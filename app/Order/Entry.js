// app/Order/Entry.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import dbService from "../../src/services/database";

export default function EntryScreen() {
  const typeList = ["Order", "Sales", "Return"];
  const paymentList = ["Cash", "UPI / Bank"];

  const [debtorsData, setDebtorsData] = useState([]);
  const [areaList, setAreaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [usingCache, setUsingCache] = useState(false);

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    // Monitor network status
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
        router.replace("/login");
        return;
      }

      setAuthToken(token);

      // Initialize database
      await dbService.init();

      // Load from database
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

      console.log('[Entry] Initializing database...');
      await dbService.init();

      console.log('[Entry] Loading customers from database...');
      const allCustomers = await dbService.getCustomers();

      console.log(`[Entry] Found ${allCustomers.length} total customers`);

      // Filter DEBTO customers
      const filteredDebtors = allCustomers.filter((debtor) => debtor.super_code === "DEBTO");

      console.log(`[Entry] Found ${filteredDebtors.length} DEBTO customers`);

      if (filteredDebtors.length === 0) {
        setLoading(false);
        Alert.alert(
          "No Customer Data",
          "No customer data found in local database. Please go to Home screen and click 'Download Data' button to download customer data for offline use.",
          [
            { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
            { text: "Close", style: "cancel", onPress: () => router.back() }
          ]
        );
        return;
      }

      setDebtorsData(filteredDebtors);

      // Extract unique areas
      const uniqueAreas = [...new Set(filteredDebtors.map((debtor) => {
        return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
      }))].filter(Boolean).sort();

      setAreaList(uniqueAreas);
      setUsingCache(false);

      console.log(`[Entry] ✅ Successfully loaded ${filteredDebtors.length} customers with ${uniqueAreas.length} unique areas`);
    } catch (error) {
      console.error('[Entry] Database load error:', error);
      setLoading(false);
      Alert.alert(
        "Error",
        `Failed to load customer data: ${error.message}. Please try again or download data from Home screen.`,
        [
          { text: "Retry", onPress: () => loadFromDatabase() },
          { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const loadFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const cachedTimestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        setDebtorsData(parsedData);

        // Extract areas
        const uniqueAreas = [...new Set(parsedData.map((debtor) => {
          return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
        }))].filter(Boolean).sort();
        setAreaList(uniqueAreas);

        setUsingCache(true);

        // Check if cache is old
        if (cachedTimestamp) {
          const timestamp = parseInt(cachedTimestamp);
          const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

          if (isExpired) {
            Alert.alert(
              "Offline Mode",
              "You're viewing cached data (may be outdated). Connect to internet for latest updates.",
              [{ text: "OK" }]
            );
          }
        }
      } else {
        Alert.alert(
          "No Cached Data",
          "No offline data available. Please connect to internet.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Cache load error:", error);
      Alert.alert("Error", "Failed to load offline data");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtors = async (token) => {
    try {
      setLoading(true);

      const response = await fetch("https://tasksas.com/api/debtors/get-debtors/", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        Alert.alert("Session Expired", "Please login again.");
        await AsyncStorage.clear();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      let data = result;
      if (result.data) {
        data = result.data;
      } else if (result.debtors) {
        data = result.debtors;
      }

      if (!Array.isArray(data)) {
        Alert.alert("Error", "Invalid data format received from API");
        setLoading(false);
        return;
      }

      const filteredDebtors = data.filter((debtor) => debtor.super_code === "DEBTO");

      if (filteredDebtors.length === 0) {
        Alert.alert("No Data", "No debtors found with DEBTO super code");
      }

      setDebtorsData(filteredDebtors);

      // Cache the data
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filteredDebtors));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      setUsingCache(false);

      const uniqueAreas = [...new Set(filteredDebtors.map((debtor) => {
        return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
      }))].filter(Boolean).sort();

      setAreaList(uniqueAreas);

    } catch (error) {
      console.error("Fetch error:", error);

      // Try to load from cache on error
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        Alert.alert(
          "Connection Error",
          "Failed to fetch latest data. Using cached data instead.",
          [{ text: "OK" }]
        );
        await loadFromCache();
      } else {
        Alert.alert("Error", "Failed to fetch debtors data: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getAllCustomers = useCallback(() => {
    if (!selectedArea) {
      // Return all customers if no area is selected
      return debtorsData.map((debtor) => ({
        code: debtor.code,
        name: debtor.name,
        place: debtor.place,
        area: debtor.area,
        phone: debtor.phone,
        balance: debtor.balance,
      }));
    }

    // Filter by selected area
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
    if (!selectedPayment) return Alert.alert("Missing", "Please select Payment Type");

    console.log("Navigation params:", {
      area: selectedArea || "N/A",
      customer: selectedCustomer.name,
      customerCode: selectedCustomer.code,
      customerPhone: selectedCustomer.phone || "",
      customerBalance: selectedCustomer.balance || 0,
      type: selectedType,
      payment: selectedPayment,
    });

    router.push({
      pathname: "/Order/OrderDetails",
      params: {
        area: selectedArea || "N/A",
        customer: selectedCustomer.name,
        customerCode: selectedCustomer.code,
        customerPhone: selectedCustomer.phone || "",
        customerBalance: selectedCustomer.balance || 0,
        type: selectedType,
        payment: selectedPayment,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleRefresh = async () => {
    if (!isOnline) {
      Alert.alert("Offline", "Cannot refresh while offline");
      return;
    }

    if (authToken) {
      await fetchDebtors(authToken);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1a237e" }}>
        <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
        <LinearGradient colors={["#1a237e", "#0d47a1"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", marginTop: 10, fontSize: 16 }}>Loading debtors...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a237e" }}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      <LinearGradient colors={["#1a237e", "#0d47a1"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* Header with Back Button */}
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.header}>New Order Entry</Text>
              {usingCache && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={12} color="#FFB74D" />
                  <Text style={styles.offlineText}>Offline Mode</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.backButton}
              activeOpacity={0.7}
              disabled={!isOnline}
            >
              <Ionicons
                name="refresh"
                size={24}
                color={isOnline ? "#fff" : "#999"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Connection Status */}
            {!isOnline && (
              <View style={styles.offlineAlert}>
                <Ionicons name="wifi-off" size={18} color="#FF9800" />
                <Text style={styles.offlineAlertText}>
                  No internet connection. Using cached data.
                </Text>
              </View>
            )}

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#64B5F6" />
              <Text style={styles.infoText}>
                Select area to filter customers, or browse all customers
              </Text>
            </View>

            <SearchableDropdown
              label="Select Area (Optional)"
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
            />

            <SearchableDropdown
              label="Customer Name *"
              placeholder="Select Customer"
              data={getAllCustomers()}
              selectedValue={selectedCustomer?.name}
              onSelect={(customer) => {
                setSelectedCustomer(customer);
                setOpenDropdown(null);
              }}
              open={openDropdown === "customer"}
              setOpen={() => setOpenDropdown(openDropdown === "customer" ? null : "customer")}
              isCustomerDropdown={true}
              showAreaFilter={!!selectedArea}
            />

            <Dropdown
              label="Select Payment Type *"
              placeholder="Choose Payment Method"
              data={paymentList}
              selectedValue={selectedPayment}
              onSelect={(val) => {
                setSelectedPayment(val);
                setOpenDropdown(null);
              }}
              open={openDropdown === "payment"}
              setOpen={() => setOpenDropdown(openDropdown === "payment" ? null : "payment")}
            />

            {/* Selected Info Display */}
            {selectedCustomer && (
              <View style={styles.selectedInfoCard}>
                <Text style={styles.selectedInfoTitle}>Selected Customer</Text>
                <View style={styles.selectedInfoRow}>
                  <Ionicons name="person" size={16} color="#64B5F6" />
                  <Text style={styles.selectedInfoText}>{selectedCustomer.name}</Text>
                </View>
                {selectedCustomer.phone && (
                  <View style={styles.selectedInfoRow}>
                    <Ionicons name="call" size={16} color="#64B5F6" />
                    <Text style={styles.selectedInfoText}>{selectedCustomer.phone}</Text>
                  </View>
                )}
                {selectedCustomer.area && (
                  <View style={styles.selectedInfoRow}>
                    <Ionicons name="location" size={16} color="#64B5F6" />
                    <Text style={styles.selectedInfoText}>{selectedCustomer.area}</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.proceedButton}
              onPress={validateAndProceed}
              activeOpacity={0.8}
            >
              <Text style={styles.proceedText}>Proceed to Order</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const SearchableDropdown = ({
  label,
  placeholder,
  data,
  selectedValue,
  onSelect,
  open,
  setOpen,
  disabled,
  isCustomerDropdown = false,
  onClear,
  showAreaFilter
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState(data);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFilteredData(data);
      setSearchQuery("");
      Animated.spring(animatedHeight, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }).start(() => {
        setTimeout(() => {
          if (searchInputRef.current && Platform.OS === "ios") {
            searchInputRef.current.focus();
          }
        }, 100);
      });
    } else {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setSearchQuery("");
        setFilteredData(data);
      });
    }
  }, [open, data]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredData(data);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = data.filter((item) => {
      if (isCustomerDropdown) {
        return (
          item.name?.toLowerCase().includes(query) ||
          item.phone?.toLowerCase().includes(query) ||
          item.code?.toLowerCase().includes(query) ||
          item.area?.toLowerCase().includes(query)
        );
      }
      return item.toLowerCase().includes(query);
    });
    setFilteredData(filtered);
  }, [searchQuery, data, isCustomerDropdown]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 320],
  });

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        disabled={disabled}
        onPress={setOpen}
        style={[styles.dropdownBox, disabled && styles.disabledBox]}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Text
            style={[
              styles.dropdownBoxText,
              { color: selectedValue ? "#fff" : "#B0BEC5" }
            ]}
            numberOfLines={1}
          >
            {selectedValue || placeholder}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {selectedValue && onClear && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{ marginRight: 10, padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={20}
            color="#fff"
          />
        </View>
      </TouchableOpacity>

      {open && (
        <Animated.View style={[styles.dropdownList, { maxHeight }]}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#1976D2" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={`Search ${isCustomerDropdown ? 'by name, phone, or area' : 'area'}...`}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {showAreaFilter && (
            <View style={styles.filterBadge}>
              <Ionicons name="filter" size={14} color="#1976D2" />
              <Text style={styles.filterText}>Filtered by area</Text>
            </View>
          )}

          <ScrollView
            style={styles.dropdownScrollView}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {filteredData.length === 0 ? (
              <View style={styles.noResultContainer}>
                <Ionicons name="search-outline" size={40} color="#ccc" />
                <Text style={styles.noResultText}>No results found</Text>
              </View>
            ) : (
              filteredData.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.dropdownItem}
                  onPress={() => onSelect(isCustomerDropdown ? item : item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownItemContent}>
                    {isCustomerDropdown && (
                      <View style={styles.customerAvatar}>
                        <Text style={styles.avatarText}>
                          {item.name?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownText} numberOfLines={1}>
                        {isCustomerDropdown ? item.name : item}
                      </Text>
                      {isCustomerDropdown && (
                        <View style={styles.customerDetails}>
                          {item.phone && (
                            <Text style={styles.dropdownSubText} numberOfLines={1}>
                              📞 {item.phone}
                            </Text>
                          )}
                          {item.area && (
                            <Text style={styles.dropdownSubText} numberOfLines={1}>
                              📍 {item.area}
                            </Text>
                          )}
                          {item.code && (
                            <Text style={styles.dropdownSubText} numberOfLines={1}>
                              🔖 {item.code}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

const Dropdown = ({
  label,
  placeholder,
  data,
  selectedValue,
  onSelect,
  open,
  setOpen,
  disabled
}) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: open ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [open]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.min(220, data.length * 55)],
  });

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        disabled={disabled}
        onPress={setOpen}
        style={[styles.dropdownBox, disabled && styles.disabledBox]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dropdownBoxText,
            { color: selectedValue ? "#fff" : "#B0BEC5" }
          ]}
          numberOfLines={1}
        >
          {selectedValue || placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>

      {open && (
        <Animated.View style={[styles.dropdownList, { maxHeight }]}>
          <ScrollView
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {data.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.dropdownItem}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemContent}>
                  <Text style={styles.dropdownText}>{item}</Text>
                  {selectedValue === item && (
                    <Ionicons name="checkmark-circle" size={20} color="#1976D2" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "rgba(255, 183, 77, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 11,
    color: "#FFB74D",
    marginLeft: 4,
    fontWeight: "600",
  },
  offlineAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#FF9800",
  },
  offlineAlertText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: "#FFE0B2",
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(100, 181, 246, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#64B5F6",
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: "#E3F2FD",
    lineHeight: 18,
  },
  dropdownContainer: {
    marginBottom: 20,
    zIndex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E3F2FD",
    marginBottom: 8,
  },
  dropdownBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 54,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  disabledBox: {
    opacity: 0.5,
  },
  dropdownBoxText: {
    fontSize: 15,
    fontWeight: "500",
  },
  dropdownList: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginTop: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownScrollView: {
    maxHeight: 260,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#000",
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    paddingHorizontal: 0,
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  filterText: {
    fontSize: 12,
    color: "#1976D2",
    marginLeft: 6,
    fontWeight: "600",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1976D2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  dropdownText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "600",
  },
  customerDetails: {
    marginTop: 4,
  },
  dropdownSubText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  noResultContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noResultText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 10,
  },
  selectedInfoCard: {
    backgroundColor: "rgba(100, 181, 246, 0.2)",
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(100, 181, 246, 0.3)",
  },
  selectedInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E3F2FD",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  selectedInfoText: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
  },
  proceedButton: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 54,
    ...Platform.select({
      ios: {
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  proceedText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
});