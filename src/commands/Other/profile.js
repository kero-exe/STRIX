const { SlashCommandBuilder } = require('discord.js');
const { executeAgent } = require('./agent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View an Agent profile.')
        .addUserOption(option => option
            .setName('player')
            .setDescription('The Agent whose profile to view')
            .setRequired(false)),
    async execute(interaction) {
        await executeAgent(interaction, 'profile');
    }
};