// Company.js - Updated to use main database service
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import dbService from "../../src/services/database";

const Company = () => {
  const router = useRouter();
  const [customersCount, setCustomersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load customer count from database
  useEffect(() => {
    loadCustomerCount();
  }, []);

  const loadCustomerCount = async () => {
    try {
      await dbService.init();
      const stats = await dbService.getDataStats();
      setCustomersCount(stats?.customers || 0);
    } catch (error) {
      console.error('[Company] Error loading customer count:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          await AsyncStorage.removeItem("authToken");
          router.replace("/LoginScreen");
        },
      },
    ]);
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
      description: `View ${customersCount} customers in database`,
      onPress: () => router.push("/customers"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
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
              <TouchableOpacity
                key={index}
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
                <Ionicons name="chevron-forward" size={20} color="#F1F5F9" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Info message */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color="#1976D2" />
            <Text style={styles.infoText}>
              To download or sync customer data, go to Home screen and click the Download/Sync button
            </Text>
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
  actionsList: { gap: 12, marginBottom: 20 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#78c0f8ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4f5f7ff",
    minHeight: 80,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 16,
  },
});

export default Company;