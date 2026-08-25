const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const spreadsheetPath = path.join(__dirname, '../src/data/sellables.xlsx');
const databasePath = path.join(__dirname, '../src/data/strix.db');
const requiredHeaders = ['Key', 'Name', 'Cost', 'Rarity'];
const workbook = XLSX.readFile(spreadsheetPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || [];
for (const header of requiredHeaders) {
    if (!headerRow.includes(header)) throw new Error(`Missing required column: ${header}`);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const seen = new Set();
const records = rows.map((row, index) => {
    const key = String(row.Key || '').trim().toLowerCase();
    const name = String(row.Name || '').trim();
    if (!key) throw new Error(`Row ${index + 2} has an empty Key.`);
    if (seen.has(key)) throw new Error(`Duplicate sellable key "${key}" at row ${index + 2}.`);
    if (!name) throw new Error(`Row ${index + 2} (${key}) has an empty Name.`);
    seen.add(key);
    return {
        key,
        name,
        cost: String(row.Cost ?? '').trim() || null,
        rarity: String(row.Rarity ?? '').trim() || null
    };
});

const db = new Database(databasePath);
db.exec('CREATE TABLE IF NOT EXISTS sellables (key TEXT PRIMARY KEY, name TEXT NOT NULL, cost TEXT, rarity TEXT)');
const upsert = db.prepare(`INSERT INTO sellables (key, name, cost, rarity) VALUES (@key, @name, @cost, @rarity)
    ON CONFLICT(key) DO UPDATE SET name = excluded.name, cost = excluded.cost, rarity = excluded.rarity`);
db.transaction(() => records.forEach(record => upsert.run(record)))();
db.close();
console.log(`Imported ${records.length} sellables into ${databasePath}. Existing keys were updated.`);