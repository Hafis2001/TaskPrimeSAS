// app/Order/Scanner.js
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";

export default function Scanner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flash, setFlash] = useState("off");

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      Alert.alert(
        "Camera Permission Required",
        "Please enable camera access in settings to scan barcodes.",
        [
          { text: "Cancel", onPress: () => router.back() },
          { text: "OK", onPress: () => router.back() },
        ]
      );
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    Vibration.vibrate(100);

    router.push({
      pathname: "/Order/OrderDetails",
      params: { ...params, scanned: String(data) },
    });
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        flash={flash}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["all"], // supports all formats in Expo SDK 54
        }}
      />

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.topText}>Scan Barcode</Text>

        {/* Flash Button */}
        <TouchableOpacity
          onPress={() =>
            setFlash((prev) => (prev === "off" ? "on" : "off"))
          }
          style={{ padding: 8 }}
        >
          <Ionicons
            name={flash === "off" ? "flash-off" : "flash"}
            size={26}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Scan Focus Box */}
      <View style={styles.scanBox} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    top: 50,
    left: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  permissionText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
  },

  // Scan box in center
  scanBox: {
    position: "absolute",
    top: "30%",
    left: "10%",
    width: "80%",
    height: "40%",
    borderColor: "#00ff00",
    borderWidth: 2,
    borderRadius: 12,
  },
});
