import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, StatusBar, StyleSheet, View } from "react-native";
import CustomTabBar from "../components/CustomTabBar";



export default function TabsLayout() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const loginTimestamp = await AsyncStorage.getItem("loginTimestamp");
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (!loginTimestamp || (now - parseInt(loginTimestamp, 10) > twentyFourHours)) {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please login again.",
            [{
              text: "OK", onPress: async () => {
                await AsyncStorage.multiRemove(["authToken", "user", "loginTimestamp"]);
                router.replace("/");
              }
            }]
          );
        }
      } catch (e) {
        console.log("Session check error", e);
      }
    };

    checkSession();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
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
    </View>
  );
}

const styles = StyleSheet.create({});
