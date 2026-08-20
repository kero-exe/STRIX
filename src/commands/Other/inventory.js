const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getUser, getInventory, addItem, removeItem, getItemLabel, getItemValue, sellItem, transferUnits, transferItem, resolveItemKey } = require('../../database/db');

function hasDmRole(member) {
    if (!member || !member.roles || !member.roles.cache) {
        return false;
    }

    const roleId = process.env.DM_ROLE_ID;
    const roleName = (process.env.DM_ROLE_NAME || 'DM').toLowerCase();

    return member.roles.cache.some(role => {
        const matchesRoleId = Boolean(roleId) && role.id === roleId;
        const matchesRoleName = role.name.toLowerCase() === roleName;
        return matchesRoleId || matchesRoleName;
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View or manage your inventory.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current inventory')
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('View someone else\'s inventory')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check a player balance')
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('The player whose balance to check')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sell')
                .setDescription('Sell an item for units')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item key to sell')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('quantity')
                        .setDescription('How many to sell')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Give another player units or an item')
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('The player to give to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('Item key to give if gifting an item')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Units to give or quantity of the item')
                        .setMinValue(1)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add an item to a player inventory (DM only)')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item key to add')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('quantity')
                        .setDescription('How many to add')
                        .setMinValue(1)
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('The player who should receive the item')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an item from a player inventory (DM only)')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item key to remove')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('quantity')
                        .setDescription('How many to remove')
                        .setMinValue(1)
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('The player whose inventory should be adjusted')
                        .setRequired(false))),
    async execute(interaction) {
        const discordId = interaction.user.id;
        const user = getUser(discordId);

        if (!user) {
            await interaction.reply({
                content: 'You need to register before using the inventory. Use /register first.',
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const requestedPlayer = interaction.options.getUser('player');
        const targetMember = requestedPlayer || interaction.user;
        const targetDiscordId = targetMember.id;
        const targetUser = getUser(targetDiscordId);

        if ((subcommand === 'add' || subcommand === 'remove') || (subcommand === 'view' && requestedPlayer)) {
            if (!hasDmRole(interaction.member)) {
                await interaction.reply({
                    content: 'Only users with the DM role can manage another player inventory.',
                });
                return;
            }
        }

        if (subcommand === 'view' && requestedPlayer && !targetUser) {
            await interaction.reply({
                content: `${targetMember.username} is not registered yet.`,
            });
            return;
        }

        if (subcommand === 'balance') {
            const balanceUser = getUser(targetDiscordId);

            if (!balanceUser) {
                await interaction.reply({
                    content: `${targetMember.username} is not registered yet.`,
                });
                return;
            }

            await interaction.reply({
                content: `${targetMember.username} has ${balanceUser.units} units.`
            });
            return;
        }

        if (subcommand === 'give') {
            const targetUser = getUser(targetDiscordId);
            const itemKey = resolveItemKey(interaction.options.getString('item'));
            const amount = interaction.options.getInteger('amount') || 1;

            if (!targetUser) {
                await interaction.reply({
                    content: `${targetMember.username} is not registered yet.`,
                });
                return;
            }

            if (itemKey) {
                const result = transferItem(discordId, targetDiscordId, itemKey, amount);
                if (!result) {
                    await interaction.reply({
                        content: `You do not have enough ${getItemLabel(itemKey)} to give.`,
                    });
                    return;
                }

                await interaction.reply({
                    content: `Gave ${amount}x ${getItemLabel(itemKey)} to ${targetMember.username}.`,
                });
                return;
            }

            if (!amount || amount < 1) {
                await interaction.reply({
                    content: 'Specify either an item or a unit amount to give.',
                });
                return;
            }

            const transfer = transferUnits(discordId, targetDiscordId, amount);
            if (!transfer || !transfer.ok) {
                await interaction.reply({
                    content: 'You do not have enough units to give.',
                });
                return;
            }

            await interaction.reply({
                content: `Gave ${amount} units to ${targetMember.username}.`,
            });
            return;
        }

        if (subcommand === 'add') {
            const itemKey = resolveItemKey(interaction.options.getString('item'));
            const quantity = interaction.options.getInteger('quantity') || 1;

            if (!itemKey) {
                await interaction.reply({
                    content: 'That item does not exist in the item database.',
                });
                return;
            }

            if (!targetUser) {
                await interaction.reply({
                    content: `${targetMember.username} is not registered yet. Use /register before adding items to them.`,
                });
                return;
            }

            addItem(targetDiscordId, itemKey, quantity);

            await interaction.reply({
                content: `Added ${quantity}x ${getItemLabel(itemKey)} to ${targetUser.display_name || targetUser.username}'s inventory.`,
            });
            return;
        }

        if (subcommand === 'remove') {
            const itemKey = resolveItemKey(interaction.options.getString('item'));
            const quantity = interaction.options.getInteger('quantity') || 1;

            if (!itemKey) {
                await interaction.reply({
                    content: 'That item does not exist in the item database.',
                });
                return;
            }

            if (!targetUser) {
                await interaction.reply({
                    content: `${targetMember.username} is not registered yet. Use /register before removing items from them.`,
                });
                return;
            }

            removeItem(targetDiscordId, itemKey, quantity);

            await interaction.reply({
                content: `Removed ${quantity}x ${getItemLabel(itemKey)} from ${targetUser.display_name || targetUser.username}'s inventory.`,
            });
            return;
        }

        if (subcommand === 'sell') {
            const itemKey = resolveItemKey(interaction.options.getString('item'));
            const quantity = interaction.options.getInteger('quantity') || 1;

            if (!itemKey) {
                await interaction.reply({
                    content: 'That item does not exist in the item database.',
                });
                return;
            }

            const entry = getInventory(discordId).find(item => item.item_key === itemKey);

            if (!entry || entry.quantity < quantity) {
                await interaction.reply({
                    content: `You do not have enough ${getItemLabel(itemKey)} to sell.`
                });
                return;
            }

            const itemValue = getItemValue(itemKey);
            const sellRatio = Number(process.env.SELL_RATIO || '0.5');
            const unitsEarned = Math.floor(itemValue * sellRatio * quantity);

            const confirmationMessage = await interaction.reply({
                content: `Sell ${quantity}x ${getItemLabel(itemKey)} for ${unitsEarned} units?`,
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
                fetchReply: true,
            });

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

            const result = sellItem(discordId, itemKey, quantity);

            await confirmation.update({
                content: `Sold ${quantity}x ${getItemLabel(itemKey)} for ${result.unitsEarned || unitsEarned} units. You now have **${result.user.units}** total units.`,
                components: [],
            });
            return;
        }

        const inventory = getInventory(targetDiscordId);

        if (!inventory.length) {
            await interaction.reply({
                content: 'Your inventory is empty.',
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#00A8E8')
            .setTitle(`${targetUser.display_name || targetUser.username}'s Inventory`)
            .setDescription('Your registered items are listed below.')
            .addFields(
                inventory.map(item => ({
                    name: getItemLabel(item.item_key),
                    value: `Quantity: ${item.quantity}`,
                    inline: true
                }))
            );

        await interaction.reply({ embeds: [embed] });
    }
};
