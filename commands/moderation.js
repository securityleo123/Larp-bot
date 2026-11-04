const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { MOD_LOG } = require('../config');

function modLog(guild, embed) {
  const ch = guild.channels.cache.get(MOD_LOG);
  ch?.send({ embeds: [embed] });
}

// ─── BAN ──────────────────────────────────────────────────────────────────────
const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .addIntegerOption(o => o.setName('days').setDescription('Delete message days (0-7)').setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days   = interaction.options.getInteger('days') || 0;
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await target.send(`You have been **banned** from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.ban({ deleteMessageDays: days, reason });

    const embed = new EmbedBuilder().setColor(0xff0000).setTitle('🔨 Member Banned')
      .addFields({ name: 'User', value: `${target.user.tag}`, inline: true },
                 { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                 { name: 'Reason', value: reason })
      .setTimestamp();
    modLog(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── KICK ─────────────────────────────────────────────────────────────────────
const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await target.send(`You have been **kicked** from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await target.kick(reason);

    const embed = new EmbedBuilder().setColor(0xff6600).setTitle('👢 Member Kicked')
      .addFields({ name: 'User', value: `${target.user.tag}`, inline: true },
                 { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                 { name: 'Reason', value: reason })
      .setTimestamp();
    modLog(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── SOFTBAN ──────────────────────────────────────────────────────────────────
const softban = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then immediately unban to clear messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await target.send(`You have been **softbanned** from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    await interaction.guild.members.ban(target.id, { deleteMessageDays: 7, reason });
    await interaction.guild.members.unban(target.id, 'Softban');

    const embed = new EmbedBuilder().setColor(0xff9900).setTitle('🔄 Member Softbanned')
      .addFields({ name: 'User', value: `${target.user.tag}`, inline: true },
                 { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                 { name: 'Reason', value: reason })
      .setTimestamp();
    modLog(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── MUTE (Timeout) ───────────────────────────────────────────────────────────
const mute = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const mins   = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await target.timeout(mins * 60 * 1000, reason);

    const embed = new EmbedBuilder().setColor(0xffcc00).setTitle('🔇 Member Muted')
      .addFields({ name: 'User', value: `${target.user.tag}`, inline: true },
                 { name: 'Duration', value: `${mins} minute(s)`, inline: true },
                 { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                 { name: 'Reason', value: reason })
      .setTimestamp();
    modLog(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── UNMUTE ───────────────────────────────────────────────────────────────────
const unmute = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    await target.timeout(null);
    await interaction.reply({ content: `✅ Removed timeout from ${target}.`, ephemeral: true });
  },
};

// ─── WARN ─────────────────────────────────────────────────────────────────────
const warn = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    const { addWarning } = require('../db');
    const count = addWarning(target.id, reason, interaction.user.id);

    await target.send(`⚠️ You have been **warned** in **${interaction.guild.name}**.\n**Reason:** ${reason}\nTotal warnings: **${count}**`).catch(() => {});

    const embed = new EmbedBuilder().setColor(0xffff00).setTitle('⚠️ Member Warned')
      .addFields({ name: 'User', value: `${target.user.tag}`, inline: true },
                 { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                 { name: 'Total Warnings', value: `${count}`, inline: true },
                 { name: 'Reason', value: reason })
      .setTimestamp();
    modLog(interaction.guild, embed);

    const warnLog = interaction.guild.channels.cache.get('1563071204498083952');
    warnLog?.send({ embeds: [embed] });

    await interaction.reply({ embeds: [embed] });
  },
};

// ─── LOCK ─────────────────────────────────────────────────────────────────────
const lock = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel so members cannot send messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)'))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason  = interaction.options.getString('reason') || 'No reason provided';

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

    const embed = new EmbedBuilder().setColor(0xff0000).setTitle('🔒 Channel Locked')
      .setDescription(`${channel} has been locked.\n**Reason:** ${reason}`)
      .setTimestamp();
    modLog(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── UNLOCK ───────────────────────────────────────────────────────────────────
const unlock = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply({ content: `🔓 ${channel} has been unlocked.` });
  },
};

// ─── PURGE ────────────────────────────────────────────────────────────────────
const purge = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete bulk messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete from this user')),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user   = interaction.options.getUser('user');

    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    messages = [...messages.values()].slice(0, amount);

    await interaction.channel.bulkDelete(messages, true);
    await interaction.reply({ content: `🗑️ Deleted **${messages.length}** messages.`, ephemeral: true });
  },
};

// ─── UNBAN ────────────────────────────────────────────────────────────────────
const unban = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await interaction.guild.members.unban(userId, reason).catch(() => {});
    await interaction.reply({ content: `✅ Unbanned user \`${userId}\`.`, ephemeral: true });
  },
};

module.exports = { ban, kick, softban, mute, unmute, warn, lock, unlock, purge, unban };
