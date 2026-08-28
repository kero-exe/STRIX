const { SlashCommandBuilder } = require('discord.js');
const { getUser, getItem, getItemLabel, equipItem, resolveItemKey } = require('../../database/db');

function hasCoordinatorRole(member) {
    if (!member || !member.roles || !member.roles.cache) return false;
    const roleId = process.env.COORDINATOR_ROLE_ID;
    const roleName = (process.env.COORDINATOR_ROLE_NAME || 'Coordinator').toLowerCase();
    return member.roles.cache.some(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equip')
        .setDescription('Equip an item you own.')
        .addStringOption(option => option
            .setName('item')
            .setDescription('The item key or alias to equip')
            .setRequired(true))
        .addUserOption(option => option
            .setName('player')
            .setDescription('The Agent whose equipment to change.')
            .setRequired(false)),
    async execute(interaction) {
        const requestedPlayer = interaction.options.getUser('player');
        if (requestedPlayer && !hasCoordinatorRole(interaction.member)) {
            await interaction.reply({ content: 'Only users with the Coordinator role can manage another player equipment.' });
            return;
        }

        const target = requestedPlayer || interaction.user;
        if (!getUser(target.id)) {
            await interaction.reply({ content: `${target.username} is not registered yet.` });
            return;
        }

        const itemKey = resolveItemKey(interaction.options.getString('item'));
        const item = itemKey ? getItem(itemKey) : null;
        if (!item) {
            await interaction.reply({ content: 'That item does not exist in the item database.' });
            return;
        }

        const result = equipItem(target.id, itemKey);
        if (!result) {
            await interaction.reply({ content: `${target.username} does not own ${getItemLabel(itemKey)}.` });
            return;
        }

        await interaction.reply({ content: `Equipped ${getItemLabel(itemKey)} for ${target.username}.` });
    }
};