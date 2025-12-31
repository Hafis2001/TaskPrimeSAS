// src/services/syncService.js - OPTIMIZED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
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

    // ==================== RETRY HELPER ====================
    async retryWithBackoff(fn, maxRetries = 3, operationName = 'Operation') {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Sync] ${operationName} - attempt ${attempt}/${maxRetries}`);
                return await fn();
            } catch (error) {
                lastError = error;
                console.error(`[Sync] ${operationName} attempt ${attempt} failed:`, error.message);

                if (attempt === maxRetries) {
                    throw new Error(`${operationName} failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Exponential backoff: 2s, 4s, 8s
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`[Sync] Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
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

            // OPTIMIZATION: Download customers and areas in PARALLEL (they're independent)
            // This saves time by not waiting for each to complete sequentially
            this.updateProgress('parallel', 'Downloading customers and areas...', 10);

            const parallelDownloads = await Promise.allSettled([
                this.downloadCustomers(),
                this.downloadAreas()
            ]);

            // Process results
            if (parallelDownloads[0].status === 'fulfilled') {
                stages.customers = true;
                this.updateProgress('customers', 'Customers downloaded', 20, true);
            } else {
                console.error('Customer download failed:', parallelDownloads[0].reason);
                this.updateProgress('customers', 'Customers failed', 20, false);
            }

            if (parallelDownloads[1].status === 'fulfilled') {
                stages.areas = true;
                this.updateProgress('areas', 'Areas downloaded', 25, true);
            } else {
                console.error('Area download failed:', parallelDownloads[1].reason);
                this.updateProgress('areas', 'Areas failed', 25, false);
            }

            // Stage 2: Download products WITH batches/photos/goddowns (SINGLE CALL WITH RETRY)
            this.updateProgress('products', 'Downloading products with batches...', 30);
            try {
                const stats = await this.retryWithBackoff(
                    () => this.downloadProductsOptimized(),
                    3,
                    'Product download'
                );
                if (stats.products > 0) {
                    stages.products = true;
                    stages.batches = true; // Batches downloaded with products
                    this.updateProgress('products', `${stats.products} products, ${stats.batches} batches downloaded`, 90, true);
                } else {
                    this.updateProgress('products', 'No products found', 90, false);
                }
            } catch (error) {
                console.error('Product download failed after all retries:', error);
                this.updateProgress('products', 'Products failed - check connection', 90, false);
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

    // ==================== OPTIMIZED PRODUCT DOWNLOAD (WITH BATCHES) ====================
    async downloadProductsOptimized() {
        try {
            const token = await this.getAuthToken();

            // Primary endpoint (returns products with batches, photos, goddowns)
            const primaryEndpoint = `${API_BASE_URL}/product/get-product-details`;

            console.log(`[Sync] Fetching products with batches from: ${primaryEndpoint}`);

            // Create AbortController with longer timeout for large data (2 minutes)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.error('[Sync] Product download timed out after 2 minutes');
            }, 120000);

            let response;
            try {
                response = await fetch(primaryEndpoint, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('Product download timed out. The server may be slow or the data is too large. Please try again.');
                }
                throw fetchError;
            }

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
                return { products: 0, batches: 0, photos: 0, goddowns: 0 };
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
                    brand: p.brand || p.BRAND || '', // Brand field
                    category: p.product || p.category || p.PRODUCT || '', // Category from 'product' field
                    taxcode: p.taxcode || p.TAXCODE || '',
                    description: p.description || '',
                }))
                .filter(p => p.code && p.name); // Only valid products

            console.log(`[Sync] Normalized ${normalizedProducts.length} valid products`);

            // Counters for batches, photos, goddowns
            let totalBatches = 0;
            let totalPhotos = 0;
            let totalGoddowns = 0;

            if (normalizedProducts.length > 0) {
                // Save products first
                await dbService.saveProducts(normalizedProducts);
                console.log(`[Sync] ✅ Saved ${normalizedProducts.length} products`);

                // Now extract and save batches, photos, goddowns from the SAME response
                // OPTIMIZED: Collect ALL data first, then bulk insert
                console.log(`[Sync] Collecting batches, photos, and goddowns for bulk insert...`);

                const allBatches = [];
                const allPhotos = [];
                const allGoddowns = [];

                for (const product of products) {
                    const productCode = product.code || product.productcode || product.PRODUCTCODE;

                    if (!productCode) continue;

                    // Collect batches with product_code
                    if (product.batches && Array.isArray(product.batches) && product.batches.length > 0) {
                        for (const batch of product.batches) {
                            allBatches.push({ ...batch, product_code: productCode });
                        }
                        totalBatches += product.batches.length;
                    }

                    // Collect photos with product_code
                    if (product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
                        for (let i = 0; i < product.photos.length; i++) {
                            const photo = product.photos[i];
                            allPhotos.push({
                                photo: photo,
                                product_code: productCode,
                                order_index: i
                            });
                        }
                        totalPhotos += product.photos.length;
                    }

                    // Collect goddowns with product_code
                    if (product.goddowns && Array.isArray(product.goddowns) && product.goddowns.length > 0) {
                        for (const godown of product.goddowns) {
                            allGoddowns.push({ ...godown, product_code: productCode });
                        }
                        totalGoddowns += product.goddowns.length;
                    }
                }

                // Bulk insert all collected data
                console.log(`[Sync] Bulk inserting ${totalBatches} batches, ${totalPhotos} photos, ${totalGoddowns} goddowns...`);

                if (allBatches.length > 0) {
                    await dbService.saveBatchesBulk(allBatches);
                }
                if (allPhotos.length > 0) {
                    await dbService.savePhotosBulk(allPhotos);
                }
                if (allGoddowns.length > 0) {
                    await dbService.saveGoddownsBulk(allGoddowns);
                }

                console.log(`[Sync] ✅ Saved ${totalBatches} batches, ${totalPhotos} photos, ${totalGoddowns} goddowns`);
            }

            return {
                products: normalizedProducts.length,
                batches: totalBatches,
                photos: totalPhotos,
                goddowns: totalGoddowns
            };
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

    // ==================== DEPRECATED - Batches now downloaded with products ====================
    // async downloadProductBatches() {
    //     try {
    //         console.log('[Sync] Fetching batches...');
    //         const stats = await batchService.downloadAndCache();

    //         if (!stats) {
    //             console.warn('[Sync] No batch data');
    //             return 0;
    //         }

    //         console.log(`[Sync] ✅ Downloaded ${stats.batches} batches`);
    //         return stats.batches;
    //     } catch (error) {
    //         console.error('[Sync] Error downloading batches:', error);
    //         throw error;
    //     }
    // }

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