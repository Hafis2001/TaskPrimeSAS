// app/Order/Entry.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function EntryScreen() {
  const areaList = ["Calicut", "Kannur", "Malappuram"];
  const customerByArea = {
    Calicut: ["Rahul", "Aslam", "Vishnu"],
    Kannur: ["Hafis", "Nihal"],
    Malappuram: ["Shamil", "Arun"],
  };
  const typeList = ["Order", "Sales", "Return"];
  const paymentList = ["Cash", "UPI / Bank"];

  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const validateAndProceed = () => {
    if (!selectedArea) return Alert.alert("Missing", "Please select Area");
    if (!selectedCustomer) return Alert.alert("Missing", "Please select Customer");
    if (!selectedType) return Alert.alert("Missing", "Please select Type");
    if (!selectedPayment) return Alert.alert("Missing", "Please select Payment Type");

    router.push({
      pathname: "/Order/OrderDetails",
      params: {
        area: selectedArea,
        customer: selectedCustomer,
        type: selectedType,
        payment: selectedPayment,
      },
    });
  };

  return (
    <LinearGradient colors={["#2b4b69ff", "#0d1e3dff"]} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={styles.header}>Entry</Text>

        <Dropdown
          label="Select Area"
          placeholder="Select Area"
          data={areaList}
          selectedValue={selectedArea}
          onSelect={(val) => {
            setSelectedArea(val);
            setSelectedCustomer(null);
          }}
          open={openDropdown === "area"}
          setOpen={() => setOpenDropdown(openDropdown === "area" ? null : "area")}
        />

        <Dropdown
          label="Customer Name"
          placeholder="Select Customer"
          data={selectedArea ? customerByArea[selectedArea] : []}
          disabled={!selectedArea}
          selectedValue={selectedCustomer}
          onSelect={setSelectedCustomer}
          open={openDropdown === "customer"}
          setOpen={() => setOpenDropdown(openDropdown === "customer" ? null : "customer")}
        />

        <Dropdown
          label="Select Type"
          placeholder="Select Type"
          data={typeList}
          selectedValue={selectedType}
          onSelect={setSelectedType}
          open={openDropdown === "type"}
          setOpen={() => setOpenDropdown(openDropdown === "type" ? null : "type")}
        />

        <Dropdown
          label="Select Payment Type"
          placeholder="Select Payment Type"
          data={paymentList}
          selectedValue={selectedPayment}
          onSelect={setSelectedPayment}
          open={openDropdown === "payment"}
          setOpen={() => setOpenDropdown(openDropdown === "payment" ? null : "payment")}
        />

        <TouchableOpacity style={styles.proceedButton} onPress={validateAndProceed}>
          <Text style={styles.proceedText}>Proceed</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const Dropdown = ({ label, placeholder, data, selectedValue, onSelect, open, setOpen, disabled }) => {
  const animatedHeight = React.useRef(new Animated.Value(open ? 120 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: open ? Math.min(220, (data?.length || 0) * 48 + 8) : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [open, data]);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity disabled={disabled} onPress={setOpen} style={[styles.dropdownBox, disabled && { opacity: 0.5 }]}>
        <Text style={{ color: selectedValue ? "#fff" : "#E0E0E0" }}>{selectedValue || placeholder}</Text>
        <Ionicons name="chevron-down" size={20} color="#fff" />
      </TouchableOpacity>

      {open && (
        <Animated.View style={[styles.dropdownList, { height: animatedHeight }]}>
          <ScrollView>
            {(!data || data.length === 0) && (
              <View style={styles.dropdownItem}><Text style={styles.dropdownText}>No items</Text></View>
            )}
            {data?.map((item, i) => (
              <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => { onSelect(item); setOpen(); }}>
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
  container: { flex: 1, padding: 18 },
  header: { fontSize: 28, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 6 },
  dropdownBox: { backgroundColor: "rgba(255,255,255,0.12)", padding: 15, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dropdownList: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 12, marginTop: 6, overflow: "hidden" },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  dropdownText: { fontSize: 15, color: "#000" },
  proceedButton: { marginTop: 12, backgroundColor: "#38ba50ff", paddingVertical: 15, borderRadius: 12 },
  proceedText: { textAlign: "center", color: "#fff", fontWeight: "700", fontSize: 18 },
});
