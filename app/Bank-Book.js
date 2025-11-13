import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = "https://taskprime.app/api/get-bank-book-data/";

// ✅ Format currency with optional "-" sign
function formatCurrency(v) {
  const n = Number(v ?? 0);
  const isNegative = n < 0;
  const absValue = Math.abs(Math.round(n));
  const formatted = "" + absValue.toLocaleString("en-IN");
  return isNegative ? `-${formatted}` : formatted;
}

export default function BankBookScreen() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const fetchBankBook = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(API_URL, { headers });
      if (!res.ok) {
        console.error("BankBook fetch failed:", res.status);
        setData([]);
        return;
      }

      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data ?? [];

      // ✅ Calculate balance as debit - credit
      const mapped = list
        .map((it, i) => {
          const debit = Number(it.debit ?? it.total_debit ?? 0);
          const credit = Number(it.credit ?? it.total_credit ?? 0);
          const balance = debit - credit;
          return {
            id: it.code ?? it.account_code ?? String(i),
            name: it.name ?? it.account_name ?? "-",
            balance,
          };
        })
        .filter((item) => item.balance !== 0); // ✅ remove only zero balances

      setData(mapped);
    } catch (err) {
      console.error("Fetch error:", err);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBankBook();
  }, [fetchBankBook]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBankBook();
  };

  const filtered = useMemo(() => {
    if (!query) return data;
    const q = query.trim().toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, query]);

  const renderRow = ({ item, index }) => {
    const isPositive = item.balance >= 0;
    return (
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: "bank-ledger",
            params: {
              account_code: item.id,
              account_name: item.name,
              previous_balance: item.balance, // ✅ sending balance
            },
          });
        }}
      >
        <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
          <Text style={[styles.cell, styles.nameCell]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.cell,
              styles.numCell,
              { color: isPositive ? "#16a34a" : "#dc2626" },
            ]}
          >
            {formatCurrency(item.balance)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0f1724" />
        </TouchableOpacity>
        <Text style={styles.title}>Bank Book</Text>
      </View>

      {/* ✅ Search box */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#9ca3af" />
        <TextInput
          placeholder="Search by name"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ Table */}
      <View style={styles.tableWrapper}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
          <Text style={[styles.headerCell, styles.numCell]}>Balance</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No records found.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ✅ Top Bar
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fffaf5",
    marginRight: 10,
    marginTop: 40,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f1724", marginTop: 40 },

  // ✅ Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffaf5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#0f1724" },
  clearBtn: { marginLeft: 8 },

  // ✅ Table
  tableWrapper: { flex: 1, width: "100%" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff6f1",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: { fontSize: 13, fontWeight: "700", color: "#ff6600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fffaf5",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomColor: "#f1e9e0",
    borderBottomWidth: 1,
  },
  rowAlt: { backgroundColor: "#fff8f2" },
  cell: { fontSize: 14, color: "#1e293b" },
  nameCell: { flex: 2 },
  numCell: { flex: 1, textAlign: "right", fontWeight: "600" },
  emptyText: { color: "#666", marginTop: 20 },
});
