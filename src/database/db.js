const Database = require('better-sqlite3');
const path = require('path');
const { topics } = require('../data/topics.json');

const db = new Database(path.join(__dirname, '../data/strix.db'));

function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            discord_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            display_name TEXT,
            units INTEGER NOT NULL DEFAULT 0,
            registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT NOT NULL,
            item_key TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(discord_id, item_key),
            FOREIGN KEY(discord_id) REFERENCES users(discord_id) ON DELETE CASCADE
        );
    `);

    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasUnits = columns.some(column => column.name === 'units');

    if (!hasUnits) {
        db.exec('ALTER TABLE users ADD COLUMN units INTEGER NOT NULL DEFAULT 0');
    }
}

initDatabase();

function getUser(discordId) {
    return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) || null;
}

function registerUser({ discordId, username, displayName }) {
    if (!discordId) {
        throw new Error('discordId is required.');
    }

    const normalizedName = username || 'Unknown User';
    const finalDisplayName = displayName || normalizedName;

    db.prepare(`
        INSERT INTO users (discord_id, username, display_name)
        VALUES (@discordId, @username, @displayName)
        ON CONFLICT(discord_id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name
    `).run({
        discordId,
        username: normalizedName,
        displayName: finalDisplayName
    });

    ensureStarterInventory(discordId);
    return getUser(discordId);
}

function getInventory(discordId) {
    return db.prepare(`
        SELECT i.item_key, i.quantity, u.username
        FROM inventory i
        INNER JOIN users u ON u.discord_id = i.discord_id
        WHERE i.discord_id = ?
        ORDER BY i.item_key ASC
    `).all(discordId);
}

function addItem(discordId, itemKey, quantity = 1) {
    if (!discordId || !itemKey) {
        throw new Error('discordId and itemKey are required.');
    }

    const safeQty = Number(quantity) || 1;

    const existing = db.prepare('SELECT quantity FROM inventory WHERE discord_id = ? AND item_key = ?').get(discordId, itemKey);

    if (existing) {
        db.prepare(`
            UPDATE inventory
            SET quantity = quantity + @quantity
            WHERE discord_id = @discordId AND item_key = @itemKey
        `).run({ discordId, itemKey, quantity: safeQty });
    } else {
        db.prepare(`
            INSERT INTO inventory (discord_id, item_key, quantity)
            VALUES (@discordId, @itemKey, @quantity)
        `).run({ discordId, itemKey, quantity: safeQty });
    }

    return getInventory(discordId);
}

function removeItem(discordId, itemKey, quantity = 1) {
    if (!discordId || !itemKey) {
        throw new Error('discordId and itemKey are required.');
    }

    const safeQty = Number(quantity) || 1;
    const existing = db.prepare('SELECT quantity FROM inventory WHERE discord_id = ? AND item_key = ?').get(discordId, itemKey);

    if (!existing) {
        return getInventory(discordId);
    }

    const newQty = existing.quantity - safeQty;

    if (newQty <= 0) {
        db.prepare('DELETE FROM inventory WHERE discord_id = ? AND item_key = ?').run(discordId, itemKey);
    } else {
        db.prepare(`
            UPDATE inventory
            SET quantity = @newQty
            WHERE discord_id = @discordId AND item_key = @itemKey
        `).run({ discordId, itemKey, newQty });
    }

    return getInventory(discordId);
}

function ensureStarterInventory(discordId) {
    const starterItems = ['gasmask', '1911', 'mp5'];

    for (const itemKey of starterItems) {
        const existing = db.prepare('SELECT 1 FROM inventory WHERE discord_id = ? AND item_key = ?').get(discordId, itemKey);
        if (!existing) {
            addItem(discordId, itemKey, 1);
        }
    }

    return getInventory(discordId);
}

function getItemValue(itemKey) {
    const rawEntry = topics[itemKey];
    if (!rawEntry) {
        return 0;
    }

    const match = rawEntry.match(/Cost:\s*`?\s*([0-9]+(?:\.[0-9]+)?)\s*units?/i);
    if (!match) {
        return 0;
    }

    return Number(match[1]) || 0;
}

function sellItem(discordId, itemKey, quantity = 1) {
    if (!discordId || !itemKey) {
        throw new Error('discordId and itemKey are required.');
    }

    const safeQty = Number(quantity) || 1;
    const existing = db.prepare('SELECT quantity FROM inventory WHERE discord_id = ? AND item_key = ?').get(discordId, itemKey);

    if (!existing) {
        return null;
    }

    const sellQty = Math.min(existing.quantity, safeQty);
    const itemValue = getItemValue(itemKey);
    const sellRatio = Number(process.env.SELL_RATIO || '0.5');
    const unitsEarned = Math.floor(itemValue * sellRatio * sellQty);

    if (sellQty > 0 && unitsEarned > 0) {
        db.prepare('UPDATE users SET units = units + ? WHERE discord_id = ?').run(unitsEarned, discordId);
    }

    if (sellQty >= existing.quantity) {
        db.prepare('DELETE FROM inventory WHERE discord_id = ? AND item_key = ?').run(discordId, itemKey);
    } else {
        db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE discord_id = ? AND item_key = ?').run(sellQty, discordId, itemKey);
    }

    return {
        soldQuantity: sellQty,
        unitsEarned,
        user: getUser(discordId),
        inventory: getInventory(discordId)
    };
}

function getItemLabel(itemKey) {
    const rawEntry = topics[itemKey];
    if (!rawEntry) {
        return itemKey.replace(/_/g, ' ');
    }

    const match = rawEntry.match(/^##\s*(.+)$/m);
    return match ? match[1] : itemKey.replace(/_/g, ' ');
}

module.exports = {
    db,
    initDatabase,
    getUser,
    registerUser,
    getInventory,
    addItem,
    removeItem,
    ensureStarterInventory,
    getItemLabel,
    getItemValue,
    sellItem
};
