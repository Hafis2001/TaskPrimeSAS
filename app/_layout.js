// app/_layout.js (ROOT LAYOUT)
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <StatusBar style="light" backgroundColor="#191e41ff" />
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
