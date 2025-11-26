// app/Order/OrderDetails.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  Dimensions,
  Pressable,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

// Demo products with barcode, price, stock
const DEMO_PRODUCTS = [
  { id: "p1", name: "RICE MRI PONNI RED26", barcode: "00710022", price: 1430.0, mrp: 1500, stock: -2 },
  { id: "p2", name: "ATTA 1KG", barcode: "1001", price: 46.5, mrp: 46.5, stock: -31 },
  { id: "p3", name: "SUGAR 1KG", barcode: "2001", price: 60.0, mrp: 65.0, stock: 10 },
  { id: "p4", name: "OIL 1L", barcode: "3001", price: 120.0, mrp: 130.0, stock: 5 },
];

export default function OrderDetails() {
  const router = useRouter();
  const params = useLocalSearchParams(); // area, customer, type, payment, scanned (if scanner returned)
  const { area = "", customer = "", type = "", payment = "", scanned } = params;

  // products and cart state
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]); // items: {product, qty}

  // bottom sheet animation
  const sheetAnim = useRef(new Animated.Value(height)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  // product filtering
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, query]);

  useEffect(() => {
    // if scanner returned a scanned barcode param, add matching product
    if (scanned) {
      const code = String(scanned);
      const found = products.find((p) => p.barcode === code);
      if (found) addToCart(found);
      else Alert.alert("Not found", `No product found for barcode ${code}`);
      // remove scanned param by replacing route without it
      router.replace({ pathname: "/Order/OrderDetails", params: { area, customer, type, payment } });
    }
  }, [scanned]);

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

  const itemCount = cart.reduce((s, it) => s + it.qty, 0);
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
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{itemCount}</Text></View>
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
            <Text style={styles.muted}>{area ? `${area} • ${type} • ${payment}` : ""}</Text>
          </View>
        </View>

        {/* Search + Scanner */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#7a8aa3" />
            <TextInput
              placeholder="Search products..."
              placeholderTextColor="#7a8aa3"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close" size={18} color="#7a8aa3" /></TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.scanBtn} onPress={() => router.push({ pathname: "/Order/Scanner", params: { area, customer, type, payment } })}>
            <Ionicons name="qr-code" size={20} color="#1a73e8" />
          </TouchableOpacity>
        </View>

        {/* Product list */}
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          style={{ marginTop: 12 }}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <View style={styles.productLeft}>
                <View style={styles.thumb} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.barcode}>Barcode: {item.barcode}</Text>
                <Text style={styles.price}>₹ {item.price.toFixed(2)}</Text>
                <Text style={[styles.stock, item.stock < 0 && { color: "#d9534f" }]}>Stock: {item.stock}</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item.id, (cart.find(c => c.product.id === item.id)?.qty || 0) - 1)}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      {/* Bottom sheet - Slide cart */}
      <Animated.View pointerEvents={sheetOpen ? "auto" : "none"} style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }] }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Cart</Text>

        {cart.length === 0 ? (
          <View style={{ padding: 20 }}><Text style={{ textAlign: "center", color: "#333" }}>Cart is empty</Text></View>
        ) : (
          <>
            <FlatList
              data={cart}
              keyExtractor={(it) => it.product.id}
              style={{ maxHeight: height * 0.35 }}
              renderItem={({ item }) => (
                <View style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.product.name}</Text>
                    <Text style={styles.barcode}>₹ {item.product.price.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity style={styles.qtyCircle} onPress={() => changeQty(item.product.id, item.qty - 1)}><Text>-</Text></TouchableOpacity>
                    <Text style={{ marginHorizontal: 8, fontWeight: "700" }}>{item.qty}</Text>
                    <TouchableOpacity style={styles.qtyCircle} onPress={() => changeQty(item.product.id, item.qty + 1)}><Text>+</Text></TouchableOpacity>
                  </View>

                  <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => removeItem(item.product.id)}><Ionicons name="trash" size={20} color="#d9534f" /></TouchableOpacity>
                </View>
              )}
            />

            <View style={styles.cartFooter}>
              <View style={{ marginBottom:20 }}>
                <Text style={{ color: "#666" }}>Total</Text>
                <Text style={{ fontSize: 18, fontWeight: "700" }}>₹ {total.toFixed(2)}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8,marginBottom:20 }}>
                <TouchableOpacity style={styles.updateBtn} onPress={() => { Alert.alert("Updated", "Cart updated."); toggleSheet(false); }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Update</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.placeBtn} onPress={() => Alert.alert("Place Order", `Order placed for ${customer}\nTotal: ₹ ${total.toFixed(2)}`)}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Place Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.closeSheet} onPress={() => toggleSheet(false)}><Text style={{ color: "#777" }}>Close</Text></Pressable>
      </Animated.View>
    </LinearGradient>
  );

  function toggleSheet(on) {
    setSheetOpen(on);
    Animated.timing(sheetAnim, {
      toValue: on ? height - (height * 0.48) : height,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }
}

const styles = StyleSheet.create({
  header: { height: 60, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", marginTop: 28 },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 20 },
  cartIcon: { padding: 6 },
  cartBadge: { position: "absolute", right: -6, top: -6, backgroundColor: "#ff3b30", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  cartBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  container: { flex: 1, padding: 16 },
  customerCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  customerLeft: { marginRight: 12 },
  smallLabel: { color: "#7a8aa3", fontSize: 12 },
  customerName: { fontSize: 16, fontWeight: "800", color: "#1b2b45" },
  muted: { color: "#7a8aa3", marginTop: 4 },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  searchBox: { flex: 1, backgroundColor: "#f2f6fb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, marginLeft: 6, color: "#2b4b69" },
  scanBtn: { marginLeft: 8, backgroundColor: "#fff", padding: 10, borderRadius: 10 },

  productCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center" },
  productLeft: { width: 70, height: 70, marginRight: 12 },
  thumb: { backgroundColor: "#e6eefc", width: 70, height: 70, borderRadius: 8 },
  productName: { fontWeight: "800", color: "#1b2b45" },
  barcode: { color: "#7a8aa3", marginTop: 4 },
  price: { color: "#1e73d9", fontWeight: "700", marginTop: 8 },
  stock: { color: "#333", marginTop: 6 },

  actions: { alignItems: "center", justifyContent: "space-between" },
  qtyBtn: { width: 34, height: 34, borderRadius: 18, borderWidth: 1, borderColor: "#d3dce6", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2b6ef0", alignItems: "center", justifyContent: "center" },

  // sheet
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: height,
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 12,
    elevation: 8,
  },
  sheetHandle: { width: 60, height: 6, backgroundColor: "#e6eefc", borderRadius: 6, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#1b2b45", marginBottom: 8 },
  cartRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f4f8" },
  qtyCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#e1e6ee", alignItems: "center", justifyContent: "center" },

  cartFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom:20 },
  updateBtn: { backgroundColor: "#6aa8ff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginRight: 8 ,marginBottom:40},
  placeBtn: { backgroundColor: "#38ba50", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,marginBottom:40 },

  closeSheet: { marginTop: 12, alignSelf: "center" },
});
