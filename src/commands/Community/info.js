const { SlashCommandBuilder } = require('@discordjs/builders');
const { topics } = require('../../data/topics.json');
const aliases = require('../../data/aliases.json');
const { getItem, resolveItemKey } = require('../../database/db');
const { formatItem } = require('../../functions/formatItem');

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

        const itemKey = resolveItemKey(topic);
        const item = getItem(itemKey);
        if (item) {
            await interaction.reply(formatItem(item));
            return;
        }

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
