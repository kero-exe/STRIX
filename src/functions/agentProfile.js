const { getUser, ensureAgentProfile, getAgentProfile } = require('../database/db');

function getAgentView(discordId, avatarUrl = null) {
    const user = getUser(discordId);
    if (!user) return null;

    const profile = getAgentProfile(discordId) || ensureAgentProfile(discordId);
    return {
        agentId: profile.agent_id,
        discordId,
        surname: profile.surname || '',
        firstName: profile.first_name || user.display_name || user.username || 'Unknown Agent',
        sex: profile.sex || 'UNSPECIFIED',
        dateOfBirth: profile.date_of_birth || 'NOT PROVIDED',
        occupationalSpecialty: profile.occupational_specialty || 'NOT ASSIGNED',
        dateOfActivation: profile.date_of_activation || user.registered_at,
        deploymentWave: profile.deployment_wave,
        shdId: profile.shd_id,
        avatarUrl: avatarUrl || profile.avatar_url || null
    };
}

module.exports = { getAgentView };
