// app/view-collection.js
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
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import NetInfo from "@react-native-community/netinfo";

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
      setLoading(true);
      const existingData = await AsyncStorage.getItem("offline_collections");
      const allCollections = existingData ? JSON.parse(existingData) : [];
      
      const sortedCollections = allCollections.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setCollections(sortedCollections);
      calculateStats(sortedCollections);
    } catch (error) {
      console.error("Error loading collections:", error);
      Alert.alert("Error", "Failed to load collections.");
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
    const syncedItems = data.filter(item => item.synced);
    const pendingItems = data.filter(item => !item.synced);

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
      filtered = filtered.filter(item => item.synced);
    } else if (filterStatus === "pending") {
      filtered = filtered.filter(item => !item.synced);
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
      `Delete collection for ${collection.customer_name}?${collection.synced ? '\n\nNote: This is already synced to server.' : ''}`,
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
      const existingData = await AsyncStorage.getItem("offline_collections");
      const allCollections = existingData ? JSON.parse(existingData) : [];
      
      const updatedCollections = allCollections.filter(item => item.id !== collectionId);
      
      await AsyncStorage.setItem("offline_collections", JSON.stringify(updatedCollections));
      
      await loadCollections();
      
      Alert.alert("Success", "Collection deleted successfully.");
    } catch (error) {
      console.error("Error deleting collection:", error);
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderStatCard = (title, value, subtitle, color, icon) => (
    <Animated.View entering={FadeInUp.delay(100)} style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
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
          <View style={styles.statusIndicator}>
            {item.synced ? (
              <Ionicons name="cloud-done" size={20} color="#0b8a2f" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color="#ff9500" />
            )}
          </View>

          <View style={styles.collectionDetails}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer_name}
            </Text>
            <Text style={styles.customerCode}>{item.customer_code}</Text>
            
            <View style={styles.metaRow}>
              <View style={[styles.badge, item.payment_type === 'cash' ? styles.cashBadge : styles.chequeBadge]}>
                <Ionicons 
                  name={item.payment_type === 'cash' ? "wallet" : "card"} 
                  size={10} 
                  color="#ffffff" 
                />
                <Text style={styles.badgeText}>
                  {item.payment_type.toUpperCase()}
                </Text>
              </View>
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={12} color="#6b7c8a" />
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <View style={[styles.statusBadge, item.synced ? styles.syncedBadge : styles.pendingBadge]}>
            <Text style={[styles.statusText, item.synced ? styles.syncedText : styles.pendingText]}>
              {item.synced ? "Synced" : "Pending"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewDetails(item)}>
          <Ionicons name="eye-outline" size={18} color="#0d3b6c" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        <View style={styles.actionDivider} />
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color="#ff3b30" />
          <Text style={[styles.actionButtonText, { color: "#ff3b30" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

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
          <Text style={styles.headerTitle}>View Collections</Text>
          <TouchableOpacity onPress={() => setShowFilterModal(true)} style={styles.filterButton}>
            <Ionicons name="filter" size={22} color="#0d3b6c" />
            {filterStatus !== "all" && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            {renderStatCard("Total", stats.total, formatCurrency(stats.totalAmount), "#0d3b6c", "layers")}
            {renderStatCard("Synced", stats.synced, formatCurrency(stats.syncedAmount), "#0b8a2f", "cloud-done")}
          </View>
          <View style={styles.statsRow}>
            {renderStatCard("Pending", stats.pending, formatCurrency(stats.pendingAmount), "#ff9500", "cloud-upload-outline")}
            <Animated.View entering={FadeInUp.delay(100)} style={[styles.statCard, { borderLeftColor: isOnline ? "#34c759" : "#ff3b30" }]}>
              <View style={[styles.statIcon, { backgroundColor: (isOnline ? "#34c759" : "#ff3b30") + '20' }]}>
                <Ionicons name={isOnline ? "wifi" : "wifi-outline"} size={20} color={isOnline ? "#34c759" : "#ff3b30"} />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{isOnline ? "Online" : "Offline"}</Text>
                <Text style={styles.statTitle}>Network</Text>
              </View>
            </Animated.View>
          </View>
        </View>

        <Animated.View entering={FadeInDown} style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7c8a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#9aa4b2"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#6b7c8a" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {filteredCollections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color="#9aa4b2" />
            <Text style={styles.emptyTitle}>No Collections</Text>
            <Text style={styles.emptySubtitle}>Add your first collection</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push("/add-collection")}>
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.addButtonText}>Add Collection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredCollections}
            keyExtractor={(item) => item.id}
            renderItem={renderCollectionItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d3b6c" />}
          />
        )}

        <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.filterModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter Collections</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={24} color="#0d3b6c" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.filterOption, filterStatus === "all" && styles.filterOptionActive]}
                onPress={() => { setFilterStatus("all"); setShowFilterModal(false); }}>
                <Ionicons name="layers-outline" size={22} color={filterStatus === "all" ? "#0d3b6c" : "#6b7c8a"} />
                <Text style={[styles.filterOptionText, filterStatus === "all" && styles.filterOptionTextActive]}>
                  All Collections
                </Text>
                <Text style={styles.filterCount}>({stats.total})</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.filterOption, filterStatus === "synced" && styles.filterOptionActive]}
                onPress={() => { setFilterStatus("synced"); setShowFilterModal(false); }}>
                <Ionicons name="cloud-done-outline" size={22} color={filterStatus === "synced" ? "#0b8a2f" : "#6b7c8a"} />
                <Text style={[styles.filterOptionText, filterStatus === "synced" && styles.filterOptionTextActive]}>
                  Synced Only
                </Text>
                <Text style={styles.filterCount}>({stats.synced})</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.filterOption, filterStatus === "pending" && styles.filterOptionActive]}
                onPress={() => { setFilterStatus("pending"); setShowFilterModal(false); }}>
                <Ionicons name="cloud-upload-outline" size={22} color={filterStatus === "pending" ? "#ff9500" : "#6b7c8a"} />
                <Text style={[styles.filterOptionText, filterStatus === "pending" && styles.filterOptionTextActive]}>
                  Pending Only
                </Text>
                <Text style={styles.filterCount}>({stats.pending})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Collection Details</Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close" size={24} color="#0d3b6c" />
                </TouchableOpacity>
              </View>

              {selectedCollection && (
                <ScrollView style={styles.detailScroll}>
                  <View style={[styles.detailStatusBanner, selectedCollection.synced ? styles.syncedBanner : styles.pendingBanner]}>
                    <Ionicons name={selectedCollection.synced ? "checkmark-circle" : "time"} size={24} color="#ffffff" />
                    <Text style={styles.detailStatusText}>
                      {selectedCollection.synced ? "Successfully Synced" : "Pending Upload"}
                    </Text>
                  </View>

                  <View style={styles.detailContent}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Customer Name</Text>
                      <Text style={styles.detailValue}>{selectedCollection.customer_name}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Customer Code</Text>
                      <Text style={styles.detailValue}>{selectedCollection.customer_code}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount</Text>
                      <Text style={[styles.detailValue, styles.amountValue]}>{formatCurrency(selectedCollection.amount)}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Type</Text>
                      <View style={[styles.badge, selectedCollection.payment_type === 'cash' ? styles.cashBadge : styles.chequeBadge]}>
                        <Ionicons name={selectedCollection.payment_type === 'cash' ? "wallet" : "card"} size={12} color="#ffffff" />
                        <Text style={styles.badgeText}>{selectedCollection.payment_type.toUpperCase()}</Text>
                      </View>
                    </View>

                    {selectedCollection.cheque_number && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Cheque Number</Text>
                        <Text style={styles.detailValue}>{selectedCollection.cheque_number}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Collection Date</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedCollection.date)}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Created At</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedCollection.created_at)}</Text>
                    </View>

                    {selectedCollection.synced && selectedCollection.synced_at && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Synced At</Text>
                        <Text style={[styles.detailValue, { color: "#0b8a2f" }]}>
                          {formatDate(selectedCollection.synced_at)}
                        </Text>
                      </View>
                    )}

                    {selectedCollection.remarks && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Remarks</Text>
                        <Text style={[styles.detailValue, styles.remarksValue]}>{selectedCollection.remarks}</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-collection")}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#6b7c8a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(13, 59, 108, 0.08)", backgroundColor: "rgba(255, 255, 255, 0.6)" },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#0d3b6c", marginLeft: 12 },
  filterButton: { padding: 4, position: "relative" },
  filterDot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3b30" },
  statsSection: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 12, padding: 12, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 10 },
  statContent: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#0b2a44" },
  statTitle: { fontSize: 12, color: "#6b7c8a", marginTop: 2 },
  statSubtitle: { fontSize: 11, color: "#0b8a2f", fontWeight: "600", marginTop: 2 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 12, height: 45, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#0b2a44" },
  listContent: { padding: 16, paddingBottom: 100 },
  collectionCard: { backgroundColor: "#ffffff", borderRadius: 12, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: "hidden" },
  cardContent: { flexDirection: "row", padding: 14, alignItems: "flex-start" },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  statusIndicator: { marginRight: 12, marginTop: 2 },
  collectionDetails: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: "700", color: "#0b2a44", marginBottom: 4 },
  customerCode: { fontSize: 13, color: "#6b7c8a", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  cashBadge: { backgroundColor: "#0b8a2f" },
  chequeBadge: { backgroundColor: "#0d3b6c" },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#ffffff" },
  dateContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: "#6b7c8a" },
  cardRight: { alignItems: "flex-end", marginLeft: 12 },
  amount: { fontSize: 18, fontWeight: "700", color: "#0b8a2f", marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  syncedBadge: { backgroundColor: "#e8f5e9" },
  pendingBadge: { backgroundColor: "#fff9e6" },
  statusText: { fontSize: 11, fontWeight: "700" },
  syncedText: { color: "#0b8a2f" },
  pendingText: { color: "#ff9500" },
  cardActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f5f5f5" },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6 },
  actionDivider: { width: 1, backgroundColor: "#f5f5f5" },
  actionButtonText: { fontSize: 14, fontWeight: "600", color: "#0d3b6c" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#0d3b6c", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#6b7c8a", textAlign: "center", marginBottom: 24 },
  addButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#0d3b6c", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, gap: 8 },
  addButtonText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  filterModal: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#eef6ff" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0d3b6c" },
  filterOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  filterOptionActive: { backgroundColor: "#f0f8ff" },
  filterOptionText: { flex: 1, fontSize: 15, color: "#6b7c8a", marginLeft: 12 },
  filterOptionTextActive: { color: "#0d3b6c", fontWeight: "600" },
  filterCount: { fontSize: 13, color: "#9aa4b2" },
  detailModal: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%"  },
  detailScroll: { maxHeight: 500 },
  detailStatusBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 },
  syncedBanner: { backgroundColor: "#0b8a2f" },
  pendingBanner: { backgroundColor: "#ff9500" },
  detailStatusText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  detailContent: { padding: 20 },
  detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  detailLabel: { fontSize: 13, color: "#6b7c8a", marginBottom: 6 },
  detailValue: { fontSize: 16, color: "#0b2a44", fontWeight: "600" },
  amountValue: { fontSize: 22, color: "#0b8a2f", fontWeight: "700" },
  remarksValue: { fontStyle: "italic", fontWeight: "400" },
  fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: "#0d3b6c", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 8 },
});