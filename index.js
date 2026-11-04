const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const cron = require('node-cron');
const db = require('./db');
const commands = require('./commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();
for (const [name, cmd] of Object.entries(commands)) {
  client.commands.set(name, cmd);
}

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  db.init();

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const cmdData = Object.values(commands).map(c => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: cmdData });
  console.log('✅ Slash commands registered');

  // Weekly moderator check-up — every Monday at 9 AM
  cron.schedule('0 9 * * 1', () => runStaffCheckup(client));
});

// ─── Message XP ───────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const result = db.addXP(message.author.id);
  if (result.leveledUp) await handleLevelUp(message.member, result.level);
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const reply = { content: '❌ An error occurred.', ephemeral: true };
      interaction.replied ? await interaction.followUp(reply) : await interaction.reply(reply);
    }
  }

  if (interaction.isButton() && interaction.customId === 'staff_checkin') {
    const success = db.recordCheckin(interaction.user.id);
    if (success) {
      await interaction.reply({ content: '✅ Check-in recorded! You\'re good for this week.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'ℹ️ You\'ve already checked in this week.', ephemeral: true });
    }
  }
});

// ─── Level Up Handler ─────────────────────────────────────────────────────────
const LEVEL_ROLES = {
  5:   '1563246961690279956',
  15:  '1563247134885806271',
  25:  '1563247265173475519',
  50:  '1563247323411128381',
  75:  '1563247444353876078',
  100: '1563248548890411080',
};

async function handleLevelUp(member, level) {
  const roleId = LEVEL_ROLES[level];
  if (roleId) {
    const role = member.guild.roles.cache.get(roleId);
    if (role) await member.roles.add(role).catch(() => {});
  }
  const embed = new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle('🎉 Level Up!')
    .setDescription(`${member} reached **Level ${level}**!${roleId ? ` You've earned a new role!` : ''}`)
    .setTimestamp();
  await member.guild.systemChannel?.send({ embeds: [embed] }).catch(() => {});
}

// ─── Weekly Staff Checkup ─────────────────────────────────────────────────────
async function runStaffCheckup(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  db.openCheckinWindow();

  const channel = guild.channels.cache.get('1563062944089251890');
  if (!channel) return;

  const button = new ButtonBuilder()
    .setCustomId('staff_checkin')
    .setLabel('✅ Check In')
    .setStyle(ButtonStyle.Success);
  const row = new ActionRowBuilder().addComponents(button);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 Weekly Staff Check-In')
    .setDescription('All staff must click the button below within **24 hours**.\n\nFailure to check in will result in a **demotion**.')
    .setTimestamp();

  await channel.send({ embeds: [embed], components: [row] });

  // After 24 hours, demote those who didn't check in
  setTimeout(async () => {
    const missed = db.getMissedCheckins();
    const STAFF_ROLES = [
      '1563061887115993129', // Moderator
      '1563062040065478677', // Head Moderator
    ];
    const activityChannel = guild.channels.cache.get('1563071102832345088');

    for (const userId of missed) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;

      let demoted = false;
      for (const roleId of STAFF_ROLES) {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => {});
          demoted = true;
          break;
        }
      }

      if (demoted && activityChannel) {
        const demoteEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⚠️ Auto-Demotion')
          .setDescription(`${member} was automatically demoted for missing the weekly check-in.`)
          .setTimestamp();
        await activityChannel.send({ embeds: [demoteEmbed] });
      }
    }

    db.closeCheckinWindow();
  }, 24 * 60 * 60 * 1000);
}

client.login(process.env.DISCORD_TOKEN);
