const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const announce = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement embed to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Announcement body').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Target channel (defaults to current)'))
    .addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #5865F2)'))
    .addStringOption(o => o.setName('ping').setDescription('@everyone or @here or a role mention')),

  async execute(interaction) {
    const title   = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const rawColor = interaction.options.getString('color') || '#5865F2';
    const ping    = interaction.options.getString('ping') || '';

    const color = parseInt(rawColor.replace('#', ''), 16) || 0x5865f2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({ content: ping || null, embeds: [embed] });
    await interaction.reply({ content: `✅ Announcement sent to ${channel}.`, ephemeral: true });
  },
};

module.exports = { announce };
