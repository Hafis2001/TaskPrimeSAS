// app/Collection/View-Collection.js
import { Ionicons } from "@expo/vector-icons";
import * as NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import dbService from "../../src/services/database";

export default function ViewCollectionScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState([]);
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    pending: 0,
    totalAmount: 0,
    syncedAmount: 0,
    pendingAmount: 0,
  });

  useEffect(() => {
    checkNetworkStatus();
    loadCollections();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    const interval = setInterval(() => {
      loadCollections();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [collections, searchQuery, filterStatus]);

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected);
  };

  const loadCollections = async () => {
    try {
      if (loading) setLoading(true);

      await dbService.init();
      const allCollections = await dbService.getOfflineCollections();
      const sortedCollections = allCollections.sort((a, b) => {
        return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
      });

      setCollections(sortedCollections);
      calculateStats(sortedCollections);
    } catch (error) {
      console.error("[View-Collection] Error loading collections:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections();
    setRefreshing(false);
  }, []);

  const calculateStats = (data) => {
    const syncedItems = data.filter(item => item.synced === 1);
    const pendingItems = data.filter(item => item.synced === 0);

    const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const syncedAmount = syncedItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const pendingAmount = pendingItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    setStats({
      total: data.length,
      synced: syncedItems.length,
      pending: pendingItems.length,
      totalAmount,
      syncedAmount,
      pendingAmount,
    });
  };

  const applyFilters = () => {
    let filtered = [...collections];

    if (filterStatus === "synced") {
      filtered = filtered.filter(item => item.synced === 1);
    } else if (filterStatus === "pending") {
      filtered = filtered.filter(item => item.synced === 0);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.customer_name.toLowerCase().includes(query) ||
        item.customer_code.toLowerCase().includes(query) ||
        (item.remarks && item.remarks.toLowerCase().includes(query))
      );
    }

    setFilteredCollections(filtered);
  };

  const handleDelete = (collection) => {
    Alert.alert(
      "Delete Collection",
      `Delete collection for ${collection.customer_name}?${collection.synced === 1 ? '\n\nNote: This is already synced to server.' : ''}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCollection(collection.id);
          }
        }
      ]
    );
  };

  const deleteCollection = async (collectionId) => {
    try {
      await dbService.init();
      await dbService.deleteCollection(collectionId);
      await loadCollections();
      Alert.alert("Success", "Collection deleted successfully.");
    } catch (error) {
      console.error("Delete error:", error);
      Alert.alert("Error", "Failed to delete collection.");
    }
  };

  const handleViewDetails = (collection) => {
    setSelectedCollection(collection);
    setShowDetailModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const renderStatCard = (title, value, subtitle, colorStart, colorEnd, icon) => (
    <Animated.View entering={FadeInUp.delay(100)} style={styles.statCardContainer}>
      <LinearGradient
        colors={[colorStart, colorEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statCard}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name={icon} size={20} color="#FFF" />
        </View>
        <View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderCollectionItem = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 30)} style={styles.collectionCard}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.statusIndicator, item.synced === 1 ? styles.syncedDot : styles.pendingDot]} />

          <View style={styles.collectionDetails}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer_name}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.customerCode}>{item.customer_code}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: Colors.neutral[100] }]}>
                <Text style={[styles.badgeText, { color: Colors.text.secondary }]}>
                  {item.payment_type}
                </Text>
              </View>
              {item.synced === 1 ? (
                <View style={[styles.badge, { backgroundColor: Colors.success[50] }]}>
                  <Text style={[styles.badgeText, { color: Colors.success.main }]}>SYNCED</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: Colors.warning[50] }]}>
                  <Text style={[styles.badgeText, { color: Colors.warning.main }]}>PENDING</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteAction}>
            <Ionicons name="trash-outline" size={18} color={Colors.error.main} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

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
          <Text style={styles.headerTitle}>View Collections</Text>
          <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterButton}>
            <Ionicons name="filter" size={22} color={Colors.primary.main} />
            {filterStatus !== "all" && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.statsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
            {renderStatCard("Total", stats.total, formatCurrency(stats.totalAmount), Colors.primary.main, Colors.primary[600], "layers")}
            {renderStatCard("Synced", stats.synced, formatCurrency(stats.syncedAmount), Colors.success.main, Colors.success[600], "cloud-done")}
            {renderStatCard("Pending", stats.pending, formatCurrency(stats.pendingAmount), Colors.warning.main, Colors.warning[600], "cloud-upload")}
          </ScrollView>
        </View>

        <Animated.View entering={FadeInDown} style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search collections..."
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>

        <FlatList
          data={filteredCollections}
          keyExtractor={(item) => (item.id || Math.random()).toString()}
          renderItem={renderCollectionItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.main} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={64} color={Colors.primary[200]} />
              <Text style={styles.emptyTitle}>No Collections Found</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push("/Collection/AddCollection")}>
                <Text style={styles.addButtonText}>Add New Collection</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Filter Modal */}
        <Modal visible={showFilterModal} animationType="fade" transparent onRequestClose={() => setShowFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.filterModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter Collections</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterStatus("all"); setShowFilterModal(false); }}>
                <Text style={[styles.filterOptionText, filterStatus === "all" && styles.activeFilterText]}>All Collections</Text>
                {filterStatus === "all" && <Ionicons name="checkmark" size={20} color={Colors.primary.main} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterStatus("synced"); setShowFilterModal(false); }}>
                <Text style={[styles.filterOptionText, filterStatus === "synced" && styles.activeFilterText]}>Synced Only</Text>
                {filterStatus === "synced" && <Ionicons name="checkmark" size={20} color={Colors.primary.main} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterOption} onPress={() => { setFilterStatus("pending"); setShowFilterModal(false); }}>
                <Text style={[styles.filterOptionText, filterStatus === "pending" && styles.activeFilterText]}>Pending Only</Text>
                {filterStatus === "pending" && <Ionicons name="checkmark" size={20} color={Colors.primary.main} />}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Detail Modal */}
        <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Details</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              {selectedCollection && (
                <ScrollView contentContainerStyle={styles.detailContent}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Client</Text>
                    <Text style={styles.detailValue}>{selectedCollection.customer_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Code</Text>
                    <Text style={styles.detailValue}>{selectedCollection.customer_code}</Text>
                  </View>
                  {selectedCollection.customer_place && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Place</Text>
                      <Text style={styles.detailValue}>{selectedCollection.customer_place}</Text>
                    </View>
                  )}
                  {selectedCollection.customer_phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{selectedCollection.customer_phone}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={[styles.detailValue, { color: Colors.success.main, fontSize: 24 }]}>
                      {formatCurrency(selectedCollection.amount)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Type</Text>
                    <Text style={styles.detailValue}>{selectedCollection.payment_type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.badge, { backgroundColor: selectedCollection.synced === 1 ? Colors.success[50] : Colors.warning[50] }]}>
                      <Text style={[styles.badgeText, { color: selectedCollection.synced === 1 ? Colors.success.main : Colors.warning.main }]}>
                        {selectedCollection.synced === 1 ? "SYNCED TO SERVER" : "PENDING UPLOAD"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{new Date(selectedCollection.date).toLocaleString()}</Text>
                  </View>
                  {selectedCollection.remarks && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Remarks</Text>
                      <Text style={styles.detailValue}>{selectedCollection.remarks}</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

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
  filterButton: {
    padding: 4,
  },
  filterDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error.main,
  },
  statsSection: {
    marginBottom: Spacing.md,
  },
  statsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statCardContainer: {
    width: 140,
    ...Shadows.sm,
  },
  statCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  statTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  statSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  searchContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.text.primary },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  collectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: Spacing.md,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.md,
    marginTop: 4,
  },
  syncedDot: { backgroundColor: Colors.success.main },
  pendingDot: { backgroundColor: Colors.warning.main },
  collectionDetails: { flex: 1 },
  customerName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerCode: { fontSize: Typography.sizes.xs, color: Colors.text.tertiary },
  dotSeparator: { marginHorizontal: 4, color: Colors.text.tertiary, fontSize: 10 },
  dateText: { fontSize: Typography.sizes.xs, color: Colors.text.tertiary },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  deleteAction: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.lg,
    color: Colors.text.secondary,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  addButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary.main,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  filterModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  detailModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    maxHeight: '80%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterOptionText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
  },
  activeFilterText: {
    color: Colors.primary.main,
    fontWeight: '600',
  },
  detailContent: {
    paddingBottom: Spacing.lg,
  },
  detailRow: {
    marginBottom: Spacing.lg,
  },
  detailLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: '500',
  },
});