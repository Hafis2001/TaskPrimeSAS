import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";

const API_URL = "https://taskprime.app/api/get-ledger-details?account_code=";

export default function CustomerLedgerScreen() {
  const { code, name, current_balance } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState([]);
  const [filteredLedger, setFilteredLedger] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(Number(current_balance) || 0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  // 🗓️ New State for Date Range
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState(null); // "from" or "to"

  useEffect(() => {
    fetchLedger();
  }, [code]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        router.replace("/");
        return;
      }

      const res = await fetch(`${API_URL}${code}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error("Invalid JSON:", text.slice(0, 200));
        Alert.alert("Server Error", "Invalid response from server.");
        setLoading(false);
        return;
      }

      let entries = Array.isArray(result) ? result : result.data || [];

      entries.sort((a, b) => {
        const dateA = new Date(a.entry_date);
        const dateB = new Date(b.entry_date);
        if (dateA.getTime() === dateB.getTime()) {
          return (a.voucher_no || 0) - (b.voucher_no || 0);
        }
        return dateB - dateA;
      });

      setLedger(entries);
      setFilteredLedger(entries);
      calculateReverseBalances(entries, Number(current_balance) || 0, false);
    } catch (err) {
      console.error("Ledger Fetch Error:", err);
      Alert.alert("Network Error", "Unable to fetch ledger details.");
    } finally {
      setLoading(false);
    }
  };

  const calculateReverseBalances = (entries, currentClosing, isDateFiltered) => {
    if (!entries.length) return;

    const grouped = {};
    entries.forEach((e) => {
      const d = e.entry_date;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(e);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    let balances = {};
    let nextOpening = currentClosing;

    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i];
      const dayEntries = grouped[date];
      let debitTotal = 0;
      let creditTotal = 0;

      dayEntries.forEach((e) => {
        debitTotal += Number(e.debit || 0);
        creditTotal += Number(e.credit || 0);
      });

      const closing = nextOpening;
      const opening = closing - debitTotal + creditTotal;
      balances[date] = { opening, closing, debitTotal, creditTotal };
      nextOpening = opening;
    }

    if (!isDateFiltered) {
      let totalDebitAll = 0;
      let totalCreditAll = 0;
      entries.forEach((e) => {
        totalDebitAll += Number(e.debit || 0);
        totalCreditAll += Number(e.credit || 0);
      });

      const earliestDate = dates[0];
      const earliest = balances[earliestDate];

      setOpeningBalance(earliest?.opening || 0);
      setClosingBalance(currentClosing);
      setTotalDebit(totalDebitAll);
      setTotalCredit(totalCreditAll);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // 🗓️ Filter ledger between two dates
  const filterByDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return;
    const from = new Date(startDate);
    const to = new Date(endDate);

    const filtered = ledger.filter((e) => {
      const d = new Date(e.entry_date);
      return d >= from && d <= to;
    });

    setFilteredLedger(filtered);
    calculateReverseBalances(filtered, Number(current_balance) || 0, true);

    let totalDebit = 0;
    let totalCredit = 0;
    filtered.forEach((e) => {
      totalDebit += Number(e.debit || 0);
      totalCredit += Number(e.credit || 0);
    });

    setTotalDebit(totalDebit);
    setTotalCredit(totalCredit);
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === "from") {
        setFromDate(selectedDate);
        if (toDate) filterByDateRange(selectedDate, toDate);
      } else if (datePickerMode === "to") {
        setToDate(selectedDate);
        if (fromDate) filterByDateRange(fromDate, selectedDate);
      }
    }
  };

  const refreshAll = () => {
    setFromDate(null);
    setToDate(null);
    setFilteredLedger(ledger);
    calculateReverseBalances(ledger, Number(current_balance) || 0, false);
  };

  const renderItem = ({ item }) => {
    const isCredit = item.credit && item.credit > 0;
    const amount = isCredit ? item.credit : item.debit;
    const color = isCredit ? "#ff4d4d" : "#00b894";

    return (
      <View style={styles.transactionCard}>
        <View style={styles.rowBetween}>
          <View style={[styles.rowCenter, { flex: 1 }]}>
            <View style={[styles.iconCircle, { backgroundColor: color + "20" }]}>
              <Icon name={isCredit ? "arrow-down" : "arrow-up"} size={18} color={color} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.particulars} numberOfLines={1} ellipsizeMode="tail">
                {item.particulars}
              </Text>
              <Text style={styles.subText}>
                {formatDate(item.entry_date)} {item.narration ? `• ${item.narration}` : ""}
              </Text>
              <Text style={styles.voucherText}>Voucher ID: {item.voucher_no || "-"}</Text>
            </View>
          </View>
          <View style={{ marginLeft: 10, minWidth: 90, alignItems: "flex-end" }}>
            <Text style={[styles.amountText, { color }]}>
              {Math.abs(amount || 0).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ff6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#fff0e0", "#ffffff"]} style={styles.headerCard}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={22} color="#ff6600" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{name || "Customer Ledger"}</Text>
          <Text style={styles.dateText}>
            {fromDate && toDate
              ? `${formatDate(fromDate)} → ${formatDate(toDate)}`
              : "All Transactions"}
          </Text>
        </View>

        <View style={styles.rowCenter}>
          <TouchableOpacity onPress={() => { setDatePickerMode("from"); setShowDatePicker(true); }}>
            <Icon name="calendar-outline" size={22} color="#ff6600" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setDatePickerMode("to"); setShowDatePicker(true); }}
            style={{ marginLeft: 10 }}
          >
            <Icon name="calendar" size={22} color="#ff6600" />
          </TouchableOpacity>
          <TouchableOpacity onPress={refreshAll} style={{ marginLeft: 10 }}>
            <Icon name="refresh" size={22} color="#ff6600" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="calendar"
          onChange={onDateChange}
        />
      )}

      <View style={styles.balanceRow}>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Opening Balance</Text>
          <Text style={styles.balanceValue}>
            {openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      <View style={styles.totalCard}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Total Credit</Text>
          <Text style={[styles.totalValue, { color: "#ff4d4d" }]}>
            {totalCredit.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Total Debit</Text>
          <Text style={[styles.totalValue, { color: "#00b894" }]}>
            {totalDebit.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      <Text style={styles.transHeading}>TRANSACTIONS</Text>
      <FlatList
        data={filteredLedger}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions found.</Text>}
      />

      <View style={styles.footerCard}>
        <Text style={styles.footerLabel}>Closing Balance</Text>
        <Text style={styles.footerValue}>
          {closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

// ----------------- Styles -----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 30,
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#ff6600", textAlign: "center" },
  dateText: { fontSize: 13, color: "#888", textAlign: "center" },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  balanceBox: {
    backgroundColor: "#f9f3ed",
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  balanceLabel: { color: "#6b7280", fontWeight: "600", fontSize: 13 },
  balanceValue: { fontSize: 17, fontWeight: "bold", color: "#1e293b" },
  totalCard: {
    flexDirection: "row",
    backgroundColor: "#fffaf5",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-evenly",
    elevation: 2,
  },
  totalItem: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 30, backgroundColor: "#ddd" },
  totalLabel: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  totalValue: { fontSize: 16, fontWeight: "bold" },
  transHeading: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 6,
    marginLeft: 4,
  },
  transactionCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  particulars: { fontWeight: "600", color: "#1e293b", maxWidth: 180 },
  subText: { color: "#6b7280", fontSize: 12 },
  voucherText: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  amountText: { fontSize: 16, fontWeight: "bold", textAlign: "right" },
  footerCard: {
    position: "absolute",
    bottom: 0,
    left: 15,
    right: 0,
    backgroundColor: "#ff6600",
    padding: 16,
    alignItems: "center",
    borderRadius: 20,
    width: "95%",
    marginBottom: 45,
  },
  footerLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerValue: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#999", marginTop: 20 },
});
