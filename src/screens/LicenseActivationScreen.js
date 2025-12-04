// src/screens/LicenseActivationScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";

export default function LicenseActivationScreen({ onActivationSuccess }) {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [checking, setChecking] = useState(true); // Initial check

  useEffect(() => {
    initializeApp();
  }, []);

  const getDeviceId = async () => {
    try {
      let id;
      if (Platform.OS === "android") {
        id = Application.androidId || `android_${Date.now()}`;
      } else if (Platform.OS === "ios") {
        id = await Application.getIosIdForVendorAsync() || `ios_${Date.now()}`;
      } else {
        // Fallback for other platforms
        id = await AsyncStorage.getItem("deviceId");
        if (!id) {
          id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem("deviceId", id);
        }
      }
      return id;
    } catch (error) {
      console.error("Error getting device ID:", error);
      return `device_${Date.now()}`;
    }
  };

  const getDeviceName = async () => {
    try {
      let name = "";
      
      if (Platform.OS === "android") {
        // Get device brand and model for Android
        const brand = Device.brand || "";
        const modelName = Device.modelName || "";
        name = `${brand} ${modelName}`.trim() || "Android Device";
      } else if (Platform.OS === "ios") {
        // Get device model for iOS
        const modelName = Device.modelName || "";
        name = modelName || "iOS Device";
      } else {
        name = "Unknown Device";
      }
      
      return name;
    } catch (error) {
      console.error("Error getting device name:", error);
      return "Unknown Device";
    }
  };

  const initializeApp = async () => {
    try {
      setChecking(true);
      
      // Get device ID
      const id = await getDeviceId();
      setDeviceId(id);
      
      // Get device name
      const name = await getDeviceName();
      setDeviceName(name);
      
      console.log("Checking if device is already registered...");
      console.log("Device ID:", id);
      console.log("Device Name:", name);
      
      // Check if device is already registered in the API
      const isRegistered = await checkDeviceRegistration(id);
      
      if (isRegistered) {
        console.log("Device already registered, skipping license screen");
        // Device is already registered, skip license screen
        onActivationSuccess();
      } else {
        console.log("Device not registered, showing license screen");
        // Device not registered, show license screen
        setChecking(false);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      // On error, show license screen
      setChecking(false);
    }
  };

  const checkDeviceRegistration = async (deviceIdToCheck) => {
    try {
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/sastest/`;

      const response = await fetch(CHECK_LICENSE_API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("API Response:", data);

      if (!response.ok || !data.success) {
        console.log("API check failed");
        return false;
      }

      if (!data.customers || data.customers.length === 0) {
        console.log("No customers found");
        return false;
      }

      // Check if this device is registered under any customer
      for (const customer of data.customers) {
        if (customer.registered_devices && customer.registered_devices.length > 0) {
          const deviceFound = customer.registered_devices.some(
            device => device.device_id === deviceIdToCheck
          );
          
          if (deviceFound) {
            console.log("Device found in customer:", customer.customer_name);
            
            // Store customer info for later use INCLUDING CLIENT_ID
            await AsyncStorage.setItem("licenseActivated", "true");
            await AsyncStorage.setItem("licenseKey", customer.license_key);
            await AsyncStorage.setItem("deviceId", deviceIdToCheck);
            await AsyncStorage.setItem("customerName", customer.customer_name);
            await AsyncStorage.setItem("projectName", data.project_name);
            await AsyncStorage.setItem("clientId", customer.client_id); // Store client_id
            
            return true;
          }
        }
      }

      console.log("Device not found in any customer");
      return false;
    } catch (error) {
      console.error("Error checking device registration:", error);
      return false;
    }
  };

  const handleActivate = async () => {
    // Validate license key
    if (!licenseKey.trim()) {
      Alert.alert("Error", "Please enter a license key");
      return;
    }

    if (!deviceId) {
      Alert.alert("Error", "Device ID not available. Please try again.");
      return;
    }

    setLoading(true);

    try {
      // ============================================
      // STEP 1: Check if license key is valid (GET API)
      // ============================================
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/sastest/`;

      console.log("Validating license key...");
      const checkResponse = await fetch(CHECK_LICENSE_API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const checkData = await checkResponse.json();
      console.log("Check response:", checkData);

      // Check if API call was successful
      if (!checkResponse.ok || !checkData.success) {
        Alert.alert(
          "Error",
          checkData.message || "Failed to validate license. Please try again."
        );
        setLoading(false);
        return;
      }

      // Check if customer exists
      if (!checkData.customers || checkData.customers.length === 0) {
        Alert.alert(
          "Invalid License",
          "No customer found for this license"
        );
        setLoading(false);
        return;
      }

      // Find the customer with matching license key
      const customer = checkData.customers.find(
        c => c.license_key === licenseKey.trim()
      );

      if (!customer) {
        Alert.alert(
          "Invalid License",
          "The license key you entered is not valid"
        );
        setLoading(false);
        return;
      }
      
      // Check if this device is already registered for this license
      const isAlreadyRegistered = customer.registered_devices?.some(
        device => device.device_id === deviceId
      );
      
      if (isAlreadyRegistered) {
        // Device already registered, just save and continue
        await AsyncStorage.setItem("licenseActivated", "true");
        await AsyncStorage.setItem("licenseKey", licenseKey.trim());
        await AsyncStorage.setItem("deviceId", deviceId);
        await AsyncStorage.setItem("customerName", customer.customer_name);
        await AsyncStorage.setItem("projectName", checkData.project_name);
        await AsyncStorage.setItem("clientId", customer.client_id); // Store client_id
        
        console.log("✅ Stored client_id:", customer.client_id);
        
        Alert.alert(
          "Already Registered",
          `Welcome back ${customer.customer_name}!\nThis device is already registered.`,
          [
            {
              text: "Continue",
              onPress: () => onActivationSuccess(),
            },
          ]
        );
        setLoading(false);
        return;
      }
      
      // Check if device limit reached
      if (customer.license_summary.registered_count >= customer.license_summary.max_devices) {
        Alert.alert(
          "License Limit Reached",
          `Maximum devices (${customer.license_summary.max_devices}) already registered for this license`
        );
        setLoading(false);
        return;
      }

      // ============================================
      // STEP 2: Register device (POST API)
      // ============================================
      const POST_DEVICE_API = `https://activate.imcbs.com/mobileapp/api/project/sastest/license/register/`;

      console.log("Registering new device...");
      console.log("License Key:", licenseKey.trim());
      console.log("Device ID:", deviceId);
      console.log("Device Name:", deviceName);

      const deviceResponse = await fetch(POST_DEVICE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          device_id: deviceId,
          device_name: deviceName,
        }),
      });

      const responseText = await deviceResponse.text();
      console.log("Raw response:", responseText);

      let deviceData;
      try {
        deviceData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        Alert.alert(
          "Error",
          "Invalid response from server. Please contact support."
        );
        setLoading(false);
        return;
      }

      console.log("Device registration response:", deviceData);

      if (deviceResponse.ok && deviceData.success) {
        // Success - store activation status permanently INCLUDING CLIENT_ID
        await AsyncStorage.setItem("licenseActivated", "true");
        await AsyncStorage.setItem("licenseKey", licenseKey.trim());
        await AsyncStorage.setItem("deviceId", deviceId);
        await AsyncStorage.setItem("customerName", customer.customer_name);
        await AsyncStorage.setItem("projectName", checkData.project_name);
        await AsyncStorage.setItem("clientId", customer.client_id); // Store client_id
        
        console.log("✅ Stored client_id:", customer.client_id);
        
        Alert.alert(
          "Success",
          `Welcome ${customer.customer_name}!\nDevice registered successfully.`,
          [
            {
              text: "Continue",
              onPress: () => onActivationSuccess(),
            },
          ]
        );
      } else {
        // Handle error from device registration API
        const errorMessage = deviceData.message 
          || deviceData.error 
          || deviceData.detail
          || "Failed to register device. Please try again.";
        
        console.error("Registration failed:", errorMessage);
        
        Alert.alert(
          "Registration Failed",
          errorMessage
        );
      }
    } catch (error) {
      console.error("Activation error:", error);
      
      // More detailed error message
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

  // Show loading screen while checking registration
  if (checking) {
    return (
      <LinearGradient
        colors={["#ffffff", "#171635ff"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <View style={styles.checkingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.checkingText}>Checking registration...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#ffffff", "#171635ff"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Activate License</Text>
        <Text style={styles.subtitle}>Enter your license key to continue</Text>

        {/* Device Info Display */}
        <View style={styles.deviceInfoContainer}>
          <Text style={styles.deviceInfoLabel}>Device ID</Text>
          <Text style={styles.deviceInfoText} numberOfLines={1}>
            {deviceId || "Loading..."}
          </Text>
          <Text style={styles.deviceInfoLabel} >Device Name</Text>
          <Text style={styles.deviceInfoText} numberOfLines={1}>
            {deviceName || "Loading..."}
          </Text>
        </View>

        {/* License Key Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>License Key</Text>
          <TextInput
            style={styles.input}
            value={licenseKey}
            onChangeText={setLicenseKey}
            placeholder="Enter license key"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        {/* Activate Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleActivate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>Validating...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Activate License</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By activating, you agree to our terms of service
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  checkingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  checkingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#ddd",
    textAlign: "center",
    marginBottom: 40,
  },
  deviceInfoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  deviceInfoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  deviceInfoText: {
    fontSize: 12,
    color: "#ddd",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: "#171635",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    backgroundColor: "#81C784",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footerText: {
    fontSize: 12,
    color: "#bbb",
    textAlign: "center",
  },
});