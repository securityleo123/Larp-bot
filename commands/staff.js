const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');

const ROLES = {
  MODERATOR:      '1563061887115993129',
  HEAD_MODERATOR: '1563062040065478677',
  ADMIN:          '1563062159146229780',
};

const STRIKE_LOG  = '1563071055688630383';
const ACTIVITY_LOG = '1563071102832345088';
const WARN_LOG    = '1563071204498083952';

function isAdmin(member) {
  return member.roles.cache.has(ROLES.ADMIN) || member.permissions.has(PermissionFlagsBits.Administrator);
}

// ─── /staffpromote ────────────────────────────────────────────────────────────
const staffpromote = {
  data: new SlashCommandBuilder()
    .setName('staffpromote')
    .setDescription('Promote a staff member (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isAdmin(interaction.member))
      return interaction.reply({ content: '❌ Only Admins can use this command.', ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    let newRole = null;
    let oldRole = null;

    if (target.roles.cache.has(ROLES.HEAD_MODERATOR)) {
      return interaction.reply({ content: '⚠️ This member is already a Head Moderator. Promote to Admin manually.', ephemeral: true });
    } else if (target.roles.cache.has(ROLES.MODERATOR)) {
      await target.roles.remove(ROLES.MODERATOR);
      await target.roles.add(ROLES.HEAD_MODERATOR);
      oldRole = 'Moderator';
      newRole = 'Head Moderator';
    } else {
      await target.roles.add(ROLES.MODERATOR);
      newRole = 'Moderator';
    }

    db.registerStaffForCheckin(target.id);

    const embed = new EmbedBuilder().setColor(0x00cc44).setTitle('⬆️ Staff Promotion')
      .addFields(
        { name: 'User',      value: `${target}`, inline: true },
        { name: 'New Role',  value: newRole, inline: true },
        ...(oldRole ? [{ name: 'Previous Role', value: oldRole, inline: true }] : []),
        { name: 'Promoted By', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      ).setTimestamp();

    const actCh = interaction.guild.channels.cache.get(ACTIVITY_LOG);
    actCh?.send({ embeds: [embed] });
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /staffdemote ─────────────────────────────────────────────────────────────
const staffdemote = {
  data: new SlashCommandBuilder()
    .setName('staffdemote')
    .setDescription('Demote a staff member (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    if (!isAdmin(interaction.member))
      return interaction.reply({ content: '❌ Only Admins can use this command.', ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    let removedRole = null;

    if (target.roles.cache.has(ROLES.HEAD_MODERATOR)) {
      await target.roles.remove(ROLES.HEAD_MODERATOR);
      await target.roles.add(ROLES.MODERATOR);
      removedRole = 'Head Moderator → Moderator';
    } else if (target.roles.cache.has(ROLES.MODERATOR)) {
      await target.roles.remove(ROLES.MODERATOR);
      removedRole = 'Moderator → None';
    } else {
      return interaction.reply({ content: '⚠️ This member holds no staff role.', ephemeral: true });
    }

    await target.send(`⬇️ You have been **demoted** in **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

    const embed = new EmbedBuilder().setColor(0xff4400).setTitle('⬇️ Staff Demotion')
      .addFields(
        { name: 'User',       value: `${target}`, inline: true },
        { name: 'Change',     value: removedRole, inline: true },
        { name: 'Demoted By', value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      ).setTimestamp();

    const actCh = interaction.guild.channels.cache.get(ACTIVITY_LOG);
    actCh?.send({ embeds: [embed] });
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /staffstrike ─────────────────────────────────────────────────────────────
const staffstrike = {
  data: new SlashCommandBuilder()
    .setName('staffstrike')
    .setDescription('Issue a strike to a staff member (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member))
      return interaction.reply({ content: '❌ Only Admins can use this command.', ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    const count = db.addStrike(target.id, reason, interaction.user.id);

    await target.send(`🚨 You received a **staff strike** in **${interaction.guild.name}**.\n**Reason:** ${reason}\nTotal strikes: **${count}**`).catch(() => {});

    const embed = new EmbedBuilder().setColor(0xff0000).setTitle('🚨 Staff Strike Issued')
      .addFields(
        { name: 'User',          value: `${target}`, inline: true },
        { name: 'Total Strikes', value: `${count}`, inline: true },
        { name: 'Issued By',     value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      ).setTimestamp();

    const strikeCh = interaction.guild.channels.cache.get(STRIKE_LOG);
    strikeCh?.send({ embeds: [embed] });
    await interaction.reply({ embeds: [embed] });

    // Auto-demote on 3 strikes
    if (count >= 3) {
      let demoted = false;
      if (target.roles.cache.has(ROLES.HEAD_MODERATOR)) {
        await target.roles.remove(ROLES.HEAD_MODERATOR);
        await target.roles.add(ROLES.MODERATOR);
        demoted = true;
      } else if (target.roles.cache.has(ROLES.MODERATOR)) {
        await target.roles.remove(ROLES.MODERATOR);
        demoted = true;
      }
      if (demoted) {
        db.clearStrikes(target.id);
        const demoteEmbed = new EmbedBuilder().setColor(0x8b0000)
          .setTitle('⚠️ Auto-Demotion (3 Strikes)')
          .setDescription(`${target} has been automatically demoted after receiving 3 strikes.`)
          .setTimestamp();
        strikeCh?.send({ embeds: [demoteEmbed] });
        await target.send(`⚠️ You have been **automatically demoted** in **${interaction.guild.name}** after reaching 3 strikes.`).catch(() => {});
      }
    }
  },
};

// ─── /staffwarn ───────────────────────────────────────────────────────────────
const staffwarn = {
  data: new SlashCommandBuilder()
    .setName('staffwarn')
    .setDescription('Warn a staff member (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member))
      return interaction.reply({ content: '❌ Only Admins can use this command.', ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    const count = db.addWarning(target.id, reason, interaction.user.id);

    await target.send(`⚠️ You received a **staff warning** in **${interaction.guild.name}**.\n**Reason:** ${reason}\nTotal warnings: **${count}**`).catch(() => {});

    const embed = new EmbedBuilder().setColor(0xffaa00).setTitle('⚠️ Staff Warning Issued')
      .addFields(
        { name: 'User',           value: `${target}`, inline: true },
        { name: 'Total Warnings', value: `${count}`, inline: true },
        { name: 'Issued By',      value: `${interaction.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
      ).setTimestamp();

    const warnCh = interaction.guild.channels.cache.get(WARN_LOG);
    warnCh?.send({ embeds: [embed] });
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /staffstrikes (view) ─────────────────────────────────────────────────────
const staffstrikes = {
  data: new SlashCommandBuilder()
    .setName('staffstrikes')
    .setDescription('View strikes for a staff member (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Staff member').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member))
      return interaction.reply({ content: '❌ Only Admins can use this command.', ephemeral: true });

    const target = interaction.options.getMember('user');
    const strikes = db.getStrikes(target.id);

    const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`🚨 Strikes for ${target.user.tag}`)
      .setDescription(
        strikes.length
          ? strikes.map((s, i) => `**${i + 1}.** ${s.reason} — <t:${Math.floor(s.timestamp / 1000)}:R>`).join('\n')
          : 'No strikes on record.',
      ).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

module.exports = { staffpromote, staffdemote, staffstrike, staffwarn, staffstrikes };
