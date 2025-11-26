// app/Order/Scanner.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Scanner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const onBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    // navigate back to OrderDetails with scanned param
    router.push({
      pathname: "/Order/OrderDetails",
      params: { ...params, scanned: String(data) },
    });
  };

  if (hasPermission === null) {
    return <View style={styles.center}><Text>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.center}><Text>No camera permission</Text></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <BarCodeScanner onBarCodeScanned={onBarCodeScanned} style={{ flex: 1 }} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topText}>Scan Barcode</Text>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", top: 40, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topText: { color: "#fff", fontWeight: "700", fontSize: 18 },
});
