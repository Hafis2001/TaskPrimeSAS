// DebtorsScreen.js - Updated to use main database service
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import dbService from "../../src/services/database";

export default function DebtorsScreen() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalStores, setTotalStores] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const router = useRouter();

  // back handler
  useEffect(() => {
    const backAction = () => {
      router.replace("/Company");
      return true;
    };

    const bh = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => bh.remove();
  }, []);

  // load from sqlite
  const loadLocalCustomers = async () => {
    try {
      setLoading(true);

      console.log('[Customers] Initializing database...');
      await dbService.init();

      console.log('[Customers] Loading customers...');
      const rows = await dbService.getCustomers();

      console.log(`[Customers] Found ${rows.length} customers`);

      if (rows.length === 0) {
        setLoading(false);
        Alert.alert(
          "No Customer Data",
          "No customer data found. Please download data from Home screen first.",
          [
            { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }

      // Filter out customers with zero balance and sort alphabetically
      const filteredRows = rows
        .filter((item) => (item.balance ?? 0) !== 0)
        .sort((a, b) => {
          const nameA = (a.name ?? "").toLowerCase();
          const nameB = (b.name ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
        });

      setData(filteredRows);
      setFiltered(filteredRows);

      // Calculate totals
      const totalBal = rows.reduce((sum, item) => sum + (item.balance || 0), 0);
      setTotalStores(filteredRows.length);
      setTotalBalance(Math.round(totalBal));

      console.log(`[Customers] ✅ Loaded ${filteredRows.length} customers with non-zero balance`);
    } catch (err) {
      console.error("[Customers] Error loading customers:", err);
      Alert.alert(
        "Error",
        `Unable to load customers: ${err.message}. Please download data from Home screen.`,
        [
          { text: "Go to Home", onPress: () => router.replace("/(tabs)/Home") },
          { text: "Retry", onPress: () => loadLocalCustomers() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalCustomers();
  }, []);

  // reset search on focus
  useFocusEffect(
    useCallback(() => {
      setSearchQuery("");
      setFiltered(data);
    }, [data])
  );

  // search filter with alphabetical sorting
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const f = data
      .filter(
        (i) =>
          (i.name ?? "").toLowerCase().includes(q) ||
          (i.place ?? "").toLowerCase().includes(q) ||
          (i.phone ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const nameA = (a.name ?? "").toLowerCase();
        const nameB = (b.name ?? "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    setFiltered(f);
  }, [searchQuery, data]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0d3b6c" />
        <Text style={{ marginTop: 10, color: "#0d3b6c" }}>Loading customers...</Text>
      </View>
    );
  }

  const renderCard = ({ item, index }) => {
    const balance = item.balance ?? 0;

    return (
      <Animated.View entering={FadeInUp.delay(index * 40)}>
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: "/customer-ledger",
              params: {
                code: item.code ?? item.id,
                name: item.name,
                current_balance: balance.toString(),
              },
            })
          }
        >
          <View style={styles.cardRow}>
            <View style={{ flex: 3 }}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.subText}>{item.phone}</Text>
              <Text style={styles.subText}>{item.place}</Text>
            </View>

            <Text
              style={[
                styles.balanceText,
                { color: balance < 0 ? "#ff3b30" : "#0b8a2f" },
              ]}
            >
              {Math.round(balance).toLocaleString("en-IN")}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
      <View style={styles.backbutton}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#0d3b6c" style={styles.arrow} />
        </TouchableOpacity>
        <Animated.Text entering={FadeInUp} style={styles.title}>
          Customers Statement
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInUp.delay(80)} style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Stores</Text>
          <Text style={styles.summaryValue}>{totalStores}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Balance</Text>
          <Text style={styles.summaryValue}>{Math.round(totalBalance).toLocaleString("en-IN")}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120)}>
        <TextInput
          placeholder="Search Name, Place, Phone"
          placeholderTextColor="#7c8899"
          style={styles.searchBox}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150)} style={styles.headingCard}>
        <Text style={[styles.headingText, { flex: 3 }]}>Name</Text>
        <Text style={[styles.headingText, { flex: 1, textAlign: "right" }]}>Balance</Text>
      </Animated.View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => (item.code ?? item.id ?? Math.random().toString()).toString()}
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No results found. Download customers from Company.
          </Text>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14, backgroundColor: "#fff" },
  loadingScreen: { flex: 1, backgroundColor: "#f7f9fa", alignItems: "center", justifyContent: "center" },
  title: { color: "#0d3b6c", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 11, marginTop: 18, marginLeft: 70 },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(13,59,108,0.08)",
    marginBottom: 16,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { color: "#55606a", fontSize: 14 },
  summaryValue: { color: "#0d3b6c", fontSize: 20, fontWeight: "700" },
  searchBox: { backgroundColor: "rgba(245,245,245,1)", borderRadius: 14, padding: 12, color: "#333", marginBottom: 16, borderWidth: 1, borderColor: "rgba(13,59,108,0.06)" },
  headingCard: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 6, marginBottom: 8 },
  headingText: { color: "#0d3b6c", fontWeight: "600", fontSize: 15 },
  card: { backgroundColor: "#ffffff", padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "#eef6ff" },
  cardRow: { flexDirection: "row", justifyContent: "space-between" },
  cardName: { color: "#0b2a44", fontSize: 16, fontWeight: "600" },
  subText: { color: "#6b7c8a", fontSize: 13 },
  balanceText: { fontSize: 18, fontWeight: "700", textAlign: "right" },
  emptyText: { textAlign: "center", color: "#9aa4b2", marginTop: 40, fontSize: 16 },
  backbutton: { flexDirection: "row" },
  arrow: { marginTop: 18 },
});