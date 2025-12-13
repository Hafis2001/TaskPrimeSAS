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
    shadowColor: "#FF8C42",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value,
    shadowRadius: glow.value * 15,
    elevation: glow.value * 10,
  }));

  // Load clientId
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("clientId");
        if (stored) setClientId(stored.trim().toUpperCase());
      } catch (e) {}
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

      const url = "https://activate.imcbs.com/mobileapp/api/project/sastest/";
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
      } catch {}

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
    } catch {}

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

  return (
    <LinearGradient
      colors={["#FFF7F0", "#FFEDE0", "#FFF2E5"]} // VERY PALE WHITE + ORANGE
      style={styles.container}
    >
      <Animated.View style={[styles.formContainer, animatedGlow]}>
        <Text style={styles.title}>
          Co-<Text style={styles.titleAccent}>operate</Text>
        </Text>
        <Text style={styles.subtitle}>Login</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#555" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#777"
            value={username}
            autoCapitalize="characters"
            onChangeText={(text) => setUsername(text.toUpperCase().replace(/\s/g, ""))}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#555" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#777"
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
              color="#555"
            />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.buttonWrapper, animatedGlow]}>
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.85 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
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
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    height: 650,
  },

  title: { fontSize: 30, fontWeight: "700", color: "#333" },
  titleAccent: { color: "#FF8C42" },
  subtitle: { fontSize: 24, color: "#444", marginBottom: 40 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 40,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 10,
  },

  icon: { marginRight: 10 },
  input: {
    flex: 1,
    color: "#333",
    fontSize: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  eyeIcon: { padding: 5 },

  buttonWrapper: { width: "100%", marginTop: 20, borderRadius: 15 },
  button: {
    backgroundColor: "#FF8C42",
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  forgotText: { color: "#555", marginTop: 20, fontSize: 14 },
});
