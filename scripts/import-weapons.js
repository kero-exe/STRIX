const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const spreadsheetPath = path.join(__dirname, '../src/data/weapons.xlsx');
const databasePath = path.join(__dirname, '../src/data/strix.db');
const columns = [
    ['key', 'TEXT PRIMARY KEY'], ['name', 'TEXT NOT NULL'], ['weapon_type', 'TEXT'],
    ['cost', 'TEXT'], ['damage', 'TEXT'], ['fire_mode', 'TEXT'], ['magazine', 'TEXT'],
    ['range', 'TEXT'], ['properties', 'TEXT'], ['ammo', 'TEXT'], ['rarity', 'TEXT']
];
const headers = columns.map(([column]) => column);
const headerMap = {
    Key: 'key', Name: 'name', 'Weapon Type': 'weapon_type', Cost: 'cost', Damage: 'damage',
    'Fire Mode': 'fire_mode', Magazine: 'magazine', Range: 'range', Properties: 'properties',
    Ammo: 'ammo', Rarity: 'rarity'
};

const workbook = XLSX.readFile(spreadsheetPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const actualHeaders = new Set(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || []);
for (const required of ['Key', 'Name', 'Weapon Type', 'Range', 'Ammo']) {
    if (!actualHeaders.has(required)) throw new Error(`Missing required column: ${required}`);
}

const seen = new Set();
const records = rows.map((row, index) => {
    const key = String(row.Key || '').trim().toLowerCase();
    if (!key) throw new Error(`Row ${index + 2} has an empty Key.`);
    if (seen.has(key)) throw new Error(`Duplicate weapon key "${key}" at row ${index + 2}.`);
    seen.add(key);
    const record = {};
    for (const [label, column] of Object.entries(headerMap)) record[column] = String(row[label] ?? '').trim() || null;
    record.key = key;
    if (!record.name) throw new Error(`Row ${index + 2} (${key}) has an empty Name.`);
    return record;
});

const db = new Database(databasePath);
db.exec(`CREATE TABLE IF NOT EXISTS weapons (${columns.map(([name, definition]) => `${name} ${definition}`).join(', ')})`);
const insert = db.prepare(`INSERT INTO weapons (${headers.join(', ')}) VALUES (${headers.map(name => `@${name}`).join(', ')})
    ON CONFLICT(key) DO UPDATE SET ${headers.slice(1).map(name => `${name} = excluded.${name}`).join(', ')}`);
db.transaction(() => records.forEach(record => insert.run(record)))();
db.close();
console.log(`Imported ${records.length} weapons into ${databasePath}.`);