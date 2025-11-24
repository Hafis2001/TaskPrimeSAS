// Company.js - React Native version
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Company = () => {
  const router = useRouter(); // Router inside component

  // 🔥 Logout confirmation popup
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => router.replace("/LoginScreen") // ⬅ Navigate to LoginScreen
        },
      ]
    );
  };

  const quickActions = [
    {
      icon: 'business-outline',
      title: 'About',
      description: 'Company mission, values, and history',
      onPress: () => router.push("/company-info"),
    },
    {
      icon: 'people-outline',
      title: 'Customers',
      description: 'Access the CRM tool',
      onPress: () => router.push("/customers"),
    },
    {
      icon: 'location-outline',
      title: 'Area Assign',
      description: 'View and manage regional assignments',
      onPress: () => router.push("/area-assign"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🔥 Top Bar with Logout Icon */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}></Text>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={26} color="#F1F5F9" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        
        {/* Logo */}
        <View style={styles.logoContainer}></View>

        {/* Greeting */}
        <View style={styles.greetingContainer}></View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>

          <View style={styles.actionsList}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name={action.icon} size={24} color="#60A5FA" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ===================== STYLES =====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07121fff',
  },

  // 🔥 Header with logout icon
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
  },

  logoutButton: {
    padding: 6,
  },

  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },

  logoContainer: {
    marginBottom: 32,
  },
  greetingContainer: {
    marginBottom: 32,
  },

  actionsContainer: {
    flex: 1,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 16,
  },

  actionsList: {
    gap: 12,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2D3748',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },

  iconContainer: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginRight: 16,
  },

  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

export default Company;
