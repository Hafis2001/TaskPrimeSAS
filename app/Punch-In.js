// app/Punch-In.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../constants/theme";

export default function PunchInScreen() {
  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={Gradients.accent}
            style={styles.iconGradient}
          >
            <Ionicons name="finger-print-outline" size={64} color="#FFF" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Attendance Punch-In</Text>
        <Text style={styles.subtitle}>
          This feature is currently under development. Employee attendance tracking will be available here soon.
        </Text>

        <View style={styles.badge}>
          <Ionicons name="construct-outline" size={16} color={Colors.accent.main} />
          <Text style={styles.badgeText}>Coming Soon</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: Spacing['2xl'],
    borderRadius: BorderRadius['2xl'],
    ...Shadows.lg,
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: "800",
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent[50],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 8,
  },
  badgeText: {
    color: Colors.accent.main,
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
});
