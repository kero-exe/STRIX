const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activity')
        .setDescription('Post a button to launch the STRIX Activity'),
    async execute(interaction) {
        const clientId = process.env.DISCORD_CLIENT_ID;

        if (!clientId) {
            await interaction.reply({
                content: 'DISCORD_CLIENT_ID is not configured for the STRIX Activity.',
                ephemeral: true
            });
            return;
        }

        const launchUrl = process.env.DISCORD_ACTIVITY_LAUNCH_URL || `https://discord.com/activities/${clientId}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Start STRIX Activity')
                .setStyle(ButtonStyle.Link)
                .setURL(launchUrl)
        );

        await interaction.reply({
            content: 'Join a voice channel, then start the STRIX Activity:',
            components: [row]
        });
    }
};
