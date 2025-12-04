import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();

  const [clientId, setClientId] = useState(""); // loaded hidden ID from previous page
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Glow animation (unchanged)
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2500 }), -1, true);
  }, []);
  const animatedGlow = useAnimatedStyle(() => ({
    shadowColor: "#4fd1c5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value,
    shadowRadius: glow.value * 15,
    elevation: glow.value * 10,
  }));

  // Load clientId once on mount (kept for quick access)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("clientId");
        console.log("Initial loaded clientId:", stored);
        if (stored) setClientId(stored.trim().toUpperCase());
      } catch (e) {
        console.warn("Error reading clientId from storage on mount:", e);
      }
    })();
  }, []);

  /**
   * validateLicense()
   *
   * - Loads the latest clientId from AsyncStorage (ensures freshest value)
   * - Fetches the license API (adds timestamp to prevent caching)
   * - Finds the matching customer by client_id (case-insensitive, trimmed)
   * - Returns:
   *    { ok: true, customer }  -> license active and matched
   *    { ok: false, reason: 'missing_client' / 'not_found' / 'inactive' / 'network' / 'invalid_response' }
   */
  const validateLicense = async () => {
    try {
      // 1) ensure we have the most recent clientId from storage
      const stored = await AsyncStorage.getItem("clientId");
      const usedClientId = (stored || clientId || "").toString().trim().toUpperCase();
      console.log("VALIDATE: using clientId from storage:", usedClientId);

      if (!usedClientId) {
        return { ok: false, reason: "missing_client" };
      }

      // 2) fetch license API with timestamp to avoid stale/cached responses
      const url = "https://activate.imcbs.com/mobileapp/api/project/sastest/";
      const fetchUrl = `${url}?t=${Date.now()}`; // prevent caching
      let res;
      try {
        res = await fetch(fetchUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        });
      } catch (networkErr) {
        console.error("Network error when calling license API:", networkErr);
        return { ok: false, reason: "network", error: networkErr };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("License API non-ok response:", res.status, text);
        return { ok: false, reason: "network", status: res.status, body: text };
      }

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error("Failed to parse license API JSON:", parseErr);
        return { ok: false, reason: "invalid_response", error: parseErr };
      }

      console.log("License API response (truncated):", {
        customersLength: Array.isArray(data.customers) ? data.customers.length : 0,
      });

      if (!Array.isArray(data.customers)) {
        console.error("License API response missing customers array:", data);
        return { ok: false, reason: "invalid_response" };
      }

      // 3) find matching customer (case-insensitive, trimmed)
      const normalizedClient = usedClientId;
      const matched = data.customers.find((c) => {
        const cid = (c?.client_id ?? "").toString().trim().toUpperCase();
        return cid === normalizedClient;
      });

      console.log("Matched customer:", matched);

      if (!matched) {
        return { ok: false, reason: "not_found" };
      }

      // 4) check status
      const status = (matched.status ?? "").toString().trim().toUpperCase();
      if (status !== "ACTIVE") {
        return { ok: false, reason: "inactive", customer: matched };
      }

      // 5) success - optionally store license info
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
      } catch (e) {
        console.warn("Failed to save licenseInfo:", e);
      }

      return { ok: true, customer: matched };
    } catch (err) {
      console.error("Unexpected error validating license:", err);
      return { ok: false, reason: "network", error: err };
    }
  };

  // handleLogin: validates license first, blocks if inactive / not found, only then calls login API
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing Details", "Please enter username and password.");
      return;
    }

    setLoading(true);

    // Ensure we refresh clientId from storage to avoid stale value
    try {
      const stored = await AsyncStorage.getItem("clientId");
      if (stored) setClientId(stored.trim().toUpperCase());
    } catch (e) {
      console.warn("Failed to refresh clientId from storage before login:", e);
    }

    // Validate license
    const licenseResult = await validateLicense();

    console.log("License validation result:", licenseResult);

    if (!licenseResult.ok) {
      setLoading(false);

      // Friendly, explicit messages for each failure reason
      switch (licenseResult.reason) {
        case "missing_client":
          Alert.alert(
            "Client ID Missing",
            "Client ID not available. Please go back and select the customer / client first."
          );
          break;
        case "network":
          Alert.alert(
            "Network Error",
            "Unable to validate license. Check your internet connection and try again."
          );
          break;
        case "invalid_response":
          Alert.alert(
            "Server Error",
            "License server returned unexpected data. Contact administrator."
          );
          break;
        case "not_found":
          Alert.alert(
            "Invalid License",
            "Your client ID is not registered. Contact administrator."
          );
          break;
        case "inactive":
          Alert.alert(
            "License Inactive",
            "Your license is inactive. Contact your administrator."
          );
          break;
        default:
          Alert.alert("License Error", "Unable to validate license.");
      }

      return; // HARD STOP — do not proceed to login
    }

    // At this point licenseResult.ok === true and license is active
    // Proceed to login API call
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
          client_id: clientId.trim(),
        }),
      });

      if (!loginResp.ok) {
        const body = await loginResp.text().catch(() => "");
        console.error("Login API non-ok:", loginResp.status, body);
        Alert.alert("Login Failed", "Invalid username or password.");
        setLoading(false);
        return;
      }

      const loginData = await loginResp.json().catch((e) => {
        console.error("Failed parsing login response:", e);
        return null;
      });

      if (!loginData) {
        Alert.alert("Login Failed", "Invalid response from login server.");
        setLoading(false);
        return;
      }

      if (loginData?.token) {
        const userData = {
          name: loginData?.username || username,
          clientId,
          token: loginData.token,
        };

        await AsyncStorage.setItem("user", JSON.stringify(userData));
        await AsyncStorage.setItem("authToken", userData.token);

        // navigate to app
        router.replace("/(tabs)/Company");
      } else {
        Alert.alert("Login Failed", "No token received from server.");
      }
    } catch (err) {
      console.error("Network error during login:", err);
      Alert.alert("Network Error", "Unable to reach login server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0b132b", "#1c2541", "#3a506b"]}
      style={styles.container}
    >
      <Animated.View style={[styles.formContainer, animatedGlow]}>
        <Text style={styles.title}>
          Co-<Text style={styles.titleAccent}>operate</Text>
        </Text>
        <Text style={styles.subtitle}>Login</Text>

        {/* Client ID intentionally hidden — loaded from storage */}

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#aaa"
            value={username}
            autoCapitalize="characters"
            onChangeText={(text) =>
              setUsername(text.toUpperCase().replace(/\s/g, ""))
            }
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
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
              color="#aaa"
            />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.buttonWrapper, animatedGlow]}>
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.85 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  formContainer: {
    width: width * 0.95,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    height: 650,
  },
  title: { fontSize: 30, fontWeight: "700", color: "#fff" },
  titleAccent: { color: "#4fd1c5" },
  subtitle: { fontSize: 24, color: "#fff", marginBottom: 40 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 10,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16, paddingVertical: Platform.OS === "ios" ? 12 : 10 },
  eyeIcon: { padding: 5 },
  buttonWrapper: { width: "100%", marginTop: 20, borderRadius: 15 },
  button: {
    backgroundColor: "#4fd1c5",
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  forgotText: { color: "#aaa", marginTop: 20, fontSize: 14 },
});
