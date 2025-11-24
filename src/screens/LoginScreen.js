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
    shadowColor: "#4fd1c5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value,
    shadowRadius: glow.value * 15,
    elevation: glow.value * 10,
  }));

  const handleLogin = async () => {
    if (!clientId || !username || !password) {
      Alert.alert("Missing Details", "Please fill all fields before logging in.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("https://taskprime.app/api/login/", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          client_id: clientId.trim(),
        }),
      });

      console.log("🔗 API Status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        Alert.alert("Login Failed", "Invalid credentials or server error.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log("✅ API Response:", data);

      if (data?.token) {
        const userData = {
          name: data?.username || username,
          clientId: data?.client_id || clientId,
          token: data.token,
        };

  await AsyncStorage.setItem("user", JSON.stringify(userData));
  await AsyncStorage.setItem("authToken", userData.token);
  console.log("✅ User data saved:", userData);

  // Navigate to the new bottom tabs company-info screen
  router.replace("/(tabs)/Company");
      } else {
        Alert.alert("Login Failed", "No token received from server.");
      }
    } catch (error) {
      console.error("🌐 Network Error:", error);
      Alert.alert(
        "Network Error",
        "Unable to connect to the server. Please check your internet connection and try again."
      );
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

        <View style={styles.inputContainer}>
          <Ionicons name="business-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Client ID"
            placeholderTextColor="#aaa"
            value={clientId}
            autoCapitalize="characters"
            onChangeText={(text) =>
              setClientId(text.toUpperCase().replace(/\s/g, ""))
            }
          />
        </View>

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
            style={styles.button}
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
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    width: width * 0.95,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    shadowColor: "#4fd1c5",
    height:650,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  titleAccent: {
    color: "#4fd1c5",
  },
  subtitle: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding:10,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  eyeIcon: {
    padding: 5,
  },
  buttonWrapper: {
    width: "100%",
    marginTop: 20,
    borderRadius: 15,
  },
  button: {
    backgroundColor: "#4fd1c5",
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  forgotText: {
    color: "#aaa",
    marginTop: 20,
    fontSize: 14,
  },
});
