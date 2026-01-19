import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../constants/theme";

const { width } = Dimensions.get('window');

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

  // Punch Status
  const [punchStatus, setPunchStatus] = useState(null); // { is_punched_in, punchin_id, firm_name, current_work_hours }
  const [workHours, setWorkHours] = useState(0);

  // Selfie State
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [punching, setPunching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
      getCurrentLocation();
      checkPunchStatus();
    }, [])
  );

  // Update work hours every minute if punched in
  useEffect(() => {
    if (punchStatus?.is_punched_in) {
      const interval = setInterval(() => {
        setWorkHours(prev => prev + (1 / 60)); // Add 1 minute
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [punchStatus?.is_punched_in]);

  const checkPunchStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch('https://tasksas.com/api/punch-status/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[PunchIn] Status:', data);
        if (data.success && data.is_punched_in) {
          setPunchStatus(data.data);
          setWorkHours(data.data.current_work_hours || 0);
        } else {
          setPunchStatus(null);
        }
      }
    } catch (error) {
      console.error('[PunchIn] Error checking status:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please login.");
        setLoading(false);
        return;
      }

      // Fetch customers from shop-location/table API
      console.log("[PunchIn] Fetching shop locations...");
      const response = await fetch('https://tasksas.com/api/shop-location/table/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[PunchIn] Fetched ${data.length} shop locations`);

      // Map to customer format
      const mappedCustomers = data.map(shop => ({
        code: shop.firm_code,
        name: shop.storeName,
        place: shop.storeLocation || '',
        latitude: shop.latitude,
        longitude: shop.longitude,
        status: shop.status,
        lastCapturedTime: shop.lastCapturedTime
      }));

      setCustomers(mappedCustomers);
    } catch (error) {
      console.error("[PunchIn] Error loading data:", error);
      Alert.alert("Error", `Failed to load shop locations: ${error.message}`);
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

    if (punchStatus?.is_punched_in) {
      Alert.alert("Already Punched In", `You are currently punched in at ${punchStatus.firm_name}. Please punch out first.`);
      return;
    }

    const distance = getDistanceFromLatLonInMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      customer.latitude,
      customer.longitude
    );

    console.log(`Distance to ${customer.name}: ${distance.toFixed(1)}m`);

    if (distance > 100) {
      Alert.alert(
        "Out of Range",
        `You are too far from ${customer.name}.\nDistance: ${distance.toFixed(1)}m.\nRequired: < 100m.`
      );
      return;
    }

    // Location verified -> Take Selfie
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
        quality: 0.7,
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

  const confirmPunchIn = async () => {
    if (!selfieUri || !pendingCustomer || !currentLocation) return;

    try {
      setPunching(true);
      const token = await AsyncStorage.getItem("authToken");

      // Get address from reverse geocoding
      let address = "";
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        });
        if (geocode && geocode.length > 0) {
          const loc = geocode[0];
          address = [loc.street, loc.city, loc.region, loc.country].filter(Boolean).join(', ');
        }
      } catch (e) {
        console.warn("Geocoding failed:", e);
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append('customerCode', pendingCustomer.code);
      formData.append('latitude', currentLocation.latitude.toString());
      formData.append('longitude', currentLocation.longitude.toString());
      formData.append('address', address || 'Unknown');
      formData.append('notes', notes || '');

      // Add image
      const filename = selfieUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: selfieUri,
        name: filename,
        type: type
      });

      console.log('[PunchIn] Posting punch-in...');
      const response = await fetch('https://tasksas.com/api/punch-in/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      const result = await response.json();
      console.log('[PunchIn] Response:', result);

      if (response.ok && result.success) {
        Alert.alert(
          "Punch In Successful",
          `Punched in at ${result.data.firm_name}\nTime: ${new Date(result.data.punchin_time).toLocaleTimeString()}`
        );

        // Update status
        await checkPunchStatus();
        closeConfirmModal();
      } else {
        Alert.alert("Error", result.message || "Failed to punch in");
      }
    } catch (error) {
      console.error("[PunchIn] Error:", error);
      Alert.alert("Error", "Failed to punch in. Please try again.");
    } finally {
      setPunching(false);
    }
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setSelfieUri(null);
    setPendingCustomer(null);
    setNotes("");
  };

  const handlePunchOut = async () => {
    if (!punchStatus?.punchin_id) return;

    Alert.alert(
      "Confirm Punch Out",
      `Are you sure you want to punch out from ${punchStatus.firm_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Punch Out",
          style: "destructive",
          onPress: async () => {
            try {
              setPunching(true);
              const token = await AsyncStorage.getItem("authToken");

              const response = await fetch(`https://tasksas.com/api/punch-out/${punchStatus.punchin_id}/`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              const result = await response.json();
              console.log('[PunchOut] Response:', result);

              if (response.ok && result.success) {
                Alert.alert(
                  "Punch Out Successful",
                  `Work Duration: ${result.data.work_duration_hours.toFixed(2)} hours\nPunch In: ${new Date(result.data.punchin_time).toLocaleTimeString()}\nPunch Out: ${new Date(result.data.punchout_time).toLocaleTimeString()}`
                );

                setPunchStatus(null);
                setWorkHours(0);
              } else {
                Alert.alert("Error", result.message || "Failed to punch out");
              }
            } catch (error) {
              console.error("[PunchOut] Error:", error);
              Alert.alert("Error", "Failed to punch out. Please try again.");
            } finally {
              setPunching(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => {
    let distanceText = "Calculating...";
    let canPunch = false;
    let distance = Infinity;

    if (currentLocation) {
      distance = getDistanceFromLatLonInMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        item.latitude,
        item.longitude
      );
      distanceText = `${distance.toFixed(0)}m away`;
      canPunch = distance <= 100;
    }

    const isPunchedInHere = punchStatus?.is_punched_in && punchStatus?.punchin_id;
    const isDisabled = !canPunch || (isPunchedInHere && punchStatus.firm_name !== item.name);

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

        <Text style={styles.customerDetail}>{item.place || "No Location"}</Text>
        <Text style={styles.customerCode}>Code: {item.code}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.punchButton,
              styles.punchInButton,
              isDisabled && styles.disabledButton
            ]}
            onPress={() => startPunchInFlow(item)}
            disabled={isDisabled || punching}
          >
            {punching ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={20} color={isDisabled ? Colors.neutral[400] : "#FFF"} />
                <Text style={[styles.punchButtonText, isDisabled && styles.disabledText]}>
                  Punch In
                </Text>
              </>
            )}
          </TouchableOpacity>
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
          <Text style={styles.title}>Punch-In</Text>

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

        {/* Punch Status Banner */}
        {punchStatus?.is_punched_in && (
          <View style={styles.statusBanner}>
            <View style={styles.statusInfo}>
              <Ionicons name="time" size={20} color={Colors.success.main} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.statusTitle}>Punched In at {punchStatus.firm_name}</Text>
                <Text style={styles.statusTime}>Work Hours: {workHours.toFixed(2)} hrs</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.punchOutButton}
              onPress={handlePunchOut}
              disabled={punching}
            >
              {punching ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#FFF" />
                  <Text style={styles.punchOutText}>Punch Out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.primary.main} />
          <Text style={styles.infoText}>
            You must be within 100 meters of the shop location to Punch In.
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
                  No shop locations found. Please capture locations first.
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
              <Text style={styles.modalSubtitle}>Shop: {pendingCustomer?.name}</Text>

              {selfieUri && (
                <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
              )}

              <TextInput
                style={styles.notesInput}
                placeholder="Add notes (optional)"
                placeholderTextColor={Colors.text.tertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => takeSelfie(pendingCustomer)}
                  disabled={punching}
                >
                  <Text style={styles.modalButtonTextCancel}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={confirmPunchIn}
                  disabled={punching}
                >
                  {punching ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.modalButtonText}>Confirm Punch In</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={closeConfirmModal} disabled={punching}>
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
  statusBanner: {
    backgroundColor: Colors.success[50],
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.success[100],
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.success[900],
  },
  statusTime: {
    fontSize: Typography.sizes.sm,
    color: Colors.success[700],
    marginTop: 2,
  },
  punchOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error.main,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  punchOutText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: Typography.sizes.sm,
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
    marginBottom: 2,
  },
  customerCode: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
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
    borderRadius: BorderRadius.xl,
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
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  notesInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
    textAlignVertical: 'top',
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
