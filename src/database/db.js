const Database = require('better-sqlite3');
const path = require('path');
const aliases = require('../data/aliases.json');

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

        CREATE TABLE IF NOT EXISTS items (
            key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            cost TEXT,
            damage TEXT,
            damage_type TEXT,
            firerate TEXT,
            magazine TEXT,
            range_max TEXT,
            range_min TEXT,
            properties TEXT,
            ammo_type TEXT,
            rarity TEXT,
            slot TEXT,
            description TEXT
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
    const item = getItem(itemKey);
    if (!item) {
        return 0;
    }

    const match = String(item.cost || '').match(/[0-9]+(?:\.[0-9]+)?/);
    if (!match) {
        return 0;
    }

    return Number(match[0]) || 0;
}

function resolveItemKey(input) {
    const normalized = String(input || '').trim().toLowerCase();
    if (!normalized) return null;

    const itemKey = aliases[normalized] || normalized;
    return getItem(itemKey) ? itemKey : null;
}

function getItem(itemKey) {
    return db.prepare('SELECT * FROM items WHERE key = ?').get(String(itemKey || '').toLowerCase()) || null;
}

function transferUnits(fromDiscordId, toDiscordId, amount) {
    if (!fromDiscordId || !toDiscordId) {
        throw new Error('fromDiscordId and toDiscordId are required.');
    }

    const safeAmount = Number(amount) || 0;
    if (safeAmount <= 0) {
        return null;
    }

    const sender = getUser(fromDiscordId);
    const recipient = getUser(toDiscordId);

    if (!sender || !recipient) {
        return null;
    }

    if (sender.units < safeAmount) {
        return { ok: false, sender, recipient, amount: safeAmount };
    }

    db.prepare('UPDATE users SET units = units - ? WHERE discord_id = ?').run(safeAmount, fromDiscordId);
    db.prepare('UPDATE users SET units = units + ? WHERE discord_id = ?').run(safeAmount, toDiscordId);

    return {
        ok: true,
        sender: getUser(fromDiscordId),
        recipient: getUser(toDiscordId),
        amount: safeAmount
    };
}

function transferItem(fromDiscordId, toDiscordId, itemKey, quantity = 1) {
    if (!fromDiscordId || !toDiscordId || !itemKey) {
        throw new Error('fromDiscordId, toDiscordId, and itemKey are required.');
    }

    const safeQty = Number(quantity) || 1;
    const senderInventory = getInventory(fromDiscordId);
    const existing = senderInventory.find(item => item.item_key === itemKey);

    if (!existing || existing.quantity < safeQty) {
        return null;
    }

    removeItem(fromDiscordId, itemKey, safeQty);
    addItem(toDiscordId, itemKey, safeQty);

    return {
        ok: true,
        itemKey,
        quantity: safeQty,
        sender: getUser(fromDiscordId),
        recipient: getUser(toDiscordId)
    };
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
    const item = getItem(itemKey);
    if (!item) {
        return itemKey.replace(/_/g, ' ');
    }

    return item.name;
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
    getItem,
    getItemLabel,
    getItemValue,
    sellItem,
    transferUnits,
    transferItem,
    resolveItemKey
};
