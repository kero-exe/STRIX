const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getEquipment, getItemLabel } = require('../../database/db');

function hasCoordinatorRole(member) {
    if (!member || !member.roles || !member.roles.cache) return false;

    const roleId = process.env.COORDINATOR_ROLE_ID;
    const roleName = (process.env.COORDINATOR_ROLE_NAME || 'Coordinator').toLowerCase();
    return member.roles.cache.some(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName);
}

function formatEquipment(equipment) {
    const formatItem = entry => entry
        ? `${getItemLabel(entry.item_key)} (${entry.quantity}x)`
        : '--';

    return [
        `Primary: ${formatItem(equipment.primary)}`,
        `Secondary: ${formatItem(equipment.secondary)}`,
        `Gasmask: ${equipment.gasmask ? `${formatItem(equipment.gasmask)} (${equipment.gasmaskFilter}% filter)` : '--'}`,
        `Ammunition: ${equipment.ammunition.length
            ? equipment.ammunition.map(ammo => `${ammo.name} (${ammo.quantity})`).join(', ')
            : '--'}`
    ].join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View an Agent profile.')
        .addUserOption(option => option
            .setName('player')
            .setDescription('The Agent whose profile to view')
            .setRequired(false)),
    async execute(interaction) {
        const requestedPlayer = interaction.options.getUser('player');
        if (requestedPlayer && !hasCoordinatorRole(interaction.member)) {
            await interaction.reply({ content: 'Only users with the Coordinator role can view another player profile.' });
            return;
        }

        const target = requestedPlayer || interaction.user;
        const user = getUser(target.id);
        if (!user) {
            if (!hasCoordinatorRole(interaction.member)) {
                await interaction.reply({ content: `No data found for ${target.username}. Try \`/register\` to activate your agent profile.` });
                return;
            }

            await interaction.reply({ content: `Agent ${target.username} is not authorized yet.` });
            return;
        }

        const equipment = getEquipment(target.id);
        const activationDate = Math.floor(new Date(`${user.registered_at} UTC`).getTime() / 1000);
        const agentName = user.display_name || user.username || target.username;

        const embed = new EmbedBuilder()
            .setColor('#00A8E8')
            .setTitle(`Agent ${agentName}`)
            .setDescription(`**Activation Date:** ${Number.isFinite(activationDate) ? `<t:${activationDate}:D>` : user.registered_at}`)
            .addFields({
                name: 'HP',
                value: `${Array(10).fill('🟩').join(' ')}\n***10/10***`,
                inline: true
            }, {
                name: 'Balance',
                value: `${user.units} units`,
                inline: true
            }, {
                name: 'Equipment',
                value: formatEquipment(equipment),
                inline: false
            });

        await interaction.reply({ embeds: [embed] });
    }
};