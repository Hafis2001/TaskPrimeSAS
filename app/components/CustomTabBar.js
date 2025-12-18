// app/components/CustomTabBar.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows } from "../../constants/theme";

const tabs = [
  { name: "Company", icon: "business", label: "Company" },
  { name: "Home", icon: "home", label: "Home" },
  { name: "Dashboard", icon: "grid", label: "Dashboard" },
];

export default function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.container}>
      {/* Background with shadow */}
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
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={descriptors[state.routes[index].key].options.tabBarAccessibilityLabel}
            testID={descriptors[state.routes[index].key].options.tabBarTestID}
          >
            {/* Active Indicator */}
            {isFocused ? (
              <LinearGradient
                colors={Gradients.primary}
                style={styles.activeBubble}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={tab.icon} size={24} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <View style={styles.inactiveIcon}>
                <Ionicons name={tab.icon + "-outline"} size={26} color={Colors.text.tertiary} />
              </View>
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
    height: 85,
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginBottom: 10,
  },

  tabBackground: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 85,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    ...Shadows.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },

  tabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: 'flex-end',
    height: 70,
  },

  activeBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    ...Shadows.md,
    transform: [{ translateY: -12 }], // Float up slightly
  },

  inactiveIcon: {
    marginBottom: 4,
  },

  label: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 2,
    fontWeight: '500',
  },

  activeLabel: {
    fontSize: 11,
    color: Colors.primary.main,
    marginTop: -8, // Adjust for floating bubble
    marginBottom: 4,
    fontWeight: "700",
  },
});
