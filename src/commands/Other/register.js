const { SlashCommandBuilder } = require('@discordjs/builders');
const { registerUser, getUser } = require('../../database/db');

function findAgentRole(guild) {
    if (!guild || !guild.roles || !guild.roles.cache) return null;

    const roleId = process.env.AGENT_ROLE_ID;
    const roleName = (process.env.AGENT_ROLE_NAME || 'Agent').toLowerCase();
    return guild.roles.cache.find(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName) || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Authorize an Agent to STRIX'),
    async execute(interaction) {
        const discordId = interaction.user.id;
        const username = interaction.user.username;
        const displayName = interaction.user.globalName || interaction.user.username;

        const existing = getUser(discordId);

        if (existing) {
            await interaction.reply({
                content: `Agent ${displayName} has already been authorized.`
            });
            return;
        }

        registerUser({
            discordId,
            username,
            displayName
        });

        const agentRole = findAgentRole(interaction.guild);
        if (!agentRole) {
            await interaction.reply({
                content: `Agent ${displayName} has been authorized, but the Agent role could not be found. Set AGENT_ROLE_ID or create an Agent role.`
            });
            return;
        }

        if (interaction.member && interaction.member.roles) {
            await interaction.member.roles.add(agentRole);
        }

        await interaction.reply({
            content: `✅ Agent ${displayName} has been authorized to STRIX. Welcome to the Division agent!`
        });
    }
};
