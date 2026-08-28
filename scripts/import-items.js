const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const spreadsheetPath = path.join(__dirname, '../src/data/items.xlsx');
const databasePath = path.join(__dirname, '../src/data/strix.db');
const columns = [
    ['key', 'TEXT PRIMARY KEY'], ['name', 'TEXT NOT NULL'], ['type', 'TEXT'],
    ['cost', 'TEXT'], ['damage', 'TEXT'], ['damage_type', 'TEXT'],
    ['firerate', 'TEXT'], ['fire_mode', 'TEXT'], ['magazine', 'TEXT'], ['range_max', 'TEXT'],
    ['range_min', 'TEXT'], ['properties', 'TEXT'], ['ammo_type', 'TEXT'],
    ['rarity', 'TEXT'], ['slot', 'TEXT'], ['description', 'TEXT']
];
const headers = columns.map(([column]) => column);
const headerMap = {
    Key: 'key', Name: 'name', Type: 'type', Cost: 'cost', Damage: 'damage',
    'Damage Type': 'damage_type', Firerate: 'firerate', 'Fire Mode': 'fire_mode', Magazine: 'magazine',
    'Range Max': 'range_max', 'Range Min': 'range_min', Properties: 'properties',
    'Ammo Type': 'ammo_type', Rarity: 'rarity', Slot: 'slot', Description: 'description'
};
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

const workbook = XLSX.readFile(spreadsheetPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const actualHeaders = new Set(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || []);
for (const required of ['Key', 'Name']) {
    if (!actualHeaders.has(required)) throw new Error(`Missing required column: ${required}`);
}

const seen = new Set();
const records = rows.map((row, index) => {
    const key = String(row.Key || '').trim().toLowerCase();
    if (!key) throw new Error(`Row ${index + 2} has an empty Key.`);
    if (seen.has(key)) throw new Error(`Duplicate item key "${key}" at row ${index + 2}.`);
    seen.add(key);
    const record = {};
    for (const [label, column] of Object.entries(headerMap)) record[column] = String(row[label] ?? '').trim() || null;
    record.key = key;
    if (record.ammo_type) record.ammo_type = normalizeAmmunition(record.ammo_type);
    if (record.cost) record.cost = record.cost.replace(/\s*units?$/i, '');
    if (!record.name) throw new Error(`Row ${index + 2} (${key}) has an empty Name.`);
    return record;
});

const db = new Database(databasePath);
db.exec(`CREATE TABLE IF NOT EXISTS items (${columns.map(([name, definition]) => `${name} ${definition}`).join(', ')})`);
db.exec(`CREATE TABLE IF NOT EXISTS weapons (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    weapon_type TEXT,
    cost TEXT,
    damage TEXT,
    fire_mode TEXT,
    magazine TEXT,
    range TEXT,
    properties TEXT,
    ammo TEXT,
    rarity TEXT
)`);
const insert = db.prepare(`INSERT INTO items (${headers.join(', ')}) VALUES (${headers.map(name => `@${name}`).join(', ')})
    ON CONFLICT(key) DO UPDATE SET ${headers.slice(1).map(name => `${name} = excluded.${name}`).join(', ')}`);
const importItems = db.transaction(() => rows.length && records.forEach(record => insert.run(record)));
importItems();
db.exec('PRAGMA foreign_keys = OFF');
db.exec('DELETE FROM equipment WHERE item_key NOT IN (SELECT key FROM items) AND item_key NOT IN (SELECT key FROM weapons)');
db.prepare('DELETE FROM items WHERE key NOT IN (' + records.map(() => '?').join(',') + ')').run(...records.map(record => record.key));
db.exec('PRAGMA foreign_keys = ON');
db.close();
console.log(`Imported ${records.length} items into ${databasePath}. Existing keys were updated.`);