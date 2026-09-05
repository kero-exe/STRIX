const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dataDirectory = path.join(__dirname, '../src/data');
const topicsPath = path.join(dataDirectory, 'topics.json');
const source = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const aliasesPath = path.join(dataDirectory, 'aliases.json');
const aliases = source.aliases || (fs.existsSync(aliasesPath) ? JSON.parse(fs.readFileSync(aliasesPath, 'utf8')) : {});
const itemColumns = ['Key', 'Name', 'Cost', 'Rarity', 'Slot', 'Description'];
const weaponColumns = [
    'Key', 'Name', 'Weapon Type', 'Cost', 'Damage', 'Fire Mode', 'Magazine',
    'Range', 'Properties', 'Ammo', 'Rarity'
];
const ammunitionAliases = {
    '9mm': '9mm', '.45 acp': '45ACP', '45 acp': '45ACP', '45acp': '45ACP',
    '.32 acp': '32ACP', '32 acp': '32ACP', '32acp': '32ACP',
    '.357 mag': '44Mag', '357 mag': '44Mag', '.50 ae': '44Mag', '50 ae': '44Mag', '44mag': '44Mag',
    '5.7x28mm': '5.7mm', '5.7x28': '5.7mm', '5.7mm': '5.7mm',
    '.300 blk': '300BLK', '300 blk': '300BLK', '300blk': '300BLK',
    '5.45x39mm': '5.45mm', '5.45x39': '5.45mm', '5.45mm': '5.45mm',
    '5.56x45mm': '5.56mm', '5.56x45': '5.56mm', '5.56mm': '5.56mm',
    '.40 s&w': '40S&W', '40 s&w': '40S&W', '40s&w': '40S&W',
    '.22 lr': '22LR', '22 lr': '22LR', '22lr': '22LR',
    '.22 wmr': '22WMR', '22 wmr': '22WMR', '22wmr': '22WMR',
    '--': 'Special', 'special': 'Special'
};

function normalizeAmmunition(value) {
    if (!value || value.trim() === '--') return 'Special';
    return value.split(',').map(type => ammunitionAliases[type.trim().toLowerCase()] || 'Special').join(', ');
}

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
        'Fire Mode': fields['Fire Mode'] || fields.Firerate || '',
        Magazine: (fields.Magazine || '').replace(/\s*rd$/i, ''),
        Range: fields.Range && /Medium/i.test(fields.Range) ? 'Medium' : 'Short',
        Properties: fields.Properties || '',
        Ammo: normalizeAmmunition(fields.Ammo || fields['Ammo Type'] || ''),
        Rarity: fields.Rarity || '',
        Slot: fields.Slot || '',
        Description: description
    };
}

const items = [];
const weapons = [];
const topics = {};
for (const [key, value] of Object.entries(source.topics)) {
    if (/\*\*(Type|Rarity):\*\*/.test(value)) {
        const item = parseItem(key, value);
        if (item.Type) {
            weapons.push({
                Key: item.Key, Name: item.Name, 'Weapon Type': item.Type, Cost: item.Cost,
                Damage: item.Damage, 'Fire Mode': item['Fire Mode'], Magazine: item.Magazine,
                Range: item.Range, Properties: item.Properties, Ammo: item.Ammo, Rarity: item.Rarity
            });
        } else {
            items.push({ Key: item.Key, Name: item.Name, Cost: item.Cost, Rarity: item.Rarity, Slot: item.Slot, Description: item.Description });
        }
    }
    else topics[key] = value;
}

if (!items.length && !weapons.length) {
    throw new Error('No item records found. The source may already be migrated; refusing to overwrite items.xlsx.');
}

function writeWorkbook(fileName, sheetName, records, headers) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records, { header: headers }), sheetName);
    XLSX.writeFile(workbook, path.join(dataDirectory, fileName));
}

writeWorkbook('items.xlsx', 'Items', items, itemColumns);
writeWorkbook('weapons.xlsx', 'Weapons', weapons, weaponColumns);
fs.writeFileSync(aliasesPath, `${JSON.stringify(aliases, null, 4)}\n`);
fs.writeFileSync(topicsPath, `${JSON.stringify({ topics }, null, 4)}\n`);
console.log(`Migrated ${items.length} items, ${Object.keys(aliases).length} aliases, and ${Object.keys(topics).length} topics.`);