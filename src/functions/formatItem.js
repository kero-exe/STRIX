function formatItem(item) {
    const lines = [`## ${item.name}`];
    if (item.rarity) lines.push(`**Rarity:** \`${item.rarity}\``);
    if (item.slot) lines.push(`**Slot:** \`${item.slot}\``);
    if (item.category === 'sellable') {
        lines.push(`**Cost:** \`${item.cost || '--'} units\``);
        return lines.join('\n');
    }
    if (item.category === 'weapon') {
        const fields = [
            ['ID', item.key], ['Weapon Type', item.type], ['Cost', item.cost ? `${item.cost} units` : '--'],
            ['Damage', item.damage], ['Fire Mode', item.firerate],
            ['Magazine', item.magazine ? `${item.magazine} rd` : '--'],
            ['Range', item.range_min || '--'],
            ['Properties', item.properties], ['Ammo', item.ammo_type]
        ];
        for (const [label, value] of fields) lines.push(`**${label}:** \`${value || '--'}\``);
    }
    if (item.description) lines.push('', item.description);
    return lines.join('\n');
}

module.exports = { formatItem };