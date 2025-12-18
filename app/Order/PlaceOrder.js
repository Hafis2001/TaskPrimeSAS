// app/Order/PlaceOrder.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function PlaceOrder() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [editingQty, setEditingQty] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  // Load orders from AsyncStorage
  async function loadOrders() {
    try {
      const storedOrders = await AsyncStorage.getItem('placed_orders');
      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        // Sort by timestamp, newest first
        const sortedOrders = parsedOrders.sort((a, b) =>
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        setOrders(sortedOrders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    }
  }

  // Refresh orders
  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  // Toggle order expansion
  function toggleOrder(orderId) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  }

  // Update item quantity
  async function updateItemQty(orderId, itemIndex, newQty) {
    try {
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          const updatedItems = [...order.items];
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            qty: newQty,
            total: newQty * updatedItems[itemIndex].price
          };

          // Recalculate order total
          const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

          return {
            ...order,
            items: updatedItems,
            total: newTotal
          };
        }
        return order;
      });

      setOrders(updatedOrders);
      await AsyncStorage.setItem('placed_orders', JSON.stringify(updatedOrders));
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  }

  // Remove item from order
  async function removeItem(orderId, itemIndex) {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedOrders = orders.map(order => {
                if (order.id === orderId) {
                  const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);

                  // If no items left, mark order for deletion
                  if (updatedItems.length === 0) {
                    return null;
                  }

                  const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

                  return {
                    ...order,
                    items: updatedItems,
                    total: newTotal
                  };
                }
                return order;
              }).filter(order => order !== null);

              setOrders(updatedOrders);
              await AsyncStorage.setItem('placed_orders', JSON.stringify(updatedOrders));
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Failed to remove item');
            }
          }
        }
      ]
    );
  }

  // Confirm order
  async function confirmOrder(orderId) {
    Alert.alert(
      'Confirm Order',
      'Are you sure you want to confirm this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const updatedOrders = orders.map(order => {
                if (order.id === orderId) {
                  return { ...order, status: 'confirmed' };
                }
                return order;
              });

              setOrders(updatedOrders);
              await AsyncStorage.setItem('placed_orders', JSON.stringify(updatedOrders));
              Alert.alert('Success', 'Order confirmed successfully!');
            } catch (error) {
              console.error('Error confirming order:', error);
              Alert.alert('Error', 'Failed to confirm order');
            }
          }
        }
      ]
    );
  }

  // Delete order
  async function deleteOrder(orderId) {
    Alert.alert(
      'Delete Order',
      'Are you sure you want to delete this entire order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedOrders = orders.filter(order => order.id !== orderId);
              setOrders(updatedOrders);
              await AsyncStorage.setItem('placed_orders', JSON.stringify(updatedOrders));
              // Alert.alert('Success', 'Order deleted successfully');
            } catch (error) {
              console.error('Error deleting order:', error);
              Alert.alert('Error', 'Failed to delete order');
            }
          }
        }
      ]
    );
  }

  // Format date
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Render order card
  function renderOrderCard({ item: order }) {
    const isExpanded = expandedOrder === order.id;
    const isConfirmed = order.status === 'confirmed';

    return (
      <View style={styles.orderCard}>
        {/* Order Header */}
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => toggleOrder(order.id)}
          activeOpacity={0.7}
        >
          <View style={styles.orderHeaderLeft}>
            <LinearGradient
              colors={isConfirmed ? Gradients.success : [Colors.warning.main, Colors.warning.main]}
              style={styles.statusBadge}
            >
              <Ionicons
                name={isConfirmed ? "checkmark-circle" : "time"}
                size={16}
                color="#fff"
              />
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.customerNameBold}>{order.customer}</Text>
              <Text style={styles.orderDetails}>
                {order.area} • {order.type} • {order.payment}
              </Text>
              <Text style={styles.orderTime}>{formatDate(order.timestamp)}</Text>
            </View>
          </View>

          <View style={styles.orderHeaderRight}>
            <Text style={styles.orderTotal}>₹{order.total.toFixed(2)}</Text>
            <Text style={styles.itemCount}>{order.items.length} items</Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.text.tertiary}
              style={{ marginTop: 4 }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Order Details */}
        {isExpanded && (
          <View style={styles.orderBody}>
            <View style={styles.divider} />

            {/* Order Items */}
            {order.items.map((item, index) => {
              const displayValue = editingQty[`${order.id}_${index}`] !== undefined
                ? editingQty[`${order.id}_${index}`]
                : String(item.qty);

              return (
                <View key={index} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>₹{item.price.toFixed(2)} × {item.qty}</Text>
                  </View>

                  {/* Quantity Controls */}
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        const newQty = Math.max(1, item.qty - 1);
                        updateItemQty(order.id, index, newQty);
                      }}
                    >
                      <Ionicons name="remove" size={16} color={Colors.text.primary} />
                    </TouchableOpacity>

                    <TextInput
                      style={styles.qtyInput}
                      value={displayValue}
                      onChangeText={(text) => {
                        if (text === "") {
                          setEditingQty(prev => ({ ...prev, [`${order.id}_${index}`]: "" }));
                          return;
                        }

                        const cleaned = text.replace(/[^0-9]/g, '');
                        if (cleaned === "") {
                          setEditingQty(prev => ({ ...prev, [`${order.id}_${index}`]: "" }));
                          return;
                        }

                        const num = parseInt(cleaned, 10);
                        if (!isNaN(num) && num > 0) {
                          setEditingQty(prev => ({ ...prev, [`${order.id}_${index}`]: cleaned }));
                          updateItemQty(order.id, index, num);
                        }
                      }}
                      onFocus={() => {
                        setEditingQty(prev => ({ ...prev, [`${order.id}_${index}`]: String(item.qty) }));
                      }}
                      onBlur={() => {
                        setEditingQty(prev => {
                          const newState = { ...prev };
                          delete newState[`${order.id}_${index}`];
                          return newState;
                        });

                        if (item.qty === 0) {
                          updateItemQty(order.id, index, 1);
                        }
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateItemQty(order.id, index, item.qty + 1)}
                    >
                      <Ionicons name="add" size={16} color={Colors.text.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => removeItem(order.id, index)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.error.main} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemTotal}>₹{item.total.toFixed(2)}</Text>
                </View>
              );
            })}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isConfirmed && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => confirmOrder(order.id)}
                >
                  <LinearGradient
                    colors={Gradients.success}
                    style={styles.actionButtonGradient}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Confirm Order</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => deleteOrder(order.id)}
              >
                <LinearGradient
                  colors={Gradients.danger}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Delete Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <LinearGradient colors={Gradients.background} style={styles.mainContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Placed Orders</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.iconButton}>
            <Ionicons name="refresh" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <View style={styles.container}>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="receipt-outline" size={60} color={Colors.primary.light} />
              </View>
              <Text style={styles.emptyTitle}>No orders placed yet</Text>
              <Text style={styles.emptySubtitle}>Start by creating a new order</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/Order/Entry")}
              >
                <LinearGradient
                  colors={Gradients.primary}
                  style={styles.emptyBtnGradient}
                >
                  <Text style={styles.emptyBtnText}>Create New Order</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrderCard}
              contentContainerStyle={styles.listContent}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  iconButton: { padding: 4 },

  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: Spacing.sm,
  },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  orderHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerNameBold: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  orderDetails: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  orderTime: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.primary.main,
  },
  itemCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  orderBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.neutral[50], // Slightly different bg or inner content
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginBottom: Spacing.md,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: '#FFF',
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  itemName: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  itemPrice: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  qtyInput: {
    marginHorizontal: 8,
    fontWeight: '600',
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    minWidth: 35,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    color: Colors.text.primary,
  },
  removeBtn: { marginLeft: 8, padding: 4 },

  itemTotal: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: Colors.success.main,
    minWidth: 60,
    textAlign: 'right',
  },

  actionButtons: {
    marginTop: Spacing.md,
    gap: 10,
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyIconContainer: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.colored.primary,
  },
  emptyBtnGradient: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyBtnText: {
    color: '#FFF',
    fontSize: Typography.sizes.base,
    fontWeight: '700',
  },
});