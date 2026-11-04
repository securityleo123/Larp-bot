const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── /cat ─────────────────────────────────────────────────────────────────────
const cat = {
  data: new SlashCommandBuilder().setName('cat').setDescription('Get a random cat picture 🐱'),
  async execute(interaction) {
    await interaction.deferReply();
    const res  = await fetch('https://api.thecatapi.com/v1/images/search');
    const [data] = await res.json();
    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle('🐱 Here\'s a cat!')
      .setImage(data.url)
      .setFooter({ text: 'Powered by thecatapi.com' });
    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /dog ─────────────────────────────────────────────────────────────────────
const dog = {
  data: new SlashCommandBuilder().setName('dog').setDescription('Get a random dog picture 🐶'),
  async execute(interaction) {
    await interaction.deferReply();
    const res  = await fetch('https://dog.ceo/api/breeds/image/random');
    const data = await res.json();
    const embed = new EmbedBuilder()
      .setColor(0xa0522d)
      .setTitle('🐶 Here\'s a dog!')
      .setImage(data.message)
      .setFooter({ text: 'Powered by dog.ceo' });
    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /8ball ───────────────────────────────────────────────────────────────────
const RESPONSES = [
  // Positive
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely!',
  'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Yes.', 'Signs point to yes.',
  // Neutral
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
  'Cannot predict now.', 'Concentrate and ask again.',
  // Negative
  "Don't count on it.", 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

const eightball = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the Magic 8-Ball a question 🎱')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('🎱 Magic 8-Ball')
      .addFields(
        { name: '❓ Question', value: question },
        { name: '🎱 Answer',   value: response },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

module.exports = { cat, dog, '8ball': eightball };
