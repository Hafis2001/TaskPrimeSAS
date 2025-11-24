// app/dashboard.js (or app/dashboard/index.js)
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";


export default function DashboardScreen() {
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to your Collection 🎯</Text>

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1c173aff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f9f4f0ff",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#f6f1eeff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
