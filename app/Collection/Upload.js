// app/Collection/Upload.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import dbService from "../../src/services/database";

const API_UPLOAD_COLLECTION = "https://tasksas.com/api/collection/create/";

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
      if (loading) setLoading(true);
      await dbService.init();
      const pendingCollections = await dbService.getOfflineCollections(false);
      setCollections(pendingCollections);
    } catch (error) {
      console.error("[Upload] Error loading collections:", error);
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
          // Prepare upload data according to API structure
          const uploadData = {
            code: collection.customer_code || '',
            name: collection.customer_name || '',
            place: collection.customer_place || '',
            phone: collection.customer_phone || '',
            amount: parseFloat(collection.amount) || 0,
            type: collection.payment_type || ''
          };

          // Add optional fields only if they exist and have values
          // Handle cheque_no (DB uses cheque_number)
          if (collection.cheque_number || collection.cheque_no) {
            uploadData.cheque_no = collection.cheque_number || collection.cheque_no;
            // Also map to ref_no if not present, based on user example
            if (!uploadData.ref_no) {
              uploadData.ref_no = uploadData.cheque_no;
            }
          }

          // Handle ref_no if explicitly present
          if (collection.ref_no) {
            uploadData.ref_no = collection.ref_no;
          }

          // Handle remark (DB uses remarks)
          if (collection.remarks || collection.remark) {
            uploadData.remark = collection.remarks || collection.remark;
          }

          console.log('[Upload] Uploading collection:', JSON.stringify(uploadData, null, 2));

          const response = await fetch(API_UPLOAD_COLLECTION, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(uploadData),
          });

          console.log('[Upload] Response status:', response.status);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.log('[Upload] Error response:', errorData);
            throw new Error(errorData.message || `Upload failed: ${response.status}`);
          }

          const responseData = await response.json().catch(() => ({}));
          console.log('[Upload] Success response:', responseData);

          // Mark as synced locally using local_id
          await dbService.markCollectionAsSynced(collection.local_id);
          successCount++;

        } catch (error) {
          console.error(`Failed to upload collection ${collection.id}:`, error);
          failedItems.push(collection);
        }
      }

      // Reload collections after upload
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

  const renderCollectionItem = ({ item, index }) => {
    const isSelected = selectedCollections.includes(item.id);

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50)}
        style={[styles.collectionCard, isSelected && styles.selectedCard]}
      >
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => toggleSelectCollection(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.checkboxContainer}>
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={24}
              color={isSelected ? Colors.primary.main : Colors.text.tertiary}
            />
          </View>

          <View style={styles.collectionInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer_name}
            </Text>
            <Text style={styles.amount}>{(+item.amount).toLocaleString()}</Text>

            <View style={styles.detailsRow}>
              <View style={[styles.badge, { backgroundColor: Colors.neutral[100] }]}>
                <Text style={styles.badgeText}>{item.payment_type}</Text>
              </View>
              <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <LinearGradient colors={Gradients.background} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Data</Text>
          <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
            <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
            <Text style={[styles.statusText, isOnline ? styles.onlineText : styles.offlineText]}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        {collections.length > 0 && (
          <View style={styles.selectionBar}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedCollections.length === collections.length ? "checkbox" : "square-outline"}
                size={20}
                color={Colors.primary.main}
              />
              <Text style={styles.selectAllText}>
                {selectedCollections.length === collections.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>
              {selectedCollections.length} selected
            </Text>
          </View>
        )}

        {collections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-done-outline" size={64} color={Colors.success.main} />
            <Text style={styles.emptyTitle}>All Synced!</Text>
            <Text style={styles.emptySubtitle}>
              You have no pending collections to upload.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/Collection/AddCollection")}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Add New Payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={collections}
              keyExtractor={(item) => (item.id || Math.random()).toString()}
              renderItem={renderCollectionItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.main} />
              }
            />

            <Animated.View entering={FadeInUp} style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  (!isOnline || selectedCollections.length === 0 || uploading) && styles.disabledButton
                ]}
                onPress={handleUpload}
                disabled={!isOnline || selectedCollections.length === 0 || uploading}
              >
                <View style={[
                  styles.gradientButton,
                  (!isOnline || selectedCollections.length === 0 || uploading) && styles.disabledGradient
                ]}>
                  {uploading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color="#FFF" />
                      <Text style={styles.uploadButtonText}>
                        Upload {selectedCollections.length} Items
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, marginTop: 35, paddingBottom: Spacing.md },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  onlineBadge: { backgroundColor: Colors.success[50] },
  offlineBadge: { backgroundColor: Colors.warning[50] },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: { backgroundColor: Colors.success.main },
  offlineDot: { backgroundColor: Colors.warning.main },
  statusText: { fontSize: 10, fontWeight: '700' },
  onlineText: { color: Colors.success.main },
  offlineText: { color: Colors.warning.main },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  selectionCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  addButton: {
    backgroundColor: Colors.primary.main,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  collectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  selectedCard: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary[50],
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: Spacing.md,
  },
  collectionInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  amount: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.success.main,
    marginVertical: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  dateText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  uploadButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
    backgroundColor: Colors.primary.main,
    borderRadius: BorderRadius.lg,
  },
  disabledGradient: {
    backgroundColor: Colors.neutral[400],
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.base,
  },
  disabledButton: {
    opacity: 0.6,
  },
});