// app/_layout.js (ROOT LAYOUT)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const pathname = usePathname();
  const [isDemo, setIsDemo] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    const checkDemoStatus = async () => {
      try {
        const demoStatus = await AsyncStorage.getItem("isDemo");
        if (demoStatus === "true") {
          const expiry = await AsyncStorage.getItem("demoExpiresAt");

          if (expiry) {
            const now = new Date();
            const expDate = new Date(expiry);
            if (now > expDate) {
              // AUTO-LOGOUT LOGIC
              await AsyncStorage.multiRemove(["authToken", "user", "loginTimestamp", "isDemo", "demoExpiresAt", "licenseActivated", "licenseKey", "clientId"]); // Remove all sensitive keys
              setIsDemo(false);
              alert("Demo License Expired. Please contact administrator.");
              return; // Stop here
            }

            const diffTime = expDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setIsDemo(true);
            setExpiresAt(expiry);
            setDaysRemaining(diffDays > 0 ? diffDays : 0);
          }
        } else {
          setIsDemo(false);
        }
      } catch (e) {
        console.log("Demo check error", e);
      }
    };

    checkDemoStatus();
    // Poll every 2 seconds to check status (Robust way for root layout to know about login changes)
    const interval = setInterval(checkDemoStatus, 2000);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar style="light" backgroundColor="#191e41ff" />
        {isDemo && (
          <View style={styles.demoBannerWrapper}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: '#FF9800' }}>
              <View style={styles.demoBanner}>
                <Text style={styles.demoText}>DEMO MODE - Expires {expiresAt} ({daysRemaining} days remaining)</Text>
              </View>
            </SafeAreaView>
          </View>
        )}
        {isDemo && <View style={{ height: 60 }} />}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="Bank-Book" />
          <Stack.Screen name="bank-ledger" />
          <Stack.Screen name="Cash-Book" />
          <Stack.Screen name="cash-ledger" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  demoBannerWrapper: {
    backgroundColor: '#FF9800',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    width: '100%',
    paddingTop: 0,
    height: 60, // Fixed height for banner area
    justifyContent: 'flex-end', // Align text to bottom of this area (keeping it away from status bar if transparent)
  },
  demoBanner: {
    height: 30, // Actual banner height
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
});


