import { Tabs } from "expo-router";
import CustomTabBar from "../components/CustomTabBar"; 
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="company-info" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="area-assign" />
      <Tabs.Screen name="user-management" />
    </Tabs>
  );
}
