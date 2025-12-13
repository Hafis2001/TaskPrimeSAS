// app/upload.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import NetInfo from "@react-native-community/netinfo";

const API_UPLOAD_COLLECTION = "https://tasksas.com/api/collections/upload/"; // Replace with your actual API

export default function UploadScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    checkNetworkStatus();
    loadPendingCollections();
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected);
  };

  const loadPendingCollections = async () => {
    try {
      setLoading(true);
      const existingData = await AsyncStorage.getItem("offline_collections");
      const allCollections = existingData ? JSON.parse(existingData) : [];
      
      // Filter only non-synced collections
      const pendingCollections = allCollections.filter(item => !item.synced);
      
      setCollections(pendingCollections);
      console.log(`Loaded ${pendingCollections.length} pending collections`);
    } catch (error) {
      console.error("Error loading collections:", error);
      Alert.alert("Error", "Failed to load collections. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPendingCollections();
    setRefreshing(false);
  }, []);

  const toggleSelectCollection = (id) => {
    setSelectedCollections(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedCollections.length === collections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(collections.map(item => item.id));
    }
  };

  const handleUpload = async () => {
    if (!isOnline) {
      Alert.alert(
        "No Internet Connection",
        "Please connect to the internet to upload collections."
      );
      return;
    }

    if (selectedCollections.length === 0) {
      Alert.alert(
        "No Selection",
        "Please select at least one collection to upload."
      );
      return;
    }

    Alert.alert(
      "Confirm Upload",
      `Upload ${selectedCollections.length} collection(s) to server?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          onPress: async () => {
            await uploadCollections();
          }
        }
      ]
    );
  };

  const uploadCollections = async () => {
    setUploading(true);
    setUploadProgress({ current: 0, total: selectedCollections.length });

    try {
      const token = await AsyncStorage.getItem("authToken");
      
      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        router.replace("/LoginScreen");
        return;
      }

      const collectionsToUpload = collections.filter(item => 
        selectedCollections.includes(item.id)
      );

      let successCount = 0;
      let failedItems = [];

      for (let i = 0; i < collectionsToUpload.length; i++) {
        const collection = collectionsToUpload[i];
        setUploadProgress({ current: i + 1, total: collectionsToUpload.length });

        try {
          // Prepare data for API
          const uploadData = {
            customer_code: collection.customer_code,
            customer_name: collection.customer_name,
            amount: collection.amount,
            payment_type: collection.payment_type,
            cheque_number: collection.cheque_number,
            remarks: collection.remarks,
            date: collection.date,
          };

          // TODO: Replace this with actual API call
          const response = await fetch(API_UPLOAD_COLLECTION, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(uploadData),
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }

          // Mark as synced
          await markAsSynced(collection.id);
          successCount++;

        } catch (error) {
          console.error(`Failed to upload collection ${collection.id}:`, error);
          failedItems.push(collection);
        }
      }

      // Reload collections
      await loadPendingCollections();
      setSelectedCollections([]);

      if (failedItems.length === 0) {
        Alert.alert(
          "Success",
          `Successfully uploaded ${successCount} collection(s)!`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Partial Success",
          `Uploaded ${successCount} collection(s). ${failedItems.length} failed.`,
          [{ text: "OK" }]
        );
      }

    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload collections. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const markAsSynced = async (collectionId) => {
    try {
      const existingData = await AsyncStorage.getItem("offline_collections");
      const allCollections = existingData ? JSON.parse(existingData) : [];
      
      const updatedCollections = allCollections.map(item => {
        if (item.id === collectionId) {
          return { ...item, synced: true, synced_at: new Date().toISOString() };
        }
        return item;
      });
      
      await AsyncStorage.setItem("offline_collections", JSON.stringify(updatedCollections));
    } catch (error) {
      console.error("Error marking as synced:", error);
    }
  };

  const handleDelete = (collectionId) => {
    Alert.alert(
      "Delete Collection",
      "Are you sure you want to delete this collection? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCollection(collectionId);
          }
        }
      ]
    );
  };

  const deleteCollection = async (collectionId) => {
    try {
      const existingData = await AsyncStorage.getItem("offline_collections");
      const allCollections = existingData ? JSON.parse(existingData) : [];
      
      const updatedCollections = allCollections.filter(item => item.id !== collectionId);
      
      await AsyncStorage.setItem("offline_collections", JSON.stringify(updatedCollections));
      
      setCollections(prev => prev.filter(item => item.id !== collectionId));
      setSelectedCollections(prev => prev.filter(id => id !== collectionId));
      
      Alert.alert("Success", "Collection deleted successfully.");
    } catch (error) {
      console.error("Error deleting collection:", error);
      Alert.alert("Error", "Failed to delete collection.");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderCollectionItem = ({ item, index }) => {
    const isSelected = selectedCollections.includes(item.id);

    return (
      <Animated.View 
        entering={FadeInUp.delay(index * 50)}
        style={styles.collectionCard}
      >
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => toggleSelectCollection(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.checkbox}>
            {isSelected ? (
              <Ionicons name="checkbox" size={24} color="#0d3b6c" />
            ) : (
              <Ionicons name="square-outline" size={24} color="#6b7c8a" />
            )}
          </View>

          <View style={styles.collectionInfo}>
            <View style={styles.customerRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customer_name}
              </Text>
              <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="person-outline" size={14} color="#6b7c8a" />
                <Text style={styles.detailText}>{item.customer_code}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={14} color="#6b7c8a" />
                <Text style={styles.detailText}>{formatDate(item.date)}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.badge, item.payment_type === 'cash' ? styles.cashBadge : styles.chequeBadge]}>
                <Ionicons 
                  name={item.payment_type === 'cash' ? "wallet" : "card"} 
                  size={12} 
                  color="#ffffff" 
                />
                <Text style={styles.badgeText}>
                  {item.payment_type.toUpperCase()}
                </Text>
              </View>
              {item.cheque_number && (
                <Text style={styles.chequeNumber}>#{item.cheque_number}</Text>
              )}
            </View>

            {item.remarks && (
              <View style={styles.remarksContainer}>
                <Ionicons name="chatbox-outline" size={12} color="#6b7c8a" />
                <Text style={styles.remarksText} numberOfLines={2}>
                  {item.remarks}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color="#ff3b30" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d3b6c" />
          <Text style={styles.loadingText}>Loading collections...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInUp} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0d3b6c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Collections</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          </View>
        </Animated.View>

        {!isOnline && (
          <Animated.View entering={FadeInDown} style={styles.offlineWarning}>
            <Ionicons name="cloud-offline-outline" size={20} color="#ff9500" />
            <Text style={styles.offlineWarningText}>
              You're offline. Connect to internet to upload collections.
            </Text>
          </Animated.View>
        )}

        {collections.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.selectionBar}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={selectedCollections.length === collections.length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#0d3b6c" 
              />
              <Text style={styles.selectAllText}>
                {selectedCollections.length === collections.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>
              {selectedCollections.length} of {collections.length} selected
            </Text>
          </Animated.View>
        )}

        {collections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-upload-outline" size={80} color="#9aa4b2" />
            <Text style={styles.emptyTitle}>No Pending Collections</Text>
            <Text style={styles.emptySubtitle}>
              All collections are synced or add new collections to upload.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/add-collection")}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.addButtonText}>Add Collection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={collections}
              keyExtractor={(item) => item.id}
              renderItem={renderCollectionItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#0d3b6c"
                />
              }
            />

            {uploading && (
              <Animated.View entering={FadeInUp} style={styles.uploadProgress}>
                <ActivityIndicator size="small" color="#0d3b6c" />
                <Text style={styles.uploadProgressText}>
                  Uploading {uploadProgress.current} of {uploadProgress.total}...
                </Text>
              </Animated.View>
            )}

            <Animated.View entering={FadeInUp.delay(200)} style={styles.uploadButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  (!isOnline || selectedCollections.length === 0 || uploading) && styles.uploadButtonDisabled
                ]}
                onPress={handleUpload}
                disabled={!isOnline || selectedCollections.length === 0 || uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={22} color="#ffffff" />
                    <Text style={styles.uploadButtonText}>
                      Upload {selectedCollections.length > 0 ? `(${selectedCollections.length})` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7c8a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(13, 59, 108, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#0d3b6c",
    marginLeft: 12,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineDot: {
    backgroundColor: "#34c759",
  },
  offlineDot: {
    backgroundColor: "#ff9500",
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9e6",
    borderRadius: 0,
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ffd966",
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#b8860b",
    fontWeight: "500",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(13, 59, 108, 0.08)",
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0d3b6c",
  },
  selectionCount: {
    fontSize: 13,
    color: "#6b7c8a",
    fontWeight: "500",
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  collectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: "row",
    padding: 14,
    alignItems: "flex-start",
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  collectionInfo: {
    flex: 1,
  },
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  customerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0b2a44",
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b8a2f",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#6b7c8a",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  cashBadge: {
    backgroundColor: "#0b8a2f",
  },
  chequeBadge: {
    backgroundColor: "#0d3b6c",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  chequeNumber: {
    fontSize: 12,
    color: "#6b7c8a",
    fontWeight: "500",
  },
  remarksContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f5f5f5",
  },
  remarksText: {
    flex: 1,
    fontSize: 12,
    color: "#6b7c8a",
    fontStyle: "italic",
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0d3b6c",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7c8a",
    textAlign: "center",
    marginBottom: 24,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d3b6c",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  uploadProgress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "rgba(13, 59, 108, 0.08)",
  },
  uploadProgressText: {
    fontSize: 14,
    color: "#0d3b6c",
    fontWeight: "600",
  },
  uploadButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 247, 240, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(13, 59, 108, 0.08)",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d3b6c",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: "#9aa4b2",
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});