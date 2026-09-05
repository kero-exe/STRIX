const path = require('path');
const XLSX = require('xlsx');

const dataDirectory = path.join(__dirname, '../src/data');
const sourcePath = path.join(dataDirectory, 'items.xlsx');
const weaponsPath = path.join(dataDirectory, 'weapons.xlsx');
const itemsPath = path.join(dataDirectory, 'items.xlsx');
const weaponHeaders = [
    'Key', 'Name', 'Weapon Type', 'Cost', 'Damage', 'Fire Mode', 'Magazine',
    'Range', 'Properties', 'Ammo', 'Rarity'
];
const itemHeaders = ['Key', 'Name', 'Cost', 'Rarity', 'Slot', 'Description'];

const workbook = XLSX.readFile(sourcePath, { cellDates: false });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
const weapons = rows.filter(row => String(row.Type || '').trim()).map(row => ({
    Key: String(row.Key).trim().toLowerCase(),
    Name: String(row.Name).trim(),
    'Weapon Type': String(row.Type).trim(),
    Cost: String(row.Cost || '').trim(),
    Damage: String(row.Damage || '').trim(),
    'Fire Mode': String(row['Fire Mode'] || row.Firerate || '').trim(),
    Magazine: String(row.Magazine || '').trim(),
    Range: String(row.Type).trim() === 'Carbine' ? 'Medium' : 'Short',
    Properties: String(row.Properties || '').trim(),
    Ammo: String(row['Ammo Type'] || '').trim(),
    Rarity: String(row.Rarity || '').trim()
}));
const items = rows.filter(row => !String(row.Type || '').trim()).map(row => ({
    Key: String(row.Key).trim().toLowerCase(),
    Name: String(row.Name).trim(),
    Cost: String(row.Cost || '').trim(),
    Rarity: String(row.Rarity || '').trim(),
    Slot: String(row.Slot || '').trim(),
    Description: String(row.Description || '').trim()
}));

if (!weapons.length) {
    throw new Error('No weapon records found in items.xlsx; refusing to overwrite weapons.xlsx.');
}

function writeWorkbook(filePath, sheetName, records, headers) {
    const output = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(output, XLSX.utils.json_to_sheet(records, { header: headers }), sheetName);
    XLSX.writeFile(output, filePath);
}

writeWorkbook(weaponsPath, 'Weapons', weapons, weaponHeaders);
writeWorkbook(itemsPath, 'Items', items, itemHeaders);
console.log(`Split ${weapons.length} weapons into weapons.xlsx and ${items.length} items into items.xlsx.`);