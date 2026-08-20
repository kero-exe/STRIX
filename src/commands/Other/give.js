const { SlashCommandBuilder } = require('discord.js');
const { getUser, transferUnits, transferItem, getItemLabel, resolveItemKey } = require('../../database/db');

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
        const amount = interaction.options.getInteger('amount') || 1;

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
