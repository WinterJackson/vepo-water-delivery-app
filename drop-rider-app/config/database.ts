/**
 * Offline SQLite database for caching orders and queuing actions.
 * Uses dynamic import so expo-sqlite doesn't crash at module load
 * when the native module isn't available (e.g., Expo Go).
 */

let _db: any = null;
let dbFailed = false;

const getSQLite = async () => {
    try {
        return await import('expo-sqlite');
    } catch {
        return null;
    }
};

export const getDB = async () => {
    if (dbFailed) return null;
    if (_db) return _db;
    const SQLite = await getSQLite();
    if (!SQLite) return null;
    try {
        _db = await SQLite.openDatabaseAsync('drop_offline.db');
        return _db;
    } catch (e) {
        if (__DEV__) console.warn('[getDB] Failed to open database:', e);
        return null;
    }
}

export const initDB = async () => {
    const db = await getDB();
    if (!db) {
        if (__DEV__) console.warn('[initDB] SQLite not available — offline features disabled.');
        return;
    }
    try {
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                vendor_id TEXT,
                customer_id TEXT,
                delivery_address TEXT,
                phone TEXT,
                lat_from REAL,
                lng_from REAL,
                lat REAL,
                lng REAL,
                total_amount REAL,
                order_status TEXT,
                payment_status TEXT,
                delivery_fee REAL,
                updated_at TEXT
            );
        `);

        const cols = await db.getAllAsync(`PRAGMA table_info(offline_actions)`) as any[];
        if (cols.length > 0 && !cols.some((c: any) => c.name === 'row_id')) {
            const legacy = await db.getAllAsync(`SELECT * FROM offline_actions`).catch(() => []) as any[];
            await db.execAsync(`DROP TABLE offline_actions;`);
            await db.execAsync(`CREATE TABLE offline_actions (row_id TEXT PRIMARY KEY, id TEXT, type TEXT, payload TEXT, created_at TEXT);`);
            for (const row of legacy) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO offline_actions (row_id, id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
                    [`${row.id}:migrated:${row.created_at}`, row.id, row.type, row.payload, row.created_at]
                );
            }
        } else {
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS offline_actions (
                    row_id TEXT PRIMARY KEY,
                    id TEXT,
                    type TEXT,
                    payload TEXT,
                    created_at TEXT
                );
            `);
        }
    } catch (e: unknown) {
        if (__DEV__ && !(e as Error)?.message?.includes('NullPointerException')) {
            console.warn('[initDB] SQLite init failed (non-fatal):', e);
        }
        _db = null; // Prevent subsequent calls from throwing if initialization fails
        dbFailed = true; // Mark as failed to prevent retrying
    }
}

export const saveOrdersLocal = async (orders: any[]) => {
    const db = await getDB();
    if (!db) return;

    try {
        const statement = await db.prepareAsync(`
            INSERT OR REPLACE INTO orders (
                id, vendor_id, customer_id, delivery_address, phone, lat_from, lng_from, lat, lng, 
                total_amount, order_status, payment_status, delivery_fee, updated_at
            ) VALUES ($id, $vendor_id, $customer_id, $delivery_address, $phone, $lat_from, $lng_from, $lat, $lng, $total_amount, $order_status, $payment_status, $delivery_fee, $updated_at)
        `);

        for (let o of orders) {
            await statement.executeAsync({
                $id: o.id,
                $vendor_id: o.vendor_id,
                $customer_id: o.customer_id,
                $delivery_address: o.delivery_address,
                $phone: o.phone,
                $lat_from: o.lat_from,
                $lng_from: o.lng_from,
                $lat: o.lat,
                $lng: o.lng,
                $total_amount: o.total_amount,
                $order_status: o.order_status,
                $payment_status: o.payment_status,
                $delivery_fee: o.delivery_fee,
                $updated_at: o.updated_at
            });
        }
        await statement.finalizeAsync();
    } catch (e) {
        if (__DEV__) console.warn('[saveOrdersLocal] SQLite operation failed (non-fatal):', e);
    }
}

export const getOrdersLocal = async () => {
    const db = await getDB();
    if (!db) return [];
    try {
        const result = await db.getAllAsync('SELECT * FROM orders ORDER BY updated_at DESC');
        return result;
    } catch (e) {
        if (__DEV__) console.warn('[getOrdersLocal] SQLite failed:', e);
        return [];
    }
}

// --- OFFLINE ACTION QUEUE ---

export const queueOfflineAction = async (id: string, type: string, payload: string) => {
    const db = await getDB();
    if (!db) return;
    const created_at = new Date().toISOString();
    const row_id = `${id}:${Date.now()}`;
    try {
        await db.runAsync(
            `INSERT OR REPLACE INTO offline_actions (row_id, id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
            [row_id, id, type, payload, created_at]
        );
    } catch (e) {
        if (__DEV__) console.warn('[queueOfflineAction] SQLite failed:', e);
    }
}

export const getQueuedActions = async () => {
    const db = await getDB();
    if (!db) return [];
    try {
        return await db.getAllAsync('SELECT * FROM offline_actions ORDER BY created_at ASC');
    } catch (e: unknown) {
        if (__DEV__ && !(e as Error)?.message?.includes('NullPointerException')) {
            console.warn('[getQueuedActions] SQLite failed:', e);
        }
        return [];
    }
}

export const removeQueuedAction = async (id: string) => {
    const db = await getDB();
    if (!db) return;
    try {
        await db.runAsync(`DELETE FROM offline_actions WHERE row_id = ?`, [id]);
    } catch (e) {
        if (__DEV__) console.warn('[removeQueuedAction] SQLite failed:', e);
    }
}
