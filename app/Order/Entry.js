// app/Order/Entry.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function EntryScreen() {
  const typeList = ["Order", "Sales", "Return"];
  const paymentList = ["Cash", "UPI / Bank"];

  const [debtorsData, setDebtorsData] = useState([]);
  const [areaList, setAreaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    initializeScreen();
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
      await fetchDebtors(token);
    } catch (error) {
      console.error("Initialize error:", error);
      Alert.alert("Error", "Failed to initialize screen");
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

      const uniqueAreas = [...new Set(filteredDebtors.map((debtor) => {
        return debtor.area && debtor.area.trim() !== "" ? debtor.area : debtor.place;
      }))].filter(Boolean).sort();

      setAreaList(uniqueAreas);

    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Error", "Failed to fetch debtors data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCustomersByArea = useCallback(() => {
    if (!selectedArea) return [];

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
    if (!selectedArea) return Alert.alert("Missing", "Please select Area");
    if (!selectedCustomer) return Alert.alert("Missing", "Please select Customer");
    if (!selectedType) return Alert.alert("Missing", "Please select Type");
    if (!selectedPayment) return Alert.alert("Missing", "Please select Payment Type");

    // Log to verify data before navigation
    console.log("Navigation params:", {
      area: selectedArea,
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
        area: selectedArea,
        customer: selectedCustomer.name, // Changed from customerName to customer
        customerCode: selectedCustomer.code,
        customerPhone: selectedCustomer.phone || "",
        customerBalance: selectedCustomer.balance || 0,
        type: selectedType,
        payment: selectedPayment,
      },
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={["#2b4b69ff", "#0d1e3dff"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", marginTop: 10, fontSize: 16 }}>Loading debtors...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#2b4b69ff", "#0d1e3dff"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>Entry</Text>

          <SearchableDropdown
            label="Select Area"
            placeholder="Select Area"
            data={areaList}
            selectedValue={selectedArea}
            onSelect={(val) => {
              setSelectedArea(val);
              setSelectedCustomer(null);
              setOpenDropdown(null);
            }}
            open={openDropdown === "area"}
            setOpen={() => setOpenDropdown(openDropdown === "area" ? null : "area")}
          />

          <SearchableDropdown
            label="Customer Name"
            placeholder="Select Customer"
            data={getCustomersByArea()}
            disabled={!selectedArea}
            selectedValue={selectedCustomer?.name}
            onSelect={(customer) => {
              setSelectedCustomer(customer);
              setOpenDropdown(null);
            }}
            open={openDropdown === "customer"}
            setOpen={() => setOpenDropdown(openDropdown === "customer" ? null : "customer")}
            isCustomerDropdown={true}
          />

          <Dropdown
            label="Select Type"
            placeholder="Select Type"
            data={typeList}
            selectedValue={selectedType}
            onSelect={(val) => {
              setSelectedType(val);
              setOpenDropdown(null);
            }}
            open={openDropdown === "type"}
            setOpen={() => setOpenDropdown(openDropdown === "type" ? null : "type")}
          />

          <Dropdown
            label="Select Payment Type"
            placeholder="Select Payment Type"
            data={paymentList}
            selectedValue={selectedPayment}
            onSelect={(val) => {
              setSelectedPayment(val);
              setOpenDropdown(null);
            }}
            open={openDropdown === "payment"}
            setOpen={() => setOpenDropdown(openDropdown === "payment" ? null : "payment")}
          />

          <TouchableOpacity style={styles.proceedButton} onPress={validateAndProceed}>
            <Text style={styles.proceedText}>Proceed</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
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
  isCustomerDropdown = false 
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState(data);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setFilteredData(data);
      setSearchQuery("");
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        setTimeout(() => {
          if (searchInputRef.current) {
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
          item.code?.toLowerCase().includes(query)
        );
      }
      return item.toLowerCase().includes(query);
    });
    setFilteredData(filtered);
  }, [searchQuery, data, isCustomerDropdown]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity 
        disabled={disabled} 
        onPress={setOpen} 
        style={[styles.dropdownBox, disabled && { opacity: 0.5 }]}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.dropdownBoxText,
            { color: selectedValue ? "#fff" : "#E0E0E0" }
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
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={`Search ${isCustomerDropdown ? 'customer' : 'area'}...`}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            style={styles.dropdownScrollView}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {filteredData.length === 0 ? (
              <View style={styles.dropdownItem}>
                <Text style={styles.noResultText}>No results found</Text>
              </View>
            ) : (
              filteredData.map((item, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={styles.dropdownItem} 
                  onPress={() => onSelect(isCustomerDropdown ? item : item)}
                  activeOpacity={0.6}
                >
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
                      {item.code && (
                        <Text style={styles.dropdownSubText} numberOfLines={1}>
                          Code: {item.code}
                        </Text>
                      )}
                    </View>
                  )}
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
    Animated.timing(animatedHeight, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [open]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.min(200, data.length * 50)],
  });

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity 
        disabled={disabled} 
        onPress={setOpen} 
        style={[styles.dropdownBox, disabled && { opacity: 0.5 }]}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.dropdownBoxText,
            { color: selectedValue ? "#fff" : "#E0E0E0" }
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
                activeOpacity={0.6}
              >
                <Text style={styles.dropdownText}>{item}</Text>
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
    padding: 18,
  },
  header: { 
    fontSize: 28, 
    fontWeight: "700", 
    color: "#fff", 
    textAlign: "center", 
    marginBottom: 24,
    marginTop: Platform.OS === "ios" ? 10 : 0,
  },
  dropdownContainer: {
    marginBottom: 20,
    zIndex: 1,
  },
  label: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#fff", 
    marginBottom: 8,
  },
  dropdownBox: { 
    backgroundColor: "rgba(255,255,255,0.12)", 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.2)", 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dropdownBoxText: {
    flex: 1,
    fontSize: 15,
    marginRight: 10,
  },
  dropdownList: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    marginTop: 8, 
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  dropdownScrollView: {
    maxHeight: 240,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f8f8f8",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#000",
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  dropdownItem: { 
    padding: 14,
    borderBottomWidth: 1, 
    borderBottomColor: "#f0f0f0",
  },
  dropdownText: { 
    fontSize: 15, 
    color: "#000",
    fontWeight: "500",
  },
  customerDetails: {
    marginTop: 4,
  },
  dropdownSubText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  noResultText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontStyle: "italic",
  },
  proceedButton: { 
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "#38ba50ff", 
    paddingVertical: 16, 
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#38ba50ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  proceedText: { 
    textAlign: "center", 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 18,
  },
});