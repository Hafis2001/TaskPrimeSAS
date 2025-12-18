// src/services/syncService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import dbService from './database';

const API_BASE_URL = 'https://tasksas.com/api';

class SyncService {
    constructor() {
        this.isDownloading = false;
        this.isUploading = false;
        this.downloadProgress = 0;
        this.progressCallback = null;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    updateProgress(message, progress) {
        this.downloadProgress = progress;
        if (this.progressCallback) {
            this.progressCallback({ message, progress });
        }
    }

    async getAuthToken() {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                throw new Error('No auth token found. Please login again.');
            }
            return token;
        } catch (error) {
            console.error('Error getting auth token:', error);
            throw error;
        }
    }

    // ==================== DOWNLOAD ALL DATA ====================

    async downloadAllData() {
        if (this.isDownloading) {
            throw new Error('Download already in progress');
        }

        this.isDownloading = true;
        this.downloadProgress = 0;

        try {
            // Initialize database if not already done
            await dbService.init();

            this.updateProgress('Clearing old data...', 5);

            // Clear old customers and products data to ensure fresh data
            await dbService.clearDownloadableData();

            this.updateProgress('Downloading customers...', 15);

            // Download customers
            await this.downloadCustomers();
            this.updateProgress('Downloading products...', 50);

            // Download products
            await this.downloadProducts();
            this.updateProgress('Finalizing...', 90);

            // Set last sync time
            await dbService.setLastSyncTime(new Date().toISOString());

            this.updateProgress('Download complete!', 100);

            return {
                success: true,
                message: 'All data downloaded successfully'
            };
        } catch (error) {
            console.error('Download error:', error);
            this.updateProgress('Download failed', 0);
            throw error;
        } finally {
            this.isDownloading = false;
        }
    }

    async downloadCustomers() {
        try {
            this.updateProgress('Downloading customers...', 10);

            const token = await this.getAuthToken();
            const response = await fetch(`${API_BASE_URL}/debtors/get-debtors/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch customers: ${response.status}`);
            }

            const data = await response.json();

            // Handle different response formats
            let customers = [];
            if (Array.isArray(data)) {
                customers = data;
            } else if (data.data && Array.isArray(data.data)) {
                customers = data.data;
            } else if (data.debtors && Array.isArray(data.debtors)) {
                customers = data.debtors;
            }

            this.updateProgress(`Saving ${customers.length} customers...`, 25);

            // Save to database
            await dbService.saveCustomers(customers);

            console.log(`Downloaded and saved ${customers.length} customers`);

            return customers.length;
        } catch (error) {
            console.error('Error downloading customers:', error);
            throw new Error(`Failed to download customers: ${error.message}`);
        }
    }

    async downloadProducts() {
        try {
            this.updateProgress('Downloading products...', 40);

            const token = await this.getAuthToken();

            // Try different possible product endpoints (matching OrderDetails.js)
            const endpoints = [
                `${API_BASE_URL}/product/get-product-details`,  // Main endpoint used in OrderDetails
                `${API_BASE_URL}/products/`,
                `${API_BASE_URL}/product`,
                `${API_BASE_URL}/stock`,
                `${API_BASE_URL}/inventory`,
            ];

            let products = [];
            let success = false;
            let successfulEndpoint = null;

            for (const endpoint of endpoints) {
                try {
                    console.log(`[Sync] Trying product endpoint: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[Sync] Response from ${endpoint}:`, typeof data, Array.isArray(data) ? `Array(${data.length})` : 'Object');

                        // Handle different response formats
                        if (Array.isArray(data)) {
                            products = data;
                        } else if (data.data && Array.isArray(data.data)) {
                            products = data.data;
                        } else if (data.products && Array.isArray(data.products)) {
                            products = data.products;
                        } else if (data.stock && Array.isArray(data.stock)) {
                            products = data.stock;
                        } else if (data.inventory && Array.isArray(data.inventory)) {
                            products = data.inventory;
                        }

                        if (products.length > 0) {
                            success = true;
                            successfulEndpoint = endpoint;
                            console.log(`[Sync] ✅ Found ${products.length} products from ${endpoint}`);
                            break;
                        }
                    } else {
                        console.log(`[Sync] ${endpoint} returned ${response.status}`);
                    }
                } catch (err) {
                    console.log(`[Sync] Failed to fetch from ${endpoint}:`, err.message);
                    continue;
                }
            }

            if (!success || products.length === 0) {
                console.warn('[Sync] ⚠️ No products downloaded - will retry with all endpoints');
                return 0;
            }

            this.updateProgress(`Saving ${products.length} products...`, 70);

            // Normalize product data before saving
            const normalizedProducts = products.map(p => ({
                code: p.code || p.productcode || p.PRODUCTCODE || p.id || '',
                name: p.name || p.productname || p.PRODUCTNAME || 'Unknown',
                barcode: p.barcode || p.BARCODE || p.code || '',
                price: parseFloat(p.price || p['NET RATE'] || p.netrate || p.PRICE || 0),
                mrp: parseFloat(p.mrp || p.MRP || 0),
                stock: parseFloat(p.stock || p.STOCK || 0),
                unit: p.unit || p.packing || p.PACKING || '',
                brand: p.brand || p.BRAND || '',
                category: p.category || p.product || p.PRODUCT || '',
                taxcode: p.taxcode || p.TAXCODE || '',
                description: p.description || '',
            })).filter(p => p.code && p.name);  // Only save products with code and name

            console.log(`[Sync] Normalized ${normalizedProducts.length} valid products`);

            // Save to database
            await dbService.saveProducts(normalizedProducts);

            console.log(`[Sync] ✅ Downloaded and saved ${normalizedProducts.length} products from ${successfulEndpoint}`);

            return normalizedProducts.length;
        } catch (error) {
            console.error('[Sync] Error downloading products:', error);
            console.error('[Sync] Error details:', error.stack);
            // Don't throw - allow sync to continue for customers
            return 0;
        }
    }

    // ==================== UPLOAD PENDING DATA ====================

    async uploadPendingData() {
        if (this.isUploading) {
            throw new Error('Upload already in progress');
        }

        this.isUploading = true;

        try {
            const token = await this.getAuthToken();

            // Upload pending collections
            const collectionsUploaded = await this.uploadPendingCollections(token);

            // Upload pending orders
            const ordersUploaded = await this.uploadPendingOrders(token);

            return {
                success: true,
                collectionsUploaded,
                ordersUploaded,
                message: `Uploaded ${collectionsUploaded} collections and ${ordersUploaded} orders`
            };
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        } finally {
            this.isUploading = false;
        }
    }

    async uploadPendingCollections(token) {
        try {
            const pendingCollections = await dbService.getOfflineCollections(false);

            if (pendingCollections.length === 0) {
                return 0;
            }

            console.log(`Uploading ${pendingCollections.length} pending collections`);

            let uploaded = 0;
            for (const collection of pendingCollections) {
                try {
                    const response = await fetch(`${API_BASE_URL}/collections/save/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            customer_code: collection.customer_code,
                            customer_name: collection.customer_name,
                            amount: collection.amount,
                            payment_type: collection.payment_type,
                            cheque_number: collection.cheque_number,
                            remarks: collection.remarks,
                            date: collection.date,
                        }),
                    });

                    if (response.ok) {
                        await dbService.markCollectionAsSynced(collection.local_id);
                        uploaded++;
                    } else {
                        console.error(`Failed to upload collection ${collection.local_id}`);
                    }
                } catch (error) {
                    console.error(`Error uploading collection ${collection.local_id}:`, error);
                }
            }

            console.log(`Successfully uploaded ${uploaded}/${pendingCollections.length} collections`);
            return uploaded;
        } catch (error) {
            console.error('Error in uploadPendingCollections:', error);
            return 0;
        }
    }

    async uploadPendingOrders(token) {
        try {
            const pendingOrders = await dbService.getOfflineOrders(false);

            if (pendingOrders.length === 0) {
                return 0;
            }

            console.log(`Uploading ${pendingOrders.length} pending orders`);

            let uploaded = 0;
            for (const order of pendingOrders) {
                try {
                    // Adjust endpoint based on your API
                    const response = await fetch(`${API_BASE_URL}/orders/save/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            customer_code: order.customer_code,
                            customer_name: order.customer_name,
                            area: order.area,
                            payment_type: order.payment_type,
                            items: order.items,
                            total_amount: order.total_amount,
                            date: order.date,
                        }),
                    });

                    if (response.ok) {
                        await dbService.markOrderAsSynced(order.local_id);
                        uploaded++;
                    } else {
                        console.error(`Failed to upload order ${order.local_id}`);
                    }
                } catch (error) {
                    console.error(`Error uploading order ${order.local_id}:`, error);
                }
            }

            console.log(`Successfully uploaded ${uploaded}/${pendingOrders.length} orders`);
            return uploaded;
        } catch (error) {
            console.error('Error in uploadPendingOrders:', error);
            return 0;
        }
    }

    // ==================== UTILITY ====================

    async getStats() {
        try {
            // Initialize database if not already done
            await dbService.init().catch(err => {
                console.log('Database already initialized or init failed:', err.message);
            });

            const stats = await dbService.getDataStats();
            const lastSync = await dbService.getLastSyncTime();

            return {
                ...stats,
                lastSyncTime: lastSync,
                hasData: stats.customers > 0 || stats.products > 0,
                hasPendingUploads: stats.pendingCollections > 0 || stats.pendingOrders > 0
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            // Return default stats instead of null to prevent crashes
            return {
                customers: 0,
                products: 0,
                offlineCollections: 0,
                offlineOrders: 0,
                pendingCollections: 0,
                pendingOrders: 0,
                lastSyncTime: null,
                hasData: false,
                hasPendingUploads: false
            };
        }
    }

    async clearAllData() {
        try {
            await dbService.clearAllData();
            console.log('All offline data cleared');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
