const { SlashCommandBuilder } = require('@discordjs/builders');
const { registerUser, getUser, ensureAgentProfile, updateAgentProfile } = require('../../database/db');

function findAgentRole(guild) {
    if (!guild || !guild.roles || !guild.roles.cache) return null;

    const roleId = process.env.AGENT_ROLE_ID;
    const roleName = (process.env.AGENT_ROLE_NAME || 'Agent').toLowerCase();
    return guild.roles.cache.find(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName) || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Authorize an Agent to STRIX')
        .addStringOption(option => option.setName('surname').setDescription('Fictional agent surname'))
        .addStringOption(option => option.setName('first_name').setDescription('Fictional agent first name'))
        .addStringOption(option => option.setName('sex').setDescription('Agent sex'))
        .addStringOption(option => option.setName('date_of_birth').setDescription('Date of birth'))
        .addStringOption(option => option.setName('specialty').setDescription('Occupational specialty')),
    async execute(interaction) {
        const discordId = interaction.user.id;
        const username = interaction.user.username;
        const displayName = interaction.user.globalName || interaction.user.username;

        const agentFields = {
            surname: interaction.options.getString('surname') || undefined,
            firstName: interaction.options.getString('first_name') || undefined,
            sex: interaction.options.getString('sex') || undefined,
            dateOfBirth: interaction.options.getString('date_of_birth') || undefined,
            occupationalSpecialty: interaction.options.getString('specialty') || undefined
        };

        const existing = getUser(discordId);

        if (existing) {
            ensureAgentProfile(discordId);
            updateAgentProfile(discordId, agentFields);
            await interaction.reply({
                content: `Agent ${displayName} has already been authorized. Your SHD ID is ${getUserAgentId(discordId)}.`
            });
            return;
        }

        registerUser({
            discordId,
            username,
            displayName
        });
        const agent = ensureAgentProfile(discordId, agentFields);

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
            content: `✅ Agent ${displayName} has been authorized to STRIX. SHD ID: ${agent.shd_id}. Welcome to the Division agent!`
        });
    }
};

function getUserAgentId(discordId) {
    return ensureAgentProfile(discordId).shd_id;
}
