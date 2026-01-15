// src/screens/LoginScreen.js
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Glow animation
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2500 }), -1, true);
  }, []);

  const animatedGlow = useAnimatedStyle(() => ({
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.5,
    shadowRadius: glow.value * 15,
    elevation: glow.value * 10,
  }));

  // Load clientId
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("clientId");
        if (stored) setClientId(stored.trim().toUpperCase());
      } catch (e) { }
    })();
  }, []);

  // LICENSE VALIDATION
  const validateLicense = async () => {
    try {
      const stored = await AsyncStorage.getItem("clientId");
      const usedClientId = (stored || clientId || "").toString().trim().toUpperCase();

      if (!usedClientId) {
        return { ok: false, reason: "missing_client" };
      }

      const url = "https://activate.imcbs.com/mobileapp/api/project/tasksas/";
      const fetchUrl = `${url}?t=${Date.now()}`;

      let res;
      try {
        res = await fetch(fetchUrl, {
          method: "GET",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        });
      } catch (networkErr) {
        return { ok: false, reason: "network" };
      }

      if (!res.ok) return { ok: false, reason: "network" };

      let data;
      try {
        data = await res.json();
      } catch {
        return { ok: false, reason: "invalid_response" };
      }

      if (!Array.isArray(data.customers))
        return { ok: false, reason: "invalid_response" };

      const matched = data.customers.find(
        (c) => (c?.client_id ?? "").toString().trim().toUpperCase() === usedClientId
      );

      if (!matched) return { ok: false, reason: "not_found" };

      const status = (matched.status ?? "").toString().trim().toUpperCase();
      if (status !== "ACTIVE") return { ok: false, reason: "inactive" };

      try {
        await AsyncStorage.setItem(
          "licenseInfo",
          JSON.stringify({
            client_id: matched.client_id,
            license_key: matched.license_key ?? "",
            status: matched.status ?? "Active",
            package: matched.package ?? "",
          })
        );
      } catch { }

      return { ok: true, customer: matched };
    } catch {
      return { ok: false, reason: "network" };
    }
  };

  // LOGIN
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing Details", "Please enter username and password.");
      return;
    }

    setLoading(true);

    try {
      const stored = await AsyncStorage.getItem("clientId");
      if (stored) setClientId(stored.trim().toUpperCase());
    } catch { }

    const licenseResult = await validateLicense();

    if (!licenseResult.ok) {
      setLoading(false);

      switch (licenseResult.reason) {
        case "missing_client":
          Alert.alert("Client ID Missing", "Please select the client first.");
          break;
        case "network":
          Alert.alert("Network Error", "Check your internet connection.");
          break;
        case "invalid_response":
          Alert.alert("Server Error", "Unexpected server response.");
          break;
        case "not_found":
          Alert.alert("Invalid License", "Client not registered.");
          break;
        case "inactive":
          Alert.alert("License Inactive", "Contact administrator.");
          break;
        default:
          Alert.alert("License Error", "Unable to validate license.");
      }
      return;
    }

    const validClientId = licenseResult.customer.client_id;

    try {
      const loginResp = await fetch("https://tasksas.com/api/login/", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          client_id: validClientId,
        }),
      });

      if (!loginResp.ok) {
        Alert.alert("Login Failed", "Invalid username or password.");
        setLoading(false);
        return;
      }

      const loginData = await loginResp.json().catch(() => null);
      if (!loginData || !loginData.token) {
        Alert.alert("Login Failed", "Invalid response from server.");
        setLoading(false);
        return;
      }

      // Save allowed modules
      await AsyncStorage.setItem(
        "allowedMenuIds",
        JSON.stringify(loginData?.user?.allowedMenuIds || [])
      );

      await AsyncStorage.setItem("role", loginData?.user?.role ?? "");
      await AsyncStorage.setItem("accountcode", loginData?.user?.accountcode ?? "");
      await AsyncStorage.setItem("client_id", loginData?.user?.client_id ?? "");
      await AsyncStorage.setItem("username", loginData?.user?.username ?? "");

      await AsyncStorage.setItem("authToken", loginData.token);
      await AsyncStorage.setItem("user", JSON.stringify(loginData.user));

      router.replace("/(tabs)/Home");
    } catch (err) {
      Alert.alert("Network Error", "Unable to reach login server.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLicense = async () => {
    Alert.alert(
      "Remove License",
      "Are you sure you want to remove the license? You will need to activate again.",
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
    setLoading(true);
    try {
      // Get license info
      let licenseKey = "";
      let deviceId = "";

      try {
        const licenseInfoStr = await AsyncStorage.getItem("licenseInfo");
        if (licenseInfoStr) {
          const info = JSON.parse(licenseInfoStr);
          licenseKey = info.license_key;
        }
        // Fallback to direct storage
        if (!licenseKey) licenseKey = await AsyncStorage.getItem("licenseKey");

        deviceId = await AsyncStorage.getItem("deviceId");
      } catch (e) { console.log(e); }

      if (!licenseKey || !deviceId) {
        Alert.alert("Error", "License information not found.");
        setLoading(false);
        return;
      }

      const LOGOUT_API = "https://activate.imcbs.com/mobileapp/api/project/tasksas/logout/";

      const response = await fetch(LOGOUT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseKey, device_id: deviceId }),
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (e) { }

      if (response.ok && data?.success) {
        // Clear all data
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys);

        Alert.alert(
          "Success",
          "License removed.",
          [{ text: "OK", onPress: () => router.replace("/") }]
        );
      } else {
        Alert.alert("Error", data?.message || "Failed to remove license.");
      }

    } catch (error) {
      Alert.alert("Error", "Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={Gradients.background}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View entering={FadeInDown.springify()} style={[styles.formContainer, animatedGlow]}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              Task<Text style={styles.titleAccent}>SAS</Text>
            </Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor={Colors.text.tertiary}
                value={username}
                autoCapitalize="characters"
                onChangeText={(text) => setUsername(text.toUpperCase().replace(/\s/g, ""))}
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.text.tertiary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.text.tertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={Gradients.primary}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeLicenseButton} onPress={handleRemoveLicense}>
            <Text style={styles.removeLicenseText}>Remove License (Temporary)</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footerText}>Version 1.0.0 • TaskPrime SAS</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1, justifyContent: "center", alignItems: "center" },

  formContainer: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
    alignItems: "center",
    ...Shadows.xl,
  },

  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Spacing.md,
  },

  title: { fontSize: Typography.sizes['2xl'], fontWeight: "800", color: Colors.text.primary },
  titleAccent: { color: Colors.primary.main },
  subtitle: { fontSize: Typography.sizes.base, color: Colors.text.secondary, marginTop: 4 },

  inputWrapper: { width: '100%', marginBottom: Spacing.lg },
  label: { fontSize: Typography.sizes.sm, fontWeight: "600", color: Colors.text.primary, marginBottom: 8, marginLeft: 4 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    backgroundColor: Colors.neutral[50],
  },

  icon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.sizes.base,
    height: '100%',
  },
  eyeIcon: { padding: Spacing.sm },

  button: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
    ...Shadows.colored.primary,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: Typography.sizes.lg, fontWeight: "700" },

  buttonText: { color: "#fff", fontSize: Typography.sizes.lg, fontWeight: "700" },

  removeLicenseButton: { marginTop: Spacing.md, padding: Spacing.sm },
  removeLicenseText: { color: Colors.error.main, fontSize: Typography.sizes.xs, fontWeight: "600" },

  forgotButton: { marginTop: Spacing.lg, padding: Spacing.sm },
  forgotText: { color: Colors.primary.main, fontSize: Typography.sizes.sm, fontWeight: "600" },

  footerText: {
    position: 'absolute',
    bottom: Spacing.xl,
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.xs
  }
});
