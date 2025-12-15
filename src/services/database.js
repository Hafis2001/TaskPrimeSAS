// src/services/database.js
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'taskprime.db';

class DatabaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized && this.db) {
            console.log('Database already initialized');
            return true;
        }

        try {
            console.log('Initializing database...');
            this.db = await SQLite.openDatabaseAsync(DB_NAME);
            console.log('Database opened');

            await this.createTables();
            this.isInitialized = true;
            console.log('Database initialized successfully');
            return true;
        } catch (error) {
            console.error('Database initialization error:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    async createTables() {
        try {
            console.log('Creating tables...');

            // Customers/Debtors table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS customers (
          code TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          place TEXT,
          area TEXT,
          phone TEXT,
          phone2 TEXT,
          super_code TEXT,
          balance REAL DEFAULT 0,
          master_debit REAL DEFAULT 0,
          master_credit REAL DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
      `);

            // Products table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE,
          name TEXT NOT NULL,
          barcode TEXT,
          price REAL DEFAULT 0,
          stock REAL DEFAULT 0,
          unit TEXT,
          category TEXT,
          description TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);

            // Create index on barcode
            await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      `);

            // Company info table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS company_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT UNIQUE,
          name TEXT,
          address TEXT,
          phone TEXT,
          email TEXT,
          data TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);

            // Offline collections table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_collections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_id TEXT UNIQUE,
          customer_code TEXT,
          customer_name TEXT,
          amount REAL,
          payment_type TEXT,
          cheque_number TEXT,
          remarks TEXT,
          date TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT,
          synced_at TEXT
        );
      `);

            // Offline orders table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_id TEXT UNIQUE,
          customer_code TEXT,
          customer_name TEXT,
          area TEXT,
          payment_type TEXT,
          items TEXT,
          total_amount REAL,
          date TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT,
          synced_at TEXT
        );
      `);

            // Customer ledger cache table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS customer_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_code TEXT,
          voucher_no TEXT,
          date TEXT,
          particulars TEXT,
          debit REAL DEFAULT 0,
          credit REAL DEFAULT 0,
          balance REAL DEFAULT 0,
          created_at TEXT
        );
      `);

            // Sync metadata table
            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT
        );
      `);

            console.log('All tables created successfully');
        } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
        }
    }

    // ==================== CUSTOMERS ====================

    async saveCustomers(customers) {
        try {
            console.log(`Saving ${customers.length} customers...`);

            for (const customer of customers) {
                await this.db.runAsync(
                    `INSERT OR REPLACE INTO customers 
          (code, name, place, area, phone, phone2, super_code, balance, master_debit, master_credit, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        customer.code,
                        customer.name,
                        customer.place || '',
                        customer.area || '',
                        customer.phone || '',
                        customer.phone2 || '',
                        customer.super_code || '',
                        customer.balance || 0,
                        customer.master_debit || 0,
                        customer.master_credit || 0,
                        new Date().toISOString()
                    ]
                );
            }

            console.log(`✅ Saved ${customers.length} customers to database`);
            return true;
        } catch (error) {
            console.error('Error saving customers:', error);
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
            console.log(`Found ${result?.length || 0} customers${superCode ? ` with super_code ${superCode}` : ''}`);
            return result || [];
        } catch (error) {
            console.error('Error getting customers:', error);
            return [];
        }
    }

    async getCustomerByCode(code) {
        try {
            const result = await this.db.getFirstAsync(
                'SELECT * FROM customers WHERE code = ?',
                [code]
            );
            return result;
        } catch (error) {
            console.error('Error getting customer by code:', error);
            return null;
        }
    }

    async searchCustomers(query, superCode = null) {
        try {
            let sql = `SELECT * FROM customers WHERE 
                 (name LIKE ? OR code LIKE ? OR phone LIKE ? OR area LIKE ?)`;
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
            console.error('Error searching customers:', error);
            return [];
        }
    }

    // ==================== PRODUCTS ====================

    async saveProducts(products) {
        try {
            console.log(`Saving ${products.length} products...`);

            for (const product of products) {
                await this.db.runAsync(
                    `INSERT OR REPLACE INTO products 
          (code, name, barcode, price, stock, unit, category, description, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        product.code || product.id,
                        product.name,
                        product.barcode || '',
                        product.price || 0,
                        product.stock || 0,
                        product.unit || '',
                        product.category || '',
                        product.description || '',
                        new Date().toISOString()
                    ]
                );
            }

            console.log(`✅ Saved ${products.length} products to database`);
            return true;
        } catch (error) {
            console.error('Error saving products:', error);
            throw error;
        }
    }

    async getProducts() {
        try {
            const result = await this.db.getAllAsync(
                'SELECT * FROM products ORDER BY name ASC'
            );
            console.log(`Found ${result?.length || 0} products`);
            return result || [];
        } catch (error) {
            console.error('Error getting products:', error);
            return [];
        }
    }

    async getProductByBarcode(barcode) {
        try {
            const result = await this.db.getFirstAsync(
                'SELECT * FROM products WHERE barcode = ?',
                [barcode]
            );
            return result;
        } catch (error) {
            console.error('Error getting product by barcode:', error);
            return null;
        }
    }

    async searchProducts(query) {
        try {
            const searchTerm = `%${query}%`;
            const result = await this.db.getAllAsync(
                `SELECT * FROM products WHERE 
         name LIKE ? OR code LIKE ? OR barcode LIKE ?
         ORDER BY name ASC LIMIT 50`,
                [searchTerm, searchTerm, searchTerm]
            );
            return result || [];
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    }

    // ==================== OFFLINE COLLECTIONS ====================

    async saveOfflineCollection(collection) {
        try {
            const localId = collection.local_id || `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.db.runAsync(
                `INSERT INTO offline_collections 
        (local_id, customer_code, customer_name, amount, payment_type, cheque_number, remarks, date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    localId,
                    collection.customer_code,
                    collection.customer_name,
                    collection.amount,
                    collection.payment_type,
                    collection.cheque_number || null,
                    collection.remarks || null,
                    collection.date || new Date().toISOString(),
                    new Date().toISOString()
                ]
            );

            console.log('Offline collection saved:', localId);
            return localId;
        } catch (error) {
            console.error('Error saving offline collection:', error);
            throw error;
        }
    }

    async getOfflineCollections(syncedOnly = false) {
        try {
            let query = 'SELECT * FROM offline_collections';
            if (syncedOnly !== null) {
                query += ` WHERE synced = ${syncedOnly ? 1 : 0}`;
            }
            query += ' ORDER BY created_at DESC';

            const result = await this.db.getAllAsync(query);
            return result || [];
        } catch (error) {
            console.error('Error getting offline collections:', error);
            return [];
        }
    }

    async markCollectionAsSynced(localId) {
        try {
            await this.db.runAsync(
                'UPDATE offline_collections SET synced = 1, synced_at = ? WHERE local_id = ?',
                [new Date().toISOString(), localId]
            );
            return true;
        } catch (error) {
            console.error('Error marking collection as synced:', error);
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
                [
                    localId,
                    order.customer_code,
                    order.customer_name,
                    order.area || '',
                    order.payment_type,
                    JSON.stringify(order.items),
                    order.total_amount,
                    order.date || new Date().toISOString(),
                    new Date().toISOString()
                ]
            );

            console.log('Offline order saved:', localId);
            return localId;
        } catch (error) {
            console.error('Error saving offline order:', error);
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
            return (result || []).map(order => ({
                ...order,
                items: JSON.parse(order.items || '[]')
            }));
        } catch (error) {
            console.error('Error getting offline orders:', error);
            return [];
        }
    }

    async markOrderAsSynced(localId) {
        try {
            await this.db.runAsync(
                'UPDATE offline_orders SET synced = 1, synced_at = ? WHERE local_id = ?',
                [new Date().toISOString(), localId]
            );
            return true;
        } catch (error) {
            console.error('Error marking order as synced:', error);
            return false;
        }
    }

    // ==================== CUSTOMER LEDGER ====================

    async saveCustomerLedger(customerCode, ledgerEntries) {
        try {
            // Clear old ledger
            await this.db.runAsync(
                'DELETE FROM customer_ledger WHERE customer_code = ?',
                [customerCode]
            );

            // Insert new entries
            for (const entry of ledgerEntries) {
                await this.db.runAsync(
                    `INSERT INTO customer_ledger 
          (customer_code, voucher_no, date, particulars, debit, credit, balance, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        customerCode,
                        entry.voucher_no || '',
                        entry.date || '',
                        entry.particulars || '',
                        entry.debit || 0,
                        entry.credit || 0,
                        entry.balance || 0,
                        new Date().toISOString()
                    ]
                );
            }

            console.log(`Saved ledger for customer ${customerCode}`);
            return true;
        } catch (error) {
            console.error('Error saving customer ledger:', error);
            throw error;
        }
    }

    async getCustomerLedger(customerCode) {
        try {
            const result = await this.db.getAllAsync(
                'SELECT * FROM customer_ledger WHERE customer_code = ? ORDER BY date DESC',
                [customerCode]
            );
            return result || [];
        } catch (error) {
            console.error('Error getting customer ledger:', error);
            return [];
        }
    }

    // ==================== SYNC METADATA ====================

    async setSyncMetadata(key, value) {
        try {
            await this.db.runAsync(
                'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
                [key, JSON.stringify(value), new Date().toISOString()]
            );
            return true;
        } catch (error) {
            console.error('Error setting sync metadata:', error);
            return false;
        }
    }

    async getSyncMetadata(key) {
        try {
            const result = await this.db.getFirstAsync(
                'SELECT value FROM sync_metadata WHERE key = ?',
                [key]
            );
            return result ? JSON.parse(result.value) : null;
        } catch (error) {
            console.error('Error getting sync metadata:', error);
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

    async clearAllData() {
        try {
            await this.db.runAsync('DELETE FROM customers');
            await this.db.runAsync('DELETE FROM products');
            await this.db.runAsync('DELETE FROM offline_collections');
            await this.db.runAsync('DELETE FROM offline_orders');
            await this.db.runAsync('DELETE FROM customer_ledger');
            await this.db.runAsync('DELETE FROM company_info');
            await this.db.runAsync('DELETE FROM sync_metadata');
            console.log('All data cleared');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    async getDataStats() {
        try {
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
            console.error('Error getting data stats:', error);
            return null;
        }
    }
}

// Create singleton instance
const dbService = new DatabaseService();

export default dbService;
