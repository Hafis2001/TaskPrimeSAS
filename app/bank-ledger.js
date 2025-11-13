import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  SafeAreaView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";

const LEDGER_API =
  "https://taskprime.app/api/get-bank-ledger-details/?account_code=";

export default function BankLedgerScreen() {
  const router = useRouter();
  const { account_code, account_name, previous_balance } = useLocalSearchParams();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(
    parseFloat(previous_balance) || 0
  );
  const [filterType, setFilterType] = useState("all");
  const [dailyBalances, setDailyBalances] = useState({});

  useEffect(() => {
    if (!account_code) {
      console.warn("⚠️ No account_code provided — skipping fetch");
      setLoading(false);
      return;
    }
    fetchLedger(account_code);
  }, [account_code]);

  const fetchLedger = async (code) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${LEDGER_API}${code}`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        Alert.alert("Error", `Failed to fetch ledger: ${res.status}`);
        setData([]);
        setFilteredData([]);
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const processed = json.data
          .map((item) => {
            const debit = Number(item.debit ?? 0);
            const credit = Number(item.credit ?? 0);
            const dateObj = new Date(item.entry_date);
            return {
              ...item,
              debit,
              credit,
              rawDate: dateObj.getTime(),
              dateOnly: item.entry_date,
            };
          })
          .sort((a, b) => a.rawDate - b.rawDate || a.voucher_no - b.voucher_no);

        // 🗂️ Group by date
        const grouped = {};
        processed.forEach((item) => {
          if (!grouped[item.dateOnly]) {
            grouped[item.dateOnly] = { debit: 0, credit: 0, entries: [] };
          }
          grouped[item.dateOnly].debit += item.debit;
          grouped[item.dateOnly].credit += item.credit;
          grouped[item.dateOnly].entries.push(item);
        });

        // 🧮 Correct reverse-opening logic
        const dates = Object.keys(grouped).sort(); // ascending (oldest → latest)
        const balanceMap = {};

        // Start from known current closing balance
        let runningClosing = parseFloat(previous_balance) || 0;

        // Traverse backward (latest → oldest)
        for (let i = dates.length - 1; i >= 0; i--) {
          const d = dates[i];
          const { debit, credit } = grouped[d];
          const opening = runningClosing - debit + credit;
          balanceMap[d] = { opening, closing: runningClosing };
          runningClosing = opening;
        }

        setData(processed);
        setDailyBalances(balanceMap);

        // Default to today
        const today = new Date().toISOString().split("T")[0];
        const todaysEntries = grouped[today]?.entries || [];
        setFilteredData(todaysEntries);
        setSelectedDate(today);

        if (balanceMap[today]) {
          setOpeningBalance(balanceMap[today].opening);
          setClosingBalance(balanceMap[today].closing);
        } else {
          // If no entry for today, keep last known
          setOpeningBalance(parseFloat(previous_balance) || 0);
          setClosingBalance(parseFloat(previous_balance) || 0);
        }
      } else {
        setData([]);
        setFilteredData([]);
      }
    } catch (err) {
      console.error("🔥 Ledger fetch error:", err);
      Alert.alert("Network Error", "Could not fetch ledger.");
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Update balances when dailyBalances or selectedDate changes
  useEffect(() => {
    if (!loading && dailyBalances && Object.keys(dailyBalances).length > 0) {
      if (dailyBalances[selectedDate]) {
        setOpeningBalance(dailyBalances[selectedDate].opening);
        setClosingBalance(dailyBalances[selectedDate].closing);
      } else {
        // ✅ Correct fallback: if date has no entries, today's opening = current closing
        setOpeningBalance(parseFloat(previous_balance) || 0);
        setClosingBalance(parseFloat(previous_balance) || 0);
      }
    }
  }, [dailyBalances, selectedDate, loading]);

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      const chosen = new Date(
        selected.getTime() - selected.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0];
      setSelectedDate(chosen);
      updateForDate(chosen);
    }
  };

  const updateForDate = (date) => {
    const entries = data.filter((i) => i.dateOnly === date);
    setFilteredData(entries);
  };

  const getFilteredList = () => {
    if (filterType === "debit") return filteredData.filter((i) => i.debit > 0);
    if (filterType === "credit") return filteredData.filter((i) => i.credit > 0);
    return filteredData;
  };

  const totals = useMemo(() => {
    const list = getFilteredList();
    let debit = 0,
      credit = 0;
    list.forEach((i) => {
      debit += i.debit;
      credit += i.credit;
    });
    return { debit, credit };
  }, [filteredData, filterType]);

  const renderItem = ({ item }) => {
    const isDebit = item.debit > 0;
    const color = isDebit ? "#d32f2f" : "#2e7d32";
    const icon = isDebit ? "arrow-down" : "arrow-up";
    const amount = isDebit
      ? `${item.debit.toLocaleString("en-IN")}`
      : `${item.credit.toLocaleString("en-IN")}`;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionRow}>
          <View style={styles.leftColumn}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: isDebit ? "#fde7e7" : "#dff7e0" },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={18}
                  color={isDebit ? "#d32f2f" : "#2e7d32"}
                />
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.particulars} numberOfLines={1}>
                  {item.particulars}
                </Text>
                <Text style={styles.narration}>{item.entry_date}</Text>
              </View>
            </View>
          </View>

          <View style={styles.amountWrap}>
            <Text style={[styles.amount, { color }]} numberOfLines={1}>
              {amount}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={["#ff6600", "#fddca9ff"]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.bankName}>{account_name || "Customer"}</Text>
              <Text style={styles.dateText}>
                {new Date(selectedDate).toDateString()}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Balances */}
          <View style={styles.balanceRow}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Closing Balance</Text>
              <Text style={styles.balanceValue}>
                {Math.abs(closingBalance).toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Opening Balance</Text>
              <Text style={styles.balanceValue}>
                {Math.abs(openingBalance).toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          {/* Filters */}
          <View style={styles.filterContainer}>
            {["all", "credit", "debit"].map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilterType(type)}
                style={[
                  styles.filterButton,
                  filterType === type && styles.filterActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterType === type && styles.filterTextActive,
                  ]}
                >
                  {type === "all" ? "All" : type === "credit" ? "Credit" : "Debit"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.summaryLabel}>Total Credit</Text>
              <Text style={[styles.summaryValue, { color: "#2e7d32" }]}>
                {totals.credit.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.summaryLabel}>Total Debit</Text>
              <Text style={[styles.summaryValue, { color: "#d32f2f" }]}>
                {totals.debit.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          {/* Transactions */}
          {loading ? (
            <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={getFilteredList()}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No transactions for this date.</Text>
              }
            />
          )}

          {/* Closing Balance */}
          <View style={styles.closingBox}>
            <Text style={styles.closingLabel}>
              Closing Balance ({selectedDate})
            </Text>
            <Text style={styles.closingValue}>
              {Math.abs(closingBalance).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={new Date(selectedDate)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 15,
  },
  headerCenter: { alignItems: "center" },
  bankName: { fontSize: 18, fontWeight: "700", color: "#fff" },
  dateText: { color: "#ffe6cc", fontSize: 13, marginTop: 2 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 12,
    borderRadius: 12,
    width: "48%",
  },
  balanceLabel: { color: "#fff", fontSize: 13 },
  balanceValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 6,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 30,
    padding: 4,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
  },
  filterActive: { backgroundColor: "#fff" },
  filterText: { color: "#fff", fontWeight: "600" },
  filterTextActive: { color: "#ff7b00" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  summaryLabel: { color: "#555", fontSize: 14 },
  summaryValue: { fontWeight: "700", fontSize: 16 },
  transactionCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 12,
    marginBottom: 10,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftColumn: { flex: 1 },
  textBlock: { marginLeft: 5, justifyContent: "center" },
  particulars: { fontSize: 15, fontWeight: "600", color: "#333" },
  narration: { fontSize: 10, color: "#999", marginTop: 2 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  amountWrap: { marginLeft: 15, justifyContent: "center", alignItems: "flex-end",marginTop: 6, },
  amount: { fontSize: 15, fontWeight: "700", textAlign: "right", marginTop: 6, },
  emptyText: {
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  closingBox: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 14,
    
    marginBottom: 38,
  },
  closingLabel: { color: "#777", fontSize: 13 },
  closingValue: { fontSize: 20, fontWeight: "700", color: "#ff7b00" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
