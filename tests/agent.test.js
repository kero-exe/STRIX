const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strix-agent-'));
process.env.STRIX_DB_PATH = path.join(tempDir, 'test.db');
const database = require('../src/database/db');

test('generates valid unique SHD IDs with wave prefixes', () => {
    const ids = new Set(Array.from({ length: 100 }, () => database.generateShdId('Second Wave')));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.match(id, /^SHD-02-\d{7}$/);
});

test('validates deployment waves', () => {
    assert.equal(database.normalizeDeploymentWave('Third Wave'), 'Third Wave');
    assert.throws(() => database.normalizeDeploymentWave('Fourth Wave'), /Deployment wave/);
});

test('persists and preserves an existing SHD ID', () => {
    database.registerUser({ discordId: '100', username: 'agent', displayName: 'Agent' });
    const first = database.ensureAgentProfile('100', { deploymentWave: 'Second Wave' });
    const second = database.ensureAgentProfile('100', { deploymentWave: 'Third Wave' });
    assert.equal(first.shd_id, second.shd_id);
    assert.match(second.shd_id, /^SHD-02-\d{7}$/);
    assert.throws(() => database.updateAgentProfile('100', { deploymentWave: 'Third Wave' }), /cannot change/);

    database.registerUser({ discordId: '200', username: 'existing', displayName: 'Existing' });
    database.db.prepare("INSERT INTO agent_profiles (discord_id, shd_id, deployment_wave) VALUES ('200', 'SHD-03-1234567', 'Third Wave')").run();
    database.backfillAgentProfiles();
    assert.equal(database.getAgentProfile('200').shd_id, 'SHD-03-1234567');
});

test('backfills registered users without overwriting user data', () => {
    database.registerUser({ discordId: '300', username: 'legacy', displayName: 'Legacy' });
    const userBefore = database.getUser('300');
    database.backfillAgentProfiles();
    const userAfter = database.getUser('300');
    assert.deepEqual(userAfter, userBefore);
    assert.match(database.getAgentProfile('300').shd_id, /^SHD-01-\d{7}$/);
});

test('publishes all required command names and subcommands', () => {
    const commands = ['agent', 'id', 'profile'].map(name => require(`../src/commands/Other/${name}`).data.toJSON());
    assert.deepEqual(commands.map(command => command.name), ['agent', 'id', 'profile']);
    assert.deepEqual(commands[0].options.map(option => option.name), ['id', 'profile']);
});
