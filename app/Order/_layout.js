import { Stack } from "expo-router";

export default function OrderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Order" />
      <Stack.Screen name="OrderDetails" />
      <Stack.Screen name="Scanner" />
    </Stack>
  );
}
