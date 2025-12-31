// src/services/database.js - COMPLETE FIXED VERSION
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'taskprime.db';
const DB_VERSION = 3;

class DatabaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized && this.db) {
            console.log('[DB] Database already initialized');
            return true;
        }

        try {
            console.log('[DB] Initializing database...');
            this.db = await SQLite.openDatabaseAsync(DB_NAME);

            if (!this.db) {
                throw new Error('Failed to open database - db is null');
            }

            console.log('[DB] Database opened successfully');

            await this.checkAndMigrate();
            await this.createTables();

            this.isInitialized = true;
            console.log('[DB] ✅ Database initialized successfully');
            return true;
        } catch (error) {
            console.error('[DB] ❌ Database initialization error:', error);
            this.isInitialized = false;
            this.db = null;
            throw error;
        }
    }

    async checkAndMigrate() {
        try {
            if (!this.db) {
                throw new Error('Database not initialized in checkAndMigrate');
            }

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS db_version (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    version INTEGER NOT NULL
                );
            `);

            const result = await this.db.getFirstAsync('SELECT version FROM db_version WHERE id = 1');
            const currentVersion = result?.version || 0;

            console.log(`[DB] Current version: ${currentVersion}, Required: ${DB_VERSION}`);

            if (currentVersion < DB_VERSION) {
                console.log('[DB] ⚠️ Schema update needed - migrating...');
                await this.db.runAsync('INSERT OR REPLACE INTO db_version (id, version) VALUES (1, ?)', [DB_VERSION]);
                console.log('[DB] ✅ Schema updated to version', DB_VERSION);
            }
        } catch (error) {
            console.error('[DB] Error checking version:', error);
            if (this.db) {
                try {
                    await this.db.runAsync('INSERT OR REPLACE INTO db_version (id, version) VALUES (1, ?)', [DB_VERSION]);
                } catch (e) {
                    console.error('[DB] Error setting initial version:', e);
                }
            }
        }
    }

    async createTables() {
        try {
            if (!this.db) {
                throw new Error('Database not initialized in createTables');
            }

            console.log('[DB] Creating/verifying tables...');

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS customers (
                    code TEXT PRIMARY KEY, name TEXT NOT NULL, place TEXT, area TEXT,
                    phone TEXT, phone2 TEXT, super_code TEXT, balance REAL DEFAULT 0,
                    master_debit REAL DEFAULT 0, master_credit REAL DEFAULT 0,
                    created_at TEXT, updated_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL,
                    barcode TEXT, price REAL DEFAULT 0, stock REAL DEFAULT 0, unit TEXT,
                    brand TEXT, category TEXT, description TEXT, created_at TEXT, updated_at TEXT
                );
            `);

            // Migration: Add brand column if it doesn't exist (for existing databases)
            try {
                await this.db.execAsync(`ALTER TABLE products ADD COLUMN brand TEXT;`);
                console.log('[DB] ✅ Added brand column to products table');
            } catch (error) {
                // Column already exists, ignore error
                if (!error.message.includes('duplicate column')) {
                    console.log('[DB] Brand column already exists or migration not needed');
                }
            }

            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS company_info (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT UNIQUE, name TEXT,
                    address TEXT, phone TEXT, email TEXT, data TEXT, created_at TEXT, updated_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS offline_collections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, local_id TEXT UNIQUE,
                    customer_code TEXT, customer_name TEXT, customer_place TEXT,
                    customer_phone TEXT, amount REAL, payment_type TEXT, cheque_number TEXT,
                    remarks TEXT, date TEXT, synced INTEGER DEFAULT 0, created_at TEXT, synced_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS offline_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, local_id TEXT UNIQUE,
                    customer_code TEXT, customer_name TEXT, area TEXT, payment_type TEXT,
                    items TEXT, total_amount REAL, date TEXT, synced INTEGER DEFAULT 0,
                    created_at TEXT, synced_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS customer_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, customer_code TEXT, voucher_no TEXT,
                    date TEXT, particulars TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0,
                    balance REAL DEFAULT 0, created_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS areas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
                    created_at TEXT, updated_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS sync_metadata (
                    key TEXT PRIMARY KEY, value TEXT, updated_at TEXT
                );
            `);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, product_code TEXT NOT NULL,
                    batch_id INTEGER, barcode TEXT, mrp REAL DEFAULT 0, retail REAL DEFAULT 0,
                    dp REAL DEFAULT 0, cb REAL DEFAULT 0, cost REAL DEFAULT 0, quantity REAL DEFAULT 0,
                    expiry_date TEXT, second_price REAL DEFAULT 0, third_price REAL DEFAULT 0,
                    net_rate REAL DEFAULT 0, pk_shop REAL DEFAULT 0, created_at TEXT, updated_at TEXT,
                    FOREIGN KEY (product_code) REFERENCES products(code)
                );
            `);

            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_batches_product_code ON batches(product_code);`);
            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_batches_barcode ON batches(barcode);`);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS product_photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, product_code TEXT NOT NULL,
                    url TEXT NOT NULL, order_index INTEGER DEFAULT 0, created_at TEXT,
                    FOREIGN KEY (product_code) REFERENCES products(code)
                );
            `);

            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_product_photos_code ON product_photos(product_code);`);

            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS product_goddowns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, product_code TEXT NOT NULL,
                    barcode TEXT, name TEXT NOT NULL, quantity REAL DEFAULT 0, created_at TEXT,
                    FOREIGN KEY (product_code) REFERENCES products(code)
                );
            `);

            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_goddowns_product_code ON product_goddowns(product_code);`);
            await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_goddowns_barcode ON product_goddowns(barcode);`);

            console.log('[DB] ✅ All tables created/verified');
        } catch (error) {
            console.error('[DB] ❌ Error creating tables:', error);
            throw error;
        }
    }

    // ==================== CUSTOMERS ====================
    async saveCustomers(customers) {
        try {
            console.log(`[DB] Saving ${customers.length} customers...`);
            for (const customer of customers) {
                await this.db.runAsync(
                    `INSERT OR REPLACE INTO customers 
                    (code, name, place, area, phone, phone2, super_code, balance, master_debit, master_credit, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [customer.code, customer.name, customer.place || '', customer.area || '', customer.phone || '',
                    customer.phone2 || '', customer.super_code || '', customer.balance || 0,
                    customer.master_debit || 0, customer.master_credit || 0, new Date().toISOString()]
                );
            }
            console.log(`[DB] ✅ Saved ${customers.length} customers`);
            return true;
        } catch (error) {
            console.error('[DB] Error saving customers:', error);
            throw error;
        }
    }

    async getCustomers(superCode = null) {
        try {
            let query = 'SELECT * FROM customers';
            let params = [];
            if (superCode) {
                query += ' WHERE super_code = ?';
                params.push(superCode);
            }
            query += ' ORDER BY name ASC';
            const result = await this.db.getAllAsync(query, params);
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting customers:', error);
            return [];
        }
    }

    async getCustomerByCode(code) {
        try {
            const result = await this.db.getFirstAsync('SELECT * FROM customers WHERE code = ?', [code]);
            return result;
        } catch (error) {
            console.error('[DB] Error getting customer:', error);
            return null;
        }
    }

    async searchCustomers(query, superCode = null) {
        try {
            let sql = `SELECT * FROM customers WHERE (name LIKE ? OR code LIKE ? OR phone LIKE ? OR area LIKE ?)`;
            const searchTerm = `%${query}%`;
            let params = [searchTerm, searchTerm, searchTerm, searchTerm];
            if (superCode) {
                sql += ' AND super_code = ?';
                params.push(superCode);
            }
            sql += ' ORDER BY name ASC LIMIT 50';
            const result = await this.db.getAllAsync(sql, params);
            return result || [];
        } catch (error) {
            console.error('[DB] Error searching customers:', error);
            return [];
        }
    }

    // ==================== PRODUCTS ====================
    async saveProducts(products) {
        try {
            console.log(`[DB] Saving ${products.length} products...`);
            const batchSize = 1000; // Increased from 500
            let savedCount = 0;

            // Use single transaction for all products
            await this.db.execAsync('BEGIN TRANSACTION');

            try {
                for (let i = 0; i < products.length; i += batchSize) {
                    const batch = products.slice(i, i + batchSize);
                    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                    const values = [];

                    for (const product of batch) {
                        values.push(
                            product.code || product.id,
                            product.name,
                            product.barcode || '',
                            product.price || 0,
                            product.stock || 0,
                            product.unit || '',
                            product.brand || '', // Add brand field
                            product.category || '',
                            product.description || '',
                            new Date().toISOString()
                        );
                    }

                    await this.db.runAsync(
                        `INSERT OR REPLACE INTO products 
                        (code, name, barcode, price, stock, unit, brand, category, description, updated_at)
                        VALUES ${placeholders}`, values
                    );

                    savedCount += batch.length;
                    // Only log every 5000 to reduce overhead
                    if (savedCount % 5000 === 0 || savedCount === products.length) {
                        console.log(`[DB] Progress: ${savedCount}/${products.length} products`);
                    }
                }

                await this.db.execAsync('COMMIT');
                console.log(`[DB] ✅ Saved ${products.length} products`);
                return true;
            } catch (error) {
                await this.db.execAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('[DB] Error saving products:', error);
            throw error;
        }
    }

    async getProducts() {
        try {
            const result = await this.db.getAllAsync('SELECT * FROM products ORDER BY name ASC');
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting products:', error);
            return [];
        }
    }

    async getProductByBarcode(barcode) {
        try {
            console.log('[DB] Searching for barcode:', barcode);

            // First, try to find product by barcode in products table
            let result = await this.db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', [barcode]);

            // If not found in products table, search in batches table
            if (!result) {
                console.log('[DB] Not found in products table, searching batches...');
                const batchResult = await this.db.getFirstAsync(
                    `SELECT p.*, b.barcode as batch_barcode, b.mrp, b.retail, b.dp, b.cb, b.cost, 
                     b.quantity as batch_quantity, b.batch_id, b.expiry_date
                     FROM batches b
                     JOIN products p ON b.product_code = p.code
                     WHERE b.barcode = ?
                     LIMIT 1`,
                    [barcode]
                );

                if (batchResult) {
                    console.log('[DB] Found product via batch barcode:', batchResult.name);
                    // Merge batch info into product
                    result = {
                        ...batchResult,
                        barcode: batchResult.batch_barcode || batchResult.barcode,
                        price: batchResult.retail || batchResult.price || 0,
                        mrp: batchResult.mrp || 0,
                        stock: batchResult.batch_quantity || batchResult.stock || 0,
                        batchId: batchResult.batch_id,
                        expiryDate: batchResult.expiry_date
                    };
                }
            } else {
                console.log('[DB] Found product in products table:', result.name);
            }

            return result;
        } catch (error) {
            console.error('[DB] Error getting product by barcode:', error);
            return null;
        }
    }

    async searchProducts(query) {
        try {
            const searchTerm = `%${query}%`;

            // Search both products table and batches table
            const result = await this.db.getAllAsync(
                `SELECT DISTINCT p.* FROM products p 
                 WHERE p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?
                 UNION
                 SELECT DISTINCT p.* FROM products p
                 JOIN batches b ON b.product_code = p.code
                 WHERE b.barcode LIKE ?
                 ORDER BY name ASC 
                 LIMIT 50`,
                [searchTerm, searchTerm, searchTerm, searchTerm]
            );
            return result || [];
        } catch (error) {
            console.error('[DB] Error searching products:', error);
            return [];
        }
    }

    // ==================== AREAS ====================
    async saveAreas(areas) {
        try {
            console.log(`[DB] Saving ${areas.length} areas...`);
            for (const area of areas) {
                await this.db.runAsync(`INSERT OR REPLACE INTO areas (name, updated_at) VALUES (?, ?)`,
                    [area, new Date().toISOString()]);
            }
            console.log(`[DB] ✅ Saved ${areas.length} areas`);
            return true;
        } catch (error) {
            console.error('[DB] Error saving areas:', error);
            throw error;
        }
    }

    async getAreas() {
        try {
            const result = await this.db.getAllAsync('SELECT name FROM areas ORDER BY name ASC');
            const areas = (result || []).map(row => row.name);
            return areas;
        } catch (error) {
            console.error('[DB] Error getting areas:', error);
            return [];
        }
    }

    // ==================== BATCHES ====================
    async saveBatches(productCode, batches) {
        try {
            await this.db.runAsync('DELETE FROM batches WHERE product_code = ?', [productCode]);

            for (const batch of batches) {
                const mrp = parseFloat(batch.MRP || batch.mrp || 0);
                const retail = parseFloat(batch.RETAIL || batch.retail || 0);
                const dp = parseFloat(batch['D.P'] || batch.dp || 0);
                const cb = parseFloat(batch.CB || batch.cb || 0);
                const cost = parseFloat(batch.COST || batch.cost || 0);
                const quantity = parseFloat(batch.quantity || 0);
                const netRate = parseFloat(batch['NET RATE'] || batch.net_rate || batch.netrate || 0);
                const pkShop = parseFloat(batch['PK SHOP'] || batch.pk_shop || batch.pkshop || 0);
                const secondPrice = parseFloat(batch.second_price || 0);
                const thirdPrice = parseFloat(batch.third_price || 0);

                await this.db.runAsync(
                    `INSERT INTO batches 
                    (product_code, batch_id, barcode, mrp, retail, dp, cb, cost, quantity, expiry_date, 
                    second_price, third_price, net_rate, pk_shop, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [productCode, batch.id || batch.batch_id || null, batch.barcode || '', mrp, retail,
                        dp, cb, cost, quantity, batch.expirydate || batch.expiry_date || null,
                        secondPrice, thirdPrice, netRate, pkShop, new Date().toISOString(), new Date().toISOString()]
                );
            }

            return true;
        } catch (error) {
            console.error(`[DB] Error saving batches for ${productCode}:`, error);
            return false;
        }
    }

    async getBatchesByProductCode(productCode) {
        try {
            const result = await this.db.getAllAsync('SELECT * FROM batches WHERE product_code = ? ORDER BY barcode ASC', [productCode]);
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting batches:', error);
            return [];
        }
    }

    async getBatchByBarcode(barcode) {
        try {
            const result = await this.db.getFirstAsync('SELECT * FROM batches WHERE barcode = ?', [barcode]);
            return result;
        } catch (error) {
            console.error('[DB] Error getting batch:', error);
            return null;
        }
    }

    async getAllBatches() {
        try {
            const result = await this.db.getAllAsync('SELECT * FROM batches ORDER BY product_code, barcode ASC');
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting all batches:', error);
            return [];
        }
    }

    // ==================== BULK INSERT FOR BATCHES (OPTIMIZED WITH TRANSACTION) ====================
    async saveBatchesBulk(batchesWithProductCode) {
        try {
            if (!batchesWithProductCode || batchesWithProductCode.length === 0) {
                console.log('[DB] No batches to save');
                return true;
            }

            console.log(`[DB] Bulk inserting ${batchesWithProductCode.length} batches...`);
            const startTime = Date.now();

            // Use a single transaction for ALL inserts - this is MUCH faster
            await this.db.execAsync('BEGIN TRANSACTION');

            try {
                // Clear all existing batches first
                await this.db.execAsync('DELETE FROM batches');

                // Insert in chunks of 500 for maximum speed
                const chunkSize = 500;
                let insertedCount = 0;

                for (let i = 0; i < batchesWithProductCode.length; i += chunkSize) {
                    const chunk = batchesWithProductCode.slice(i, i + chunkSize);

                    // Build multi-value INSERT statement
                    const rows = [];
                    for (const item of chunk) {
                        const batch = item.batch || item;
                        const productCode = item.product_code;

                        const mrp = parseFloat(batch.MRP || batch.mrp || 0);
                        const retail = parseFloat(batch.RETAIL || batch.retail || 0);
                        const dp = parseFloat(batch['D.P'] || batch.dp || 0);
                        const cb = parseFloat(batch.CB || batch.cb || 0);
                        const cost = parseFloat(batch.COST || batch.cost || 0);
                        const quantity = parseFloat(batch.quantity || 0);
                        const netRate = parseFloat(batch['NET RATE'] || batch.net_rate || batch.netrate || 0);
                        const pkShop = parseFloat(batch['PK SHOP'] || batch.pk_shop || batch.pkshop || 0);
                        const secondPrice = parseFloat(batch.second_price || 0);
                        const thirdPrice = parseFloat(batch.third_price || 0);
                        const batchId = batch.id || batch.batch_id || 'NULL';
                        const barcode = (batch.barcode || '').replace(/'/g, "''");
                        const expiryDate = batch.expirydate || batch.expiry_date || 'NULL';
                        const now = new Date().toISOString();

                        rows.push(`('${productCode}', ${batchId}, '${barcode}', ${mrp}, ${retail}, ${dp}, ${cb}, ${cost}, ${quantity}, ${expiryDate === 'NULL' ? 'NULL' : `'${expiryDate}'`}, ${secondPrice}, ${thirdPrice}, ${netRate}, ${pkShop}, '${now}', '${now}')`);
                    }

                    const sql = `INSERT INTO batches 
                        (product_code, batch_id, barcode, mrp, retail, dp, cb, cost, quantity, expiry_date, 
                        second_price, third_price, net_rate, pk_shop, created_at, updated_at)
                        VALUES ${rows.join(',')}`;

                    await this.db.execAsync(sql);

                    insertedCount += chunk.length;
                    // Only log every 5000 to reduce overhead
                    if (insertedCount % 5000 === 0) {
                        console.log(`[DB] Batch progress: ${insertedCount}/${batchesWithProductCode.length}`);
                    }
                }

                // Commit the transaction
                await this.db.execAsync('COMMIT');

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[DB] ✅ Bulk inserted ${insertedCount} batches in ${duration}s`);
                return true;

            } catch (error) {
                // Rollback on error
                await this.db.execAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('[DB] Error bulk inserting batches:', error);
            throw error;
        }
    }

    // ==================== PRODUCT PHOTOS ====================
    async saveProductPhotos(productCode, photos) {
        try {
            if (!photos || photos.length === 0) return true;
            await this.db.runAsync('DELETE FROM product_photos WHERE product_code = ?', [productCode]);

            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                await this.db.runAsync(
                    `INSERT INTO product_photos (product_code, url, order_index, created_at) VALUES (?, ?, ?, ?)`,
                    [productCode, photo.url || photo, i, new Date().toISOString()]
                );
            }
            return true;
        } catch (error) {
            console.error('[DB] Error saving photos:', error);
            throw error;
        }
    }

    async getProductPhotos(productCode) {
        try {
            const result = await this.db.getAllAsync(
                'SELECT url, order_index FROM product_photos WHERE product_code = ? ORDER BY order_index ASC', [productCode]
            );
            return (result || []).map(row => ({ url: row.url }));
        } catch (error) {
            console.error('[DB] Error getting photos:', error);
            return [];
        }
    }

    // ==================== BULK INSERT FOR PHOTOS (OPTIMIZED WITH TRANSACTION) ====================
    async savePhotosBulk(photosWithProductCode) {
        try {
            if (!photosWithProductCode || photosWithProductCode.length === 0) {
                console.log('[DB] No photos to save');
                return true;
            }

            console.log(`[DB] Bulk inserting ${photosWithProductCode.length} photos...`);
            const startTime = Date.now();

            await this.db.execAsync('BEGIN TRANSACTION');

            try {
                await this.db.execAsync('DELETE FROM product_photos');

                const chunkSize = 1000;
                let insertedCount = 0;

                for (let i = 0; i < photosWithProductCode.length; i += chunkSize) {
                    const chunk = photosWithProductCode.slice(i, i + chunkSize);
                    const rows = [];

                    for (const item of chunk) {
                        const photo = item.photo || item;
                        const productCode = item.product_code;
                        const orderIndex = item.order_index || 0;
                        const url = (photo.url || photo).replace(/'/g, "''");
                        const now = new Date().toISOString();

                        rows.push(`('${productCode}', '${url}', ${orderIndex}, '${now}')`);
                    }

                    await this.db.execAsync(
                        `INSERT INTO product_photos (product_code, url, order_index, created_at) VALUES ${rows.join(',')}`
                    );

                    insertedCount += chunk.length;
                }

                await this.db.execAsync('COMMIT');
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[DB] ✅ Bulk inserted ${insertedCount} photos in ${duration}s`);
                return true;

            } catch (error) {
                await this.db.execAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('[DB] Error bulk inserting photos:', error);
            throw error;
        }
    }

    // ==================== OPTIMIZED BULK QUERIES (FIX N+1 PROBLEM) ====================
    /**
     * Get ALL product photos in a single query and return as Map grouped by product_code
     * This is MUCH faster than calling getProductPhotos() for each product
     */
    async getAllProductPhotos() {
        try {
            const result = await this.db.getAllAsync(
                'SELECT product_code, url, order_index FROM product_photos ORDER BY product_code, order_index ASC'
            );

            // Group photos by product_code for O(1) lookup
            const photosByProduct = new Map();
            for (const photo of result || []) {
                if (!photosByProduct.has(photo.product_code)) {
                    photosByProduct.set(photo.product_code, []);
                }
                photosByProduct.get(photo.product_code).push({ url: photo.url });
            }

            console.log(`[DB] ✅ Loaded ${result?.length || 0} photos for ${photosByProduct.size} products in single query`);
            return photosByProduct;
        } catch (error) {
            console.error('[DB] Error getting all photos:', error);
            return new Map();
        }
    }

    /**
     * Get ALL product goddowns in a single query and return as Map grouped by product_code
     * This is MUCH faster than calling getProductGoddowns() for each product
     */
    async getAllProductGoddowns() {
        try {
            const result = await this.db.getAllAsync(
                'SELECT product_code, barcode, name, quantity FROM product_goddowns ORDER BY product_code, name ASC'
            );

            // Group goddowns by product_code for O(1) lookup
            const goddownsByProduct = new Map();
            for (const godown of result || []) {
                if (!goddownsByProduct.has(godown.product_code)) {
                    goddownsByProduct.set(godown.product_code, []);
                }
                goddownsByProduct.get(godown.product_code).push({
                    barcode: godown.barcode,
                    name: godown.name,
                    quantity: godown.quantity
                });
            }

            console.log(`[DB] ✅ Loaded ${result?.length || 0} goddowns for ${goddownsByProduct.size} products in single query`);
            return goddownsByProduct;
        } catch (error) {
            console.error('[DB] Error getting all goddowns:', error);
            return new Map();
        }
    }

    // ==================== PRODUCT GODDOWNS ====================
    async saveProductGoddowns(productCode, goddowns) {
        try {
            if (!goddowns || goddowns.length === 0) return true;
            await this.db.runAsync('DELETE FROM product_goddowns WHERE product_code = ?', [productCode]);

            for (const godown of goddowns) {
                await this.db.runAsync(
                    `INSERT INTO product_goddowns (product_code, barcode, name, quantity, created_at) VALUES (?, ?, ?, ?, ?)`,
                    [productCode, godown.barcode || '', godown.name || '', parseFloat(godown.quantity || 0), new Date().toISOString()]
                );
            }
            return true;
        } catch (error) {
            console.error('[DB] Error saving goddowns:', error);
            throw error;
        }
    }

    async getProductGoddowns(productCode) {
        try {
            const result = await this.db.getAllAsync('SELECT * FROM product_goddowns WHERE product_code = ? ORDER BY name ASC', [productCode]);
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting goddowns:', error);
            return [];
        }
    }

    async getGoddownsByBarcode(barcode) {
        try {
            const result = await this.db.getAllAsync('SELECT * FROM product_goddowns WHERE barcode = ? ORDER BY name ASC', [barcode]);
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting goddowns:', error);
            return [];
        }
    }

    // ==================== BULK INSERT FOR GODDOWNS (OPTIMIZED WITH TRANSACTION) ====================
    async saveGoddownsBulk(goddownsWithProductCode) {
        try {
            if (!goddownsWithProductCode || goddownsWithProductCode.length === 0) {
                console.log('[DB] No goddowns to save');
                return true;
            }

            console.log(`[DB] Bulk inserting ${goddownsWithProductCode.length} goddowns...`);
            const startTime = Date.now();

            await this.db.execAsync('BEGIN TRANSACTION');

            try {
                await this.db.execAsync('DELETE FROM product_goddowns');

                const chunkSize = 1000;
                let insertedCount = 0;

                for (let i = 0; i < goddownsWithProductCode.length; i += chunkSize) {
                    const chunk = goddownsWithProductCode.slice(i, i + chunkSize);
                    const rows = [];

                    for (const item of chunk) {
                        const godown = item.godown || item;
                        const productCode = item.product_code;
                        const barcode = (godown.barcode || '').replace(/'/g, "''");
                        const name = (godown.goddown_name || godown.name || '').replace(/'/g, "''");
                        const quantity = parseFloat(godown.quantity || 0);
                        const now = new Date().toISOString();

                        rows.push(`('${productCode}', '${barcode}', '${name}', ${quantity}, '${now}')`);
                    }

                    await this.db.execAsync(
                        `INSERT INTO product_goddowns (product_code, barcode, name, quantity, created_at) VALUES ${rows.join(',')}`
                    );

                    insertedCount += chunk.length;
                }

                await this.db.execAsync('COMMIT');
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[DB] ✅ Bulk inserted ${insertedCount} goddowns in ${duration}s`);
                return true;

            } catch (error) {
                await this.db.execAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('[DB] Error bulk inserting goddowns:', error);
            throw error;
        }
    }

    // ==================== OFFLINE COLLECTIONS ====================
    async saveOfflineCollection(collection) {
        try {
            const localId = collection.local_id || `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.db.runAsync(
                `INSERT INTO offline_collections 
                (local_id, customer_code, customer_name, customer_place, customer_phone, amount, payment_type, cheque_number, remarks, date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [localId, collection.customer_code || collection.code, collection.customer_name || collection.name,
                    collection.customer_place || collection.place || null, collection.customer_phone || collection.phone || null,
                    collection.amount, collection.payment_type || collection.type, collection.cheque_number || null,
                    collection.remarks || null, collection.date || new Date().toISOString(), new Date().toISOString()]
            );
            console.log('[DB] Offline collection saved:', localId);
            return localId;
        } catch (error) {
            console.error('[DB] Error saving collection:', error);
            throw error;
        }
    }

    async getOfflineCollections(syncedOnly) {
        try {
            let query = 'SELECT * FROM offline_collections';
            if (syncedOnly !== undefined && syncedOnly !== null) {
                query += ` WHERE synced = ${syncedOnly ? 1 : 0}`;
            }
            query += ' ORDER BY created_at DESC';
            const result = await this.db.getAllAsync(query);
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting collections:', error);
            return [];
        }
    }

    async markCollectionAsSynced(localId) {
        try {
            await this.db.runAsync('UPDATE offline_collections SET synced = 1, synced_at = ? WHERE local_id = ?',
                [new Date().toISOString(), localId]);
            return true;
        } catch (error) {
            console.error('[DB] Error marking collection synced:', error);
            return false;
        }
    }

    async deleteCollection(collectionId) {
        try {
            await this.db.runAsync('DELETE FROM offline_collections WHERE id = ?', [collectionId]);
            return true;
        } catch (error) {
            console.error('[DB] Error deleting collection:', error);
            return false;
        }
    }

    // ==================== OFFLINE ORDERS ====================
    async saveOfflineOrder(order) {
        try {
            const localId = order.local_id || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.db.runAsync(
                `INSERT INTO offline_orders 
                (local_id, customer_code, customer_name, area, payment_type, items, total_amount, date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [localId, order.customer_code, order.customer_name, order.area || '', order.payment_type,
                    JSON.stringify(order.items), order.total_amount, order.date || new Date().toISOString(), new Date().toISOString()]
            );
            console.log('[DB] Offline order saved:', localId);
            return localId;
        } catch (error) {
            console.error('[DB] Error saving order:', error);
            throw error;
        }
    }

    async getOfflineOrders(syncedOnly = false) {
        try {
            let query = 'SELECT * FROM offline_orders';
            if (syncedOnly !== null) {
                query += ` WHERE synced = ${syncedOnly ? 1 : 0}`;
            }
            query += ' ORDER BY created_at DESC';
            const result = await this.db.getAllAsync(query);
            return (result || []).map(order => ({ ...order, items: JSON.parse(order.items || '[]') }));
        } catch (error) {
            console.error('[DB] Error getting orders:', error);
            return [];
        }
    }

    async markOrderAsSynced(localId) {
        try {
            await this.db.runAsync('UPDATE offline_orders SET synced = 1, synced_at = ? WHERE local_id = ?',
                [new Date().toISOString(), localId]);
            return true;
        } catch (error) {
            console.error('[DB] Error marking order synced:', error);
            return false;
        }
    }

    // ==================== CUSTOMER LEDGER ====================
    async saveCustomerLedger(customerCode, ledgerEntries) {
        try {
            await this.db.runAsync('DELETE FROM customer_ledger WHERE customer_code = ?', [customerCode]);
            for (const entry of ledgerEntries) {
                await this.db.runAsync(
                    `INSERT INTO customer_ledger 
                    (customer_code, voucher_no, date, particulars, debit, credit, balance, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [customerCode, entry.voucher_no || '', entry.date || '', entry.particulars || '',
                        entry.debit || 0, entry.credit || 0, entry.balance || 0, new Date().toISOString()]
                );
            }
            return true;
        } catch (error) {
            console.error('[DB] Error saving ledger:', error);
            throw error;
        }
    }

    async getCustomerLedger(customerCode) {
        try {
            const result = await this.db.getAllAsync(
                'SELECT * FROM customer_ledger WHERE customer_code = ? ORDER BY date DESC', [customerCode]
            );
            return result || [];
        } catch (error) {
            console.error('[DB] Error getting ledger:', error);
            return [];
        }
    }

    // ==================== SYNC METADATA ====================
    async setSyncMetadata(key, value) {
        try {
            await this.db.runAsync('INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
                [key, JSON.stringify(value), new Date().toISOString()]);
            return true;
        } catch (error) {
            console.error('[DB] Error setting metadata:', error);
            return false;
        }
    }

    async getSyncMetadata(key) {
        try {
            // Ensure database is initialized
            if (!this.db || !this.isInitialized) {
                console.log('[DB] Database not initialized yet, initializing...');
                await this.init();
            }

            const result = await this.db.getFirstAsync('SELECT value FROM sync_metadata WHERE key = ?', [key]);
            return result?.value || null;
        } catch (error) {
            console.error('[DB] Error getting metadata:', error);
            return null;
        }
    }

    async getLastSyncTime() {
        return await this.getSyncMetadata('last_sync_time');
    }

    async setLastSyncTime(time) {
        return await this.setSyncMetadata('last_sync_time', time);
    }

    // ==================== UTILITY ====================
    async clearDownloadableData() {
        try {
            await this.db.runAsync('DELETE FROM customers');
            await this.db.runAsync('DELETE FROM products');
            await this.db.runAsync('DELETE FROM areas');
            await this.db.runAsync('DELETE FROM customer_ledger');
            await this.db.runAsync('DELETE FROM batches');
            await this.db.runAsync('DELETE FROM product_photos');
            await this.db.runAsync('DELETE FROM product_goddowns');
            console.log('[DB] ✅ Downloadable data cleared');
            return true;
        } catch (error) {
            console.error('[DB] Error clearing data:', error);
            return false;
        }
    }

    async clearAllData() {
        try {
            await this.db.runAsync('DELETE FROM customers');
            await this.db.runAsync('DELETE FROM products');
            await this.db.runAsync('DELETE FROM areas');
            await this.db.runAsync('DELETE FROM offline_collections');
            await this.db.runAsync('DELETE FROM offline_orders');
            await this.db.runAsync('DELETE FROM customer_ledger');
            await this.db.runAsync('DELETE FROM company_info');
            await this.db.runAsync('DELETE FROM sync_metadata');
            await this.db.runAsync('DELETE FROM batches');
            await this.db.runAsync('DELETE FROM product_photos');
            await this.db.runAsync('DELETE FROM product_goddowns');
            console.log('[DB] ✅ All data cleared');
            return true;
        } catch (error) {
            console.error('[DB] Error clearing all data:', error);
            return false;
        }
    }

    async getDataStats() {
        try {
            // Ensure database is initialized
            if (!this.db || !this.isInitialized) {
                console.log('[DB] Database not initialized yet, initializing...');
                await this.init();
            }

            const stats = {
                customers: 0,
                products: 0,
                offlineCollections: 0,
                offlineOrders: 0,
                pendingCollections: 0,
                pendingOrders: 0
            };

            const customerCount = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM customers');
            stats.customers = customerCount?.count || 0;

            const productCount = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM products');
            stats.products = productCount?.count || 0;

            const collectionCount = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM offline_collections');
            stats.offlineCollections = collectionCount?.count || 0;

            const orderCount = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM offline_orders');
            stats.offlineOrders = orderCount?.count || 0;

            const pendingCollections = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM offline_collections WHERE synced = 0');
            stats.pendingCollections = pendingCollections?.count || 0;

            const pendingOrders = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM offline_orders WHERE synced = 0');
            stats.pendingOrders = pendingOrders?.count || 0;

            return stats;
        } catch (error) {
            console.error('[DB] Error getting data stats:', error);
            return {
                customers: 0,
                products: 0,
                offlineCollections: 0,
                offlineOrders: 0,
                pendingCollections: 0,
                pendingOrders: 0
            };
        }
    }
}

// Create singleton instance
const dbService = new DatabaseService();
export default dbService;