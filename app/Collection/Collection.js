// app/dashboard.js (or app/dashboard/index.js)
import React, { useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  BackHandler
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useRouter } from 'expo-router';

export default function CollectionScreen() {

  const router = useRouter();

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const sections = [
    {
      id: 1,
      title: "Add Collection",
      description: "Create new collection entries",
      icon: "add-circle-outline",
      color: "#0b8a2f",
      bgColor: "rgba(11, 138, 47, 0.12)",
      onPress: () => { router.push("./AddCollection");
        // Navigate to add collection screen
        console.log("Navigate to Add Collection");
      },
    },
    {
      id: 2,
      title: "Upload",
      description: "Upload collection data",
      icon: "cloud-upload-outline",
      color: "#ff9500",
      bgColor: "rgba(255, 149, 0, 0.12)",
      onPress: () => {router.push("./Upload");
        // Navigate to upload screen
        console.log("Navigate to Upload");
      },
    },
    {
      id: 3,
      title: "View Collection",
      description: "Browse all collections",
      icon: "eye-outline",
      color: "#0d3b6c",
      bgColor: "rgba(13, 59, 108, 0.12)",
      onPress: () => {router.push("./View-Collection");
        // Navigate to view collection screen
        console.log("Navigate to View Collection");
      },
    },
  ];

  return (
    <LinearGradient colors={["#FFF7F0", "#FFEDE0"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header with Back Button */}
        <Animated.View entering={FadeInDown.delay(50)} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0d3b6c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Collection Dashboard</Text>
          <View style={styles.headerRight} />
        </Animated.View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Section */}
          {/* <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
            <Text style={styles.greeting}>Welcome Back! 👋</Text>
            <Text style={styles.title}>Collection Dashboard</Text>
            <Text style={styles.subtitle}>Manage your collections efficiently</Text>
          </Animated.View> */}

          {/* Stats Cards */}
          {/* <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(11, 138, 47, 0.12)" }]}>
                <Ionicons name="wallet-outline" size={24} color="#0b8a2f" />
              </View>
              <Text style={styles.statValue}>₹0</Text>
              <Text style={styles.statLabel}>Total Collected</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(255, 59, 48, 0.12)" }]}>
                <Ionicons name="time-outline" size={24} color="#ff3b30" />
              </View>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </Animated.View> */}

          {/* Quick Actions Section */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <View style={styles.cardsContainer}>
              {sections.map((section, index) => (
                <Animated.View
                  key={section.id}
                  entering={FadeInUp.delay(400 + index * 100)}
                >
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={section.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: section.bgColor }]}>
                      <Ionicons name={section.icon} size={32} color={section.color} />
                    </View>
                    
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{section.title}</Text>
                      <Text style={styles.cardDescription}>{section.description}</Text>
                    </View>

                    <View style={styles.arrowContainer}>
                      <Ionicons name="chevron-forward" size={20} color="#6b7c8a" />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* Recent Activity Section */}
          <Animated.View entering={FadeInUp.delay(700)} style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color="#9aa4b2" />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>Your collection activities will appear here</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(13, 59, 108, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0d3b6c",
  },
  headerRight: {
    width: 32,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 16,
    color: "#55606a",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0d3b6c",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7c8a",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef6ff",
    shadowColor: "#0d3b6c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0d3b6c",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7c8a",
    fontWeight: "500",
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0d3b6c",
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eef6ff",
    shadowColor: "#0d3b6c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 2,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b2a44",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "#6b7c8a",
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(13, 59, 108, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  recentSection: {
    marginBottom: 20,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: "#0d3b6c",
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef6ff",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#55606a",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9aa4b2",
    textAlign: "center",
  },
});