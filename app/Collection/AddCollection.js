// app/add-collection.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import dbService from "../../src/services/database";

const API_CUSTOMERS = "https://tasksas.com/api/debtors/get-debtors/";
const API_SAVE_COLLECTION = "https://tasksas.com/api/collections/save/"; // Add your save collection API

export default function AddCollectionScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [isOnline, setIsOnline] = useState(true);

  // Customer selection modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState([]);

  // Form fields
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [chequeNumber, setChequeNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    checkNetworkStatus();
    fetchCustomers();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected);
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      const localCustomers = await loadCustomersFromDB();

      if (localCustomers.length > 0) {
        setCustomers(localCustomers);
        setFilteredCustomers(localCustomers);
        setLoading(false);

        if (isOnline) {
          fetchCustomersFromAPI().catch(err => {
            console.log("Background API fetch failed:", err);
          });
        }
      } else if (isOnline) {
        await fetchCustomersFromAPI();
      } else {
        Alert.alert(
          "No Data Available",
          "No customer data found offline. Please connect to the internet and download data first."
        );
        setLoading(false);
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      Alert.alert("Error", "Failed to load customers. Please try again.");
      setLoading(false);
    }
  };

  const fetchCustomersFromAPI = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        router.replace("/LoginScreen");
        return;
      }

      const response = await fetch(API_CUSTOMERS, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      let customersArray = [];
      if (Array.isArray(data)) {
        customersArray = data;
      } else if (Array.isArray(data.data)) {
        customersArray = data.data;
      } else if (Array.isArray(data.results)) {
        customersArray = data.results;
      }

      const filteredCustomers = customersArray
        .filter((customer) => customer.super_code === "DEBTO")
        .sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });

      setCustomers(filteredCustomers);
      setFilteredCustomers(filteredCustomers);
      console.log(`Loaded ${filteredCustomers.length} customers from API`);
    } catch (error) {
      console.error("API fetch error:", error);
      throw error;
    }
  };

  const loadCustomersFromDB = async () => {
    try {
      console.log('[AddCollection] Initializing database...');
      await dbService.init();

      console.log('[AddCollection] Loading customers from database...');
      const allCustomers = await dbService.getCustomers();

      console.log(`[AddCollection] Found ${allCustomers.length} total customers`);

      if (allCustomers.length === 0) {
        setLoading(false); // Assuming setLoadingCustomers is meant to be setLoading
        Alert.alert(
          "No Customer Data",
          "No customer data available. Please download customer data from Home screen first.",
          [
            { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return [];
      }

      const sortedCustomers = allCustomers.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      console.log(`[AddCollection] ✅ Loaded ${sortedCustomers.length} customers from local database`);
      return sortedCustomers;
    } catch (error) {
      console.error("[AddCollection] Error loading customers from database:", error);
      Alert.alert(
        "Error",
        `Failed to load customers: ${error.message}. Please download data from Home screen.`,
        [
          { text: "Retry", onPress: () => fetchCustomers() },
          { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") }
        ]
      );
      return [];
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer.code);
    setSelectedCustomerName(customer.name);
    setShowCustomerModal(false);
    setSearchQuery("");
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      Alert.alert("Validation Error", "Please select a customer.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount.");
      return;
    }

    if (paymentType === "cheque" && !chequeNumber.trim()) {
      Alert.alert("Validation Error", "Please enter cheque number.");
      return;
    }

    setSaving(true);

    try {
      const collectionData = {
        customer_code: selectedCustomer,
        customer_name: selectedCustomerName,
        amount: parseFloat(amount),
        payment_type: paymentType,
        cheque_number: paymentType === "cheque" ? chequeNumber : null,
        remarks: remarks.trim() || null,
        date: new Date().toISOString(),
      };

      if (isOnline) {
        await saveToAPI(collectionData);
      } else {
        await saveToLocalStorage(collectionData);
        Alert.alert(
          "Saved Offline",
          "Collection saved locally. It will be synced when you're back online.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }

      resetForm();
    } catch (error) {
      console.error("Save error:", error);

      if (isOnline) {
        Alert.alert(
          "Network Error",
          "Failed to save online. Would you like to save offline?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save Offline",
              onPress: async () => {
                try {
                  const collectionData = {
                    customer_code: selectedCustomer,
                    customer_name: selectedCustomerName,
                    amount: parseFloat(amount),
                    payment_type: paymentType,
                    cheque_number: paymentType === "cheque" ? chequeNumber : null,
                    remarks: remarks.trim() || null,
                    date: new Date().toISOString(),
                  };
                  await saveToLocalStorage(collectionData);
                  resetForm();
                  router.back();
                } catch (err) {
                  Alert.alert("Error", "Failed to save collection.");
                }
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to save collection. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveToAPI = async (collectionData) => {
    const token = await AsyncStorage.getItem("authToken");

    // Save to SQLite database (offline-first approach)
    await saveToLocalStorage(collectionData, false); // false = needs to be uploaded

    Alert.alert(
      "Collection Saved!",
      "Your collection has been saved offline. What would you like to do next?",
      [
        {
          text: "Add Another",
          onPress: () => {
            // Stay on page, form is already reset
          }
        },
        {
          text: "Done",
          onPress: () => router.push("/Collection/Collection")
        },
        // {
        //   text: "Upload Now",
        //   onPress: () => router.push("/Collection/Upload")
        // }
      ]
    );
  };

  const saveToLocalStorage = async (collectionData, isSynced = false) => {
    try {
      // Save to SQLite database
      await dbService.init();
      const localId = await dbService.saveOfflineCollection({
        ...collectionData,
        synced: isSynced ? 1 : 0
      });

      console.log("Collection saved to database:", localId);
    } catch (error) {
      console.error("Error saving to database:", error);
      throw error;
    }
  };

  const resetForm = () => {
    setSelectedCustomer("");
    setSelectedCustomerName("");
    setAmount("");
    setPaymentType("cash");
    setChequeNumber("");
    setRemarks("");
  };

  const handleClose = () => {
    if (amount || remarks || selectedCustomer) {
      Alert.alert(
        "Discard Changes",
        "You have unsaved changes. Are you sure you want to close?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d3b6c" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInUp} style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0d3b6c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Collection</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
            <Text style={styles.statusText}>{isOnline ? "Online" : "Offline"}</Text>
          </View>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!isOnline && (
            <Animated.View entering={FadeInUp.delay(50)} style={styles.offlineWarning}>
              <Ionicons name="cloud-offline-outline" size={20} color="#ff9500" />
              <Text style={styles.offlineWarningText}>
                You're offline. Collections will be saved locally and synced later.
              </Text>
            </Animated.View>
          )}

          {customers.length === 0 && (
            <Animated.View entering={FadeInUp.delay(50)} style={styles.noDataWarning}>
              <Ionicons name="alert-circle-outline" size={20} color="#ff3b30" />
              <Text style={styles.noDataWarningText}>
                No customer data available. Please download customer data first.
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(100)} style={styles.formSection}>
            <Text style={styles.label}>
              Select Customer <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.customerSelector}
              onPress={() => customers.length > 0 && setShowCustomerModal(true)}
              disabled={customers.length === 0}
            >
              <Ionicons name="person-outline" size={20} color="#6b7c8a" style={styles.inputIcon} />
              <Text style={[styles.customerSelectorText, !selectedCustomerName && styles.placeholderText]}>
                {selectedCustomerName || "-- Select Customer --"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7c8a" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200)} style={styles.formSection}>
            <Text style={styles.label}>
              Amount <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="cash-outline" size={20} color="#6b7c8a" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                placeholderTextColor="#9aa4b2"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300)} style={styles.formSection}>
            <Text style={styles.label}>
              Payment Type <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.paymentTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.paymentTypeButton,
                  paymentType === "cash" && styles.paymentTypeButtonActive,
                ]}
                onPress={() => {
                  setPaymentType("cash");
                  setChequeNumber("");
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="wallet-outline"
                  size={24}
                  color={paymentType === "cash" ? "#ffffff" : "#6b7c8a"}
                />
                <Text
                  style={[
                    styles.paymentTypeText,
                    paymentType === "cash" && styles.paymentTypeTextActive,
                  ]}
                >
                  Cash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentTypeButton,
                  paymentType === "cheque" && styles.paymentTypeButtonActive,
                ]}
                onPress={() => setPaymentType("cheque")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="card-outline"
                  size={24}
                  color={paymentType === "cheque" ? "#ffffff" : "#6b7c8a"}
                />
                <Text
                  style={[
                    styles.paymentTypeText,
                    paymentType === "cheque" && styles.paymentTypeTextActive,
                  ]}
                >
                  Cheque
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {paymentType === "cheque" && (
            <Animated.View entering={FadeInUp.delay(400)} style={styles.formSection}>
              <Text style={styles.label}>
                Cheque Number <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="document-text-outline" size={20} color="#6b7c8a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter cheque number"
                  placeholderTextColor="#9aa4b2"
                  value={chequeNumber}
                  onChangeText={setChequeNumber}
                />
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(500)} style={styles.formSection}>
            <Text style={styles.label}>Remarks (Optional)</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="Add any notes or remarks..."
                placeholderTextColor="#9aa4b2"
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving || customers.length === 0}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>
                    {isOnline ? "Save Collection" : "Save Offline"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={handleClose}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={20} color="#ff3b30" />
              <Text style={[styles.buttonText, { color: "#ff3b30" }]}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

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
                  <Ionicons name="close" size={24} color="#0d3b6c" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#6b7c8a" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search customer..."
                  placeholderTextColor="#9aa4b2"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={20} color="#6b7c8a" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.customerItem}
                    onPress={() => handleSelectCustomer(item)}
                  >
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{item.name}</Text>
                      <Text style={styles.customerCode}>Code: {item.code}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6b7c8a" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="#9aa4b2" />
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
    fontSize: 20,
    fontWeight: "700",
    color: "#0d3b6c",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7c8a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9e6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ffd966",
  },
  offlineWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#b8860b",
    fontWeight: "500",
  },
  noDataWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffebee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  noDataWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#c62828",
    fontWeight: "500",
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0d3b6c",
    marginBottom: 8,
  },
  required: {
    color: "#ff3b30",
  },
  customerSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef6ff",
    paddingHorizontal: 12,
    height: 50,
  },
  customerSelectorText: {
    flex: 1,
    fontSize: 15,
    color: "#0b2a44",
  },
  placeholderText: {
    color: "#9aa4b2",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef6ff",
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#0b2a44",
  },
  paymentTypeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  paymentTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef6ff",
    paddingVertical: 16,
    gap: 8,
  },
  paymentTypeButtonActive: {
    backgroundColor: "#0d3b6c",
    borderColor: "#0d3b6c",
  },
  paymentTypeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7c8a",
  },
  paymentTypeTextActive: {
    color: "#ffffff",
  },
  textAreaContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef6ff",
    padding: 12,
    minHeight: 100,
  },
  textArea: {
    fontSize: 15,
    color: "#0b2a44",
    minHeight: 80,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  saveButton: {
    backgroundColor: "#0b8a2f",
  },
  closeButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ff3b30",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eef6ff",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0d3b6c",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginVertical: 12,
    height: 45,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0b2a44",
  },
  customerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0b2a44",
    marginBottom: 4,
  },
  customerCode: {
    fontSize: 13,
    color: "#6b7c8a",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#9aa4b2",
    marginTop: 12,
  },
});