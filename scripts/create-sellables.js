const path = require('path');
const XLSX = require('xlsx');

const headers = ['Key', 'Name', 'Cost', 'Rarity'];
const rows = [{ Key: 'battery', Name: 'Battery', Cost: 2, Rarity: 'Standard' }];
const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sellables');
XLSX.writeFile(workbook, path.join(__dirname, '../src/data/sellables.xlsx'));
console.log('Created src/data/sellables.xlsx with the battery placeholder.');