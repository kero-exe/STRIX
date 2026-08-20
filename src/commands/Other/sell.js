const { SlashCommandBuilder } = require('discord.js');
const { getUser, getInventory, getItemLabel, getItemValue, sellItem } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell an item from your inventory for units.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item key to sell')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('How many to sell')
                .setMinValue(1)
                .setRequired(false)),
    async execute(interaction) {
        const discordId = interaction.user.id;
        const user = getUser(discordId);

        if (!user) {
            await interaction.reply({
                content: 'You need to register before selling items. Use /register first.',
            });
            return;
        }

        const itemKey = interaction.options.getString('item').toLowerCase();
        const quantity = interaction.options.getInteger('quantity') || 1;
        const aliases = require('../../data/topics.json').aliases;
        const resolvedItem = aliases[itemKey] || itemKey;

        if (!(resolvedItem in require('../../data/topics.json').topics)) {
            await interaction.reply({
                content: 'That item does not exist in the item database.',
            });
            return;
        }

        const entry = getInventory(discordId).find(item => item.item_key === resolvedItem);
        if (!entry || entry.quantity < quantity) {
            await interaction.reply({
                content: `You do not have enough ${getItemLabel(resolvedItem)} to sell.`
            });
            return;
        }

        const itemValue = getItemValue(resolvedItem);
        const sellRatio = Number(process.env.SELL_RATIO || '0.5');
        const unitsEarned = Math.floor(itemValue * sellRatio * quantity);
        const result = sellItem(discordId, resolvedItem, quantity);

        await interaction.reply({
            content: `Sold ${quantity}x ${getItemLabel(resolvedItem)} for ${result.unitsEarned || unitsEarned} units. You now have ${result.user.units} total units.`
        });
    }
};
