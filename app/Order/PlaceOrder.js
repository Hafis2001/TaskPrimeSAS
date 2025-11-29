// app/Order/PlaceOrder.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
              Alert.alert('Success', 'Order deleted successfully');
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
            <View style={[styles.statusBadge, isConfirmed && styles.confirmedBadge]}>
              <Ionicons 
                name={isConfirmed ? "checkmark-circle" : "time"} 
                size={16} 
                color="#fff" 
              />
            </View>
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
              color="#7a8aa3" 
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
                      <Text style={styles.qtyBtnText}>-</Text>
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
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => removeItem(order.id, index)}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#d9534f" />
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
                  style={styles.confirmBtn}
                  onPress={() => confirmOrder(order.id)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirm Order</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => deleteOrder(order.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#d9534f" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <LinearGradient colors={["#4ea0ff", "#3a6fff"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Placed Orders</Text>
          <TouchableOpacity onPress={handleRefresh} style={{ padding: 6 }}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <View style={styles.container}>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="#d3dce6" />
              <Text style={styles.emptyText}>No orders placed yet</Text>
              <TouchableOpacity 
                style={styles.emptyBtn}
                onPress={() => router.push("/Order/Entry")}
              >
                <Text style={styles.emptyBtnText}>Create New Order</Text>
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
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  orderHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffa726',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedBadge: {
    backgroundColor: '#38ba50',
  },
  customerNameBold: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1b2b45',
  },
  orderDetails: {
    fontSize: 12,
    color: '#7a8aa3',
    marginTop: 2,
  },
  orderTime: {
    fontSize: 11,
    color: '#a0aec0',
    marginTop: 2,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e73d9',
  },
  itemCount: {
    fontSize: 12,
    color: '#7a8aa3',
    marginTop: 2,
  },
  orderBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e6eefc',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f7fa',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b2b45',
  },
  itemPrice: {
    fontSize: 12,
    color: '#7a8aa3',
    marginTop: 4,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d3dce6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b2b45',
  },
  qtyInput: {
    marginHorizontal: 8,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    minWidth: 35,
    borderWidth: 1,
    borderColor: '#d3dce6',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38ba50',
    minWidth: 70,
    textAlign: 'right',
  },
  actionButtons: {
    marginTop: 16,
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: '#38ba50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9534f',
    gap: 8,
  },
  deleteBtnText: {
    color: '#d9534f',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '600',
  },
  emptyBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyBtnText: {
    color: '#3a6fff',
    fontSize: 16,
    fontWeight: '700',
  },
});