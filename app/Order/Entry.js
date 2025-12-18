// app/Order/Entry.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import dbService from "../../src/services/database";

export default function EntryScreen() {
  const router = useRouter();
  const paymentList = ["Cash", "UPI / Bank"];

  const [debtorsData, setDebtorsData] = useState([]);
  const [areaList, setAreaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [usingCache, setUsingCache] = useState(false);

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState("Cash");
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    initializeScreen();

    return () => unsubscribe();
  }, []);

  const initializeScreen = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        router.replace("/LoginScreen");
        return;
      }

      setAuthToken(token);
      await dbService.init();
      await loadFromDatabase();
    } catch (error) {
      console.error("Initialize error:", error);
      Alert.alert("Error", "Failed to initialize. Please try again.");
      setLoading(false);
    }
  };

  const loadFromDatabase = async () => {
    try {
      setLoading(true);
      await dbService.init();
      const allCustomers = await dbService.getCustomers();
      const filteredDebtors = allCustomers.filter((debtor) => debtor.super_code === "DEBTO");

      if (filteredDebtors.length === 0) {
        setLoading(false);
        Alert.alert(
          "No Customer Data",
          "No customer data found in local database. Please go to Home screen and click 'Download Data' button.",
          [
            { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
            { text: "Close", style: "cancel", onPress: () => router.back() }
          ]
        );
        return;
      }

      setDebtorsData(filteredDebtors);

      const uniqueAreas = [...new Set(filteredDebtors.map((debtor) => {
        return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
      }))].filter(Boolean).sort();

      setAreaList(uniqueAreas);
      setUsingCache(false);
    } catch (error) {
      console.error('[Entry] Database load error:', error);
      Alert.alert("Error", `Failed to load customer data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!isOnline) {
      Alert.alert("Offline", "Cannot refresh while offline");
      return;
    }
    await loadFromDatabase();
  };

  // Memoized customer list - improves performance
  const allCustomers = useMemo(() => {
    if (!selectedArea) {
      return debtorsData.map((debtor) => ({
        code: debtor.code,
        name: debtor.name,
        place: debtor.place,
        area: debtor.area,
        phone: debtor.phone,
        balance: debtor.balance,
      }));
    }

    const customers = debtorsData.filter((debtor) => {
      const debtorArea = debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
      return debtorArea === selectedArea;
    });

    return customers.map((debtor) => ({
      code: debtor.code,
      name: debtor.name,
      place: debtor.place,
      area: debtor.area,
      phone: debtor.phone,
      balance: debtor.balance,
    }));
  }, [selectedArea, debtorsData]);

  const validateAndProceed = () => {
    if (!selectedCustomer) return Alert.alert("Missing", "Please select Customer");

    router.push({
      pathname: "/Order/OrderDetails",
      params: {
        area: selectedCustomer.area || selectedCustomer.place || "N/A",
        customer: selectedCustomer.name,
        customerCode: selectedCustomer.code,
        customerPhone: selectedCustomer.phone || "",
        customerBalance: selectedCustomer.balance || 0,
        payment: selectedPayment,
      },
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={Gradients.background} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
        <Text style={styles.loadingText}>Loading customers...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Order</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color={Colors.primary.main} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {usingCache && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color={Colors.warning.main} />
              <Text style={styles.offlineText}>Offline Mode - Using cached data</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.infoGradient}
            >
              <View style={styles.infoIcon}>
                <Ionicons name="cart" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Start New Order</Text>
                <Text style={styles.infoSubtitle}>Select customer details to proceed</Text>
              </View>
            </LinearGradient>
          </View>

          <SearchableDropdown
            label="Filter by Area (Optional)"
            placeholder="All Areas"
            data={areaList}
            selectedValue={selectedArea}
            onSelect={(val) => {
              setSelectedArea(val);
              setSelectedCustomer(null);
              setOpenDropdown(null);
            }}
            onClear={() => {
              setSelectedArea(null);
              setSelectedCustomer(null);
            }}
            open={openDropdown === "area"}
            setOpen={() => setOpenDropdown(openDropdown === "area" ? null : "area")}
            icon="map"
            zIndex={1000}
          />

          <SearchableDropdown
            label="Select Customer *"
            placeholder="Search Name or Code..."
            data={allCustomers}
            selectedValue={selectedCustomer?.name}
            onSelect={(customer) => {
              setSelectedCustomer(customer);
              setOpenDropdown(null);
            }}
            open={openDropdown === "customer"}
            setOpen={() => setOpenDropdown(openDropdown === "customer" ? null : "customer")}
            isCustomerDropdown={true}
            showAreaFilter={!!selectedArea}
            icon="person"
            zIndex={900}
          />

          {/* Selected Customer Info */}
          {selectedCustomer && (
            <Animated.View style={styles.selectedCustomerCard}>
              <View style={styles.customerHeader}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.avatarText}>{selectedCustomer.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardCustomerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.cardCustomerCode}>{selectedCustomer.code}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.customerDetails}>
                {selectedCustomer.phone && (
                  <View style={styles.detailItem}>
                    <Ionicons name="call-outline" size={16} color={Colors.text.tertiary} />
                    <Text style={styles.detailText}>{selectedCustomer.phone}</Text>
                  </View>
                )}
                {(selectedCustomer.area || selectedCustomer.place) && (
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color={Colors.text.tertiary} />
                    <Text style={styles.detailText}>{selectedCustomer.area || selectedCustomer.place}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          <Dropdown
            label="Payment Method"
            placeholder="Select Payment"
            data={paymentList}
            selectedValue={selectedPayment}
            onSelect={(val) => {
              setSelectedPayment(val);
              setOpenDropdown(null);
            }}
            open={openDropdown === "payment"}
            setOpen={() => setOpenDropdown(openDropdown === "payment" ? null : "payment")}
            icon="card"
            zIndex={700}
          />

          <TouchableOpacity
            style={[styles.proceedButton, !selectedCustomer && styles.disabledButton]}
            onPress={validateAndProceed}
            activeOpacity={0.8}
            disabled={!selectedCustomer}
          >
            <LinearGradient
              colors={selectedCustomer ? Gradients.primary : [Colors.neutral[400], Colors.neutral[400]]}
              style={styles.proceedGradient}
            >
              <Text style={styles.proceedText}>Proceed to Products</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Optimized SearchableDropdown with FlatList for better performance - memoized
const SearchableDropdown = React.memo(({ label, placeholder, data, selectedValue, onSelect, open, setOpen, disabled, isCustomerDropdown, onClear, showAreaFilter, icon, zIndex }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState(data);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setFilteredData(data);
      setSearchQuery("");
      Animated.spring(animatedHeight, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 40
      }).start();
    } else {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start();
    }
  }, [open, data]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = data.filter(item => {
      if (isCustomerDropdown) {
        return (
          item.name?.toLowerCase().includes(query) ||
          item.code?.toLowerCase().includes(query) ||
          item.area?.toLowerCase().includes(query) ||
          item.place?.toLowerCase().includes(query)
        );
      }
      return item.toLowerCase().includes(query);
    });
    setFilteredData(filtered);
  }, [searchQuery, data, isCustomerDropdown]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 350]
  });

  const renderItem = useCallback(({ item }) => {
    if (isCustomerDropdown) {
      return (
        <TouchableOpacity
          style={styles.dropdownItem}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {item.code} {item.area ? `• ${item.area}` : item.place ? `• ${item.place}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => onSelect(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemTitle} numberOfLines={1}>{item}</Text>
      </TouchableOpacity>
    );
  }, [isCustomerDropdown, onSelect]);

  const keyExtractor = useCallback((item, index) => {
    if (isCustomerDropdown) {
      return item.code || index.toString();
    }
    return index.toString();
  }, [isCustomerDropdown]);

  return (
    <View style={[styles.dropdownContainer, { zIndex }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputBox}
        onPress={setOpen}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={20} color={selectedValue ? Colors.primary.main : Colors.text.tertiary} style={styles.inputIcon} />
        <Text style={[styles.inputText, !selectedValue && { color: Colors.text.tertiary }]}>
          {selectedValue || placeholder}
        </Text>
        {selectedValue && onClear ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onClear(); }}>
            <Ionicons name="close-circle" size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} />
        )}
      </TouchableOpacity>

      {open && (
        <Animated.View style={[styles.dropdownList, { maxHeight, opacity: animatedHeight }]}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Colors.text.tertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={Colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
          {filteredData.length === 0 ? (
            <Text style={styles.noResults}>No results found</Text>
          ) : (
            <FlatList
              data={filteredData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              style={styles.dropdownScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
});

const Dropdown = React.memo(({ label, placeholder, data, selectedValue, onSelect, open, setOpen, icon, zIndex }) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: open ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  }, [open]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200]
  });

  return (
    <View style={[styles.dropdownContainer, { zIndex }]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputBox}
        onPress={setOpen}
        activeOpacity={0.7}
      >
        {icon && <Ionicons name={icon} size={20} color={selectedValue ? Colors.primary.main : Colors.text.tertiary} style={styles.inputIcon} />}
        <Text style={[styles.inputText, !selectedValue && { color: Colors.text.tertiary }]}>
          {selectedValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} />
      </TouchableOpacity>

      {open && (
        <Animated.View style={[styles.dropdownList, { maxHeight, opacity: animatedHeight }]}>
          <ScrollView nestedScrollEnabled style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
            {data.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.dropdownItem}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.itemTitle, selectedValue === item && { color: Colors.primary.main, fontWeight: '600' }]}>{item}</Text>
                {selectedValue === item && <Ionicons name="checkmark" size={18} color={Colors.primary.main} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.xs, paddingBottom: Spacing.md },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: Colors.text.secondary },
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
  refreshButton: { padding: 4 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  offlineText: { color: Colors.warning.main, fontSize: Typography.sizes.sm, fontWeight: '600' },

  infoCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  infoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  infoTitle: { color: '#FFF', fontSize: Typography.sizes.lg, fontWeight: '700' },
  infoSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.sizes.sm },

  dropdownContainer: { marginBottom: Spacing.lg, position: 'relative' },
  label: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.text.primary, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    ...Shadows.sm,
  },
  inputIcon: { marginRight: Spacing.sm },
  inputText: { flex: 1, fontSize: Typography.sizes.base, color: Colors.text.primary },

  dropdownList: {
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.md,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.neutral[50],
  },
  searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.text.primary, height: 40 },
  dropdownScroll: { maxHeight: 300 },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    minHeight: 60,
  },
  itemTitle: {
    fontSize: Typography.sizes.md,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  noResults: { padding: Spacing.md, color: Colors.text.tertiary, textAlign: 'center' },

  selectedCustomerCard: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary[100],
    ...Shadows.sm,
  },
  customerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: { fontSize: Typography.sizes.lg, fontWeight: '700', color: Colors.primary.main },
  cardCustomerName: { fontSize: Typography.sizes.base, fontWeight: '700', color: Colors.text.primary },
  cardCustomerCode: { fontSize: Typography.sizes.sm, color: Colors.text.secondary },
  divider: { height: 1, backgroundColor: Colors.border.light, marginBottom: Spacing.md },
  customerDetails: { gap: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: Typography.sizes.sm, color: Colors.text.secondary },



  proceedButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginTop: Spacing.md,
    ...Shadows.colored.primary,
  },
  proceedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  proceedText: { color: '#FFF', fontSize: Typography.sizes.base, fontWeight: '700' },
  disabledButton: { opacity: 0.6, ...Shadows.none },
});