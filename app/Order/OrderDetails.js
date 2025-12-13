// app/Order/OrderDetails.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  
  const sheetAnim = useRef(new Animated.Value(height)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Get token from AsyncStorage
  async function getToken() {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      const token = authToken;
      
      if (!token) {
        Alert.alert(
          "Login Required", 
          "Please login to access products",
          [
            { 
              text: "Go to Login", 
              onPress: () => router.replace('/LoginScreen') 
            }
          ]
        );
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      Alert.alert("Error", "Failed to retrieve authentication token");
      return null;
    }
  }

  // Get client_id from AsyncStorage
  async function getClientId() {
    try {
      const clientId = await AsyncStorage.getItem('client_id');
      return clientId || '';
    } catch (error) {
      console.error('Error getting client ID:', error);
      return '';
    }
  }

  // Extract product data from API response
  function extractProductData(productData) {
    if (!productData || typeof productData !== 'object') {
      return null;
    }

    try {
      // Extract basic product info
      const productCode = productData.code || productData.productcode || productData.PRODUCTCODE || '';
      const productName = productData.name || productData.productname || productData.PRODUCTNAME || 'Unknown Product';
      const brand = productData.brand || productData.BRAND || '';
      const unit = productData.unit || productData.packing || productData.PACKING || '';
      
      // Get pricing and stock
      let price = 0;
      let mrp = 0;
      let stock = 0;
      let batchBarcode = productCode;
      
      // Try different price fields
      if (productData['NET RATE'] !== undefined) price = parseFloat(productData['NET RATE']);
      else if (productData.netrate !== undefined) price = parseFloat(productData.netrate);
      else if (productData.price !== undefined) price = parseFloat(productData.price);
      else if (productData.PRICE !== undefined) price = parseFloat(productData.PRICE);
      
      // Try MRP fields
      if (productData.MRP !== undefined) mrp = parseFloat(productData.MRP);
      else if (productData.mrp !== undefined) mrp = parseFloat(productData.mrp);
      
      // Try stock fields
      if (productData.stock !== undefined) stock = parseFloat(productData.stock);
      else if (productData.STOCK !== undefined) stock = parseFloat(productData.STOCK);
      
      // Get barcode
      if (productData.barcode) batchBarcode = productData.barcode;
      else if (productData.BARCODE) batchBarcode = productData.BARCODE;
      
      // Process photos
      let photos = [];
      if (Array.isArray(productData.photos)) {
        photos = productData.photos;
      } else if (productData.photo) {
        photos = [{ url: productData.photo }];
      }
      
      // Fix photo URLs
      const fixedPhotos = photos.map(photo => {
        let url = photo.url || photo;
        
        // Ensure url is a string before processing
        if (!url || typeof url !== 'string') {
          return null;
        }
        
        url = url.replace(/\\/g, '/');
        url = url.trim();
        
        if (url === '') {
          return null;
        }
        
        if (url.startsWith('/')) {
          url = `https://tasksas.com${url}`;
        } else if (!url.startsWith('http')) {
          url = `https://tasksas.com/${url}`;
        }
        
        return {
          ...photo,
          url: url
        };
      }).filter(photo => photo !== null && photo.url);
      
      const productId = productData.id || productData.ID || `${productCode}_${Date.now()}`;
      
      return {
        id: productId,
        code: productCode,
        name: productName,
        barcode: batchBarcode,
        price: price,
        mrp: mrp,
        stock: stock,
        brand: brand,
        unit: unit,
        photos: fixedPhotos,
        taxcode: productData.taxcode || productData.TAXCODE || '',
        productCategory: productData.product || productData.PRODUCT || '',
        createdAt: productData.createdAt || new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error extracting product data:', error);
      return null;
    }
  }

  // Fetch all products from API - SIMPLIFIED VERSION
  async function fetchAllProducts(isRefresh = false) {
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const token = await getToken();
      const clientId = await getClientId();
      
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Try multiple endpoints
      const endpoints = [
        `https://tasksas.com/api/product/get-product-details`,
        `https://tasksas.com/api/products`,
        `https://tasksas.com/api/product`,
        `https://tasksas.com/api/stock`,
        `https://tasksas.com/api/inventory`,
      ];
      
      let productsData = [];
      
      for (let endpoint of endpoints) {
        try {
          console.log(`Trying: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            // Extract products from different response formats
            if (Array.isArray(data)) {
              productsData = data;
              break;
            } else if (data && Array.isArray(data.data)) {
              productsData = data.data;
              break;
            } else if (data && Array.isArray(data.products)) {
              productsData = data.products;
              break;
            } else if (data && Array.isArray(data.stock)) {
              productsData = data.stock;
              break;
            } else if (data && Array.isArray(data.inventory)) {
              productsData = data.inventory;
              break;
            }
          }
        } catch (error) {
          console.log(`Endpoint ${endpoint} failed:`, error.message);
        }
      }
      
      if (productsData.length === 0) {
        // Try to load from cache
        const cachedProducts = await AsyncStorage.getItem('cached_products');
        if (cachedProducts) {
          const parsedProducts = JSON.parse(cachedProducts);
          setAllProducts(parsedProducts);
          setFilteredProducts(parsedProducts);
          
          Alert.alert(
            "Using Cached Data", 
            `Showing ${parsedProducts.length} cached products.`
          );
          return;
        }
        
        Alert.alert(
          "No Products", 
          "Could not fetch products. Use scanner to add products individually."
        );
        
        setAllProducts([]);
        setFilteredProducts([]);
        return;
      }
      
      // Extract product data
      const extractedProducts = productsData
        .map(productData => extractProductData(productData))
        .filter(product => product !== null);
      
      // Set products
      setAllProducts(extractedProducts);
      setFilteredProducts(extractedProducts);
      
      // Cache products
      await AsyncStorage.setItem('cached_products', JSON.stringify(extractedProducts));
      
    } catch (error) {
      console.error('Error fetching products:', error);
      
      // Try to load from cache
      try {
        const cachedProducts = await AsyncStorage.getItem('cached_products');
        if (cachedProducts) {
          const parsedProducts = JSON.parse(cachedProducts);
          setAllProducts(parsedProducts);
          setFilteredProducts(parsedProducts);
          return;
        }
      } catch (cacheError) {
        console.error('Error loading cached products:', cacheError);
      }
      
      Alert.alert("Error", "Unable to fetch products. Please check connection.");
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch single product by barcode
  async function fetchProductByBarcode(barcode) {
    const cleanBarcode = barcode.trim();
    
    if (!cleanBarcode) {
      Alert.alert("Error", "Please enter a valid barcode");
      return null;
    }
    
    setSearchLoading(true);
    try {
      const token = await getToken();
      
      if (!token) {
        return null;
      }

      const url = `https://tasksas.com/api/product/get-product-details?code=${encodeURIComponent(cleanBarcode)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle response formats
      let productData = data;
      if (data && data.data) {
        productData = data.data;
      }
      
      if (Array.isArray(productData) && productData.length > 0) {
        productData = productData[0];
      }
      
      if (!productData) {
        Alert.alert("Not Found", `No product found for barcode: ${cleanBarcode}`);
        return null;
      }
      
      const product = extractProductData(productData);
      
      if (!product) {
        Alert.alert("Error", "Could not process product data");
        return null;
      }
      
      // Add to products
      setAllProducts(prev => {
        const exists = prev.find(p => p.code === product.code);
        if (exists) return prev;
        return [product, ...prev];
      });
      
      setFilteredProducts(prev => {
        const exists = prev.find(p => p.code === product.code);
        if (exists) return prev;
        return [product, ...prev];
      });
      
      // Update cache
      try {
        const cachedProducts = await AsyncStorage.getItem('cached_products');
        const existingProducts = cachedProducts ? JSON.parse(cachedProducts) : [];
        const productExists = existingProducts.find(p => p.code === product.code);
        if (!productExists) {
          const updatedProducts = [product, ...existingProducts];
          await AsyncStorage.setItem('cached_products', JSON.stringify(updatedProducts));
        }
      } catch (cacheError) {
        console.error('Error caching product:', cacheError);
      }
      
      return product;
      
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert("Error", `Failed to fetch product: ${error.message}`);
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

  // Initial load
  useEffect(() => {
    fetchAllProducts();
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

  // Handle search
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
    Animated.timing(sheetAnim, {
      toValue: open ? height * 0.22 : height,
      duration: 300,
      useNativeDriver: true,
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
        <Ionicons name="cube-outline" size={80} color="rgba(255,255,255,0.7)" />
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
          <Ionicons name="qr-code" size={20} color="#fff" />
          <Text style={styles.scanActionText}>Scan Barcode</Text>
        </TouchableOpacity>
        
        {allProducts.length === 0 && (
          <TouchableOpacity 
            style={[styles.scanActionBtn, { backgroundColor: '#28a745', marginTop: 10 }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.scanActionText}>Refresh Products</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const itemCount = cart.length;
  const total = cart.reduce((s, it) => s + it.qty * it.product.price, 0);

  return (
    <LinearGradient colors={["#4ea0ff", "#3a6fff"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order</Text>

        <TouchableOpacity onPress={() => toggleSheet(true)} style={{ padding: 6 }}>
          <View style={styles.cartIcon}>
            <Ionicons name="cart" size={22} color="#fff" />
            {itemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Customer card */}
        <View style={styles.customerCard}>
          <View style={styles.customerLeft}>
            <Ionicons name="person-circle" size={36} color="#2b6ea6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Customer</Text>
            <Text style={styles.customerName}>{customer || "Unknown Customer"}</Text>
            <Text style={styles.muted}>
              {area && `Area: ${area}`} 
              {type && ` • Type: ${type}`}
              {payment && ` • Payment: ${payment}`}
            </Text>
          </View>
        </View>

        {/* Search + Scanner */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#7a8aa3" />
            <TextInput
              placeholder="Search by barcode, name or brand..."
              placeholderTextColor="#7a8aa3"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => {
                setQuery("");
                setFilteredProducts(allProducts);
              }}>
                <Ionicons name="close" size={18} color="#7a8aa3" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.scanBtn} 
            onPress={() => router.push({ 
              pathname: "/Order/Scanner", 
              params: { area, customer, type, payment } 
            })}
          >
            <Ionicons name="qr-code" size={20} color="#1a73e8" />
          </TouchableOpacity>
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Loading products...</Text>
          </View>
        )}

        {searchLoading && (
          <View style={{ padding: 10, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 5 }}>Searching...</Text>
          </View>
        )}

        {/* Product count */}
        {!loading && allProducts.length > 0 && (
          <View style={styles.productCount}>
            <Text style={styles.productCountText}>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} 
              {query ? ` matching "${query}"` : ' available'}
            </Text>
          </View>
        )}

        {/* Product list */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          style={{ marginTop: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#fff"]}
              tintColor="#fff"
              title="Pull to refresh"
              titleColor="#fff"
            />
          }
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => {
            const cartItem = cart.find(c => c.product.id === item.id);
            const currentQty = cartItem?.qty || 0;
            const displayValue = editingQty[item.id] !== undefined ? editingQty[item.id] : String(currentQty);

            return (
              <View style={styles.productCard}>
                {/* Product Image */}
                <TouchableOpacity 
                  style={styles.productLeft}
                  onPress={() => openImageModal(item.photos, 0)}
                >
                  {item.photos && item.photos.length > 0 ? (
                    <Image 
                      source={{ uri: item.photos[0].url }} 
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.thumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e7ff' }]}>
                      <Ionicons name="cube-outline" size={24} color="#7a8aa3" />
                    </View>
                  )}
                  {item.photos && item.photos.length > 1 && (
                    <View style={styles.photoCount}>
                      <Text style={styles.photoCountText}>{item.photos.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Product Details */}
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  
                  {item.brand && (
                    <Text style={styles.brand}>{item.brand}</Text>
                  )}
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <Text style={styles.barcode}>Code: {item.code || item.barcode || 'N/A'}</Text>
                    {item.unit && (
                      <Text style={[styles.barcode, { marginLeft: 8 }]}>Unit: {item.unit}</Text>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={styles.price}>₹ {item.price > 0 ? item.price.toFixed(2) : '0.00'}</Text>
                    {item.mrp > item.price && (
                      <Text style={styles.mrpText}>MRP: ₹ {item.mrp.toFixed(2)}</Text>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={[
                      styles.stock, 
                      item.stock <= 0 ? { color: "#ff4444" } : 
                      item.stock < 10 ? { color: "#ff9800" } : { color: "#4CAF50" }
                    ]}>
                      Stock: {item.stock > 0 ? item.stock.toFixed(2) : 'Out of stock'}
                    </Text>
                  </View>
                </View>

                {/* Quantity Controls */}
                <View style={styles.actions}>
                  {currentQty > 0 ? (
                    <View style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                        <TouchableOpacity 
                          style={[styles.qtyCircleSmall, currentQty <= 0 && { opacity: 0.5 }]} 
                          onPress={() => changeQty(item.id, currentQty - 1)}
                          disabled={currentQty <= 0}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700" }}>-</Text>
                        </TouchableOpacity>
                        
                        <TextInput
                          style={styles.qtyTextInputMain}
                          value={displayValue}
                          onChangeText={(text) => {
                            const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(num) && num >= 0) {
                              setEditingQty(prev => ({ ...prev, [item.id]: text }));
                              changeQty(item.id, num);
                            } else if (text === '') {
                              setEditingQty(prev => ({ ...prev, [item.id]: '' }));
                            }
                          }}
                          onBlur={() => {
                            setEditingQty(prev => {
                              const newState = { ...prev };
                              delete newState[item.id];
                              return newState;
                            });
                          }}
                          keyboardType="numeric"
                        />
                        
                        <TouchableOpacity 
                          style={[
                            styles.qtyCircleSmall, 
                            item.stock > 0 && currentQty >= item.stock && { opacity: 0.5 }
                          ]} 
                          onPress={() => changeQty(item.id, currentQty + 1)}
                          disabled={item.stock > 0 && currentQty >= item.stock}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700" }}>+</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity 
                        onPress={() => removeItem(item.id)}
                      >
                        <Ionicons name="trash" size={18} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.addBtn, item.stock <= 0 && { backgroundColor: '#cccccc' }]} 
                      onPress={() => {
                        if (item.stock <= 0) {
                          Alert.alert("Out of Stock", "This product is currently out of stock");
                        } else {
                          addToCart(item);
                        }
                      }}
                      disabled={item.stock <= 0}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* Image Gallery Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={closeImageModal}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {selectedImage && selectedImage.length > 0 && (
            <>
              <FlatList
                data={selectedImage}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item.id || index}-${index}`}
                initialScrollIndex={currentImageIndex}
                getItemLayout={(data, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const index = Math.floor(event.nativeEvent.contentOffset.x / width);
                  setCurrentImageIndex(index);
                }}
                renderItem={({ item }) => (
                  <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
                    <Image
                      source={{ uri: item.url }}
                      style={styles.fullImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              />

              {selectedImage.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {selectedImage.length}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Bottom sheet - Cart */}
      <Animated.View 
        pointerEvents={sheetOpen ? "auto" : "none"} 
        style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }] }]}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>
          Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </Text>

        {cart.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="cart-outline" size={50} color="#cccccc" />
            <Text style={{ textAlign: "center", color: "#666", marginTop: 10, fontSize: 16 }}>
              Your cart is empty
            </Text>
            <Text style={{ textAlign: "center", color: "#999", marginTop: 5 }}>
              Add products to get started
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={cart}
              keyExtractor={(item) => item.product.id}
              style={{ maxHeight: height * 0.35 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const itemTotal = item.qty * item.product.price;
                const displayValueCart = editingQty[`cart_${item.product.id}`] !== undefined 
                  ? editingQty[`cart_${item.product.id}`] 
                  : String(item.qty);

                return (
                  <View style={styles.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.cartPrice}>
                        ₹ {item.product.price.toFixed(2)} × {item.qty}
                      </Text>
                      <Text style={styles.itemTotal}>
                        Total: ₹ {itemTotal.toFixed(2)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <TouchableOpacity 
                        style={[styles.qtyCircle, item.qty <= 1 && { opacity: 0.5 }]} 
                        onPress={() => changeQty(item.product.id, item.qty - 1)}
                        disabled={item.qty <= 1}
                      >
                        <Text>-</Text>
                      </TouchableOpacity>
                      
                      <TextInput
                        style={styles.qtyTextInput}
                        value={displayValueCart}
                        onChangeText={(text) => {
                          const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                          if (!isNaN(num) && num >= 0) {
                            setEditingQty(prev => ({ ...prev, [`cart_${item.product.id}`]: text }));
                            changeQty(item.product.id, num);
                          } else if (text === '') {
                            setEditingQty(prev => ({ ...prev, [`cart_${item.product.id}`]: '' }));
                          }
                        }}
                        onBlur={() => {
                          setEditingQty(prev => {
                            const newState = { ...prev };
                            delete newState[`cart_${item.product.id}`];
                            return newState;
                          });
                        }}
                        keyboardType="numeric"
                      />
                      
                      <TouchableOpacity 
                        style={[
                          styles.qtyCircle, 
                          item.product.stock > 0 && item.qty >= item.product.stock && { opacity: 0.5 }
                        ]} 
                        onPress={() => changeQty(item.product.id, item.qty + 1)}
                        disabled={item.product.stock > 0 && item.qty >= item.product.stock}
                      >
                        <Text>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={{ marginLeft: 12 }} 
                      onPress={() => removeItem(item.product.id)}
                    >
                      <Ionicons name="trash" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />

            <View style={styles.cartFooter}>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: "#666", fontSize: 14 }}>Total Amount</Text>
                <Text style={{ fontSize: 24, fontWeight: "700", color: "#1b2b45" }}>
                  ₹ {total.toFixed(2)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: "#6c757d" }]} 
                  onPress={() => toggleSheet(false)}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Continue Shopping</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: "#28a745" }]} 
                  onPress={handlePlaceOrder}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Place Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.closeSheet} onPress={() => toggleSheet(false)}>
          <Text style={{ color: "#1a73e8", fontWeight: "600" }}>Close</Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { 
    height: 60, 
    paddingHorizontal: 16, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    backgroundColor: "transparent", 
    marginTop: 28 
  },
  headerTitle: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 20 
  },
  cartIcon: { 
    padding: 6, 
    position: "relative" 
  },
  cartBadge: { 
    position: "absolute", 
    right: -6, 
    top: -6, 
    backgroundColor: "#ff3b30", 
    borderRadius: 10, 
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  cartBadgeText: { 
    color: "#fff", 
    fontSize: 12, 
    fontWeight: "700" 
  },
  container: { 
    flex: 1, 
    padding: 16 
  },
  customerCard: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    padding: 14, 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerLeft: { 
    marginRight: 12 
  },
  smallLabel: { 
    color: "#7a8aa3", 
    fontSize: 12 
  },
  customerName: { 
    fontSize: 16, 
    fontWeight: "800", 
    color: "#1b2b45" 
  },
  muted: { 
    color: "#7a8aa3", 
    marginTop: 4,
    fontSize: 12 
  },
  searchRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginTop: 6 
  },
  searchBox: { 
    flex: 1, 
    backgroundColor: "#f2f6fb", 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8 
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 6, 
    color: "#2b4b69",
    fontSize: 14 
  },
  scanBtn: { 
    marginLeft: 8, 
    backgroundColor: "#fff", 
    padding: 12, 
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productCard: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 12, 
    flexDirection: "row", 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productLeft: { 
    width: 70, 
    height: 70, 
    marginRight: 12, 
    position: 'relative' 
  },
  thumb: { 
    backgroundColor: "#e6eefc", 
    width: 70, 
    height: 70, 
    borderRadius: 8 
  },
  photoCount: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  productName: { 
    fontWeight: "700", 
    color: "#1b2b45",
    fontSize: 14,
    lineHeight: 18 
  },
  barcode: { 
    color: "#7a8aa3", 
    fontSize: 11,
    marginTop: 2
  },
  brand: { 
    color: "#666", 
    fontSize: 12, 
    marginTop: 2,
    fontWeight: '500'
  },
  price: { 
    color: "#1e73d9", 
    fontWeight: "700", 
    fontSize: 16 
  },
  mrpText: {
    color: "#999",
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  stock: { 
    fontSize: 12,
    fontWeight: '600' 
  },
  actions: { 
    alignItems: "center", 
    justifyContent: "center" 
  },
  addBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: "#2b6ef0", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  qtyCircleSmall: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "#d3dce6", 
    alignItems: "center", 
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  qtyTextInputMain: {
    marginHorizontal: 6,
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
    minWidth: 35,
    borderWidth: 1,
    borderColor: "#d3dce6",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fff",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: width * 0.95,
    height: height * 0.8,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: height,
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sheetHandle: { 
    width: 60, 
    height: 6, 
    backgroundColor: "#e6eefc", 
    borderRadius: 6, 
    alignSelf: "center", 
    marginBottom: 12 
  },
  sheetTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#1b2b45", 
    marginBottom: 16 
  },
  cartRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: "#f1f4f8" 
  },
  qtyCircle: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "#e1e6ee", 
    alignItems: "center", 
    justifyContent: "center",
    backgroundColor: "#fff" 
  },
  qtyTextInput: {
    marginHorizontal: 8,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    minWidth: 40,
    borderWidth: 1,
    borderColor: "#e1e6ee",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  itemTotal: {
    color: "#28a745",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 13,
  },
  cartFooter: { 
    flexDirection: "column", 
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f4f8"
  },
  closeSheet: { 
    marginTop: 12, 
    alignSelf: "center",
    padding: 10 
  },
  cartPrice: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  scanActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b6ef0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 10,
  },
  scanActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productCount: {
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  productCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});