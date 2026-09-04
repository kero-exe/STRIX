const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getUser, getEquipment, getItemLabel } = require('../../database/db');
const { getAgentView } = require('../../functions/agentProfile');
const { renderAgentCard } = require('../../functions/renderAgentCard');

function hasCoordinatorRole(member) {
    if (!member || !member.roles || !member.roles.cache) return false;
    const roleId = process.env.COORDINATOR_ROLE_ID;
    const roleName = (process.env.COORDINATOR_ROLE_NAME || 'Coordinator').toLowerCase();
    return member.roles.cache.some(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName);
}

function formatEquipment(equipment) {
    const formatItem = entry => entry ? `${getItemLabel(entry.item_key)} (${entry.quantity}x)` : '--';
    return [
        `Primary: ${formatItem(equipment.primary)}`,
        `Secondary: ${formatItem(equipment.secondary)}`,
        `Gasmask: ${equipment.gasmask ? `${formatItem(equipment.gasmask)} (${equipment.gasmaskFilter}% filter)` : '--'}`,
        `Ammunition: ${equipment.ammunition.length ? equipment.ammunition.map(ammo => `${ammo.name} (${ammo.quantity})`).join(', ') : '--'}`
    ].join('\n');
}

function getTarget(interaction) {
    return interaction.options.getUser('player') || interaction.user;
}

async function executeAgent(interaction, mode = interaction.options.getSubcommand?.() || 'profile') {
    const requestedPlayer = interaction.options.getUser('player');
    if (requestedPlayer && !hasCoordinatorRole(interaction.member)) {
        await interaction.reply({ content: 'Only users with the Coordinator role can view another player profile.' });
        return;
    }

    const target = getTarget(interaction);
    const user = getUser(target.id);
    if (!user) {
        await interaction.reply({ content: hasCoordinatorRole(interaction.member) ? `Agent ${target.username} is not authorized yet.` : `No data found for ${target.username}. Try \`/register\` to activate your agent profile.` });
        return;
    }

    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 512 });
    const agent = getAgentView(target.id, avatarUrl);
    if (mode === 'id') {
        try {
            const card = await renderAgentCard(agent);
            await interaction.reply({ files: [new AttachmentBuilder(card, { name: `${agent.shdId}.png` })] });
        } catch (error) {
            await interaction.reply({ content: `The ID card could not be rendered: ${error.message}` });
        }
        return;
    }

    const activationDate = Math.floor(new Date(`${user.registered_at} UTC`).getTime() / 1000);
    const embed = new EmbedBuilder()
        .setColor('#00A8E8')
        .setTitle(`Agent ${agent.firstName}${agent.surname ? ` ${agent.surname}` : ''}`)
        .setDescription(`**SHD ID:** ${agent.shdId}\n**Activation Date:** ${Number.isFinite(activationDate) ? `<t:${activationDate}:D>` : user.registered_at}`)
        .addFields({ name: 'HP', value: `${Array(10).fill('🟩').join(' ')}\n***10/10***`, inline: true }, { name: 'Balance', value: `${user.units} units`, inline: true }, { name: 'Equipment', value: formatEquipment(getEquipment(target.id)), inline: false });
    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('agent')
        .setDescription('View an SHD Agent record.')
        .addSubcommand(subcommand => subcommand.setName('id').setDescription('Display the SHD identification card.').addUserOption(option => option.setName('player').setDescription('Agent to view').setRequired(false)))
        .addSubcommand(subcommand => subcommand.setName('profile').setDescription('Display the Agent profile.').addUserOption(option => option.setName('player').setDescription('Agent to view').setRequired(false))),
    execute: executeAgent,
    executeAgent
};
