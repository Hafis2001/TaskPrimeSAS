import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../constants/theme";
import dbService from "../src/services/database";

const { width } = Dimensions.get('window');
const API_DEBTORS = "https://tasksas.com/api/debtors/get-debtors/";

// Haversine formula to calculate distance in meters
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

export default function PunchInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [punchedInCustomer, setPunchedInCustomer] = useState(null);

  // Selfie State
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
      getCurrentLocation();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      await dbService.init();

      // 1. Fetch Customers (API Preference to match Location Capture)
      let allCustomers = [];
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          console.log("[PunchIn] Fetching customers from API...");
          const response = await fetch(API_DEBTORS, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await response.json();

          if (Array.isArray(json)) allCustomers = json;
          else if (json.data && Array.isArray(json.data)) allCustomers = json.data;
          else if (json.debtors && Array.isArray(json.debtors)) allCustomers = json.debtors;

          console.log(`[PunchIn] Fetched ${allCustomers.length} customers from API`);
        }
      } catch (e) {
        console.warn("[PunchIn] API fetch failed, falling back to local DB", e);
      }

      // Fallback to local DB if API failed or returned nothing
      if (allCustomers.length === 0) {
        console.log("[PunchIn] Using local DB customers");
        allCustomers = await dbService.getCustomers();
      }

      // 2. Get captured locations
      const locations = await dbService.getCustomerLocations();
      console.log(`[PunchIn] Found ${locations.length} captured locations`);

      // Map locations to customers
      const locationMap = new Map();
      locations.forEach(l => locationMap.set(l.customer_code, l));

      // Filter customers to ONLY those with captured locations
      const customersWithLocation = allCustomers
        .filter(c => locationMap.has(c.code))
        .map(c => ({
          ...c,
          geo: locationMap.get(c.code)
        }));

      console.log(`[PunchIn] ${customersWithLocation.length} customers matched with location`);
      if (customersWithLocation.length === 0 && locations.length > 0) {
        console.warn("[PunchIn] Locations exist but no matching customers found. Code mismatch?");
        // console.log("Sample Location Code:", locations[0].customer_code);
        // console.log("Sample Customer Codes:", allCustomers.slice(0, 3).map(c => c.code));
      }

      setCustomers(customersWithLocation);
    } catch (error) {
      console.error("[PunchIn] Error loading data:", error);
      Alert.alert("Error", "Failed to load customer list");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setRefreshingLocation(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for Punch In.');
        setRefreshingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setCurrentLocation(location.coords);
    } catch (error) {
      console.error("Error getting current location:", error);
      Alert.alert("Location Error", "Could not fetch current location.");
    } finally {
      setRefreshingLocation(false);
    }
  };

  const startPunchInFlow = async (customer) => {
    if (!currentLocation) {
      Alert.alert("Location Missing", "Please wait for current location to update.");
      getCurrentLocation();
      return;
    }

    const distance = getDistanceFromLatLonInMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      customer.geo.latitude,
      customer.geo.longitude
    );

    console.log(`Distance to ${customer.name}: ${distance}`);

    if (distance > 50) {
      Alert.alert(
        "Out of Range",
        `You are too far from ${customer.name}.\nDistance: ${distance.toFixed(1)}m.\nRequired: < 50m.`
      );
      return;
    }

    // Identify Verified -> Take Selfie
    takeSelfie(customer);
  };

  const takeSelfie = async (customer) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission denied", "Camera permission is required for selfie verification.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieUri(result.assets[0].uri);
        setPendingCustomer(customer);
        setShowConfirmModal(true);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to open camera.");
    }
  };

  const confirmPunchIn = () => {
    // Here you would upload the selfie and punch-in data to the server
    // For now, we simulate success
    Alert.alert(
      "Punch In Successful",
      `Selfie Captured.\nPunched in at ${pendingCustomer?.name}.`
    );

    setPunchedInCustomer(pendingCustomer?.code);
    closeConfirmModal();
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setSelfieUri(null);
    setPendingCustomer(null);
  };

  const handlePunchOut = () => {
    Alert.alert("Punch Out Successful", "You have successfully punched out.");
    setPunchedInCustomer(null);
  };

  const renderItem = ({ item }) => {
    let distanceText = "Calculating...";
    let canPunch = false;
    let distance = Infinity;

    if (currentLocation && item.geo) {
      distance = getDistanceFromLatLonInMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        item.geo.latitude,
        item.geo.longitude
      );
      distanceText = `${distance.toFixed(0)}m away`;
      canPunch = distance <= 50;
    }

    const isPunchedInHere = punchedInCustomer === item.code;
    const isPunchedInElsewhere = punchedInCustomer && punchedInCustomer !== item.code;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.customerName}>{item.name}</Text>
          <View style={[styles.distanceBadge, canPunch ? styles.badgeSuccess : styles.badgeError]}>
            <Ionicons
              name={canPunch ? "checkmark-circle" : "warning"}
              size={12}
              color={canPunch ? Colors.success.main : Colors.error.main}
            />
            <Text style={[styles.distanceText, { color: canPunch ? Colors.success.main : Colors.error.main }]}>
              {distanceText}
            </Text>
          </View>
        </View>

        <Text style={styles.customerDetail}>{item.place || "No Place"}</Text>

        <View style={styles.actionRow}>
          {isPunchedInHere ? (
            <TouchableOpacity
              style={[styles.punchButton, styles.punchOutButton]}
              onPress={handlePunchOut}
            >
              <Ionicons name="log-out-outline" size={20} color="#FFF" />
              <Text style={styles.punchButtonText}>Punch Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.punchButton,
                styles.punchInButton,
                (!canPunch || isPunchedInElsewhere) && styles.disabledButton
              ]}
              onPress={() => startPunchInFlow(item)}
              disabled={!canPunch || isPunchedInElsewhere}
            >
              <Ionicons name="camera-outline" size={20} color={(!canPunch || isPunchedInElsewhere) ? Colors.neutral[400] : "#FFF"} />
              <Text style={[styles.punchButtonText, (!canPunch || isPunchedInElsewhere) && styles.disabledText]}>
                {isPunchedInElsewhere ? "Punch Out First" : "Punch In"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.title}>Attendance Punch-In</Text>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={getCurrentLocation}
            disabled={refreshingLocation}
          >
            {refreshingLocation ? (
              <ActivityIndicator size="small" color={Colors.primary.main} />
            ) : (
              <Ionicons name="locate" size={24} color={Colors.primary.main} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.primary.main} />
          <Text style={styles.infoText}>
            You must be within 50 meters of the customer location to Punch In. Punch Out can be done anywhere.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary.main} />
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={item => item.code}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="location-outline" size={48} color={Colors.neutral[300]} />
                <Text style={styles.emptyText}>
                  No customer locations found. Please use "Location Capture" first.
                </Text>
              </View>
            }
          />
        )}

        {/* Selfie Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          animationType="slide"
          transparent={true}
          onRequestClose={closeConfirmModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Punch In</Text>
              <Text style={styles.modalSubtitle}>Client: {pendingCustomer?.name}</Text>

              {selfieUri && (
                <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => takeSelfie(pendingCustomer)}
                >
                  <Text style={styles.modalButtonTextCancel}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={confirmPunchIn}
                >
                  <Text style={styles.modalButtonText}>Upload & Punch In</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={closeConfirmModal}>
                <Ionicons name="close-circle" size={32} color={Colors.neutral[400]} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
    marginTop: 35,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  backButton: {
    padding: Spacing.xs,
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primary[50],
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.primary[900],
    lineHeight: 18,
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  customerName: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  customerDetail: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeSuccess: {
    backgroundColor: Colors.success[50],
  },
  badgeError: {
    backgroundColor: Colors.error[50],
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  punchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  punchInButton: {
    backgroundColor: Colors.success.main,
  },
  punchOutButton: {
    backgroundColor: Colors.error.main,
  },
  disabledButton: {
    backgroundColor: Colors.neutral[100],
  },
  punchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: Typography.sizes.sm,
  },
  disabledText: {
    color: Colors.neutral[400],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...Shadows.md,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  selfieImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.neutral[100],
  },
  modalButtonConfirm: {
    backgroundColor: Colors.success.main,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalButtonTextCancel: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  }
});
