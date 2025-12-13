// db.js
import * as SQLite from "expo-sqlite";

// Open database using the modern API
const db = SQLite.openDatabaseSync("myapp.db");

// ========================
// INITIALIZE DATABASE
// ========================
export const initDB = async () => {
  try {
    // Create customers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        place TEXT,
        phone TEXT,
        balance REAL
      );
    `);

    // Create collections table for offline storage
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_code TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_type TEXT NOT NULL,
        cheque_number TEXT,
        remarks TEXT,
        date TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT
      );
    `);

    console.log("DB initialized with customers and collections tables");
    return true;
  } catch (err) {
    console.error("initDB error:", err);
    throw err;
  }
};

// ========================
// CUSTOMER FUNCTIONS
// ========================

// Clear Customers Table
export const clearCustomers = async () => {
  try {
    await db.runAsync("DELETE FROM customers;");
    console.log("Customers table cleared");
    return true;
  } catch (err) {
    console.error("clearCustomers error:", err);
    throw err;
  }
};

// Save Customers (Bulk Insert)
export const saveCustomers = async (customers = []) => {
  if (!Array.isArray(customers)) customers = [];

  try {
    await db.withTransactionAsync(async () => {
      for (const c of customers) {
        const code = (c.code || c.id || c.code_no || "").toString();
        const name = c.name || c.customerName || "-";
        const place = c.place || c.city || c.address || "-";
        const phone = c.phone || c.mobile || "-";
        const balance = Number(c.balance ?? c.current_balance ?? 0);

        await db.runAsync(
          `INSERT OR REPLACE INTO customers 
           (code, name, place, phone, balance) 
           VALUES (?, ?, ?, ?, ?);`,
          [code, name, place, phone, balance]
        );
      }
    });
    console.log(`Saved ${customers.length} customers to database`);
    return true;
  } catch (err) {
    console.error("saveCustomers error:", err);
    throw err;
  }
};

// Get All Customers
export const getCustomers = async () => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC;"
    );
    return result || [];
  } catch (err) {
    console.error("getCustomers error:", err);
    throw err;
  }
};

// Get Customer by Code
export const getCustomerByCode = async (code) => {
  try {
    const result = await db.getFirstAsync(
      "SELECT * FROM customers WHERE code = ?;",
      [code]
    );
    return result || null;
  } catch (err) {
    console.error("getCustomerByCode error:", err);
    throw err;
  }
};

// Search Customers by Name
export const searchCustomers = async (searchTerm) => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM customers WHERE name LIKE ? ORDER BY name COLLATE NOCASE ASC;",
      [`%${searchTerm}%`]
    );
    return result || [];
  } catch (err) {
    console.error("searchCustomers error:", err);
    throw err;
  }
};

// Get Customers Summary (Total stores + total balance)
export const getCustomersSummary = async () => {
  try {
    const result = await db.getFirstAsync(
      "SELECT COUNT(*) AS totalStores, SUM(balance) AS totalBalance FROM customers;"
    );
    return {
      totalStores: result?.totalStores ?? 0,
      totalBalance: result?.totalBalance ?? 0,
    };
  } catch (err) {
    console.error("getCustomersSummary error:", err);
    throw err;
  }
};

// ========================
// COLLECTION FUNCTIONS
// ========================

