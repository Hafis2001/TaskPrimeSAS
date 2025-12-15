import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";


const tabs = [
  { name: "Company", icon: "business", label: "Company" },
  { name: "Home", icon: "people", label: "Home" }, 
  { name: "Dashboard", icon: "grid-sharp", label: "Dashboard" },
 
];

export default function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.container}>
      {/* Background curved bar */}
      <View style={styles.tabBackground} />

      {tabs.map((tab, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: state.routes[index].key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={onPress}
            style={styles.tabButton}
          >
            {/* Floating active icon */}
            {isFocused ? (
              <View style={styles.activeBubble}>
                <Ionicons name={tab.icon} size={26} color="#f4f8f7ff" />
              </View>
            ) : (
              <Ionicons name={tab.icon} size={22} color="#9aa4b2" />
            )}

            {!isFocused && <Text style={styles.label}>{tab.label}</Text>}
            {isFocused && <Text style={styles.activeLabel}>{tab.label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    backgroundColor: "#ececeaff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 12,
    marginBottom: 56,
  },

  tabBackground: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 70,
    backgroundColor: "#e9e4ceff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    
  },

  tabButton: {
    alignItems: "center",
    flex: 1,
  },

  activeBubble: {
    width: 55,
    height: 55,
    borderRadius: 40,
    backgroundColor: "#78c0f8ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    elevation: 8,
    shadowColor: "#b1b6b6ff",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },

  label: {
    fontSize: 12,
    color: "#9aa4b2",
    marginTop: 4,
  },

  activeLabel: {
    fontSize: 12,
    color: "#4fd1c5",
    marginTop: 4,
    fontWeight: "600",
  },
});
