const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const spreadsheetPath = path.join(__dirname, '../src/data/items.xlsx');
const databasePath = path.join(__dirname, '../src/data/strix.db');
const columns = [
    ['key', 'TEXT PRIMARY KEY'], ['name', 'TEXT NOT NULL'], ['type', 'TEXT'],
    ['cost', 'TEXT'], ['damage', 'TEXT'], ['damage_type', 'TEXT'],
    ['firerate', 'TEXT'], ['magazine', 'TEXT'], ['range_max', 'TEXT'],
    ['range_min', 'TEXT'], ['properties', 'TEXT'], ['ammo_type', 'TEXT'],
    ['rarity', 'TEXT'], ['slot', 'TEXT'], ['description', 'TEXT']
];
const headers = columns.map(([column]) => column);
const headerMap = {
    Key: 'key', Name: 'name', Type: 'type', Cost: 'cost', Damage: 'damage',
    'Damage Type': 'damage_type', Firerate: 'firerate', Magazine: 'magazine',
    'Range Max': 'range_max', 'Range Min': 'range_min', Properties: 'properties',
    'Ammo Type': 'ammo_type', Rarity: 'rarity', Slot: 'slot', Description: 'description'
};

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
    if (record.cost) record.cost = record.cost.replace(/\s*units?$/i, '');
    if (!record.name) throw new Error(`Row ${index + 2} (${key}) has an empty Name.`);
    return record;
});

const db = new Database(databasePath);
db.exec(`CREATE TABLE IF NOT EXISTS items (${columns.map(([name, definition]) => `${name} ${definition}`).join(', ')})`);
const insert = db.prepare(`INSERT INTO items (${headers.join(', ')}) VALUES (${headers.map(name => `@${name}`).join(', ')})
    ON CONFLICT(key) DO UPDATE SET ${headers.slice(1).map(name => `${name} = excluded.${name}`).join(', ')}`);
const importItems = db.transaction(() => rows.length && records.forEach(record => insert.run(record)));
importItems();
db.close();
console.log(`Imported ${records.length} items into ${databasePath}. Existing keys were updated.`);