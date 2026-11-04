const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

// ─── /rank ────────────────────────────────────────────────────────────────────
const rank = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your level and XP')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')),
  async execute(interaction) {
    const target = interaction.options.getMember('user') || interaction.member;
    const data   = db.getLevel(target.id);

    // Calculate XP needed for next level
    const LEVEL_THRESHOLDS = [0];
    for (let i = 1; i <= 100; i++) LEVEL_THRESHOLDS[i] = LEVEL_THRESHOLDS[i - 1] + 100 + (i - 1) * 50;

    const currentXP  = data.xp;
    const level      = data.level;
    const currentLvlXP = LEVEL_THRESHOLDS[level];
    const nextLvlXP    = level < 100 ? LEVEL_THRESHOLDS[level + 1] : currentXP;
    const progress     = currentXP - currentLvlXP;
    const needed       = nextLvlXP - currentLvlXP;
    const bar          = buildBar(progress, needed);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${target.displayName}'s Rank`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: 'Level', value: `**${level}**`, inline: true },
        { name: 'XP',    value: `**${currentXP}**`, inline: true },
        { name: 'Progress', value: `${bar}\n${progress} / ${needed} XP to level ${level + 1}` },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

function buildBar(value, max, length = 20) {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, length - filled));
}

// ─── /leaderboard ─────────────────────────────────────────────────────────────
const leaderboard = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top 10 most active members'),
  async execute(interaction) {
    const rows = db.getLeaderboard(10);
    const lines = rows.map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      return `${medal} <@${r.user_id}> — Level **${r.level}** (${r.xp} XP)`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle('🏆 XP Leaderboard')
      .setDescription(lines.join('\n') || 'No data yet.')
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

module.exports = { rank, leaderboard };
