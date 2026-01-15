// src/screens/LicenseActivationScreen.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LicenseActivationScreen({ onActivationSuccess }) {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const requestAndroidPermissions = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: "Device ID Permission",
          message: "This app needs access to your device ID for license activation.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log("✅ Phone state permission granted");
        return true;
      } else {
        console.log("❌ Phone state permission denied");
        return false;
      }
    } catch (err) {
      console.warn("Permission request error:", err);
      return false;
    }
  };

  const getDeviceId = async () => {
    try {
      let id = null;

      if (Platform.OS === "android") {
        // Request permission first
        const hasPermission = await requestAndroidPermissions();

        if (!hasPermission) {
          throw new Error("Permission denied. Please grant phone state permission to use this app.");
        }

        // Try multiple methods to get Android ID

        // Method 1: Application.androidId
        id = Application.androidId;
        console.log("Method 1 - Application.androidId:", id);

        if (id && id !== "null" && id !== "" && id !== "unknown") {
          console.log("✅ Using Application.androidId:", id);
          return id;
        }

        // Method 2: Try getting from native module directly using Application.getAndroidId()
        if (Application.getAndroidId) {
          try {
            id = await Application.getAndroidId();
            console.log("Method 2 - Application.getAndroidId():", id);

            if (id && id !== "null" && id !== "" && id !== "unknown") {
              console.log("✅ Using Application.getAndroidId():", id);
              return id;
            }
          } catch (e) {
            console.log("Method 2 failed:", e);
          }
        }

        // Method 3: Check if we have a previously stored device ID
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("✅ Using stored device ID:", storedId);
          return storedId;
        }

        // If all methods fail, generate a UUID-based persistent ID
        console.log("⚠️ Android ID not available, generating persistent UUID");
        const uuid = 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function (c) {
          const r = Math.random() * 16 | 0;
          return r.toString(16);
        });

        // Store it permanently
        await AsyncStorage.setItem("device_hardware_id", uuid);
        console.log("✅ Generated and stored UUID:", uuid);
        return uuid;

      } else if (Platform.OS === "ios") {
        // Get iOS IDFV
        id = await Application.getIosIdForVendorAsync();

        console.log("iOS IDFV from Application:", id);

        if (id && id !== "null" && id !== "") {
          console.log("✅ Using iOS IDFV:", id);
          return id;
        }

        // Fallback for iOS - check stored ID
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("✅ Using stored iOS device ID:", storedId);
          return storedId;
        }

        // Generate UUID for iOS fallback
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

        await AsyncStorage.setItem("device_hardware_id", uuid);
        console.log("✅ Generated and stored iOS UUID:", uuid);
        return uuid;

      } else {
        throw new Error("Unsupported platform: " + Platform.OS);
      }

    } catch (error) {
      console.error("❌ CRITICAL ERROR getting device ID:", error);

      // Last resort - try to get stored ID
      try {
        const storedId = await AsyncStorage.getItem("device_hardware_id");
        if (storedId) {
          console.log("Using emergency stored device ID");
          return storedId;
        }
      } catch (e) {
        console.error("Storage error:", e);
      }

      Alert.alert(
        "Device ID Error",
        error.message || "Unable to get device identifier",
        [
          {
            text: "Retry",
            onPress: () => {
              initializeApp();
            }
          },
          {
            text: "Exit",
            style: "cancel"
          }
        ]
      );

      throw error;
    }
  };

  const getDeviceName = async () => {
    try {
      let name = "";

      if (Platform.OS === "android") {
        const brand = Device.brand || "";
        const modelName = Device.modelName || "";
        name = `${brand} ${modelName}`.trim() || "Android Device";
      } else if (Platform.OS === "ios") {
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

      console.log("=== DEVICE INFO ===");
      console.log("Platform:", Platform.OS);
      console.log("Device ID:", id);
      console.log("Device Name:", name);
      console.log("Is Physical Device:", Device.isDevice);
      console.log("===================");

      // Check if device is already registered in the API
      const isRegistered = await checkDeviceRegistration(id);

      if (isRegistered) {
        console.log("✅ Device already registered, skipping license screen");
        onActivationSuccess();
      } else {
        console.log("❌ Device not registered, showing license screen");
        setChecking(false);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      setChecking(false);
    }
  };

  const checkDeviceRegistration = async (deviceIdToCheck) => {
    try {
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/tasksas/`;

      console.log("Checking device registration for:", deviceIdToCheck);

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
            console.log("✅ Device found in customer:", customer.customer_name);

            // Store customer info for later use
            await AsyncStorage.setItem("licenseActivated", "true");
            await AsyncStorage.setItem("licenseKey", customer.license_key);
            await AsyncStorage.setItem("deviceId", deviceIdToCheck);
            await AsyncStorage.setItem("customerName", customer.customer_name);
            await AsyncStorage.setItem("projectName", data.project_name);
            await AsyncStorage.setItem("clientId", customer.client_id);

            console.log("✅ Stored client_id:", customer.client_id);

            return true;
          }
        }
      }

      console.log("❌ Device not found in any customer");
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
      Alert.alert("Error", "Device ID not available. Please restart the app.");
      return;
    }

    setLoading(true);

    try {
      // ============================================
      // STEP 1: Check if license key is valid (GET API)
      // ============================================
      const CHECK_LICENSE_API = `https://activate.imcbs.com/mobileapp/api/project/tasksas/`;

      console.log("Validating license key:", licenseKey.trim());
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
        await AsyncStorage.setItem("clientId", customer.client_id);

        console.log("✅ Device already registered");
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
      if (customer.license_summary.registered_devices >= customer.license_summary.max_devices) {
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
      const POST_DEVICE_API = `https://activate.imcbs.com/mobileapp/api/project/tasksas/license/register/`;

      console.log("📤 Registering new device...");
      console.log("Platform:", Platform.OS);
      console.log("Is Physical Device:", Device.isDevice);
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
        // Success - store activation status
        await AsyncStorage.setItem("licenseActivated", "true");
        await AsyncStorage.setItem("licenseKey", licenseKey.trim());
        await AsyncStorage.setItem("deviceId", deviceId);
        await AsyncStorage.setItem("customerName", customer.customer_name);
        await AsyncStorage.setItem("projectName", checkData.project_name);
        await AsyncStorage.setItem("clientId", customer.client_id);

        console.log("✅ Device registered successfully!");
        console.log("✅ Stored client_id:", customer.client_id);
        console.log("✅ Registered Device ID:", deviceId);

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

        console.error("❌ Registration failed:", errorMessage);

        Alert.alert(
          "Registration Failed",
          errorMessage
        );
      }
    } catch (error) {
      console.error("Activation error:", error);

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
          <View style={styles.deviceInfoRow}>
            <Text style={styles.deviceInfoLabel}>Device Type</Text>
            <Text style={styles.deviceInfoBadge}>
              {Device.isDevice ? "Physical Device" : "Emulator/Simulator"}
            </Text>
          </View>
          <Text style={styles.deviceInfoLabel}>Device ID</Text>
          <Text style={styles.deviceInfoText} numberOfLines={2}>
            {deviceId || "Loading..."}
          </Text>
          <Text style={[styles.deviceInfoLabel, { marginTop: 12 }]}>Device Name</Text>
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
  deviceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deviceInfoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  deviceInfoBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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