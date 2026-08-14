const { SlashCommandBuilder } = require('@discordjs/builders');
const { registerUser, getUser } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register your Discord account to the inventory database.'),
    async execute(interaction) {
        const discordId = interaction.user.id;
        const username = interaction.user.username;
        const displayName = interaction.user.globalName || interaction.user.username;

        const existing = getUser(discordId);

        if (existing) {
            await interaction.reply({
                content: `You are already registered, ${displayName}. Your Discord ID is saved in the database.`
            });
            return;
        }

        registerUser({
            discordId,
            username,
            displayName
        });

        await interaction.reply({
            content: `✅ Registered successfully for ${displayName} (${discordId}). Your starter inventory is ready.`
        });
    }
};
