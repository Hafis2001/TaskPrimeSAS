// app/(tabs)/Company.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";
import dbService from "../../src/services/database";

const Company = () => {
  const router = useRouter();
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    loadCustomerCount();
  }, []);

  const loadCustomerCount = async () => {
    try {
      await dbService.init();
      const stats = await dbService.getDataStats();
      setCustomersCount(stats?.customers || 0);
    } catch (error) {
      console.error('[Company] Error loading customer count:', error);
    }
  };

  const quickActions = [
    {
      icon: "business",
      title: "About Company",
      description: "Company mission, values, and history",
      onPress: () => router.push("/company-info"),
      color: Colors.primary.main,
      bg: Colors.primary[50],
    },
    {
      icon: "people",
      title: "Customers",
      description: `${customersCount} registered customers`,
      onPress: () => router.push("/customers"),
      color: Colors.secondary.main,
      bg: Colors.secondary[50],
    }
  ];

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Company</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <View style={styles.bannerContainer}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <View style={styles.bannerContent}>
                <View style={styles.bannerIcon}>
                  <Ionicons name="briefcase" size={32} color={Colors.primary.main} />
                </View>
                <View>
                  <Text style={styles.bannerTitle}>Business Center</Text>
                  <Text style={styles.bannerSubtitle}>Manage your company data</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.listContainer}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionCard}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>

                  <View style={styles.cardContent}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>

                  <View style={styles.arrowContainer}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.neutral[400]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* New Attendance Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance</Text>
            <View style={styles.attendanceCard}>
              <TouchableOpacity
                style={styles.attendanceItem}
                activeOpacity={0.7}
                onPress={() => router.push("/location-capture")}
              >
                <View style={[styles.attendanceIcon, { backgroundColor: Colors.warning[50] }]}>
                  <Ionicons name="location" size={24} color={Colors.warning.main} />
                </View>
                <Text style={styles.attendanceLabel}>Location Capture</Text>
              </TouchableOpacity>

              <View style={styles.attendanceDivider} />

              <TouchableOpacity
                style={styles.attendanceItem}
                activeOpacity={0.7}
                onPress={() => router.push("/Punch-In")}
              >
                <View style={[styles.attendanceIcon, { backgroundColor: Colors.success[50] }]}>
                  <Ionicons name="finger-print" size={24} color={Colors.success.main} />
                </View>
                <Text style={styles.attendanceLabel}>Punch In</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={Colors.primary.main} />
              <Text style={styles.infoText}>
                Use the Home screen to download or sync the latest company data.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    marginTop: 35,
    paddingBottom: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  pageTitle: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text.primary,
  },
  scrollView: {
    flex: 1
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 100, // Space for tab bar
  },
  bannerContainer: {
    marginBottom: Spacing.xl,
  },
  banner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  bannerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  bannerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  listContainer: {
    gap: Spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  actionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
  },
  arrowContainer: {
    marginLeft: Spacing.sm,
  },
  infoSection: {
    marginTop: Spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.primary[50], // Very light purple
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.primary[900],
    lineHeight: 20,
  },
  attendanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  attendanceItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  attendanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  attendanceDivider: {
    width: 1,
    height: '60%',
    backgroundColor: Colors.border.light,
  }
});

export default Company;