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
  const R = 6371e3;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
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

  // Filter State
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'active'

  // Punch Status
  const [punchStatus, setPunchStatus] = useState(null);
  const [workHours, setWorkHours] = useState(0);

  // Selfie State
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [punching, setPunching] = useState(false);
  const [completedPunches, setCompletedPunches] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      getCurrentLocation();
      checkPunchStatus();
      loadCompletedHistory();
    }, [])
  );

  // Update work hours every minute if punched in
  useEffect(() => {
    if (punchStatus?.is_punched_in) {
      const interval = setInterval(() => {
        setWorkHours(prev => prev + (1 / 60));
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
        if (data.success && data.is_punched_in && data.data) {
          setPunchStatus({
            ...data.data,
            is_punched_in: true
          });
          setWorkHours(data.data.current_work_hours || 0);
        } else {
          setPunchStatus(null);
          setWorkHours(0);
        }
      }
    } catch (error) {
      console.error('[PunchIn] Error checking status:', error);
    }
  };

  const loadCompletedHistory = async () => {
    try {
      const historyStr = await AsyncStorage.getItem("attendance_history");
      if (historyStr) {
        let history = [];
        try {
          history = JSON.parse(historyStr);
        } catch (parseError) {
          console.error('[PunchIn] Failed to parse history:', parseError);
          // If corrupted, clear it
          await AsyncStorage.removeItem("attendance_history");
          setCompletedPunches([]);
          return;
        }

        if (!Array.isArray(history)) {
          setCompletedPunches([]);
          return;
        }

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Filter out records older than 3 days
        const filteredHistory = history.filter(item => {
          try {
            if (!item) return false;
            const punchDate = new Date(item.punchout_time || item.timestamp);
            return !isNaN(punchDate.getTime()) && punchDate >= threeDaysAgo;
          } catch (e) {
            return false;
          }
        });

        // Save back if some were removed
        if (filteredHistory.length !== history.length) {
          await AsyncStorage.setItem("attendance_history", JSON.stringify(filteredHistory));
        }

        setCompletedPunches(filteredHistory);
      }
    } catch (error) {
      console.error('[PunchIn] Error loading completed history:', error);
    }
  };

  const saveToCompletedHistory = async (record) => {
    try {
      const historyStr = await AsyncStorage.getItem("attendance_history");
      let history = historyStr ? JSON.parse(historyStr) : [];

      // Add new record at the top
      history.unshift({
        ...record,
        timestamp: new Date().toISOString()
      });

      // Keep only last 3 days (redundant but safe)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      history = history.filter(item => new Date(item.punchout_time || item.timestamp) >= threeDaysAgo);

      await AsyncStorage.setItem("attendance_history", JSON.stringify(history));
      setCompletedPunches(history);
    } catch (error) {
      console.error('[PunchIn] Error saving completed history:', error);
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

      console.log("[PunchIn] Fetching shop locations...");
      const response = await fetch('https://tasksas.com/api/shop-location/firms/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.firms) {
        throw new Error('Invalid API response format');
      }

      const firms = result.firms;
      console.log(`[PunchIn] Fetched ${firms.length} shop locations`);

      const mappedCustomers = firms.map(shop => ({
        code: shop.id,
        name: shop.firm_name,
        place: shop.area || '',
        latitude: parseFloat(shop.latitude) || 0,
        longitude: parseFloat(shop.longitude) || 0
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

  const confirmPunchIn = async () => {
    if (!selfieUri || !pendingCustomer || !currentLocation) return;

    try {
      setPunching(true);
      const token = await AsyncStorage.getItem("authToken");

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

      const formData = new FormData();
      formData.append('customerCode', pendingCustomer.code);
      formData.append('latitude', currentLocation.latitude.toString());
      formData.append('longitude', currentLocation.longitude.toString());
      formData.append('address', address || 'Unknown');
      formData.append('notes', notes || '');

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

        // Update status immediately
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

  const handlePunchOut = async (customer) => {
    if (!punchStatus?.punchin_id) {
      console.warn('[PunchOut] Cannot punch out: punchin_id is missing', punchStatus);
      Alert.alert("Error", "Could not find active punch-in record. Please refresh.");
      return;
    }

    Alert.alert(
      "Confirm Punch Out",
      `Are you sure you want to punch out from ${customer.name}?\n\nWork Hours: ${workHours.toFixed(2)} hrs`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Punch Out",
          style: "destructive",
          onPress: async () => {
            try {
              setPunching(true);
              const token = await AsyncStorage.getItem("authToken");

              const url = `https://tasksas.com/api/punch-out/${punchStatus.punchin_id}/`;
              console.log('[PunchOut] Requesting URL:', url);
              console.log('[PunchOut] Notes:', notes);

              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ notes: notes || '' })
              });

              console.log('[PunchOut] Response Status:', response.status);

              const responseText = await response.text();
              console.log('[PunchOut] Raw Response:', responseText);

              let result;
              try {
                result = JSON.parse(responseText);
              } catch (e) {
                console.error('[PunchOut] JSON Parse Error:', e);
                throw new Error(`Invalid server response: ${responseText.substring(0, 100)}`);
              }

              if (response.ok && result.success) {
                Alert.alert(
                  "Punch Out Successful",
                  `Work Duration: ${result.data?.work_duration_hours?.toFixed(2) || 0} hours\nPunch In: ${result.data?.punchin_time ? new Date(result.data.punchin_time).toLocaleTimeString() : 'N/A'}\nPunch Out: ${result.data?.punchout_time ? new Date(result.data.punchout_time).toLocaleTimeString() : 'N/A'}`
                );

                setPunchStatus(null);
                setWorkHours(0);

                // Save to local history for 'Completed' section
                await saveToCompletedHistory({
                  firm_name: customer.name,
                  code: customer.code,
                  place: customer.place,
                  work_duration_hours: result.data?.work_duration_hours || workHours,
                  punchin_time: result.data?.punchin_time,
                  punchout_time: result.data?.punchout_time
                });

                // Verify status was updated
                setTimeout(() => {
                  checkPunchStatus();
                }, 1000);
              } else {
                Alert.alert("Error", result.message || `Failed to punch out (${response.status})`);
              }
            } catch (error) {
              console.error("[PunchOut] Error:", error);
              // Handle the specific "Network request failed" error with more context
              if (error.message === 'Network request failed') {
                Alert.alert(
                  "Network Error",
                  "Punch out failed due to a network issue. Please check your internet connection and verify if the punch-in ID is valid."
                );
              } else {
                Alert.alert("Error", `Failed to punch out: ${error.message}`);
              }
            } finally {
              setPunching(false);
            }
          }
        }
      ]
    );
  };

  const getFilteredCustomers = () => {
    if (filterTab === 'active' && punchStatus?.is_punched_in) {
      // Show only the customer where user is punched in
      return customers.filter(c => c.name === punchStatus.firm_name);
    }
    if (filterTab === 'completed') {
      return completedPunches;
    }
    return customers;
  };

  const renderItem = ({ item }) => {
    let distanceText = "Calculating...";
    let canPunch = false;
    let distance = Infinity;

    if (currentLocation && item.latitude && item.longitude) {
      distance = getDistanceFromLatLonInMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        parseFloat(item.latitude),
        parseFloat(item.longitude)
      );
      if (!isNaN(distance)) {
        distanceText = distance >= 1000
          ? `${(distance / 1000).toFixed(1)}km away`
          : `${distance.toFixed(0)}m away`;
        canPunch = distance <= 100;
      } else {
        distanceText = "Location Error";
      }
    } else {
      distanceText = "No Location";
    }

    const isPunchedInHere = punchStatus?.is_punched_in && punchStatus?.firm_name === item.name;
    const isCompletedItem = filterTab === 'completed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.customerName}>{item.name || item.firm_name}</Text>
          {!isPunchedInHere && !isCompletedItem && (
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
          )}
        </View>

        <Text style={styles.customerDetail}>{item.place || "No Location"}</Text>
        <Text style={styles.customerCode}>Code: {item.code}</Text>

        {isPunchedInHere && (
          <View style={styles.workHoursCard}>
            <Ionicons name="time-outline" size={16} color={Colors.success.main} />
            <Text style={styles.workHoursText}>Work Hours: {workHours.toFixed(2)} hrs</Text>
          </View>
        )}

        {isCompletedItem && (
          <View style={[styles.workHoursCard, { backgroundColor: Colors.neutral[50] }]}>
            <Ionicons name="time" size={16} color={Colors.neutral[600]} />
            <Text style={[styles.workHoursText, { color: Colors.neutral[600] }]}>
              Duration: {item.work_duration_hours?.toFixed(2) || 0} hrs
            </Text>
            <Text style={{ fontSize: 10, color: Colors.neutral[400], marginLeft: 'auto' }}>
              {item.punchout_time ? new Date(item.punchout_time).toLocaleDateString() : ''}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          {isCompletedItem ? (
            <View style={styles.completedInfo}>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>In:</Text>
                <Text style={styles.timeValue}>
                  {item.punchin_time ? new Date(item.punchin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </Text>
                <Text style={[styles.timeLabel, { marginLeft: 12 }]}>Out:</Text>
                <Text style={styles.timeValue}>
                  {item.punchout_time ? new Date(item.punchout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </Text>
              </View>
            </View>
          ) : isPunchedInHere ? (
            <TouchableOpacity
              style={[styles.punchButton, styles.punchOutButton]}
              onPress={() => handlePunchOut(item)}
              disabled={punching}
            >
              {punching ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#FFF" />
                  <Text style={styles.punchButtonText}>Punch Out</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.punchButton,
                styles.punchInButton,
                (!canPunch || punchStatus?.is_punched_in) && styles.disabledButton
              ]}
              onPress={() => startPunchInFlow(item)}
              disabled={!canPunch || punchStatus?.is_punched_in || punching}
            >
              {punching ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color={(!canPunch || punchStatus?.is_punched_in) ? Colors.neutral[400] : "#FFF"} />
                  <Text style={[styles.punchButtonText, (!canPunch || punchStatus?.is_punched_in) && styles.disabledText]}>
                    Punch In
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredCustomers = getFilteredCustomers();

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.title}>Attendance</Text>

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

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'all' && styles.filterTabActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.filterTabText, filterTab === 'all' && styles.filterTabTextActive]}>
              All Shops ({customers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'active' && styles.filterTabActive]}
            onPress={() => setFilterTab('active')}
          >
            <Ionicons
              name="time"
              size={16}
              color={filterTab === 'active' ? Colors.success.main : Colors.text.secondary}
            />
            <Text style={[styles.filterTabText, filterTab === 'active' && styles.filterTabTextActive]}>
              Active {punchStatus?.is_punched_in ? '(1)' : '(0)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'completed' && styles.filterTabActive, filterTab === 'completed' && { borderColor: Colors.primary.main, backgroundColor: Colors.primary[50] }]}
            onPress={() => setFilterTab('completed')}
          >
            <Ionicons
              name="checkmark-done-circle"
              size={16}
              color={filterTab === 'completed' ? Colors.primary.main : Colors.text.secondary}
            />
            <Text style={[styles.filterTabText, filterTab === 'completed' && { color: Colors.primary.main }]}>
              Completed ({completedPunches.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Banner */}
        {punchStatus?.is_punched_in && (
          <View style={styles.statusBanner}>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success.main} />
              <Text style={styles.statusText}>Punched in at {punchStatus.firm_name}</Text>
            </View>
            <Text style={styles.statusSubtext}>Work Hours: {workHours.toFixed(2)} hrs</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary.main} />
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            keyExtractor={item => item.code}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="location-outline" size={48} color={Colors.neutral[300]} />
                <Text style={styles.emptyText}>
                  {filterTab === 'active' && !punchStatus?.is_punched_in
                    ? "No active punch-in"
                    : "No shop locations found. Please capture locations first."}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterTabActive: {
    backgroundColor: Colors.success[50],
    borderColor: Colors.success.main,
  },
  filterTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterTabTextActive: {
    color: Colors.success.main,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.success[900],
  },
  statusSubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.success[700],
    marginTop: 4,
    marginLeft: 28,
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
    marginBottom: Spacing.sm,
  },
  workHoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  workHoursText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.success.main,
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
  completedInfo: {
    flex: 1,
    paddingTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    fontWeight: '600',
    marginRight: 4,
  },
  timeValue: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: '500',
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
