// src/services/syncService.js - OPTIMIZED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import batchService from './batchService';
import dbService from './database';

const API_BASE_URL = 'https://tasksas.com/api';

class SyncService {
    constructor() {
        this.isDownloading = false;
        this.isUploading = false;
        this.downloadProgress = 0;
        this.progressCallback = null;
        this.abortController = null;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    updateProgress(stage, message, progress, completed = false) {
        this.downloadProgress = progress;
        if (this.progressCallback) {
            this.progressCallback({ 
                stage,      // 'customers', 'products', 'batches', 'areas'
                message, 
                progress,
                completed 
            });
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

    // ==================== CHECK IF DATA EXISTS ====================
    async hasDownloadedData() {
        try {
            await dbService.init();
            const stats = await dbService.getDataStats();
            return stats.customers > 0 && stats.products > 0;
        } catch (error) {
            console.error('Error checking downloaded data:', error);
            return false;
        }
    }

    // ==================== DOWNLOAD ALL DATA (OPTIMIZED) ====================
    async downloadAllData(forceRefresh = false) {
        if (this.isDownloading) {
            throw new Error('Download already in progress');
        }

        this.isDownloading = true;
        this.downloadProgress = 0;
        this.abortController = new AbortController();

        const stages = {
            customers: false,
            products: false,
            batches: false,
            areas: false
        };

        try {
            // Initialize database
            await dbService.init();

            // If force refresh, clear old data
            if (forceRefresh) {
                this.updateProgress('init', 'Clearing old data...', 5);
                await dbService.clearDownloadableData();
            }

            // Stage 1: Download customers
            this.updateProgress('customers', 'Downloading customers...', 10);
            try {
                await this.downloadCustomers();
                stages.customers = true;
                this.updateProgress('customers', 'Customers downloaded', 25, true);
            } catch (error) {
                console.error('Customer download failed:', error);
                this.updateProgress('customers', 'Customers failed', 25, false);
            }

            // Stage 2: Download products (with better error handling)
            this.updateProgress('products', 'Downloading products...', 30);
            try {
                const productCount = await this.downloadProductsOptimized();
                if (productCount > 0) {
                    stages.products = true;
                    this.updateProgress('products', `${productCount} products downloaded`, 50, true);
                } else {
                    this.updateProgress('products', 'No products found', 50, false);
                }
            } catch (error) {
                console.error('Product download failed:', error);
                this.updateProgress('products', 'Products failed', 50, false);
            }

            // Stage 3: Download batches (only if products exist)
            if (stages.products) {
                this.updateProgress('batches', 'Downloading batches...', 55);
                try {
                    const batchCount = await this.downloadProductBatches();
                    stages.batches = true;
                    this.updateProgress('batches', `${batchCount} batches downloaded`, 75, true);
                } catch (error) {
                    console.error('Batch download failed:', error);
                    this.updateProgress('batches', 'Batches failed', 75, false);
                }
            }

            // Stage 4: Download areas
            this.updateProgress('areas', 'Downloading areas...', 80);
            try {
                await this.downloadAreas();
                stages.areas = true;
                this.updateProgress('areas', 'Areas downloaded', 90, true);
            } catch (error) {
                console.error('Area download failed:', error);
                this.updateProgress('areas', 'Areas failed', 90, false);
            }

            // Set last sync time
            await dbService.setLastSyncTime(new Date().toISOString());

            this.updateProgress('complete', 'Download complete!', 100, true);

            return {
                success: true,
                stages,
                message: 'Data synchronized successfully'
            };
        } catch (error) {
            console.error('Download error:', error);
            this.updateProgress('error', 'Download failed', 0);
            throw error;
        } finally {
            this.isDownloading = false;
            this.abortController = null;
        }
    }

    // ==================== OPTIMIZED PRODUCT DOWNLOAD ====================
    async downloadProductsOptimized() {
        try {
            const token = await this.getAuthToken();

            // Primary endpoint (most reliable based on your code)
            const primaryEndpoint = `${API_BASE_URL}/product/get-product-details`;
            
            console.log(`[Sync] Fetching products from: ${primaryEndpoint}`);
            
            const response = await fetch(primaryEndpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                signal: this.abortController?.signal
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            console.log(`[Sync] Product API response type:`, typeof data);

            // Parse response
            let products = [];
            if (Array.isArray(data)) {
                products = data;
            } else if (data.data && Array.isArray(data.data)) {
                products = data.data;
            } else if (data.products && Array.isArray(data.products)) {
                products = data.products;
            }

            if (products.length === 0) {
                console.warn('[Sync] No products found in response');
                return 0;
            }

            console.log(`[Sync] Found ${products.length} products`);

            // Normalize and validate products
            const normalizedProducts = products
                .map(p => ({
                    code: p.code || p.productcode || p.PRODUCTCODE || '',
                    name: p.name || p.productname || p.PRODUCTNAME || '',
                    barcode: p.barcode || p.BARCODE || p.code || '',
                    price: parseFloat(p.price || p['NET RATE'] || p.netrate || p.PRICE || 0),
                    mrp: parseFloat(p.mrp || p.MRP || 0),
                    stock: parseFloat(p.stock || p.STOCK || 0),
                    unit: p.unit || p.packing || p.PACKING || '',
                    brand: p.brand || p.BRAND || '',
                    category: p.category || p.product || p.PRODUCT || '',
                    taxcode: p.taxcode || p.TAXCODE || '',
                    description: p.description || '',
                }))
                .filter(p => p.code && p.name); // Only valid products

            console.log(`[Sync] Normalized ${normalizedProducts.length} valid products`);

            if (normalizedProducts.length > 0) {
                // Save in batches for better performance
                await dbService.saveProducts(normalizedProducts);
                console.log(`[Sync] ✅ Saved ${normalizedProducts.length} products`);
            }

            return normalizedProducts.length;
        } catch (error) {
            console.error('[Sync] Error downloading products:', error);
            throw error;
        }
    }

    async downloadCustomers() {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${API_BASE_URL}/debtors/get-debtors/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                signal: this.abortController?.signal
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

            // Save to database
            await dbService.saveCustomers(customers);

            console.log(`[Sync] ✅ Downloaded ${customers.length} customers`);
            return customers.length;
        } catch (error) {
            console.error('[Sync] Error downloading customers:', error);
            throw error;
        }
    }

    async downloadProductBatches() {
        try {
            console.log('[Sync] Fetching batches...');
            const stats = await batchService.downloadAndCache();

            if (!stats) {
                console.warn('[Sync] No batch data');
                return 0;
            }

            console.log(`[Sync] ✅ Downloaded ${stats.batches} batches`);
            return stats.batches;
        } catch (error) {
            console.error('[Sync] Error downloading batches:', error);
            throw error;
        }
    }

    async downloadAreas() {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${API_BASE_URL}/area/list/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                signal: this.abortController?.signal
            });

            if (!response.ok) {
                console.warn(`[Sync] Area API returned ${response.status}`);
                return 0;
            }

            const data = await response.json();

            let areas = [];
            if (data.success && data.areas && Array.isArray(data.areas)) {
                areas = data.areas;
            } else if (Array.isArray(data)) {
                areas = data;
            }

            const validAreas = areas.filter(area => 
                area && typeof area === 'string' && area.trim() !== ''
            );

            await dbService.saveAreas(validAreas);

            console.log(`[Sync] ✅ Downloaded ${validAreas.length} areas`);
            return validAreas.length;
        } catch (error) {
            console.error('[Sync] Error downloading areas:', error);
            throw error;
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
            const collectionsUploaded = await this.uploadPendingCollections(token);
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

            if (pendingCollections.length === 0) return 0;

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
                    }
                } catch (error) {
                    console.error(`Error uploading collection:`, error);
                }
            }

            return uploaded;
        } catch (error) {
            console.error('Error in uploadPendingCollections:', error);
            return 0;
        }
    }

    async uploadPendingOrders(token) {
        try {
            const pendingOrders = await dbService.getOfflineOrders(false);

            if (pendingOrders.length === 0) return 0;

            let uploaded = 0;
            for (const order of pendingOrders) {
                try {
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
                    }
                } catch (error) {
                    console.error(`Error uploading order:`, error);
                }
            }

            return uploaded;
        } catch (error) {
            console.error('Error in uploadPendingOrders:', error);
            return 0;
        }
    }

    // ==================== UTILITY ====================
    async getStats() {
        try {
            await dbService.init();
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

    // Cancel ongoing download
    cancelDownload() {
        if (this.abortController) {
            this.abortController.abort();
            this.isDownloading = false;
        }
    }
}

const syncService = new SyncService();
export default syncService;