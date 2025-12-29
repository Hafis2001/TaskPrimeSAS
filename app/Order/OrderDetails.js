// app/Order/OrderDetails.js - FIXED VERSION with better barcode handling
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import batchService from "../../src/services/batchService";
import dbService from "../../src/services/database";

const { width, height } = Dimensions.get("window");

export default function OrderDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { area = "", customer = "", customerCode = "", type = "", payment = "", scanned, timestamp } = params;

  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [editingQty, setEditingQty] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Track last processed barcode to prevent duplicates
  const lastProcessedBarcode = useRef(null);

  // Filter modal state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState("brand");

  // Quantity modal state
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tempQuantity, setTempQuantity] = useState("1");

  // Details modal state
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const sheetAnim = useRef(new Animated.Value(height)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Load all products with batches from database
  async function fetchAllProducts(isRefresh = false) {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      console.log('[OrderDetails] Loading products with batches from database...');
      await dbService.init();

      const productsWithBatches = await batchService.getProductBatchesOffline();

      console.log(`[OrderDetails] Found ${productsWithBatches.length} products in database`);

      if (productsWithBatches.length === 0) {
        Alert.alert(
          "No Products Available",
          "No product data found. Please download products from Home screen first.",
          [
            { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
            { text: "Cancel", style: "cancel" }
          ]
        );
        setAllProducts([]);
        setFilteredProducts([]);
        return;
      }

      const batchCards = batchService.transformBatchesToCards(productsWithBatches);

      console.log(`[OrderDetails] Transformed to ${batchCards.length} batch cards`);

      setAllProducts(batchCards);
      setFilteredProducts(batchCards);

      // Extract filter options
      extractFilterOptions(batchCards);
    } catch (error) {
      console.error('[OrderDetails] Error loading products:', error);
      Alert.alert(
        "Error",
        `Failed to load products: ${error.message}. Please try downloading data from Home screen.`,
        [
          { text: "Retry", onPress: () => fetchAllProducts(isRefresh) },
          { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Extract unique brands and products for filtering
  function extractFilterOptions(products) {
    console.log('[OrderDetails] Extracting filter options from', products.length, 'products');
    
    const brandsMap = new Map();
    const productsMap = new Map();
    
    products.forEach(p => {
      const brand = (p.brand || '').trim();
      if (brand) {
        brandsMap.set(brand, (brandsMap.get(brand) || 0) + 1);
      }
      
      const productName = (p.name || '').trim();
      if (productName) {
        productsMap.set(productName, (productsMap.get(productName) || 0) + 1);
      }
    });
    
    const brands = Array.from(brandsMap.keys()).sort();
    const productNames = Array.from(productsMap.keys()).sort();
    
    console.log('[OrderDetails] Extracted brands:', brands.length);
    console.log('[OrderDetails] Sample brands:', brands.slice(0, 5));
    console.log('[OrderDetails] Extracted products:', productNames.length);
    console.log('[OrderDetails] Sample products:', productNames.slice(0, 3));
    
    setAvailableBrands(brands);
    setAvailableProducts(productNames);
  }

  // Apply filters
  function applyFilters() {
    console.log('[OrderDetails] === APPLYING FILTERS ===');
    console.log('Selected Brands:', selectedBrands);
    console.log('Selected Products:', selectedProducts);
    console.log('Search Query:', query);
    console.log('Total Products:', allProducts.length);

    let filtered = [...allProducts];

    if (selectedBrands.length > 0) {
      filtered = filtered.filter(p => {
        const productBrand = (p.brand || '').trim();
        return selectedBrands.includes(productBrand);
      });
      console.log(`After brand filter: ${filtered.length} products`);
    }

    if (selectedProducts.length > 0) {
      filtered = filtered.filter(p => {
        const productName = (p.name || '').trim();
        return selectedProducts.includes(productName);
      });
      console.log(`After product filter: ${filtered.length} products`);
    }

    if (query.trim()) {
      const searchQuery = query.trim().toLowerCase();
      filtered = filtered.filter((p) => {
        const matchName = (p.name || '').toLowerCase().includes(searchQuery);
        const matchCode = (p.code || '').toLowerCase().includes(searchQuery);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(searchQuery);
        const matchBrand = (p.brand || '').toLowerCase().includes(searchQuery);
        return matchName || matchCode || matchBarcode || matchBrand;
      });
      console.log(`After search filter: ${filtered.length} products`);
    }

    console.log(`Final filtered count: ${filtered.length}`);
    setFilteredProducts(filtered);
    setFilterModalVisible(false);

    if (filtered.length === 0) {
      Alert.alert(
        "No Results", 
        "No products match your current filters. Try adjusting your selection."
      );
    }
  }

  // Clear all filters
  function clearFilters() {
    console.log('[OrderDetails] Clearing all filters');
    setSelectedBrands([]);
    setSelectedProducts([]);
    setFilterSearchQuery("");
    setQuery("");
    setFilteredProducts(allProducts);
    setFilterModalVisible(false);
  }

  // Toggle brand selection
  function toggleBrandSelection(brand) {
    setSelectedBrands(prev => {
      const isSelected = prev.includes(brand);
      if (isSelected) {
        return prev.filter(b => b !== brand);
      } else {
        return [...prev, brand];
      }
    });
  }

  // Toggle product selection
  function toggleProductSelection(product) {
    setSelectedProducts(prev => {
      const isSelected = prev.includes(product);
      if (isSelected) {
        return prev.filter(p => p !== product);
      } else {
        return [...prev, product];
      }
    });
  }

  // Search product by barcode - IMPROVED VERSION
  async function fetchProductByBarcode(barcode) {
    const cleanBarcode = barcode.trim();

    if (!cleanBarcode) {
      Alert.alert("Error", "Please enter a valid barcode");
      return null;
    }

    setSearchLoading(true);
    try {
      console.log('[OrderDetails] Searching for barcode:', cleanBarcode);
      await dbService.init();

      // First try exact barcode match
      let product = await dbService.getProductByBarcode(cleanBarcode);

      // If not found by barcode, try by code
      if (!product) {
        console.log('[OrderDetails] Not found by barcode, trying by code...');
        const searchResults = await dbService.searchProducts(cleanBarcode);

        if (searchResults.length > 0) {
          product = searchResults[0];
          console.log('[OrderDetails] Found by code:', product.name);
        }
      }

      if (!product) {
        console.log('[OrderDetails] Product not found in database');
        Alert.alert(
          "Not Found", 
          `Product with barcode "${cleanBarcode}" not found in database.\n\nPlease ensure:\n• Product data is downloaded\n• Barcode is correct`
        );
        return null;
      }

      console.log('[OrderDetails] Product found:', product.name);

      return {
        id: product.id || product.code,
        code: product.code,
        name: product.name,
        barcode: product.barcode || product.code,
        price: product.price || 0,
        mrp: product.mrp || 0,
        stock: product.stock || 0,
        brand: product.brand || '',
        unit: product.unit || '',
        photos: product.photos || [],
        taxcode: product.taxcode || '',
        productCategory: product.category || '',
      };

    } catch (error) {
      console.error('[OrderDetails] Error searching product:', error);
      Alert.alert("Error", `Failed to search product: ${error.message}`);
      return null;
    } finally {
      setSearchLoading(false);
    }
  }

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllProducts(true);
  };

  // Initial load and network monitoring
  useEffect(() => {
    fetchAllProducts();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    return () => {
      unsubscribe();
      lastProcessedBarcode.current = null;
    };
  }, []);

  // Handle barcode scanning - IMPROVED VERSION
  useEffect(() => {
    if (scanned && scanned !== lastProcessedBarcode.current) {
      console.log('[OrderDetails] New barcode received:', scanned);
      lastProcessedBarcode.current = scanned;
      
      const code = String(scanned).trim();
      handleScannedBarcode(code);
      
      // Clear the scanned param after processing
      setTimeout(() => {
        router.setParams({
          area,
          customer,
          customerCode,
          type,
          payment,
          scanned: undefined,
          timestamp: undefined
        });
      }, 500);
    }
  }, [scanned, timestamp]);

  // Handle search by text
  const handleSearch = () => {
    console.log('[OrderDetails] Handle search called');
    applyFilters();
  };

  // Handle scanned barcode - IMPROVED VERSION
  async function handleScannedBarcode(code) {
    console.log('[OrderDetails] Processing barcode:', code);
    
    // First, check in already loaded products
    const existingProduct = allProducts.find((p) =>
      p.barcode === code || p.code === code
    );

    if (existingProduct) {
      console.log('[OrderDetails] Product found in loaded products:', existingProduct.name);
      openQuantityModal(existingProduct);
      return;
    }

    // If not found in loaded products, search database
    console.log('[OrderDetails] Product not in loaded list, searching database...');
    setLoading(true);
    const fetchedProduct = await fetchProductByBarcode(code);
    setLoading(false);

    if (fetchedProduct) {
      console.log('[OrderDetails] Opening quantity modal for:', fetchedProduct.name);
      openQuantityModal(fetchedProduct);
    } else {
      console.log('[OrderDetails] Product not found');
    }
  }

  function openQuantityModal(product) {
    console.log('[OrderDetails] Opening quantity modal for:', product.name);
    setSelectedProduct(product);
    setTempQuantity("1");
    setQuantityModalVisible(true);
  }

  function closeQuantityModal() {
    setQuantityModalVisible(false);
    setSelectedProduct(null);
    setTempQuantity("1");
  }

  function handleConfirmQuantity() {
    if (selectedProduct) {
      const qty = parseInt(tempQuantity, 10);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert("Invalid Quantity", "Please enter a valid quantity");
        return;
      }
      addToCart(selectedProduct, qty);
      closeQuantityModal();
      Alert.alert("Success", `${selectedProduct.name} added to cart with quantity ${qty}`);
    }
  }

  function addToCart(product, quantity = 1) {
    console.log('[OrderDetails] Adding to cart:', product.name, 'qty:', quantity);
    setCart((c) => {
      const idx = c.findIndex((it) => it.product.id === product.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx].qty += quantity;
        console.log('[OrderDetails] Updated cart quantity:', next[idx].qty);
        return next;
      }
      console.log('[OrderDetails] Added new item to cart');
      return [{ product, qty: quantity }, ...c];
    });
  }

  function changeQty(productId, qty) {
    setCart((c) => c.map((it) => (it.product.id === productId ? { ...it, qty: Math.max(0, qty) } : it)).filter((it) => it.qty > 0));
  }

  function removeItem(productId) {
    setCart((c) => c.filter((it) => it.product.id !== productId));
  }

  function toggleSheet(open) {
    setSheetOpen(open);
    Animated.spring(sheetAnim, {
      toValue: open ? 0 : height,
      useNativeDriver: true,
      friction: 8,
      tension: 40
    }).start();
  }

  function openImageModal(photos, index = 0) {
    if (photos && photos.length > 0) {
      setSelectedImage(photos);
      setCurrentImageIndex(index);
      setImageModalVisible(true);
    }
  }

  function closeImageModal() {
    setImageModalVisible(false);
    setSelectedImage(null);
    setCurrentImageIndex(0);
  }

  function openDetailsModal(batchCard) {
    console.log('[OrderDetails] Opening details for:', batchCard.name);
    setSelectedBatchDetails(batchCard);
    setCurrentPhotoIndex(0);
    setDetailsModalVisible(true);
  }

  function closeDetailsModal() {
    setDetailsModalVisible(false);
    setSelectedBatchDetails(null);
    setCurrentPhotoIndex(0);
  }

  async function handlePlaceOrder() {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to cart before placing order");
      return;
    }

    try {
      const order = {
        id: `order_${Date.now()}`,
        customer: customer || "Unknown Customer",
        customerCode: customerCode || "",
        area: area,
        type: type,
        payment: payment,
        items: cart.map(item => ({
          productId: item.product.id,
          code: item.product.code,
          name: item.product.name,
          barcode: item.product.barcode,
          batchId: item.product.batchId || null,
          mrp: item.product.mrp || 0,
          price: item.product.price,
          qty: item.qty,
          total: item.qty * item.product.price
        })),
        total: cart.reduce((s, it) => s + it.qty * it.product.price, 0),
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      const existingOrders = await AsyncStorage.getItem('placed_orders');
      const orders = existingOrders ? JSON.parse(existingOrders) : [];
      orders.push(order);
      await AsyncStorage.setItem('placed_orders', JSON.stringify(orders));

      setCart([]);
      toggleSheet(false);

      Alert.alert(
        "Order Placed Successfully",
        `Order placed for ${customer}\nTotal: ₹ ${order.total.toFixed(2)}`,
        [
          {
            text: "View Orders",
            onPress: () => router.push("/Order/PlaceOrder")
          },
          {
            text: "Continue Shopping",
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to place order. Please try again.");
      console.error(error);
    }
  }

  // Render empty state
  const renderEmptyState = () => {
    if (loading || searchLoading) return null;

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="cube-outline" size={60} color={Colors.primary.light} />
        </View>
        <Text style={styles.emptyStateTitle}>
          {allProducts.length === 0 ? "No Products Available" : "No Search Results"}
        </Text>
        <Text style={styles.emptyStateText}>
          {allProducts.length === 0
            ? "Use the barcode scanner to add products"
            : `No products match your filters. Try adjusting your filters.`}
        </Text>
        <TouchableOpacity
          style={styles.scanActionBtn}
          onPress={() => router.push({
            pathname: "/Order/Scanner",
            params: { area, customer, customerCode, type, payment }
          })}
        >
          <LinearGradient
            colors={Gradients.primary}
            style={styles.scanActionGradient}
          >
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={styles.scanActionText}>Scan Barcode</Text>
          </LinearGradient>
        </TouchableOpacity>

        {allProducts.length === 0 && (
          <TouchableOpacity
            style={styles.refreshActionBtn}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color={Colors.primary.main} />
            <Text style={styles.refreshActionText}>Refresh Products</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const itemCount = cart.length;
  const total = cart.reduce((s, it) => s + it.qty * it.product.price, 0);
  const activeFiltersCount = selectedBrands.length + selectedProducts.length;

  // Get filtered lists for filter modal
  const getFilteredBrands = () => {
    if (!filterSearchQuery.trim()) return availableBrands;
    const search = filterSearchQuery.toLowerCase();
    return availableBrands.filter(brand => 
      brand.toLowerCase().includes(search)
    );
  };

  const getFilteredProductNames = () => {
    if (!filterSearchQuery.trim()) return availableProducts;
    const search = filterSearchQuery.toLowerCase();
    return availableProducts.filter(product => 
      product.toLowerCase().includes(search)
    );
  };

  // Get count for each filter option
  const getBrandCount = (brand) => {
    return allProducts.filter(p => (p.brand || '').trim() === brand).length;
  };

  const getProductCount = (productName) => {
    return allProducts.filter(p => (p.name || '').trim() === productName).length;
  };

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.content}>
          {/* Customer Card */}
          <View style={styles.customerCard}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.customerGradient}
            >
              <View style={styles.customerIcon}>
                <Text style={styles.customerInitial}>{customer ? customer.charAt(0) : '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName} numberOfLines={1}>{customer || "Unknown Customer"}</Text>
                <Text style={styles.customerDetails}>
                  {area && `${area}`}
                  {type && ` • ${type}`}
                  {payment && ` • ${payment}`}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => {
                console.log('[OrderDetails] Scanner button pressed');
                router.push({
                  pathname: "/Order/Scanner",
                  params: { area, customer, customerCode, type, payment }
                });
              }}
            >
              <Ionicons name="qr-code" size={20} color={Colors.primary.main} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionIconButton, activeFiltersCount > 0 && styles.actionIconButtonActive]}
              onPress={() => {
                console.log('[OrderDetails] Filter button pressed');
                setFilterModalVisible(true);
              }}
            >
              <Ionicons name="filter" size={20} color={activeFiltersCount > 0 ? "#FFF" : Colors.primary.main} />
              {activeFiltersCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconButton}
              onPress={() => {
                console.log('[OrderDetails] Refresh button pressed');
                onRefresh();
              }}
            >
              <Ionicons name="refresh" size={20} color={Colors.primary.main} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionIconButton, itemCount > 0 && styles.actionIconButtonActive]}
              onPress={() => {
                console.log('[OrderDetails] Cart button pressed');
                toggleSheet(true);
              }}
            >
              <Ionicons name="cart-outline" size={22} color={itemCount > 0 ? "#FFF" : Colors.primary.main} />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, code, barcode, brand..."
                placeholderTextColor={Colors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { 
                  setQuery(""); 
                  let filtered = [...allProducts];
                  if (selectedBrands.length > 0) {
                    filtered = filtered.filter(p => selectedBrands.includes((p.brand || '').trim()));
                  }
                  if (selectedProducts.length > 0) {
                    filtered = filtered.filter(p => selectedProducts.includes((p.name || '').trim()));
                  }
                  setFilteredProducts(filtered);
                }}>
                  <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
            >
              <LinearGradient colors={Gradients.secondary} style={styles.searchGradient}>
                <Ionicons name="search" size={22} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersLabel}>Filters:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersList}>
                {selectedBrands.map(brand => (
                  <View key={brand} style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>{brand}</Text>
                    <TouchableOpacity onPress={() => {
                      toggleBrandSelection(brand);
                      setTimeout(() => applyFilters(), 100);
                    }}>
                      <Ionicons name="close-circle" size={16} color={Colors.primary.main} />
                    </TouchableOpacity>
                  </View>
                ))}
                {selectedProducts.map(product => (
                  <View key={product} style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText} numberOfLines={1}>{product}</Text>
                    <TouchableOpacity onPress={() => {
                      toggleProductSelection(product);
                      setTimeout(() => applyFilters(), 100);
                    }}>
                      <Ionicons name="close-circle" size={16} color={Colors.primary.main} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading States */}
          {(loading || searchLoading) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary.main} />
              <Text style={styles.loadingText}>
                {searchLoading ? 'Searching product...' : 'Loading products...'}
              </Text>
            </View>
          )}

          {/* Product List */}
          {!loading && !searchLoading && (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary.main]}
                  tintColor={Colors.primary.main}
                />
              }
              ListEmptyComponent={renderEmptyState}
              renderItem={({ item }) => {
                const cartItem = cart.find(c => c.product.id === item.id);
                const currentQty = cartItem?.qty || 0;
                const displayValue = editingQty[item.id] !== undefined ? editingQty[item.id] : String(currentQty);
                const inStock = true;
                const stockQty = item.stock || 0;
                const isInCart = currentQty > 0;

                return (
                  <CodeItem
                    item={item}
                    inStock={inStock}
                    stockQty={stockQty}
                    currentQty={currentQty}
                    displayValue={displayValue}
                    isInCart={isInCart}
                    setEditingQty={setEditingQty}
                    changeQty={changeQty}
                    removeItem={removeItem}
                    addToCart={() => openQuantityModal(item)}
                    openImageModal={openImageModal}
                    openDetailsModal={openDetailsModal}
                  />
                );
              }}
            />
          )}
        </View>

        {/* Filter Modal */}
        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalOverlay}>
            <View style={styles.filterModalContent}>
              <View style={styles.filterModalHeader}>
                <Text style={styles.filterModalTitle}>Filter Products</Text>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Filter Info */}
              <View style={styles.filterInfo}>
                <Text style={styles.filterInfoText}>
                  {availableBrands.length} Brands • {availableProducts.length} Products
                </Text>
              </View>

              {/* Filter Tabs */}
              <View style={styles.filterTabs}>
                <TouchableOpacity
                  style={[styles.filterTab, activeFilterTab === "brand" && styles.filterTabActive]}
                  onPress={() => setActiveFilterTab("brand")}
                >
                  <Text style={[styles.filterTabText, activeFilterTab === "brand" && styles.filterTabTextActive]}>
                    Brand {selectedBrands.length > 0 && `(${selectedBrands.length})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, activeFilterTab === "product" && styles.filterTabActive]}
                  onPress={() => setActiveFilterTab("product")}
                >
                  <Text style={[styles.filterTabText, activeFilterTab === "product" && styles.filterTabTextActive]}>
                    Product {selectedProducts.length > 0 && `(${selectedProducts.length})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Filter Search */}
              <View style={styles.filterSearchBar}>
                <Ionicons name="search" size={18} color={Colors.text.tertiary} />
                <TextInput
                  style={styles.filterSearchInput}
                  placeholder={`Search ${activeFilterTab}s...`}
                  placeholderTextColor={Colors.text.tertiary}
                  value={filterSearchQuery}
                  onChangeText={setFilterSearchQuery}
                />
                {filterSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setFilterSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter List */}
              <ScrollView style={styles.filterList} showsVerticalScrollIndicator={false}>
                {activeFilterTab === "brand" && (
                  <>
                    {getFilteredBrands().length === 0 ? (
                      <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>No brands found</Text>
                      </View>
                    ) : (
                      getFilteredBrands().map(brand => {
                        const productCount = getBrandCount(brand);
                        const isSelected = selectedBrands.includes(brand);
                        return (
                          <TouchableOpacity
                            key={brand}
                            style={styles.filterItem}
                            onPress={() => toggleBrandSelection(brand)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.filterItemLeft}>
                              <View style={[
                                styles.checkbox,
                                isSelected && styles.checkboxChecked
                              ]}>
                                {isSelected && (
                                  <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                              </View>
                              <Text style={styles.filterItemText}>{brand}</Text>
                            </View>
                            <Text style={styles.filterItemCount}>{productCount}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}

                {activeFilterTab === "product" && (
                  <>
                    {getFilteredProductNames().length === 0 ? (
                      <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>No products found</Text>
                      </View>
                    ) : (
                      getFilteredProductNames().map(product => {
                        const productCount = getProductCount(product);
                        const isSelected = selectedProducts.includes(product);
                        return (
                          <TouchableOpacity
                            key={product}
                            style={styles.filterItem}
                            onPress={() => toggleProductSelection(product)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.filterItemLeft}>
                              <View style={[
                                styles.checkbox,
                                isSelected && styles.checkboxChecked
                              ]}>
                                {isSelected && (
                                  <Ionicons name="checkmark" size={16} color="#FFF" />
                                )}
                              </View>
                              <Text style={styles.filterItemText} numberOfLines={2}>{product}</Text>
                            </View>
                            <Text style={styles.filterItemCount}>{productCount}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}
              </ScrollView>

              {/* Filter Actions */}
              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={styles.filterClearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.filterClearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterApplyButton}
                  onPress={applyFilters}
                >
                  <LinearGradient
                    colors={Gradients.primary}
                    style={styles.filterApplyGradient}
                  >
                    <Text style={styles.filterApplyButtonText}>
                      Apply {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Cart Bottom Sheet */}
        {sheetOpen && (
          <Pressable style={styles.overlay} onPress={() => toggleSheet(false)} />
        )}
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Current Order ({itemCount} items)</Text>
            <TouchableOpacity onPress={() => toggleSheet(false)}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={48} color={Colors.neutral[300]} />
                <Text style={styles.emptyCartText}>Your cart is empty</Text>
              </View>
            ) : (
              <FlatList
                data={cart}
                keyExtractor={(item) => item.product.id.toString()}
                style={styles.cartList}
                renderItem={({ item }) => (
                  <View style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                      <Text style={styles.cartItemPrice}>
                        {item.qty} x ₹{item.product.price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.cartItemTotal}>₹{(item.qty * item.product.price).toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => removeItem(item.product.id)}
                      style={styles.removeCartItem}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.error.main} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>

          <View style={styles.sheetFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹ {total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, cart.length === 0 && styles.disabledButton]}
              onPress={handlePlaceOrder}
              disabled={cart.length === 0}
            >
              <LinearGradient
                colors={cart.length > 0 ? Gradients.success : [Colors.neutral[400], Colors.neutral[400]]}
                style={styles.proceedGradient}
              >
                <View style={styles.PlaceOrderButton}>
                  <Text style={styles.checkoutText}>Place Order</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Quantity Selection Modal */}
        <Modal
          visible={quantityModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeQuantityModal}
        >
          <View style={styles.quantityModalOverlay}>
            <View style={styles.quantityModalContent}>
              <View style={styles.quantityModalHeader}>
                <Text style={styles.quantityModalTitle}>Select Quantity</Text>
                <TouchableOpacity onPress={closeQuantityModal}>
                  <Ionicons name="close" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <>
                  <View style={styles.quantityProductInfo}>
                    <Text style={styles.quantityProductName} numberOfLines={2}>
                      {selectedProduct.name}
                    </Text>
                    <Text style={styles.quantityProductPrice}>
                      ₹ {selectedProduct.price.toFixed(2)} per unit
                    </Text>
                  </View>

                  <View style={styles.quantityInputContainer}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        const current = parseInt(tempQuantity, 10) || 1;
                        setTempQuantity(String(Math.max(1, current - 1)));
                      }}
                    >
                      <Ionicons name="remove" size={24} color={Colors.primary.main} />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.quantityInput}
                      value={tempQuantity}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setTempQuantity(cleaned || "1");
                      }}
                      selectTextOnFocus
                    />

                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        const current = parseInt(tempQuantity, 10) || 1;
                        setTempQuantity(String(current + 1));
                      }}
                    >
                      <Ionicons name="add" size={24} color={Colors.primary.main} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.quantityTotalContainer}>
                    <Text style={styles.quantityTotalLabel}>Total:</Text>
                    <Text style={styles.quantityTotalValue}>
                      ₹ {((parseInt(tempQuantity, 10) || 0) * selectedProduct.price).toFixed(2)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.quantityConfirmButton}
                    onPress={handleConfirmQuantity}
                  >
                    <LinearGradient
                      colors={Gradients.success}
                      style={styles.quantityConfirmGradient}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.quantityConfirmText}>Add to Cart</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Image Modal */}
        <Modal
          visible={imageModalVisible}
          transparent={true}
          onRequestClose={closeImageModal}
        >
          <View style={styles.imageModalOverlay}>
            <TouchableOpacity style={styles.closeModalButton} onPress={closeImageModal}>
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            {selectedImage && selectedImage.length > 0 && (
              <Image
                source={{ uri: selectedImage[currentImageIndex].url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        {/* Batch Details Modal */}
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeDetailsModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.detailsModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Batch Details</Text>
                <TouchableOpacity onPress={closeDetailsModal}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedBatchDetails && (
                  <>
                    {/* Image Carousel */}
                    {selectedBatchDetails.photos && selectedBatchDetails.photos.length > 0 && (
                      <View style={styles.detailsImageContainer}>
                        <Image
                          source={{ uri: selectedBatchDetails.photos[currentPhotoIndex].url }}
                          style={styles.detailsImage}
                          resizeMode="contain"
                        />
                        {selectedBatchDetails.photos.length > 1 && (
                          <>
                            {currentPhotoIndex > 0 && (
                              <TouchableOpacity
                                style={[styles.photoNavButton, styles.photoNavLeft]}
                                onPress={() => setCurrentPhotoIndex(currentPhotoIndex - 1)}
                              >
                                <Ionicons name="chevron-back" size={24} color="#FFF" />
                              </TouchableOpacity>
                            )}
                            {currentPhotoIndex < selectedBatchDetails.photos.length - 1 && (
                              <TouchableOpacity
                                style={[styles.photoNavButton, styles.photoNavRight]}
                                onPress={() => setCurrentPhotoIndex(currentPhotoIndex + 1)}
                              >
                                <Ionicons name="chevron-forward" size={24} color="#FFF" />
                              </TouchableOpacity>
                            )}

                            <View style={styles.imageCountBadge}>
                              <Text style={styles.imageCountText}>
                                {currentPhotoIndex + 1}/{selectedBatchDetails.photos.length}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    )}

                    {/* Product Info */}
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsProductName}>{selectedBatchDetails.name}</Text>
                      <Text style={styles.detailsProductMeta}>
                        Code: {selectedBatchDetails.code} • {selectedBatchDetails.brand}
                      </Text>
                      {selectedBatchDetails.barcode && (
                        <Text style={styles.detailsBarcode}>Barcode: {selectedBatchDetails.barcode}</Text>
                      )}
                    </View>

                    {/* Price Information */}
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsSectionTitle}>Price Information</Text>
                      <View style={styles.priceGrid}>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>MRP</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.mrp?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>RETAIL</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.retail?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>D.P</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.dp?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>CB</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.cb?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>NET RATE</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.netRate?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>PK SHOP</Text>
                          <Text style={styles.priceValue}>₹ {selectedBatchDetails.pkShop?.toFixed(2) || '0.00'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Stock Information */}
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsSectionTitle}>Stock Information</Text>
                      <View style={styles.stockInfo}>
                        <Text style={styles.stockLabel}>Quantity:</Text>
                        <Text style={styles.stockValue}>{selectedBatchDetails.stock || 0} {selectedBatchDetails.unit}</Text>
                      </View>
                      {selectedBatchDetails.expiryDate && selectedBatchDetails.expiryDate !== '1900-01-01' && (
                        <View style={styles.stockInfo}>
                          <Text style={styles.stockLabel}>Expiry:</Text>
                          <Text style={styles.stockValue}>{selectedBatchDetails.expiryDate}</Text>
                        </View>
                      )}
                    </View>

                    {/* Godown Information */}
                    {selectedBatchDetails.goddowns && selectedBatchDetails.goddowns.length > 0 && (
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsSectionTitle}>Godown Quantities</Text>
                        {selectedBatchDetails.goddowns.map((godown, index) => (
                          <View key={index} style={styles.goddownItem}>
                            <Text style={styles.goddownName}>{godown.name}</Text>
                            <Text style={styles.goddownQty}>{godown.quantity} {selectedBatchDetails.unit}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

// Separated Component for better performance
const CodeItem = ({ item, inStock, stockQty, currentQty, displayValue, isInCart, setEditingQty, changeQty, removeItem, addToCart, openImageModal, openDetailsModal }) => (
  <View style={[styles.productCard, isInCart && styles.productCardInCart]}>
    <View style={styles.productContainer}>
      <TouchableOpacity onPress={() => openImageModal(item.photos)}>
        {item.photos && item.photos.length > 0 ? (
          <Image source={{ uri: item.photos[0].url }} style={styles.productImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={24} color={Colors.neutral[400]} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={[styles.stockBadge, stockQty === 0 && styles.outOfStockBadge]}>
            <Text style={[styles.stockText, stockQty === 0 && styles.outOfStockText]}>
              {stockQty}
            </Text>
          </View>
        </View>

        <Text style={styles.productMeta}>Code: {item.code} {item.unit ? `• ${item.unit}` : ''}</Text>
        {item.barcode && item.barcode !== item.code && (
          <Text style={styles.productBarcode}>Barcode: {item.barcode}</Text>
        )}
        {item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}

        <View style={styles.priceColumn}>
          <Text style={styles.mrpLabel}>MRP: ₹ {item.mrp.toFixed(2)}</Text>
          <Text style={styles.price}>Price: ₹ {item.price.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => openDetailsModal(item)}
        >
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary.main} />
          <Text style={styles.viewDetailsText}>Details</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.productActions}>
      {currentQty > 0 ? (
        <View style={styles.qtyControl}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => changeQty(item.id, currentQty - 1)}
          >
            <Ionicons name="remove" size={18} color={Colors.text.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.qtyInput}
            value={displayValue}
            keyboardType="numeric"
            onChangeText={(text) => {
              const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
              setEditingQty(prev => ({ ...prev, [item.id]: text }));
              if (!isNaN(num)) changeQty(item.id, num);
            }}
            onBlur={() => {
              setEditingQty(prev => {
                const n = { ...prev };
                delete n[item.id];
                return n;
              });
            }}
          />

          <TouchableOpacity
            style={[styles.qtyBtn, !inStock && { opacity: 0.5 }]}
            onPress={() => changeQty(item.id, currentQty + 1)}
            disabled={!inStock}
          >
            <Ionicons name="add" size={18} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addButton, !inStock && styles.disabledAddButton]}
          onPress={addToCart}
          disabled={!inStock}
        >
          <Text style={styles.addButtonText}>{inStock ? 'Add' : 'Out of Stock'}</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: 35,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  backButton: { padding: 4 },

  content: { flex: 1, paddingHorizontal: Spacing.lg },

  customerCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  customerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  customerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  customerInitial: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  customerName: { fontSize: Typography.sizes.base, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  customerDetails: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.9)' },

  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
    position: 'relative',
  },
  actionIconButtonActive: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.error.main,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.error.main,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  searchContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: Typography.sizes.base, color: Colors.text.primary },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  searchGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  activeFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  activeFiltersLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeFiltersList: {
    flex: 1,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
    gap: 4,
    maxWidth: 120,
  },
  activeFilterChipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary.main,
    fontWeight: '600',
  },
  clearFiltersBtn: {
    paddingHorizontal: Spacing.sm,
  },
  clearFiltersBtnText: {
    fontSize: Typography.sizes.xs,
    color: Colors.error.main,
    fontWeight: '600',
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: Colors.text.secondary },

  listContent: { paddingBottom: 100 },

  productCard: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  productCardInCart: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
    borderWidth: 2,
  },
  productContainer: { flexDirection: 'row', gap: Spacing.md },
  productImage: { width: 60, height: 60, borderRadius: BorderRadius.md, backgroundColor: Colors.neutral[50] },
  placeholderImage: { width: 60, height: 60, borderRadius: BorderRadius.md, backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productName: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.text.primary, flex: 1, marginRight: 8 },
  stockBadge: {
    backgroundColor: Colors.success[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outOfStockBadge: { backgroundColor: Colors.error[50] },
  stockText: { fontSize: 10, fontWeight: '700', color: Colors.success.main },
  outOfStockText: { color: Colors.error.main },
  productMeta: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  productBrand: { fontSize: 11, color: Colors.text.secondary, fontStyle: 'italic', marginBottom: 4 },
  productBarcode: { fontSize: Typography.sizes.sm, color: Colors.text.secondary, marginTop: 2 },
  priceColumn: { 
    marginTop: 4,
  },
  mrpLabel: { 
    fontSize: Typography.sizes.sm, 
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  price: { 
    fontSize: Typography.sizes.base, 
    fontWeight: '700', 
    color: Colors.primary.main,
  },

  productActions: { marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'flex-end' },
  addButton: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  disabledAddButton: { backgroundColor: Colors.neutral[100] },
  addButtonText: { color: Colors.primary.main, fontWeight: '600', fontSize: Typography.sizes.sm },

  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.neutral[50], borderRadius: BorderRadius.md },
  qtyBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { width: 40, textAlign: 'center', fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.text.primary },

  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingVertical: 4,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary.main,
    fontWeight: '600',
  },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyIconContainer: { marginBottom: Spacing.md },
  emptyStateTitle: { fontSize: Typography.sizes.lg, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  emptyStateText: { fontSize: Typography.sizes.sm, color: Colors.text.secondary, textAlign: 'center', maxWidth: '80%', marginBottom: Spacing.xl },
  scanActionBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadows.colored.primary },
  scanActionGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: 8 },
  scanActionText: { color: '#FFF', fontWeight: '700' },
  refreshActionBtn: { marginTop: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshActionText: { color: Colors.primary.main, fontWeight: '600' },

  // Filter Modal
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    height: '80%',
    paddingTop: Spacing.lg,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterModalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  filterInfo: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterInfoText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.neutral[50],
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.primary.main,
  },
  filterTabText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  filterSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    height: 40,
    marginBottom: Spacing.md,
  },
  filterSearchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  filterList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  noResultsContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  filterItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    flex: 1,
  },
  filterItemCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  filterActions: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  filterClearButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary.main,
    alignItems: 'center',
  },
  filterClearButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  filterApplyButton: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  filterApplyGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: '#FFF',
  },

  // Bottom Sheet
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.7,
    backgroundColor: '#FFF',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    zIndex: 101,
    ...Shadows.xl,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  sheetTitle: { fontSize: Typography.sizes.lg, fontWeight: '700', color: Colors.text.primary },
  sheetContent: { flex: 1 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCartText: { marginTop: Spacing.md, color: Colors.text.tertiary, fontSize: Typography.sizes.base },
  cartList: { padding: Spacing.md },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.neutral[50] },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.text.primary },
  cartItemPrice: { fontSize: Typography.sizes.sm, color: Colors.text.secondary },
  cartItemTotal: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.primary.main, marginHorizontal: Spacing.md },
  removeCartItem: { padding: 4 },

  sheetFooter: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border.light },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  totalLabel: { fontSize: Typography.sizes.lg, color: Colors.text.secondary },
  totalValue: { fontSize: Typography.sizes.xl, fontWeight: '700', color: Colors.text.primary },
  checkoutButton: { borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadows.colored.success },
  proceedGradient: { paddingVertical: Spacing.md },
  checkoutText: { color: '#FFF', fontSize: Typography.sizes.lg, fontWeight: '700' },
  disabledButton: { opacity: 0.6, ...Shadows.none },
  PlaceOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
  },

  // Quantity Modal
  quantityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  quantityModalContent: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius['2xl'],
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    ...Shadows.xl,
  },
  quantityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  quantityModalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  quantityProductInfo: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  quantityProductName: {
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  quantityProductPrice: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  quantityButton: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 80,
    height: 60,
    borderWidth: 2,
    borderColor: Colors.primary.main,
    borderRadius: BorderRadius.lg,
    textAlign: 'center',
    fontSize: Typography.sizes['2xl'],
    fontWeight: '700',
    color: Colors.text.primary,
  },
  quantityTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.neutral[50],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  quantityTotalLabel: {
    fontSize: Typography.sizes.lg,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  quantityTotalValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: '700',
    color: Colors.primary.main,
  },
  quantityConfirmButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.colored.success,
  },
  quantityConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  quantityConfirmText: {
    color: '#FFF',
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },

  // Image Modal
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalButton: { position: 'absolute', top: 40, right: 20, padding: 10, zIndex: 1 },
  fullImage: { width: width, height: height * 0.8 },

  // Details Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailsModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    height: '90%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  detailsImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.neutral[50],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  detailsImage: {
    width: '100%',
    height: '100%',
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCountText: {
    color: '#FFF',
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  photoNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoNavLeft: {
    left: 10,
  },
  photoNavRight: {
    right: 10,
  },
  detailsSection: {
    marginBottom: Spacing.lg,
  },
  detailsProductName: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  detailsProductMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  detailsBarcode: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  detailsSectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  priceItem: {
    width: '48%',
    backgroundColor: Colors.neutral[50],
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.primary.main,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  stockLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  stockValue: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  goddownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.neutral[50],
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  goddownName: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  goddownQty: {
    fontSize: Typography.sizes.base,
    color: Colors.primary.main,
    fontWeight: '700',
  },
});