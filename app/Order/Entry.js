// app/Order/Entry.js
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  SafeAreaView,
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
  const paymentList = ["Cash/Bank", "Credit"];

  const [debtorsData, setDebtorsData] = useState([]);
  const [areaList, setAreaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [usingCache, setUsingCache] = useState(false);

  // Selection states - DEFAULT PAYMENT SET TO "Cash/Bank"
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState("Cash/Bank");

  // Modal states
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Search states
  const [areaSearchQuery, setAreaSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Filtered data
  const [filteredAreas, setFilteredAreas] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  // Handle back press
  const handleBackPress = useCallback(() => {
    router.replace("/(tabs)/Home");
    return true;
  }, [router]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    loadFromDatabase();

    return () => unsubscribe();
  }, []);

  // Handle hardware back button
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  // Filter areas based on search
  useEffect(() => {
    if (areaSearchQuery.trim() === "") {
      setFilteredAreas(areaList);
    } else {
      const filtered = areaList.filter(area =>
        area.toLowerCase().includes(areaSearchQuery.toLowerCase())
      );
      setFilteredAreas(filtered);
    }
  }, [areaSearchQuery, areaList]);

  // Filter customers based on search and selected area
  useEffect(() => {
    let customers = debtorsData;

    // Filter by area if selected
    if (selectedArea) {
      customers = customers.filter(debtor => {
        const debtorArea = debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
        return debtorArea === selectedArea;
      });
    }

    // Filter by search query
    if (customerSearchQuery.trim() !== "") {
      customers = customers.filter(customer =>
        customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.code.toLowerCase().includes(customerSearchQuery.toLowerCase())
      );
    }

    setFilteredCustomers(customers);
  }, [customerSearchQuery, debtorsData, selectedArea]);

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

      // Load areas from database (from API)
      let areasFromDb = await dbService.getAreas();
      console.log(`[Entry] Loaded ${areasFromDb?.length || 0} areas from database`);

      // Fallback: if no areas in database, derive from customer data
      if (!areasFromDb || areasFromDb.length === 0) {
        console.log('[Entry] No areas in database, using customer-derived areas');
        const uniqueAreas = [...new Set(filteredDebtors.map((debtor) => {
          return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
        }))].filter(Boolean).sort();
        areasFromDb = uniqueAreas;
      }

      setAreaList(areasFromDb);
      setFilteredAreas(areasFromDb);
      setFilteredCustomers(filteredDebtors);
      setUsingCache(false);
    } catch (error) {
      console.error('[Entry] Database load error:', error);
      Alert.alert("Error", `Failed to load customer data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setAreaSearchQuery("");
    setCustomerSearchQuery("");
    loadFromDatabase();
  };

  const handleSelectArea = (area) => {
    setSelectedArea(area);
    setSelectedCustomer(null); // Reset customer when area changes
    setShowAreaModal(false);
    setAreaSearchQuery("");
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    setCustomerSearchQuery("");
  };

  const handleProceed = () => {
    /* Area is now optional
    if (!selectedArea) {
      Alert.alert("Validation Error", "Please select an area");
      return;
    }
    */

    if (!selectedCustomer) {
      Alert.alert("Validation Error", "Please select a customer");
      return;
    }

    if (!selectedPayment) {
      Alert.alert("Validation Error", "Please select a payment method");
      return;
    }

    router.push({
      pathname: "/Order/OrderDetails",
      params: {
        area: selectedArea,
        customer: selectedCustomer.name,
        customerCode: selectedCustomer.code,
        payment: selectedPayment,
      },
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={Gradients.background} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary.main} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Order</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color={Colors.primary.main} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {usingCache && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color={Colors.warning.main} />
              <Text style={styles.offlineText}>Using cached data</Text>
            </View>
          )}

          {/* Area Selection */}
          <View style={styles.formSection}>
            <Text style={styles.label}>
              Filter by Area
            </Text>
            <TouchableOpacity
              style={styles.inputBox}
              onPress={() => setShowAreaModal(true)}
            >
              <Ionicons name="location" size={20} color={selectedArea ? Colors.primary.main : Colors.text.tertiary} style={styles.inputIcon} />
              <Text style={[styles.inputText, !selectedArea && styles.placeholderText]}>
                {selectedArea || "Select Area"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Customer Selection */}
          <View style={styles.formSection}>
            <Text style={styles.label}>
              Select Customer <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputBox}
              onPress={() => setShowCustomerModal(true)}
            >
              <Ionicons name="person" size={20} color={selectedCustomer ? Colors.primary.main : Colors.text.tertiary} style={styles.inputIcon} />
              <Text style={[styles.inputText, !selectedCustomer && styles.placeholderText]}>
                {selectedCustomer ? selectedCustomer.name : "Select Customer"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
            {selectedCustomer && (
              <View style={styles.selectedCustomerCard}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.avatarText}>{selectedCustomer.name.charAt(0)}</Text>
                </View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerDetails}>
                    Code: {selectedCustomer.code} • {selectedCustomer.place || selectedCustomer.area}
                  </Text>
                </View>
                {selectedCustomer.remarkcolumntitle ? (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>{selectedCustomer.remarkcolumntitle}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.formSection}>
            <Text style={styles.label}>
              Payment Method <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.paymentContainer}>
              {paymentList.map((payment) => (
                <TouchableOpacity
                  key={payment}
                  style={[
                    styles.paymentButton,
                    selectedPayment === payment && styles.paymentButtonActive,
                  ]}
                  onPress={() => setSelectedPayment(payment)}
                  activeOpacity={0.8}
                >
                  {selectedPayment === payment && (
                    <LinearGradient
                      colors={Gradients.primary}
                      style={styles.activeGradient}
                    />
                  )}
                  <Ionicons
                    name={payment === "Cash/Bank" ? "wallet" : "card"}
                    size={24}
                    color={selectedPayment === payment ? "#ffffff" : Colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.paymentText,
                      selectedPayment === payment && styles.paymentTextActive,
                    ]}
                  >
                    {payment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Proceed Button */}
          <TouchableOpacity
            style={styles.proceedButton}
            onPress={handleProceed}
            activeOpacity={0.8}
          >
            <LinearGradient colors={Gradients.primary} style={styles.proceedGradient}>
              <Text style={styles.proceedText}>Proceed to Products</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* View Orders Button */}
          <TouchableOpacity
            style={[styles.proceedButton, { marginTop: Spacing.md, backgroundColor: '#ffffff', borderWidth: 1, borderColor: Colors.primary.main }]}
            onPress={() => router.push("/Order/PlaceOrder")}
            activeOpacity={0.8}
          >
            <View style={[styles.proceedGradient, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.proceedText, { color: Colors.primary.main }]}>View Placed Orders</Text>
              <Ionicons name="list" size={20} color={Colors.primary.main} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Area Selection Modal */}
        <Modal
          visible={showAreaModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAreaModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Area</Text>
                <TouchableOpacity onPress={() => setShowAreaModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search area..."
                  placeholderTextColor={Colors.text.tertiary}
                  value={areaSearchQuery}
                  onChangeText={setAreaSearchQuery}
                  autoFocus={true}
                />
              </View>

              <FlatList
                data={filteredAreas}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => handleSelectArea(item)}
                  >
                    <View style={styles.listItemIcon}>
                      <Ionicons name="location" size={20} color={Colors.primary.main} />
                    </View>
                    <Text style={styles.listItemText}>{item}</Text>
                    {selectedArea === item && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success.main} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No areas found</Text>
                  </View>
                }
                showsVerticalScrollIndicator={true}
              />
            </View>
          </View>
        </Modal>

        {/* Customer Selection Modal */}
        <Modal
          visible={showCustomerModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCustomerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Customer</Text>
                <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search name or code..."
                  placeholderTextColor={Colors.text.tertiary}
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                  autoFocus={true}
                />
              </View>

              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.customerItem}
                    onPress={() => handleSelectCustomer(item)}
                  >
                    <View style={styles.customerAvatar}>
                      <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{item.name}</Text>
                      <Text style={styles.customerCode}>Code: {item.code}</Text>
                    </View>
                    {selectedCustomer?.code === item.code && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success.main} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No customers found</Text>
                  </View>
                }
                showsVerticalScrollIndicator={true}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

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
    marginTop: 30,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  backButton: { padding: 4 },
  refreshButton: { padding: 4 },
  content: { flex: 1, padding: Spacing.lg },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  offlineText: {
    fontSize: Typography.sizes.sm,
    color: Colors.warning.dark,
    fontWeight: '600',
  },

  formSection: { marginBottom: Spacing.lg },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  required: { color: Colors.error.main },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: Spacing.md,
    height: 52,
    ...Shadows.sm,
  },
  inputIcon: { marginRight: Spacing.sm },
  inputText: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  placeholderText: { color: Colors.text.tertiary },

  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },

  paymentContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  paymentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingVertical: Spacing.md,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
    height: 56,
  },
  paymentButtonActive: { borderColor: 'transparent' },
  activeGradient: { ...StyleSheet.absoluteFillObject },
  paymentText: {
    fontSize: Typography.sizes.base,
    fontWeight: "600",
    color: Colors.text.secondary,
    zIndex: 1,
  },
  paymentTextActive: { color: "#ffffff" },

  proceedButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.xl,
    ...Shadows.colored.primary,
  },
  proceedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 8,

  },
  proceedText: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    height: '80%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    height: 48,
    marginBottom: Spacing.md,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  listItemText: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
  },

  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.primary.main,
  },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  customerCode: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },
  customerDetails: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },

  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.base,
  },

  priceBadge: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  priceBadgeText: {
    color: '#ffffff',
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },
});