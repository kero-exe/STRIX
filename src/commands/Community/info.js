const { SlashCommandBuilder } = require('@discordjs/builders');
const { topics, aliases } = require('../../data/topics.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get information about a topic')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The topic you want information about')
                .setRequired(true)),
    async execute(interaction) {
        let topic = interaction.options.getString('topic').toLowerCase();

        if (aliases[topic]) {
            topic = aliases[topic];
        }

        if (topic in topics) {
            await interaction.reply(topics[topic]);
        } else {
            await interaction.reply('Information not available for the specified topic (yet)');
        }
    },
};
