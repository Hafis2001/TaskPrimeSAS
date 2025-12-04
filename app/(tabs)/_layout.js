import { Tabs } from "expo-router";
import CustomTabBar from "../components/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        marginBottom: 25,
      }}
    >
      <Tabs.Screen name="Company" />
      <Tabs.Screen name="Home" />
      <Tabs.Screen name="Dashboard" />
      
    </Tabs>
  );
}
