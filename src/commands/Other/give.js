const { SlashCommandBuilder } = require('discord.js');
const { getUser, transferUnits, transferItem, transferAmmunition, getItemLabel, getAmmunitionLabel, resolveItemKey } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give units or an item to another player.')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('The player to give to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item key to give, if giving an item')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('ammunition')
                .setDescription('Ammunition type to give, such as 9mm or .45 ACP')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Units to give, or quantity of the item')
                .setMinValue(1)
                .setRequired(false)),
    async execute(interaction) {
        const senderId = interaction.user.id;
        const sender = getUser(senderId);

        if (!sender) {
            await interaction.reply({
                content: 'You need to register before giving items or units. Use /register first.',
            });
            return;
        }

        const targetUser = interaction.options.getUser('player');
        const target = getUser(targetUser.id);

        if (!target) {
            await interaction.reply({
                content: `${targetUser.username} is not registered yet.`,
            });
            return;
        }

        const itemKey = interaction.options.getString('item');
        const ammunition = interaction.options.getString('ammunition');
        const amount = interaction.options.getInteger('amount') || 1;

        if (itemKey && ammunition) {
            await interaction.reply({ content: 'Specify either an item or ammunition, not both.' });
            return;
        }

        if (ammunition) {
            const result = transferAmmunition(senderId, targetUser.id, ammunition, amount);
            if (!result) {
                await interaction.reply({ content: `You do not have enough ${getAmmunitionLabel(`ammo:${ammunition}`)} to give.` });
                return;
            }
            await interaction.reply({ content: `Gave ${amount}x ${getAmmunitionLabel(`ammo:${ammunition}`)} to ${targetUser.username}.` });
            return;
        }

        if (itemKey) {
            const resolvedItem = resolveItemKey(itemKey);

            if (!resolvedItem) {
                await interaction.reply({
                    content: 'That item does not exist in the item database.',
                });
                return;
            }

            const result = transferItem(senderId, targetUser.id, resolvedItem, amount);

            if (!result) {
                await interaction.reply({
                    content: `You do not have enough ${getItemLabel(resolvedItem)} to give.`,
                });
                return;
            }

            await interaction.reply({
                content: `Gave ${amount}x ${getItemLabel(resolvedItem)} to ${targetUser.username}.`,
            });
            return;
        }

        const units = interaction.options.getInteger('amount') || 1;
        const transfer = transferUnits(senderId, targetUser.id, units);

        if (!transfer || !transfer.ok) {
            await interaction.reply({
                content: `You do not have enough units to give.`,
            });
            return;
        }

        await interaction.reply({
            content: `Gave ${units} units to ${targetUser.username}.`,
        });
    }
};
