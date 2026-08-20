const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dataDirectory = path.join(__dirname, '../src/data');
const topicsPath = path.join(dataDirectory, 'topics.json');
const source = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const aliasesPath = path.join(dataDirectory, 'aliases.json');
const aliases = source.aliases || (fs.existsSync(aliasesPath) ? JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) : {});
const itemColumns = [
    'Key', 'Name', 'Type', 'Cost', 'Damage', 'Damage Type', 'Firerate',
    'Magazine', 'Range Max', 'Range Min', 'Properties', 'Ammo Type',
    'Rarity', 'Slot', 'Description'
];

function parseItem(key, markdown) {
    const fields = {};
    for (const line of markdown.split('\n')) {
        const match = line.match(/^\*\*([^:]+):\*\*\s*`?([^`]*)`?\s*$/);
        if (match) fields[match[1].trim()] = match[2].trim();
    }

    const nameMatch = markdown.match(/^##\s*(.+)$/m);
    const description = markdown.split('\n')
        .filter(line => line.trim() && !line.startsWith('## ') && !/^\*\*[^:]+:\*\*/.test(line))
        .join('\n')
        .trim();

    return {
        Key: key,
        Name: nameMatch ? nameMatch[1].trim() : key.replace(/_/g, ' '),
        Type: fields.Type || '',
        Cost: (fields.Cost || '').replace(/\s*units?$/i, ''),
        Damage: fields.Damage || '',
        'Damage Type': fields['Damage Type'] || '',
        Firerate: fields.Firerate || '',
        Magazine: (fields.Magazine || '').replace(/\s*rd$/i, ''),
        'Range Max': (fields.Range || '').split(/\s+Max,\s+/i)[0] || '',
        'Range Min': ((fields.Range || '').split(/\s+Max,\s+/i)[1] || '').replace(/\s+Min$/i, ''),
        Properties: fields.Properties || '',
        'Ammo Type': fields['Ammo Type'] || '',
        Rarity: fields.Rarity || '',
        Slot: fields.Slot || '',
        Description: description
    };
}

const items = [];
const topics = {};
for (const [key, value] of Object.entries(source.topics)) {
    if (/\*\*(Type|Rarity):\*\*/.test(value)) items.push(parseItem(key, value));
    else topics[key] = value;
}

if (!items.length) {
    throw new Error('No item records found. The source may already be migrated; refusing to overwrite items.xlsx.');
}

const worksheet = XLSX.utils.json_to_sheet(items, { header: itemColumns });
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
XLSX.writeFile(workbook, path.join(dataDirectory, 'items.xlsx'));
fs.writeFileSync(aliasesPath, `${JSON.stringify(aliases, null, 4)}\n`);
fs.writeFileSync(topicsPath, `${JSON.stringify({ topics }, null, 4)}\n`);
console.log(`Migrated ${items.length} items, ${Object.keys(aliases).length} aliases, and ${Object.keys(topics).length} topics.`);