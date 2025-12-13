// Company.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initDB, saveCustomers } from "../components/db"; // adjust path if needed

const API_CUSTOMERS = "https://tasksas.com/api/debtors/get-debtors/"; // your customers (debtors) endpoint

const Company = () => {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);

  // initialize DB on mount (optional - ensures table exists)
  React.useEffect(() => {
    initDB().catch((e) => console.warn("DB init failed", e));
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          // optional: clear auth and navigate
          await AsyncStorage.removeItem("authToken");
          router.replace("/LoginScreen");
        },
      },
    ]);
  };

  const downloadCustomers = async () => {
    setDownloading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Not logged in", "Please login to download data.");
        setDownloading(false);
        return;
      }

      const resp = await fetch(API_CUSTOMERS, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        Alert.alert("Download Failed", `Server responded: ${resp.status}`);
        setDownloading(false);
        return;
      }

      const payload = await resp.json().catch(() => null);
      if (!payload) {
        Alert.alert("Download Failed", "Invalid server response.");
        setDownloading(false);
        return;
      }

      // normalize array from payload (same logic used in Debtors screen)
      let arrayData = [];
      if (Array.isArray(payload)) arrayData = payload;
      else if (Array.isArray(payload.data)) arrayData = payload.data;
      else if (Array.isArray(payload.results)) arrayData = payload.results;

      // Basic normalization to fields we need
      const normalized = arrayData.map((item) => ({
        code: item.code ?? item.id ?? Math.random().toString(),
        name: (item.name ?? "-")
          .toString()
          .replace(/^\(.*?\)\s*/g, "")
          .trim(),
        place: item.place ?? "-",
        phone: item.phone ?? "-",
        balance: Number(item.balance ?? 0),
      }));

      // Save to SQLite
      await saveCustomers(normalized);

      Alert.alert("Success", `Downloaded ${normalized.length} customers.`);
    } catch (err) {
      console.error("downloadCustomers error", err);
      Alert.alert("Network Error", "Unable to download customers.");
    } finally {
      setDownloading(false);
    }
  };

  const quickActions = [
    {
      icon: "business-outline",
      title: "About",
      description: "Company mission, values, and history",
      onPress: () => router.push("/company-info"),
    },
    {
      icon: "people-outline",
      title: "Customers",
      description: "Access the CRM tool",
      onPress: () => router.push("/customers"), // route to DebtorsScreen
      hasDownload: true, // flag to show download button
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top header */}
      <View style={styles.header}>
        {/* Optional: Add any header content here if needed */}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.logoContainer} />
        <View style={styles.greetingContainer} />

        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>

          <View style={styles.actionsList}>
            {quickActions.map((action, index) => (
              <View key={index} style={styles.actionCardWrapper}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name={action.icon} size={24} color="#0d3b6c" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>
                </TouchableOpacity>

                {/* Download button for Customers card */}
                {action.hasDownload && (
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={downloadCustomers}
                    disabled={downloading}
                    activeOpacity={0.7}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                        <Text style={styles.downloadButtonText}>Download Customers</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f9fa" },
  header: {
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scrollView: { flex: 1 },
  contentContainer: { padding: 24 },
  logoContainer: { marginBottom: 32 },
  greetingContainer: { marginBottom: 32 },
  actionsContainer: { flex: 1 },
  actionsTitle: { fontSize: 18, fontWeight: "600", color: "#0d3b6c", marginBottom: 16 },
  actionsList: { gap: 12 },
  actionCardWrapper: {
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#78c0f8ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4f5f7ff",
    height: 120,
  },
  iconContainer: { 
    backgroundColor: "rgba(251,251,243,0.48)", 
    borderRadius: 8, 
    padding: 8, 
    marginRight: 16 
  },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: "600", color: "#F1F5F9", marginBottom: 4 },
  actionDescription: { fontSize: 14, color: "#f8fafdff" },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#75b4f9ff",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default Company;