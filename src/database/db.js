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

        CREATE TABLE IF NOT EXISTS sellables (
            key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cost TEXT,
            rarity TEXT
        );

        CREATE TABLE IF NOT EXISTS equipment (
            discord_id TEXT NOT NULL,
            slot TEXT NOT NULL,
            item_key TEXT NOT NULL,
            PRIMARY KEY(discord_id, slot),
            UNIQUE(discord_id, item_key),
            FOREIGN KEY(discord_id) REFERENCES users(discord_id) ON DELETE CASCADE,
            FOREIGN KEY(item_key) REFERENCES items(key)
        );
    `);

    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasUnits = columns.some(column => column.name === 'units');

    if (!hasUnits) {
        db.exec('ALTER TABLE users ADD COLUMN units INTEGER NOT NULL DEFAULT 0');
    }

    migrateLegacyEquipment();
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

function normalizeAmmunition(ammunition) {
    const normalized = String(ammunition || '').trim().toLowerCase();
    return normalized ? `ammo:${normalized}` : null;
}

function getAmmunitionLabel(itemKey) {
    const normalized = String(itemKey || '').replace(/^ammo:/i, '').toLowerCase();
    const knownType = db.prepare('SELECT ammo_type FROM items WHERE lower(ammo_type) LIKE ? LIMIT 1').get(`%${normalized}%`);
    if (knownType) {
        const match = knownType.ammo_type.split(',').find(type => type.trim().toLowerCase() === normalized);
        if (match) return match.trim();
    }

    return normalized;
}

function addAmmunition(discordId, ammunition, quantity = 1) {
    const ammoKey = normalizeAmmunition(ammunition);
    if (!ammoKey) throw new Error('Ammunition is required.');
    return addItem(discordId, ammoKey, quantity);
}

function transferAmmunition(fromDiscordId, toDiscordId, ammunition, quantity = 1) {
    const ammoKey = normalizeAmmunition(ammunition);
    if (!ammoKey) throw new Error('Ammunition is required.');
    return transferItem(fromDiscordId, toDiscordId, ammoKey, quantity);
}

function getEquipment(discordId) {
    const ownedItems = getInventory(discordId)
        .filter(entry => !entry.item_key.startsWith('ammo:'))
        .map(entry => ({ ...entry, item: getItem(entry.item_key) }))
        .filter(entry => entry.item);
    const equipped = db.prepare(`
        SELECT e.slot AS equipped_slot, e.item_key, i.quantity, d.*
        FROM equipment e
        INNER JOIN inventory i ON i.discord_id = e.discord_id AND i.item_key = e.item_key
        INNER JOIN items d ON d.key = e.item_key
        WHERE e.discord_id = ?
    `).all(discordId);
    const ammunition = getInventory(discordId)
        .filter(entry => entry.item_key.startsWith('ammo:'))
        .map(entry => ({
            name: getAmmunitionLabel(entry.item_key),
            quantity: entry.quantity
        }));

    const equipmentBySlot = slot => {
        const entry = equipped.find(item => item.equipped_slot === slot);
        return entry ? { item_key: entry.item_key, quantity: entry.quantity, username: entry.username, item: entry } : null;
    };

    return {
        primary: equipmentBySlot('primary'),
        secondary: equipmentBySlot('secondary'),
        gasmask: equipmentBySlot('gasmask'),
        gasmaskFilter: equipmentBySlot('gasmask') ? 100 : 0,
        ammunition
    };
}

function migrateLegacyEquipment() {
    const users = db.prepare('SELECT discord_id FROM users').all();
    const insert = db.prepare('INSERT OR IGNORE INTO equipment (discord_id, slot, item_key) VALUES (?, ?, ?)');
    for (const user of users) {
        const ownedItems = getInventory(user.discord_id)
            .map(entry => ({ ...entry, item: getItem(entry.item_key) }))
            .filter(entry => entry.item);
        const legacySlots = [
            ['primary', ownedItems.find(entry => entry.item.type && entry.item.type !== 'Handgun')],
            ['secondary', ownedItems.find(entry => entry.item.type === 'Handgun')],
            ['gasmask', ownedItems.find(entry => entry.item.slot === 'Face')]
        ];
        for (const [slot, entry] of legacySlots) {
            if (entry) insert.run(user.discord_id, slot, entry.item_key);
        }
    }
}

function getEquipmentSlot(item) {
    if (item.slot === 'Face') return 'gasmask';
    if (item.type === 'Handgun') return 'secondary';
    if (item.type) return 'primary';
    return null;
}

function equipItem(discordId, itemKey) {
    const item = getItem(itemKey);
    const owned = db.prepare('SELECT quantity FROM inventory WHERE discord_id = ? AND item_key = ?').get(discordId, itemKey);
    const slot = item && getEquipmentSlot(item);
    if (!owned || !slot) return null;

    db.prepare('INSERT INTO equipment (discord_id, slot, item_key) VALUES (?, ?, ?) ON CONFLICT(discord_id, slot) DO UPDATE SET item_key = excluded.item_key').run(discordId, slot, itemKey);
    return { slot, item };
}

function unequipItem(discordId, slot) {
    const normalizedSlot = String(slot || '').trim().toLowerCase();
    if (!['primary', 'secondary', 'gasmask'].includes(normalizedSlot)) return null;
    const equipped = db.prepare('SELECT item_key FROM equipment WHERE discord_id = ? AND slot = ?').get(discordId, normalizedSlot);
    if (!equipped) return null;
    db.prepare('DELETE FROM equipment WHERE discord_id = ? AND slot = ?').run(discordId, normalizedSlot);
    return { slot: normalizedSlot, itemKey: equipped.item_key };
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
    const normalizedKey = String(itemKey || '').toLowerCase();
    return db.prepare(`
        SELECT *, 'item' AS category FROM items WHERE key = ?
        UNION ALL
        SELECT key, name, NULL AS type, cost, NULL AS damage, NULL AS damage_type,
            NULL AS firerate, NULL AS magazine, NULL AS range_max, NULL AS range_min,
            NULL AS properties, NULL AS ammo_type, rarity, NULL AS slot,
            NULL AS description, 'sellable' AS category
        FROM sellables WHERE key = ?
        LIMIT 1
    `).get(normalizedKey, normalizedKey) || null;
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
    getEquipment,
    equipItem,
    unequipItem,
    addItem,
    addAmmunition,
    removeItem,
    ensureStarterInventory,
    getItem,
    getItemLabel,
    getItemValue,
    sellItem,
    transferUnits,
    transferItem,
    transferAmmunition,
    getAmmunitionLabel,
    resolveItemKey
};
