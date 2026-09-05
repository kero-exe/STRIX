const path = require('path');
const XLSX = require('xlsx');
const { db, getAgentProfile, isValidShdId, normalizeDeploymentWave, updateAgentProfile } = require('../src/database/db');

const spreadsheetPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '../src/data/agent-profiles.xlsx');
const requiredHeaders = ['Agent ID', 'Discord ID', 'SHD ID', 'Deployment Wave'];
const editableFields = {
    'Surname': 'surname',
    'First Name': 'firstName',
    'Sex': 'sex',
    'Date of Birth': 'dateOfBirth',
    'Occupational Specialty': 'occupationalSpecialty',
    'Date of Activation': 'dateOfActivation',
    'Deployment Wave': 'deploymentWave',
    'Avatar URL': 'avatarUrl'
};

const workbook = XLSX.readFile(spreadsheetPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || [];
for (const header of requiredHeaders) {
    if (!headerRow.includes(header)) throw new Error(`Missing required column: ${header}`);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const seen = new Set();
const records = rows.map((row, index) => {
    const agentId = Number(String(row['Agent ID'] || '').trim());
    const discordId = String(row['Discord ID'] || '').trim();
    const shdId = String(row['SHD ID'] || '').trim();
    if (!Number.isInteger(agentId) || agentId < 1) throw new Error(`Row ${index + 2} has an invalid Agent ID.`);
    if (seen.has(agentId)) throw new Error(`Duplicate Agent ID "${agentId}" at row ${index + 2}.`);
    seen.add(agentId);
    if (!discordId) throw new Error(`Row ${index + 2} has an empty Discord ID.`);
    if (!isValidShdId(shdId)) throw new Error(`Row ${index + 2} has an invalid SHD ID.`);
    const profile = getAgentProfile(discordId);
    if (!profile || profile.agent_id !== agentId) throw new Error(`Row ${index + 2} does not match an existing agent profile.`);
    if (profile.shd_id !== shdId) throw new Error(`Row ${index + 2} attempts to change immutable SHD ID ${profile.shd_id}.`);
    const fields = {};
    for (const [label, field] of Object.entries(editableFields)) {
        const value = String(row[label] ?? '').trim();
        if (field !== 'deploymentWave') fields[field] = value || null;
    }
    fields.deploymentWave = normalizeDeploymentWave(fields.deploymentWave || profile.deployment_wave);
    if (fields.deploymentWave !== profile.deployment_wave) {
        throw new Error(`Row ${index + 2} attempts to change the deployment wave for ${shdId}; SHD IDs are stable.`);
    }
    return { discordId, fields };
});

db.transaction(() => {
    for (const record of records) updateAgentProfile(record.discordId, record.fields);
})();

console.log(`Imported ${records.length} agent profiles from ${spreadsheetPath}. SHD IDs were preserved.`);