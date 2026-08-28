const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getUser, getInventory, getItemLabel, getItemValue, sellItem, resolveItemKey } = require('../../database/db');

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

        const itemKey = interaction.options.getString('item');
        const quantity = interaction.options.getInteger('quantity') || 1;
        const resolvedItem = resolveItemKey(itemKey);

        if (!resolvedItem) {
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

        await interaction.reply({
            content: `Sell ${quantity}x ${getItemLabel(resolvedItem)} for ${unitsEarned} units?`,
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm-sell')
                    .setLabel('Yes')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel-sell')
                    .setLabel('No')
                    .setEmoji('❎')
                    .setStyle(ButtonStyle.Danger),
            )],
        });
        const confirmationMessage = await interaction.fetchReply();

        let confirmation;
        try {
            confirmation = await confirmationMessage.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: buttonInteraction => buttonInteraction.user.id === discordId,
                time: 30_000,
            });
        } catch {
            await interaction.editReply({
                content: 'Sale cancelled because the confirmation timed out.',
                components: [],
            });
            return;
        }

        if (confirmation.customId === 'cancel-sell') {
            await confirmation.update({
                content: 'Sale cancelled.',
                components: [],
            });
            return;
        }

        const result = sellItem(discordId, resolvedItem, quantity);

        await confirmation.update({
            content: `Sold ${quantity}x ${getItemLabel(resolvedItem)} for ${result.unitsEarned || unitsEarned} units. You now have **${result.user.units}** total units.`,
            components: [],
        });
    }
};
