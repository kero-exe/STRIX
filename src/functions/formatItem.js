function formatItem(item) {
    const lines = [`## ${item.name}`];
    if (item.rarity) lines.push(`**Rarity:** \`${item.rarity}\``);
    if (item.slot) lines.push(`**Slot:** \`${item.slot}\``);
    if (item.category === 'sellable') {
        lines.push(`**Cost:** \`${item.cost || '--'} units\``);
        return lines.join('\n');
    }
    if (item.type) {
        const fields = [
            ['Type', item.type], ['Cost', item.cost ? `${item.cost} units` : '--'],
            ['Damage', item.damage], ['Damage Type', item.damage_type], ['Firerate', item.firerate],
            ['Magazine', item.magazine ? `${item.magazine} rd` : '--'],
            ['Range', item.range_max || item.range_min ? `${item.range_max || '--'} Max, ${item.range_min || '--'} Min` : '--'],
            ['Properties', item.properties], ['Ammo Type', item.ammo_type]
        ];
        for (const [label, value] of fields) lines.push(`**${label}:** \`${value || '--'}\``);
    }
    if (item.description) lines.push('', item.description);
    return lines.join('\n');
}

module.exports = { formatItem };