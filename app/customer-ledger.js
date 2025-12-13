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
import Animated, { FadeInUp } from "react-native-reanimated";

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

  // Date range states
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState(null); // "from" or "to"

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const color = isCredit ? "#ff3b30" : "#0b8a2f"; // credit red, debit green

    return (
      <Animated.View entering={FadeInUp.delay(20)}>
        <View style={styles.transactionCard}>
          <View style={styles.rowBetween}>
            <View style={[styles.rowCenter, { flex: 1 }]}>
              <View style={[styles.iconCircle, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
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
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0d3b6c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.headerCard}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color="#0d3b6c" />
        </TouchableOpacity>

        <View style={{ flex: 1, paddingHorizontal: 8 }}>
          <Animated.Text entering={FadeInUp} style={styles.title}>
            {name || "Customer Ledger"}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(40)} style={styles.dateText}>
            {fromDate && toDate
              ? `${formatDate(fromDate)} → ${formatDate(toDate)}`
              : "All Transactions"}
          </Animated.Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => {
              setDatePickerMode("from");
              setShowDatePicker(true);
            }}
            style={styles.iconAction}
          >
            <Icon name="calendar-outline" size={20} color="#0d3b6c" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setDatePickerMode("to");
              setShowDatePicker(true);
            }}
            style={styles.iconAction}
          >
            <Icon name="calendar" size={20} color="#0d3b6c" />
          </TouchableOpacity>

          <TouchableOpacity onPress={refreshAll} style={styles.iconAction}>
            <Icon name="refresh" size={20} color="#0d3b6c" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === "from" ? (fromDate || new Date()) : (toDate || new Date())}
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
          <Text style={[styles.totalValue, { color: "#ff3b30" }]}>{totalCredit.toLocaleString("en-IN")}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Total Debit</Text>
          <Text style={[styles.totalValue, { color: "#0b8a2f" }]}>{totalDebit.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      <Text style={styles.transHeading}>TRANSACTIONS</Text>

      <FlatList
        data={filteredLedger}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions found.</Text>}
        showsVerticalScrollIndicator={false}
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
  container: { flex: 1, backgroundColor: "#FFF7F0", padding: 12 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF7F0" },

  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: Platform.OS === "ios" ? 50 : 16,
    marginBottom: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(13,59,108,0.08)",
  },

  backBtn: { paddingRight: 8 },

  title: { fontSize: 18, fontWeight: "700", color: "#0d3b6c" },
  dateText: { fontSize: 13, color: "#55606a", marginTop: 2 },

  actions: { flexDirection: "row", alignItems: "center" },
  iconAction: { marginLeft: 10, padding: 6, borderRadius: 8 },

  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  balanceBox: {
    backgroundColor: "rgba(255,255,255,0.9)",
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(13,59,108,0.06)",
  },
  balanceLabel: { color: "#55606a", fontWeight: "600", fontSize: 13 },
  balanceValue: { fontSize: 17, fontWeight: "700", color: "#0d3b6c", marginTop: 4 },

  totalCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(13,59,108,0.06)",
  },
  totalItem: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 36, backgroundColor: "rgba(13,59,108,0.08)" },
  totalLabel: { color: "#55606a", fontWeight: "600", fontSize: 13 },
  totalValue: { fontSize: 16, fontWeight: "700" },

  transHeading: { fontSize: 13, fontWeight: "700", color: "#0d3b6c", marginBottom: 6, marginTop: 6 },

  transactionCard: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eef6ff",
    shadowColor: "#0d3b6c",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center" },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  particulars: { fontWeight: "700", color: "#0b2a44", maxWidth: 220 },
  subText: { color: "#6b7c8a", fontSize: 12 },
  voucherText: { color: "#7c8899", fontSize: 12, marginTop: 4 },

  amountText: { fontSize: 16, fontWeight: "700", textAlign: "right" },

  footerCard: {
    position: "absolute",
    bottom: 18,
    left: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 14,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(13,59,108,0.12)",
  },
  footerLabel: { color: "#55606a", fontSize: 14, fontWeight: "700" },
  footerValue: { color: "#0d3b6c", fontSize: 20, fontWeight: "900", marginTop: 6 },

  emptyText: { textAlign: "center", color: "#9aa4b2", marginTop: 20 },
});

// ----------------- Helpers -----------------
function hexWithAlpha(hexColor, alpha) {
  // hexColor like '#00eaff' -> returns rgba string with alpha
  try {
    const c = hexColor.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(13,59,108,${alpha})`;
  }
}