// app/Order/OrderDetails.js
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
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import dbService from "../../src/services/database";

const { width, height } = Dimensions.get("window");

export default function OrderDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { area = "", customer = "", type = "", payment = "", scanned } = params;

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

  const sheetAnim = useRef(new Animated.Value(height)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Load all products from SQLite database (OFFLINE-FIRST)
  async function fetchAllProducts(isRefresh = false) {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      console.log('[OrderDetails] Initializing database...');
      await dbService.init();

      console.log('[OrderDetails] Loading products from database...');
      const productsFromDB = await dbService.getProducts();

      console.log(`[OrderDetails] Found ${productsFromDB.length} products in database`);

      if (productsFromDB.length === 0) {
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

      // Map database products to expected format
      const formattedProducts = productsFromDB.map(product => ({
        id: product.id || product.code,
        code: product.code,
        name: product.name,
        barcode: product.barcode || product.code,
        price: product.price || 0,
        mrp: product.mrp || 0,
        stock: product.stock || 0,
        brand: product.brand || '',
        unit: product.unit || '',
        photos: [], // Photos handling would go here if DB supported it
        taxcode: product.taxcode || '',
        productCategory: product.category || '',
        createdAt: product.created_at || new Date().toISOString(),
      }));

      setAllProducts(formattedProducts);
      setFilteredProducts(formattedProducts);
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

  // Search product by barcode from database (OFFLINE-FIRST)
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

      // Search in database
      const product = await dbService.getProductByBarcode(cleanBarcode);

      if (!product) {
        // Try searching in all products by code or name
        const searchResults = await dbService.searchProducts(cleanBarcode);

        if (searchResults.length > 0) {
          const foundProduct = searchResults[0];
          return {
            id: foundProduct.id || foundProduct.code,
            code: foundProduct.code,
            name: foundProduct.name,
            barcode: foundProduct.barcode || foundProduct.code,
            price: foundProduct.price || 0,
            mrp: foundProduct.mrp || 0,
            stock: foundProduct.stock || 0,
            brand: foundProduct.brand || '',
            unit: foundProduct.unit || '',
            photos: [],
            taxcode: foundProduct.taxcode || '',
            productCategory: foundProduct.category || '',
          };
        }

        Alert.alert("Not Found", `Product with barcode "${cleanBarcode}" not found in database.`);
        return null;
      }

      // Format product from database
      const formattedProduct = {
        id: product.id || product.code,
        code: product.code,
        name: product.name,
        barcode: product.barcode || product.code,
        price: product.price || 0,
        mrp: product.mrp || 0,
        stock: product.stock || 0,
        brand: product.brand || '',
        unit: product.unit || '',
        photos: [],
        taxcode: product.taxcode || '',
        productCategory: product.category || '',
      };

      return formattedProduct;

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
    // Load products
    fetchAllProducts();

    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Handle barcode scanning
  useEffect(() => {
    if (scanned) {
      const code = String(scanned);
      handleScannedBarcode(code);
      router.setParams({
        area,
        customer,
        type,
        payment,
        scanned: undefined
      });
    }
  }, [scanned]);

  // Handle search by text
  const handleSearch = () => {
    const searchQuery = query.trim().toLowerCase();

    if (!searchQuery) {
      setFilteredProducts(allProducts);
      return;
    }

    const results = allProducts.filter((p) =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.code?.toLowerCase().includes(searchQuery) ||
      p.barcode?.toLowerCase().includes(searchQuery) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery))
    );

    setFilteredProducts(results);

    if (results.length === 0) {
      Alert.alert("No Results", `No products found for "${query}".`);
    }
  };

  async function handleScannedBarcode(code) {
    const existingProduct = allProducts.find((p) =>
      p.barcode === code ||
      p.code === code
    );

    if (existingProduct) {
      addToCart(existingProduct);
      Alert.alert("Success", `${existingProduct.name} added to cart`);
      return;
    }

    setLoading(true);
    const fetchedProduct = await fetchProductByBarcode(code);
    setLoading(false);

    if (fetchedProduct) {
      addToCart(fetchedProduct);
      Alert.alert("Success", `${fetchedProduct.name} added to cart`);
    }
  }

  function addToCart(product) {
    setCart((c) => {
      const idx = c.findIndex((it) => it.product.id === product.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx].qty += 1;
        return next;
      }
      return [{ product, qty: 1 }, ...c];
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

  async function handlePlaceOrder() {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to cart before placing order");
      return;
    }

    try {
      const order = {
        id: `order_${Date.now()}`,
        customer: customer || "Unknown Customer",
        area: area,
        type: type,
        payment: payment,
        items: cart.map(item => ({
          productId: item.product.id,
          code: item.product.code,
          name: item.product.name,
          barcode: item.product.barcode,
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
            : `No products match "${query}". Try a different search.`}
        </Text>
        <TouchableOpacity
          style={styles.scanActionBtn}
          onPress={() => router.push({
            pathname: "/Order/Scanner",
            params: { area, customer, type, payment }
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
          <TouchableOpacity onPress={() => toggleSheet(true)} style={styles.cartButton}>
            <View style={[styles.cartIconBadge, itemCount > 0 && styles.cartIconBadgeActive]}>
              <Ionicons name="cart-outline" size={24} color={Colors.primary.main} />
              {itemCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{itemCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
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

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, code, brand..."
                placeholderTextColor={Colors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(""); setFilteredProducts(allProducts); }}>
                  <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.scannerButton}
              onPress={() => router.push({
                pathname: "/Order/Scanner",
                params: { area, customer, type, payment }
              })}
            >
              <LinearGradient colors={Gradients.secondary} style={styles.scannerGradient}>
                <Ionicons name="scan" size={22} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Loading States */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary.main} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          )}

          {/* Product List */}
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
              const inStock = item.stock > 0;

              return (
                <CodeItem
                  item={item}
                  inStock={inStock}
                  currentQty={currentQty}
                  displayValue={displayValue}
                  setEditingQty={setEditingQty}
                  changeQty={changeQty}
                  removeItem={removeItem}
                  addToCart={addToCart}
                  openImageModal={openImageModal}
                />
              );
            }}
          />
        </View>

        {/* Cart Bottom Sheet (Custom Implementation) */}
        {sheetOpen && (
          <Pressable style={styles.overlay} onPress={() => toggleSheet(false)} />
        )}
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Current Order</Text>
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
                <Text style={styles.checkoutText}>Place Order</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

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

      </SafeAreaView>
    </LinearGradient>
  );
}

// Separated Component for better performance
const CodeItem = ({ item, inStock, currentQty, displayValue, setEditingQty, changeQty, removeItem, addToCart, openImageModal }) => (
  <View style={styles.productCard}>
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
          <Text style={styles.productName}>{item.name}</Text>
          <View style={[styles.stockBadge, !inStock && styles.outOfStockBadge]}>
            <Text style={[styles.stockText, !inStock && styles.outOfStockText]}>
              {inStock ? `${item.stock}` : 'OS'}
            </Text>
          </View>
        </View>

        <Text style={styles.productMeta}>Code: {item.code} {item.unit ? `• ${item.unit}` : ''}</Text>
        <Text style={styles.productBrand}>{item.brand}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹ {item.price.toFixed(2)}</Text>
          {item.mrp > item.price && (
            <Text style={styles.mrp}>₹ {item.mrp.toFixed(2)}</Text>
          )}
        </View>
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
          onPress={() => addToCart(item)}
          disabled={!inStock}
        >
          <Text style={styles.addButtonText}>{inStock ? 'Add to Cart' : 'Out of Stock'}</Text>
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
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  backButton: { padding: 4 },
  cartButton: { padding: 4 },
  cartIconBadge: { position: 'relative' },
  cartIconBadgeActive: {},
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: Colors.error.main,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

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
  scannerButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  scannerGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: Typography.sizes.base, fontWeight: '700', color: Colors.primary.main },
  mrp: { fontSize: Typography.sizes.sm, color: Colors.text.tertiary, textDecorationLine: 'line-through' },

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
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  checkoutText: { color: '#FFF', fontSize: Typography.sizes.lg, fontWeight: '700' },
  disabledButton: { opacity: 0.6, ...Shadows.none },

  // Image Modal
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalButton: { position: 'absolute', top: 40, right: 20, padding: 10, zIndex: 1 },
  fullImage: { width: width, height: height * 0.8 },
});