// Save Collection
export const saveCollection = async (collection) => {
  try {
    const result = await db.runAsync(
      `INSERT INTO collections 
       (customer_code, customer_name, amount, payment_type, cheque_number, remarks, date, synced) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        collection.customer_code,
        collection.customer_name,
        collection.amount,
        collection.payment_type,
        collection.cheque_number || null,
        collection.remarks || null,
        collection.date,
        0 // Not synced yet
      ]
    );
    console.log("Collection saved to database with ID:", result.lastInsertRowId);
    return { success: true, id: result.lastInsertRowId };
  } catch (err) {
    console.error("saveCollection error:", err);
    throw err;
  }
};

// Get All Collections
export const getCollections = async () => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM collections ORDER BY created_at DESC;"
    );
    return result || [];
  } catch (err) {
    console.error("getCollections error:", err);
    throw err;
  }
};

// Get Unsynced Collections
export const getUnsyncedCollections = async () => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM collections WHERE synced = 0 ORDER BY created_at ASC;"
    );
    return result || [];
  } catch (err) {
    console.error("getUnsyncedCollections error:", err);
    throw err;
  }
};

// Get Synced Collections
export const getSyncedCollections = async () => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM collections WHERE synced = 1 ORDER BY synced_at DESC;"
    );
    return result || [];
  } catch (err) {
    console.error("getSyncedCollections error:", err);
    throw err;
  }
};

// Mark Collection as Synced
export const markCollectionSynced = async (collectionId) => {
  try {
    await db.runAsync(
      "UPDATE collections SET synced = 1, synced_at = ? WHERE id = ?;",
      [new Date().toISOString(), collectionId]
    );
    console.log(`Collection ${collectionId} marked as synced`);
    return true;
  } catch (err) {
    console.error("markCollectionSynced error:", err);
    throw err;
  }
};

// Mark Multiple Collections as Synced
export const markCollectionsSynced = async (collectionIds = []) => {
  if (!Array.isArray(collectionIds) || collectionIds.length === 0) {
    return true;
  }

  try {
    await db.withTransactionAsync(async () => {
      for (const id of collectionIds) {
        await db.runAsync(
          "UPDATE collections SET synced = 1, synced_at = ? WHERE id = ?;",
          [new Date().toISOString(), id]
        );
      }
    });
    console.log(`${collectionIds.length} collections marked as synced`);
    return true;
  } catch (err) {
    console.error("markCollectionsSynced error:", err);
    throw err;
  }
};

// Delete Collection
export const deleteCollection = async (collectionId) => {
  try {
    await db.runAsync("DELETE FROM collections WHERE id = ?;", [collectionId]);
    console.log(`Collection ${collectionId} deleted`);
    return true;
  } catch (err) {
    console.error("deleteCollection error:", err);
    throw err;
  }
};

// Clear All Synced Collections
export const clearSyncedCollections = async () => {
  try {
    await db.runAsync("DELETE FROM collections WHERE synced = 1;");
    console.log("All synced collections cleared");
    return true;
  } catch (err) {
    console.error("clearSyncedCollections error:", err);
    throw err;
  }
};

// Get Collections Count
export const getCollectionsCount = async () => {
  try {
    const result = await db.getFirstAsync(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) AS unsynced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) AS synced
       FROM collections;`
    );
    return {
      total: result?.total ?? 0,
      unsynced: result?.unsynced ?? 0,
      synced: result?.synced ?? 0,
    };
  } catch (err) {
    console.error("getCollectionsCount error:", err);
    throw err;
  }
};

// Get Collections Summary (Total amount)
export const getCollectionsSummary = async () => {
  try {
    const result = await db.getFirstAsync(
      `SELECT 
        COUNT(*) AS totalCollections,
        SUM(amount) AS totalAmount,
        SUM(CASE WHEN synced = 0 THEN amount ELSE 0 END) AS unsyncedAmount,
        SUM(CASE WHEN synced = 1 THEN amount ELSE 0 END) AS syncedAmount
       FROM collections;`
    );
    return {
      totalCollections: result?.totalCollections ?? 0,
      totalAmount: result?.totalAmount ?? 0,
      unsyncedAmount: result?.unsyncedAmount ?? 0,
      syncedAmount: result?.syncedAmount ?? 0,
    };
  } catch (err) {
    console.error("getCollectionsSummary error:", err);
    throw err;
  }
};

// Get Collections by Customer
export const getCollectionsByCustomer = async (customerCode) => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM collections WHERE customer_code = ? ORDER BY created_at DESC;",
      [customerCode]
    );
    return result || [];
  } catch (err) {
    console.error("getCollectionsByCustomer error:", err);
    throw err;
  }
};

// Get Collections by Date Range
export const getCollectionsByDateRange = async (startDate, endDate) => {
  try {
    const result = await db.getAllAsync(
      "SELECT * FROM collections WHERE date BETWEEN ? AND ? ORDER BY date DESC;",
      [startDate, endDate]
    );
    return result || [];
  } catch (err) {
    console.error("getCollectionsByDateRange error:", err);
    throw err;
  }
};

// ========================
// UTILITY FUNCTIONS
// ========================

// Clear All Data (both customers and collections)
export const clearAllData = async () => {
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM customers;");
      await db.runAsync("DELETE FROM collections;");
    });
    console.log("All data cleared from database");
    return true;
  } catch (err) {
    console.error("clearAllData error:", err);
    throw err;
  }
};

// Get Database Info
export const getDatabaseInfo = async () => {
  try {
    const customerCount = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM customers;"
    );
    const collectionCount = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM collections;"
    );
    const unsyncedCount = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM collections WHERE synced = 0;"
    );

    return {
      customers: customerCount?.count ?? 0,
      collections: collectionCount?.count ?? 0,
      unsynced: unsyncedCount?.count ?? 0,
    };
  } catch (err) {
    console.error("getDatabaseInfo error:", err);
    throw err;
  }
};

// Export database instance for advanced usage
export default db;