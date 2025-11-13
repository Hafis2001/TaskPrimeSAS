import { useEffect, useState } from "react";
import { View, Image, StyleSheet, Animated } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import LoginScreen from "../src/screens/LoginScreen";

SplashScreen.preventAutoHideAsync(); // Keep splash visible

export default function Index() {
  const [appReady, setAppReady] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0)); // For fade animation

  useEffect(() => {
    const prepare = async () => {
      // Simulate loading tasks (fonts, auth, etc.)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Animate fade-in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        SplashScreen.hideAsync();
        setAppReady(true);
      });
    };

    prepare();
  }, []);

  if (!appReady) {
    // Show gradient splash with fade
    return (
      <LinearGradient
        colors={["#ffffff", "#171635ff"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
          <Image
            source={require("../assets/images/taskprime1.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </LinearGradient>
    );
  }

  return <LoginScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
});
