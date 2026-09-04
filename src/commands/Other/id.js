const { SlashCommandBuilder } = require('discord.js');
const { executeAgent } = require('./agent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('id')
        .setDescription('Display the SHD identification card.')
        .addUserOption(option => option.setName('player').setDescription('Agent to view').setRequired(false)),
    async execute(interaction) {
        await executeAgent(interaction, 'id');
    }
};
