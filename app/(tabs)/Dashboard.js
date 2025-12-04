// app/dashboard.js (or wherever your Dashboard is)
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator 
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function DashboardScreen() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedLicenseKey = await AsyncStorage.getItem("licenseKey");
      const storedDeviceId = await AsyncStorage.getItem("deviceId");
      const storedCustomerName = await AsyncStorage.getItem("customerName");

      setLicenseKey(storedLicenseKey || "");
      setDeviceId(storedDeviceId || "");
      setCustomerName(storedCustomerName || "");
    } catch (error) {
      console.error("Error loading stored data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleRemoveLicense = async () => {
    Alert.alert(
      "Remove License",
      "Are you sure you want to remove this license? You will need to activate again and login.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: removeLicense,
        },
      ]
    );
  };

  const removeLicense = async () => {
    if (!licenseKey || !deviceId) {
      Alert.alert("Error", "License information not found");
      return;
    }

    setLoading(true);

    try {
      const LOGOUT_API = "https://activate.imcbs.com/mobileapp/api/project/sastest/logout/";

      console.log("Removing license...");
      console.log("License Key:", licenseKey);
      console.log("Device ID:", deviceId);

      const response = await fetch(LOGOUT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId,
        }),
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        Alert.alert(
          "Error",
          "Invalid response from server. Please contact support."
        );
        setLoading(false);
        return;
      }

      console.log("Logout response:", data);

      if (response.ok && data.success) {
        // Clear ALL stored data including user session
        await AsyncStorage.multiRemove([
          "licenseActivated",
          "licenseKey",
          "deviceId",
          "customerName",
          "projectName",
          "clientId",
          "user",
          "authToken",
          "licenseInfo",
        ]);

        console.log("✅ All data cleared successfully");

        Alert.alert(
          "Success",
          "License removed successfully. You will be redirected to activation.",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigate back to index (license screen)
                router.replace("/");
              },
            },
          ]
        );
      } else {
        // Handle error from logout API
        const errorMessage = data.message 
          || data.error 
          || data.detail
          || "Failed to remove license. Please try again.";
        
        console.error("Logout failed:", errorMessage);
        
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      console.error("Remove license error:", error);
      
      let errorMessage = "Network error. Please check your connection and try again.";
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      if (error.name === "TypeError" && error.message.includes("Network request failed")) {
        errorMessage = "Cannot connect to server. Please check your internet connection.";
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to your Dashboard 🎯</Text>

      {/* License Information Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>License Information</Text>
        
        {customerName ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue}>{customerName}</Text>
          </View>
        ) : null}
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>License Key:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {licenseKey || "Not available"}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device ID:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {deviceId || "Not available"}
          </Text>
        </View>
      </View>

      {/* Remove License Button */}
      <TouchableOpacity
        style={[styles.removeButton, loading && styles.buttonDisabled]}
        onPress={handleRemoveLicense}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>Removing...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Remove License</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1c173aff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f9f4f0ff",
    marginBottom: 30,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f9f4f0ff",
    marginBottom: 15,
    textAlign: "center",
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#bbb",
    marginBottom: 4,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: "#f9f4f0ff",
    fontWeight: "500",
  },
  removeButton: {
    backgroundColor: "#f44336",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    backgroundColor: "#e57373",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});