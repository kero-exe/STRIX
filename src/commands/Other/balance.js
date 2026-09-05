const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check an Agent\'s balance.')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('The Agent whose balance to check')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('player') || interaction.user;
        const user = getUser(targetUser.id);

        if (!user) {
            await interaction.reply({
                content: `Agent ${targetUser.username} is not authorized yet.`,
            });
            return;
        }

        await interaction.reply({
            content: `Agent ${targetUser.username} has ${user.units} units.`
        });
    }
};
