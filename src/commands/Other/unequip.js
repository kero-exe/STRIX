const { SlashCommandBuilder } = require('discord.js');
const { getUser, unequipItem, getItemLabel } = require('../../database/db');

function hasDmRole(member) {
    if (!member || !member.roles || !member.roles.cache) return false;
    const roleId = process.env.DM_ROLE_ID;
    const roleName = (process.env.DM_ROLE_NAME || 'DM').toLowerCase();
    return member.roles.cache.some(role => (roleId && role.id === roleId) || role.name.toLowerCase() === roleName);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unequip')
        .setDescription('Unequip an item slot.')
        .addStringOption(option => option
            .setName('slot')
            .setDescription('The equipment slot to clear')
            .addChoices(
                { name: 'Primary', value: 'primary' },
                { name: 'Secondary', value: 'secondary' },
                { name: 'Gasmask', value: 'gasmask' })
            .setRequired(true))
        .addUserOption(option => option
            .setName('player')
            .setDescription('The player whose equipment to change (DM only)')
            .setRequired(false)),
    async execute(interaction) {
        const requestedPlayer = interaction.options.getUser('player');
        if (requestedPlayer && !hasDmRole(interaction.member)) {
            await interaction.reply({ content: 'Only users with the DM role can manage another player equipment.' });
            return;
        }

        const target = requestedPlayer || interaction.user;
        if (!getUser(target.id)) {
            await interaction.reply({ content: `${target.username} is not registered yet.` });
            return;
        }

        const result = unequipItem(target.id, interaction.options.getString('slot'));
        if (!result) {
            await interaction.reply({ content: `${target.username} has nothing equipped in that slot.` });
            return;
        }

        await interaction.reply({ content: `Unequipped ${getItemLabel(result.itemKey)} for ${target.username}.` });
    }
};