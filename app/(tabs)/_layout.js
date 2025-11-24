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
      <Tabs.Screen name="Company" />
      <Tabs.Screen name="Home" />
      <Tabs.Screen name="Dashboard" />
      
    </Tabs>
  );
}
