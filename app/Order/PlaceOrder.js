// app/Order/PlaceOrder.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
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
  const [uploadingOrder, setUploadingOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, uploaded, pending, failed
  const [uploadDetailsModal, setUploadDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

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

  // Upload order to API
  async function uploadOrderToAPI(order) {
    try {
      // Get auth details from AsyncStorage
      const username = await AsyncStorage.getItem('username');
      const clientId = await AsyncStorage.getItem('client_id');
      const authToken = await AsyncStorage.getItem('authToken');
      const deviceId = (await AsyncStorage.getItem('device_hardware_id')) || (await AsyncStorage.getItem('deviceId'));

      console.log('[Upload] Auth check:', { username, clientId, deviceId, hasToken: !!authToken });

      if (!username || !clientId) {
        throw new Error('Missing authentication credentials. Please login again.');
      }

      if (!deviceId) {
        throw new Error('Device ID not found. Please restart the app.');
      }

      // Upload results for each item
      const uploadResults = [];

      console.log(`[Upload] Starting upload for ${order.items.length} items`);

      // Upload each item separately
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];

        // Prepare payload matching the API requirements
        const payload = {
          customer_name: String(order.customer || ''),
          customer_code: String(order.customerCode || ''),
          area: String(order.area || ''),
          product_name: String(item.name || ''),
          item_code: String(item.code || ''),
          barcode: String(item.barcode || item.code || ''),
          payment_type: String(order.payment || ''),
          price: Number(item.price || 0),          // Numeric value
          quantity: Number(item.qty || 0),          // Numeric value
          amount: Number(item.total || 0),          // Numeric value
          username: String(username).trim(),
          remark: String(order.remark || ''),      // Include remark field
          device_id: String(deviceId).trim(),      // Required device_id
        };

        console.log(`[Upload] Item ${i + 1}/${order.items.length}:`, JSON.stringify(payload, null, 2));

        try {
          const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          };

          // Add auth token if available
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          console.log('[Upload] Headers:', headers);

          const response = await fetch('https://tasksas.com/api/item-orders/create', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
          });

          console.log(`[Upload] Response status for item ${i + 1}:`, response.status);

          // Clone response to read it multiple times if needed
          const responseClone = response.clone();

          if (!response.ok) {
            let errorText = '';
            let errorDetails = null;

            try {
              // Try to parse as JSON first
              errorDetails = await response.json();
              errorText = JSON.stringify(errorDetails, null, 2);
              console.log(`[Upload] Error JSON for item ${i + 1}:`, errorDetails);
            } catch {
              // If JSON parsing fails, get text
              try {
                errorText = await responseClone.text();
                console.log(`[Upload] Error text for item ${i + 1}:`, errorText);
              } catch (e) {
                errorText = `HTTP ${response.status}`;
                console.log(`[Upload] Could not read error body for item ${i + 1}`);
              }
            }

            // Extract meaningful error message
            let userFriendlyError = errorText;
            if (errorDetails) {
              if (errorDetails.message) {
                userFriendlyError = errorDetails.message;
              } else if (errorDetails.error) {
                userFriendlyError = errorDetails.error;
              } else if (errorDetails.detail) {
                userFriendlyError = errorDetails.detail;
              }
            }

            uploadResults.push({
              itemIndex: i,
              itemName: item.name,
              success: false,
              error: userFriendlyError || `HTTP ${response.status}: Server error`,
              statusCode: response.status,
            });
          } else {
            let responseData = null;
            try {
              responseData = await response.json();
              console.log(`[Upload] Success for item ${i + 1}:`, responseData);
            } catch (e) {
              // If response is not JSON, that's OK for success
              console.log(`[Upload] Success for item ${i + 1} (no JSON response)`);
              responseData = { success: true };
            }

            uploadResults.push({
              itemIndex: i,
              itemName: item.name,
              success: true,
              data: responseData,
            });
          }
        } catch (error) {
          console.error(`[Upload] Exception for item ${i + 1}:`, error);
          uploadResults.push({
            itemIndex: i,
            itemName: item.name,
            success: false,
            error: `Network error: ${error.message}`,
          });
        }
      }

      // Check if all items uploaded successfully
      const allSuccess = uploadResults.every(r => r.success);
      const anySuccess = uploadResults.some(r => r.success);
      const successCount = uploadResults.filter(r => r.success).length;

      console.log('[Upload] Results:', {
        total: uploadResults.length,
        successful: successCount,
        failed: uploadResults.length - successCount,
        allSuccess,
        anySuccess
      });

      return {
        success: allSuccess,
        partialSuccess: anySuccess && !allSuccess,
        results: uploadResults,
        successCount,
        totalCount: uploadResults.length,
      };
    } catch (error) {
      console.error('[Upload] Fatal error:', error);
      return {
        success: false,
        partialSuccess: false,
        error: error.message,
        results: [],
      };
    }
  }

  // Test API endpoint (for debugging)
  async function testAPIConnection() {
    try {
      const username = await AsyncStorage.getItem('username');
      const clientId = await AsyncStorage.getItem('client_id');
      const authToken = await AsyncStorage.getItem('authToken');

      // Test 1: With string values
      const testPayload1 = {
        client_id: String(clientId || '').trim(),
        customer_name: "TEST CUSTOMER",
        customer_code: "TEST001",
        area: "TEST AREA",
        product_name: "TEST PRODUCT",
        item_code: "TEST123",
        barcode: "TEST123",
        payment_type: "Cash",
        price: "100.00",
        quantity: "1",
        amount: "100.00",
        username: String(username || '').trim(),
      };

      console.log('[API Test 1] Testing with string values...');
      console.log('[API Test 1] Payload:', JSON.stringify(testPayload1, null, 2));

      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response1 = await fetch('https://tasksas.com/api/item-orders/create', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testPayload1),
      });

      console.log('[API Test 1] Response status:', response1.status);

      const responseClone1 = response1.clone();
      let result1 = '';

      try {
        const json = await response1.json();
        result1 = JSON.stringify(json, null, 2);
        console.log('[API Test 1] Response JSON:', result1);
      } catch {
        try {
          result1 = await responseClone1.text();
          console.log('[API Test 1] Response text:', result1);
        } catch (e) {
          result1 = 'Could not read response';
        }
      }

      if (response1.status === 500) {
        // Test 2: Try with numeric values
        const testPayload2 = {
          client_id: String(clientId || '').trim(),
          customer_name: "TEST CUSTOMER",
          customer_code: "TEST001",
          area: "TEST AREA",
          product_name: "TEST PRODUCT",
          item_code: "TEST123",
          barcode: "TEST123",
          payment_type: "Cash",
          price: 100.00,
          quantity: 1,
          amount: 100.00,
          username: String(username || '').trim(),
        };

        console.log('[API Test 2] Testing with numeric values...');
        console.log('[API Test 2] Payload:', JSON.stringify(testPayload2, null, 2));

        const response2 = await fetch('https://tasksas.com/api/item-orders/create', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(testPayload2),
        });

        console.log('[API Test 2] Response status:', response2.status);

        const responseClone2 = response2.clone();
        let result2 = '';

        try {
          const json = await response2.json();
          result2 = JSON.stringify(json, null, 2);
          console.log('[API Test 2] Response JSON:', result2);
        } catch {
          try {
            result2 = await responseClone2.text();
            console.log('[API Test 2] Response text:', result2);
          } catch (e) {
            result2 = 'Could not read response';
          }
        }

        Alert.alert(
          'API Test Results',
          `Test 1 (Strings): ${response1.status}\n${result1.substring(0, 200)}\n\nTest 2 (Numbers): ${response2.status}\n${result2.substring(0, 200)}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'API Test Result',
          `Status: ${response1.status}\n\n${result1}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[API Test] Error:', error);
      Alert.alert('API Test Error', error.message);
    }
  }

  // Confirm order (uploads to API)
  async function confirmOrder(orderId) {
    Alert.alert(
      'Confirm & Upload Order',
      'This will upload the order to the server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Upload',
          onPress: async () => {
            setUploadingOrder(orderId);

            try {
              const order = orders.find(o => o.id === orderId);
              if (!order) {
                throw new Error('Order not found');
              }

              // Upload to API
              const uploadResult = await uploadOrderToAPI(order);

              // Update order with upload status
              const updatedOrders = orders.map(o => {
                if (o.id === orderId) {
                  const itemsWithStatus = o.items.map((item, index) => {
                    const result = uploadResult.results?.find(r => r.itemIndex === index);
                    return {
                      ...item,
                      uploadStatus: result?.success ? 'uploaded to server' : 'failed',
                      uploadError: result?.error || null,
                      uploadedAt: result?.success ? new Date().toISOString() : null,
                    };
                  });

                  return {
                    ...o,
                    status: uploadResult.success ? 'uploaded to server' :
                      uploadResult.partialSuccess ? 'partial' : 'failed',
                    uploadStatus: uploadResult.success ? 'uploaded to server' :
                      uploadResult.partialSuccess ? 'partial' : 'failed',
                    uploadedAt: uploadResult.success ? new Date().toISOString() : null,
                    uploadError: uploadResult.error || null,
                    items: itemsWithStatus,
                  };
                }
                return o;
              });

              setOrders(updatedOrders);
              await AsyncStorage.setItem('placed_orders', JSON.stringify(updatedOrders));

              // Show result
              if (uploadResult.success) {
                Alert.alert('Success', `All ${uploadResult.successCount} items uploaded successfully!`);
              } else if (uploadResult.partialSuccess) {
                Alert.alert(
                  'Partial Upload',
                  `${uploadResult.successCount} of ${uploadResult.totalCount} items uploaded successfully.\n\nCheck details for failed items.`,
                  [
                    { text: 'OK' },
                    {
                      text: 'View Details',
                      onPress: () => {
                        const orderDetails = updatedOrders.find(o => o.id === orderId);
                        setSelectedOrderDetails(orderDetails);
                        setUploadDetailsModal(true);
                      }
                    }
                  ]
                );
              } else {
                const errorMsg = uploadResult.error ||
                  (uploadResult.results && uploadResult.results.length > 0
                    ? uploadResult.results[0].error
                    : 'Failed to upload order');

                Alert.alert(
                  'Upload Failed',
                  `${errorMsg}\n\nPlease check your connection and try again.`,
                  [
                    { text: 'OK' },
                    { text: 'Retry', onPress: () => confirmOrder(orderId) },
                    {
                      text: 'View Details',
                      onPress: () => {
                        const orderDetails = updatedOrders.find(o => o.id === orderId);
                        setSelectedOrderDetails(orderDetails);
                        setUploadDetailsModal(true);
                      }
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Error confirming order:', error);
              Alert.alert('Error', `Failed to upload order: ${error.message}`);
            } finally {
              setUploadingOrder(null);
            }
          }
        }
      ]
    );
  }

  // Retry failed upload
  async function retryUpload(orderId) {
    await confirmOrder(orderId);
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

  // Get status badge config
  function getStatusBadgeConfig(status) {
    switch (status) {
      case 'uploaded':
      case 'uploaded to server':
        return {
          gradient: Gradients.success,
          icon: 'cloud-done',
          text: 'Uploaded'
        };
      case 'partial':
        return {
          gradient: [Colors.warning.main, Colors.warning.main],
          icon: 'cloud-upload',
          text: 'Partial'
        };
      case 'failed':
        return {
          gradient: Gradients.danger,
          icon: 'cloud-offline',
          text: 'Failed'
        };
      case 'confirmed':
        return {
          gradient: Gradients.success,
          icon: 'checkmark-circle',
          text: 'Confirmed'
        };
      default:
        return {
          gradient: [Colors.warning.main, Colors.warning.main],
          icon: 'time',
          text: 'Pending'
        };
    }
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'pending') return !order.uploadStatus || order.uploadStatus === 'pending';
    if (filterStatus === 'uploaded') return order.uploadStatus === 'uploaded' || order.uploadStatus === 'uploaded to server';
    if (filterStatus === 'all') return true;


    if (filterStatus === 'failed') return order.uploadStatus === 'failed' || order.uploadStatus === 'partial';
    return true;
  });

  // Get counts
  const uploadedCount = orders.filter(o => o.uploadStatus === 'uploaded' || o.uploadStatus === 'uploaded to server').length;
  const pendingCount = orders.filter(o => !o.uploadStatus || o.uploadStatus === 'pending').length;
  const failedCount = orders.filter(o => o.uploadStatus === 'failed' || o.uploadStatus === 'partial').length;

  // Render order card
  function renderOrderCard({ item: order }) {
    const isExpanded = expandedOrder === order.id;
    const statusConfig = getStatusBadgeConfig(order.uploadStatus || order.status);
    const isUploading = uploadingOrder === order.id;

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
              colors={statusConfig.gradient}
              style={styles.statusBadge}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={statusConfig.icon}
                  size={16}
                  color="#fff"
                />
              )}
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.customerNameBold}>{order.customer}</Text>
              <Text style={styles.orderDetails}>
                {order.area} • {order.type} • {order.payment}
              </Text>
              <View style={styles.statusRow}>
                <Text style={styles.orderTime}>{formatDate(order.timestamp)}</Text>
                <Text style={[styles.statusText,
                order.uploadStatus === 'partial' && styles.statusTextWarning,
                order.uploadStatus === 'uploaded' && styles.statusTextSuccess,
                order.uploadStatus === 'failed' && styles.statusTextError,

                ]}>
                  • {statusConfig.text}
                </Text>
              </View>
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
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.uploadStatus && (
                        <Ionicons
                          name={item.uploadStatus === 'uploaded' ? 'checkmark-circle' : 'close-circle'}
                          size={16}
                          color={item.uploadStatus === 'uploaded' ? Colors.success.main : Colors.error.main}
                        />
                      )}
                    </View>
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
                      disabled={order.uploadStatus === 'uploaded'}
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
                      editable={order.uploadStatus !== 'uploaded'}
                    />

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateItemQty(order.id, index, item.qty + 1)}
                      disabled={order.uploadStatus === 'uploaded'}
                    >
                      <Ionicons name="add" size={16} color={Colors.text.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => removeItem(order.id, index)}
                      style={styles.removeBtn}
                      disabled={order.uploadStatus === 'uploaded'}
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
              {order.uploadStatus === 'uploaded' ? (
                <View style={styles.uploadedBadge}>
                  <Ionicons name="cloud-done" size={18} color={Colors.success.main} />
                  <Text style={styles.uploadedBadgeText}>
                    Uploaded on {formatDate(order.uploadedAt)}
                  </Text>
                </View>
              ) : (
                <>
                  {(order.uploadStatus === 'failed' || order.uploadStatus === 'partial') && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => retryUpload(order.id)}
                      disabled={isUploading}
                    >
                      <LinearGradient
                        colors={Gradients.warning}
                        style={styles.actionButtonGradient}
                      >
                        {isUploading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="refresh" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Retry Upload</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {order.uploadStatus === 'partial' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        setSelectedOrderDetails(order);
                        setUploadDetailsModal(true);
                      }}
                    >
                      <LinearGradient
                        colors={Gradients.secondary}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="information-circle" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>View Details</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {!order.uploadStatus && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => confirmOrder(order.id)}
                      disabled={isUploading}
                    >
                      <LinearGradient
                        colors={Gradients.success}
                        style={styles.actionButtonGradient}
                      >
                        {isUploading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Upload Order</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => deleteOrder(order.id)}
                disabled={isUploading}
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
          <TouchableOpacity onPress={testAPIConnection} style={styles.iconButton}>
            <Ionicons name="flask" size={24} color={Colors.secondary.main} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>

            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'pending' && styles.filterTabActive]}
              onPress={() => setFilterStatus('pending')}
            >
              <Ionicons name="time" size={16} color={filterStatus === 'pending' ? '#FFF' : Colors.warning.main} />
              <Text style={[styles.filterTabText, filterStatus === 'pending' && styles.filterTabTextActive]}>
                Pending ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'uploaded' && styles.filterTabActive]}
              onPress={() => setFilterStatus('uploaded')}
            >
              <Ionicons name="cloud-done" size={16} color={filterStatus === 'uploaded' ? '#FFF' : Colors.success.main} />
              <Text style={[styles.filterTabText, filterStatus === 'uploaded' && styles.filterTabTextActive]}>
                Uploaded ({uploadedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
              onPress={() => setFilterStatus('all')}
            >
              <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>
                All ({orders.length})
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'failed' && styles.filterTabActive]}
              onPress={() => setFilterStatus('failed')}
            >
              <Ionicons name="close-circle" size={16} color={filterStatus === 'failed' ? '#FFF' : Colors.error.main} />
              <Text style={[styles.filterTabText, filterStatus === 'failed' && styles.filterTabTextActive]}>
                Failed ({failedCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.container}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="receipt-outline" size={60} color={Colors.primary.light} />
              </View>
              <Text style={styles.emptyTitle}>
                {orders.length === 0 ? 'No orders placed yet' : 'No orders found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {orders.length === 0
                  ? 'Start by creating a new order'
                  : `No ${filterStatus} orders available`
                }
              </Text>
              {orders.length === 0 && (
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
              )}
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrderCard}
              contentContainerStyle={styles.listContent}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Upload Details Modal */}
        <Modal
          visible={uploadDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setUploadDetailsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Details</Text>
                <TouchableOpacity onPress={() => setUploadDetailsModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {selectedOrderDetails && (
                  <>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Customer:</Text>
                      <Text style={styles.modalValue}>{selectedOrderDetails.customer}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Total:</Text>
                      <Text style={styles.modalValue}>₹{selectedOrderDetails.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalLabel}>Status:</Text>
                      <Text style={[styles.modalValue,
                      selectedOrderDetails.uploadStatus === 'uploaded' && { color: Colors.success.main },
                      selectedOrderDetails.uploadStatus === 'failed' && { color: Colors.error.main },
                      selectedOrderDetails.uploadStatus === 'partial' && { color: Colors.warning.main }
                      ]}>
                        {getStatusBadgeConfig(selectedOrderDetails.uploadStatus).text}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.modalSectionTitle}>Items Status</Text>
                    {selectedOrderDetails.items.map((item, index) => (
                      <View key={index} style={styles.modalItemRow}>
                        <View style={styles.modalItemInfo}>
                          <Text style={styles.modalItemName}>{item.name}</Text>
                          <Text style={styles.modalItemMeta}>
                            Qty: {item.qty} × ₹{item.price.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.modalItemStatus}>
                          {item.uploadStatus === 'uploaded' ? (
                            <View style={styles.statusSuccess}>
                              <Ionicons name="checkmark-circle" size={20} color={Colors.success.main} />
                              <Text style={styles.statusSuccessText}>Uploaded</Text>
                            </View>
                          ) : (
                            <View style={styles.statusError}>
                              <Ionicons name="close-circle" size={20} color={Colors.error.main} />
                              <Text style={styles.statusErrorText}>Failed</Text>
                            </View>
                          )}
                          {item.uploadError && (
                            <Text style={styles.errorText}>{item.uploadError}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setUploadDetailsModal(false);
                    if (selectedOrderDetails) {
                      retryUpload(selectedOrderDetails.id);
                    }
                  }}
                >
                  <LinearGradient
                    colors={Gradients.primary}
                    style={styles.modalButtonGradient}
                  >
                    <Ionicons name="refresh" size={18} color="#FFF" />
                    <Text style={styles.modalButtonText}>Retry Upload</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    marginTop: 30,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  iconButton: { padding: 4 },

  filterContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  filterTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterTabTextActive: {
    color: '#FFF',
  },

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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  orderTime: {
    fontSize: 10,
    color: Colors.text.tertiary,
  },
  statusText: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginLeft: 4,
  },
  statusTextSuccess: {
    color: Colors.success.main,
    fontWeight: '600',
  },
  statusTextError: {
    color: Colors.error.main,
    fontWeight: '600',
  },
  statusTextWarning: {
    color: Colors.warning.main,
    fontWeight: '600',
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
    backgroundColor: Colors.neutral[50],
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
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
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

  uploadedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success[50],
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  uploadedBadgeText: {
    color: Colors.success.main,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  modalLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  modalValue: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  modalSectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  modalItemMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },
  modalItemStatus: {
    alignItems: 'flex-end',
  },
  statusSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusSuccessText: {
    fontSize: Typography.sizes.sm,
    color: Colors.success.main,
    fontWeight: '600',
  },
  statusError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusErrorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error.main,
    fontWeight: '600',
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.error.main,
    marginTop: 2,
    maxWidth: 150,
  },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  modalButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  modalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: Typography.sizes.base,
    fontWeight: '700',
  },
});