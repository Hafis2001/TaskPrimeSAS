import React from "react";
import { View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function TestIcons() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <MaterialIcons name="menu" size={40} color="orange" />
    </View>
  );
}
