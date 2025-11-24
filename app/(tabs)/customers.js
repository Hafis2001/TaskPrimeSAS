import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const API_URL = "https://taskprime.app/api/debtors/get-debtors/";

export default function DebtorsScreen() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalStores, setTotalStores] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [rawJson, setRawJson] = useState(null);
  const router = useRouter();

  // 🔙 Android Back Button
  useEffect(() => {
    const backAction = () => {
      router.replace("/company-info");
      return true;
    };

    const bh = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => bh.remove();
  }, []);

  // 🔥 Fetch Debtors
  const fetchDebtors = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      if (!token) {
        Alert.alert("Session Expired", "Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch (err) {
        Alert.alert("Server Error", "Invalid response from server.");
        setLoading(false);
        return;
      }

      setRawJson(result);

      let arrayData = [];
      if (Array.isArray(result)) arrayData = result;
      else if (Array.isArray(result.data)) arrayData = result.data;
      else if (Array.isArray(result.results)) arrayData = result.results;

      const formatted = arrayData
        .map((item) => {
          let name = item.name ?? "-";
          name = name.replace(/^\(.*?\)\s*/g, "").trim();
          name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

          return {
            id: item.code || item.id || Math.random().toString(),
            name,
            place: item.place ?? "-",
            phone: item.phone ?? "-",
            balance: Math.round(Number(item.balance ?? 0)),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setData(formatted);
      setFiltered(formatted);
      setTotalStores(formatted.length);
      setTotalBalance(
        formatted.reduce((sum, c) => sum + c.balance, 0)
      );
    } catch (error) {
      Alert.alert("Network Error", "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  // Reset search on focus
  useFocusEffect(
    useCallback(() => {
      setSearchQuery("");
      setFiltered(data);
    }, [data])
  );

  // 🔍 Search Filter
  useEffect(() => {
    const f = data.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.phone.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFiltered(f);
  }, [searchQuery, data]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  // 💳 Card Renderer
  const renderCard = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 40)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/customer-ledger",
            params: {
              code: item.id,
              name: item.name,
              current_balance: item.balance.toString(),
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
              { color: item.balance < 0 ? "#ff3b30" : "#00eaff" },
            ]}
          >
            {item.balance.toLocaleString("en-IN")}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={["#07182a", "#0b132b", "#0b132b"]}
      style={styles.container}
    >
      <View style={styles.backbutton}>
        <TouchableOpacity onPress={() => router.back()}>
  <Ionicons name="arrow-back" size={23} color="#fff" style={styles.arrow}/>
</TouchableOpacity>
      <Animated.Text entering={FadeInUp} style={styles.title}>
        Customers Statement
      </Animated.Text>
      </View>

      {/* Summary */}
      <Animated.View entering={FadeInUp.delay(80)} style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Stores</Text>
          <Text style={styles.summaryValue}>{totalStores}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Balance</Text>
          <Text style={styles.summaryValue}>
            {Math.round(totalBalance)}
          </Text>
        </View>
      </Animated.View>

      {/* Search Box */}
      <Animated.View entering={FadeInUp.delay(120)}>
        <TextInput
          placeholder="Search Name, Place, Phone"
          placeholderTextColor="#7c8899"
          style={styles.searchBox}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Animated.View>

      {/* Column Header */}
      <Animated.View entering={FadeInUp.delay(150)} style={styles.headingCard}>
        <Text style={[styles.headingText, { flex: 3 }]}>Name</Text>
        <Text style={[styles.headingText, { flex: 1, textAlign: "right" }]}>
          Balance
        </Text>
      </Animated.View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No results found.</Text>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#07182a",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#00eaff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 11,
    marginTop:18,
    marginLeft:70
  },

  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.25)",
    marginBottom: 16,
  },

  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { color: "#9aa4b2", fontSize: 14 },
  summaryValue: { color: "#00eaff", fontSize: 20, fontWeight: "700" },

  searchBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.2)",
  },

  headingCard: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
  },

  headingText: {
    color: "#8fd8ff",
    fontWeight: "600",
    fontSize: 15,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,255,255,0.1)",
  },

  cardRow: { flexDirection: "row", justifyContent: "space-between" },

  cardName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  subText: { color: "#8fa6c4", fontSize: 13 },

  balanceText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "right",
  },

  emptyText: {
    textAlign: "center",
    color: "#9aa4b2",
    marginTop: 40,
    fontSize: 16,
  },
  backbutton:{
    flexDirection:"row",
  },
  arrow:{
marginTop:18
  }
});
