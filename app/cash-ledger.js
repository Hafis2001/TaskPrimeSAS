import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const LEDGER_API =
  "https://taskprime.app/api/get-cash-ledger-details/?account_code=";

export default function CashLedgerScreen() {
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
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

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
        const processedAsc = json.data
          .map((item) => {
            const debit = Number(item.debit ?? 0);
            const credit = Number(item.credit ?? 0);
            let dateObj = null;
            if (item.entry_date) {
              const safeDate = item.entry_date.includes("T")
                ? item.entry_date
                : `${item.entry_date}T00:00:00Z`;
              dateObj = new Date(safeDate);
            }
            const formattedDate = dateObj
              ? `${String(dateObj.getDate()).padStart(2, "0")}-${String(
                  dateObj.getMonth() + 1
                ).padStart(2, "0")}-${dateObj.getFullYear()}`
              : "-";
            return {
              date: formattedDate,
              rawDate: dateObj ? dateObj.getTime() : 0,
              dateOnly: dateObj
                ? dateObj.toISOString().split("T")[0]
                : null,
              particulars: item.particulars ?? item.account_name ?? "-",
              narration: item.narration ?? "-",
              debit,
              credit,
            };
          })
          .sort((a, b) => a.rawDate - b.rawDate);

        const dailyMap = {};
        processedAsc.forEach((item) => {
          if (!item.dateOnly) return;
          if (!dailyMap[item.dateOnly]) {
            dailyMap[item.dateOnly] = { debit: 0, credit: 0, entries: [] };
          }
          dailyMap[item.dateOnly].debit += item.debit;
          dailyMap[item.dateOnly].credit += item.credit;
          dailyMap[item.dateOnly].entries.push(item);
        });

        // 🧮 Reverse calculation (Opening = Closing + Debit - Credit)
        const dates = Object.keys(dailyMap).sort();
        let runningClosing = parseFloat(previous_balance) || 0;
        const balances = {};
        for (let i = dates.length - 1; i >= 0; i--) {
          const d = dates[i];
          const { debit, credit } = dailyMap[d];
          const open = runningClosing + debit - credit;
          balances[d] = { opening: open, closing: runningClosing };
          runningClosing = open;
        }

        setData(processedAsc);
        setDailyBalances(balances);

        const today = new Date().toISOString().split("T")[0];
        const todaysEntries = dailyMap[today]?.entries || [];
        setFilteredData(todaysEntries);
        setSelectedDate(today);

        if (balances[today]) {
          setOpeningBalance(balances[today].opening);
          setClosingBalance(balances[today].closing);
        } else {
          setOpeningBalance(parseFloat(previous_balance) || 0);
        }

        setTotalDebit(dailyMap[today]?.debit || 0);
        setTotalCredit(dailyMap[today]?.credit || 0);
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

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      const chosen = new Date(
        selected.getTime() - selected.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0];
      setSelectedDate(chosen);
      calculateOpeningForDate(chosen);
    }
  };

  const calculateOpeningForDate = (date) => {
    if (!data.length) return;
    const sorted = [...data].sort((a, b) => a.rawDate - b.rawDate);
    const dailyMap = {};
    sorted.forEach((item) => {
      if (!item.dateOnly) return;
      if (!dailyMap[item.dateOnly]) {
        dailyMap[item.dateOnly] = { debit: 0, credit: 0, entries: [] };
      }
      dailyMap[item.dateOnly].debit += item.debit;
      dailyMap[item.dateOnly].credit += item.credit;
      dailyMap[item.dateOnly].entries.push(item);
    });

    const dates = Object.keys(dailyMap).sort();
    let runningClosing = parseFloat(previous_balance) || 0;
    const balances = {};
    for (let i = dates.length - 1; i >= 0; i--) {
      const d = dates[i];
      const { debit, credit } = dailyMap[d];
      const open = runningClosing - debit + credit;
      balances[d] = { opening: open, closing: runningClosing };
      runningClosing = open;
    }

    setDailyBalances(balances);
    const entries = dailyMap[date]?.entries || [];
    setFilteredData(entries);

    setTotalDebit(dailyMap[date]?.debit || 0);
    setTotalCredit(dailyMap[date]?.credit || 0);

    if (balances[date]) {
      setOpeningBalance(balances[date].opening);
      setClosingBalance(balances[date].closing);
    }
  };

  const clearDateFilter = () => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    calculateOpeningForDate(today);
  };

  const getFilteredList = () => {
    if (filterType === "debit") return filteredData.filter((i) => i.debit > 0);
    if (filterType === "credit") return filteredData.filter((i) => i.credit > 0);
    return filteredData;
  };

  const renderItem = ({ item }) => {
    const color = item.debit > 0 ? "#2e7d32" : "#d32f2f";
    const amount =
      item.debit > 0
        ? `${item.debit.toLocaleString("en-IN")}`
        : `${item.credit.toLocaleString("en-IN")}`;
    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.dateText}>{item.date}</Text>
          <Text style={[styles.balanceText, { color }]}>{amount}</Text>
        </View>
        <Text style={styles.particulars}>{item.particulars}</Text>
        {item.narration && <Text style={styles.narration}>{item.narration}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0f1724" />
        </TouchableOpacity>
        <Text style={styles.title}>{account_name || "Cash Ledger"}</Text>

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.calendarButton}
        >
          <Ionicons name="calendar-outline" size={22} color="#ff6600" />
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity onPress={clearDateFilter} style={styles.clearButton}>
            <Ionicons name="refresh" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter buttons */}
      <View style={styles.filterRow}>
        {["all", "debit", "credit"].map((type) => (
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
              {type === "all"
                ? "All"
                : type === "debit"
                ? "Debit Only"
                : "Credit Only"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(selectedDate)}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      <View style={styles.balanceview}>

      {/* Previous Balance */}
      <View style={styles.previousBox}>
        <Text style={styles.label}>current   Amount</Text>
        <Text style={[styles.balanceValue, { color: "#2563eb" }]}>
          {Math.abs(previous_balance || 0).toLocaleString("en-IN")}
        </Text>
      </View>

      {/* Opening Balance */}
      <View style={styles.balanceBox}>
        <Text style={styles.label}>Opening Balance</Text>
        <Text
          style={[
            styles.balanceValue,
            { color: openingBalance >= 0 ? "#16a34a" : "#dc2626" },
          ]}
        >
          {Math.abs(openingBalance).toLocaleString("en-IN")}
        </Text>
      </View>
       
       </View>
      

      {/* Total Debit & Credit */}
      <View style={styles.totalsBox}>
        <View style={styles.totalItem}>
          <Text style={styles.label}>Total Debit</Text>
          <Text style={[styles.balanceValue, { color: "#16a34a" }]}>
            {totalDebit.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.label}>Total Credit</Text>
          <Text style={[styles.balanceValue, { color: "#dc2626" }]}>
            {totalCredit.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6600" />
        </View>
      ) : (
        <>
          <FlatList
            data={getFilteredList()}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>
                  {selectedDate
                    ? `No entries found for ${selectedDate}`
                    : "No ledger entries found."}
                </Text>
              </View>
            }
          />

          {dailyBalances[selectedDate] && (
            <View style={styles.previousBoxClose}>
              <Text style={styles.label}>Closing Balance ({selectedDate})</Text>
              <Text
                style={[
                  styles.balanceValue,
                  {
                    color:
                      dailyBalances[selectedDate].closing >= 0
                        ? "#16a34a"
                        : "#dc2626",
                  },
                ]}
              >
                ₹{Math.abs(
                  dailyBalances[selectedDate].closing
                ).toLocaleString("en-IN")}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 14 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fffaf5",
    marginRight: 10,
    marginTop: 50,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f1724", marginTop: 50 },
  calendarButton: {
    marginLeft: "auto",
    marginTop: 50,
    backgroundColor: "#fffaf5",
    padding: 8,
    borderRadius: 8,
  },
  clearButton: { marginLeft: 6, marginTop: 50 },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 15,
    alignItems: "center",
  },
  filterActive: { backgroundColor: "#ff6600", borderColor: "#ff6600" },
  filterText: { color: "#555", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  balanceBox: {
    backgroundColor: "#fffaf5",
    padding: 12,
    borderRadius: 10,
    marginLeft:10,
    marginBottom: 10,
    width:180,
  },
  previousBox: {
    backgroundColor: "#fff6f1",
    padding: 12,
    borderRadius: 10,
    
    marginBottom: 10,
     width:180,
     
  },
  totalsBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff8f3",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  totalItem: { flex: 1, alignItems: "center" },
  label: { fontSize: 13, color: "#666" },
  balanceValue: { fontSize: 18, fontWeight: "700" },
  card: {
    backgroundColor: "#fffaf5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderColor: "#ffebdf",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dateText: { fontSize: 13, color: "#555" },
  balanceText: { fontSize: 14, fontWeight: "700" },
  particulars: { fontSize: 14, fontWeight: "600", color: "#222" },
  narration: { fontSize: 13, color: "#666", marginTop: 3 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#666" },

  balanceview: {
    flexDirection: "row",
    
  },
  previousBoxClose: {
    backgroundColor: "#fff6f1",
    padding: 12,
    borderRadius: 10,
    
    marginBottom: 30,
     width:180,
     marginLeft:200,
  },
});
