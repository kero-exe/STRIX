const path = require('path');
const XLSX = require('xlsx');
const { db } = require('../src/database/db');

const spreadsheetPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../src/data/agent-profiles.xlsx');

const columns = [
    'Agent ID', 'Discord ID', 'SHD ID', 'Surname', 'First Name', 'Sex',
    'Date of Birth', 'Occupational Specialty', 'Date of Activation',
    'Deployment Wave', 'Avatar URL'
];

const rows = db.prepare(`
    SELECT agent_id AS 'Agent ID', discord_id AS 'Discord ID', shd_id AS 'SHD ID',
        surname AS 'Surname', first_name AS 'First Name', sex AS 'Sex',
        date_of_birth AS 'Date of Birth', occupational_specialty AS 'Occupational Specialty',
        date_of_activation AS 'Date of Activation', deployment_wave AS 'Deployment Wave',
        avatar_url AS 'Avatar URL'
    FROM agent_profiles
    ORDER BY agent_id ASC
`).all().map(row => Object.fromEntries(columns.map(column => [column, row[column] || ''])));

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
sheet['!cols'] = columns.map(column => ({ wch: Math.max(column.length + 2, 18) }));
XLSX.utils.book_append_sheet(workbook, sheet, 'Agent Profiles');
XLSX.writeFile(workbook, spreadsheetPath);
console.log(`Generated ${rows.length} agent profiles at ${spreadsheetPath}.`);