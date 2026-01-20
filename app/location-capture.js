import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../constants/theme";
import dbService from "../src/services/database";

const { width, height } = Dimensions.get('window');
const API_DEBTORS = "https://tasksas.com/api/debtors/get-debtors/";

export default function LocationCaptureScreen() {
    const router = useRouter();
    const [customers, setCustomers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [capturing, setCapturing] = useState(false);
    const [capturedCustomers, setCapturedCustomers] = useState(new Set());

    // Map State
    const [showMap, setShowMap] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [currentRegion, setCurrentRegion] = useState(null);
    const [markerCoordinate, setMarkerCoordinate] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const q = searchQuery.toLowerCase();
        const f = customers.filter(c =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.place || "").toLowerCase().includes(q) ||
            (c.phone || "").toLowerCase().includes(q) ||
            (c.code || "").toLowerCase().includes(q)
        );
        setFiltered(f);
    }, [searchQuery, customers]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Get Token
            const token = await AsyncStorage.getItem("authToken");
            if (!token) {
                Alert.alert("Error", "User not authenticated. Please login.");
                setLoading(false);
                return;
            }

            // 2. Fetch Customers from API
            console.log(`[LocationCapture] Fetching debtors from: ${API_DEBTORS}`);
            const response = await fetch(API_DEBTORS, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('[LocationCapture] GET Status:', response.status);
            const responseText = await response.text();

            if (!response.ok) {
                console.warn('[LocationCapture] GET Error:', response.status, responseText);
                throw new Error(`Server returned ${response.status}: ${responseText.substring(0, 100)}`);
            }

            let json;
            try {
                json = JSON.parse(responseText);
            } catch (e) {
                console.error('[LocationCapture] GET JSON Parse Error:', e);
                throw new Error('Invalid JSON response from server');
            }

            let allCustomers = [];
            if (Array.isArray(json)) {
                allCustomers = json;
            } else if (json.data && Array.isArray(json.data)) {
                allCustomers = json.data;
            } else if (json.debtors && Array.isArray(json.debtors)) {
                allCustomers = json.debtors;
            } else {
                console.warn("Unexpected API response format:", json);
                // Try to handle single object if that was the case, but likely it's one of above
            }

            console.log(`Fetched ${allCustomers.length} debtors from API`);

            // 3. Get Local Locations (to show captured status)
            await dbService.init();
            const locations = await dbService.getCustomerLocations();
            const capturedSet = new Set(locations.map(l => l.customer_code));
            setCapturedCustomers(capturedSet);

            setCustomers(allCustomers);
            setFiltered(allCustomers);

        } catch (error) {
            console.error("Error loading data:", error);
            Alert.alert("Error", `Failed to load customers: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const openMapForCustomer = async (customer) => {
        try {
            setCapturing(true);

            // Check location permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Permission to access location was denied');
                setCapturing(false);
                return;
            }

            // Get current location with timeout
            const location = await Promise.race([
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Location timeout')), 10000)
                )
            ]);

            if (!location || !location.coords) {
                throw new Error('Invalid location data');
            }

            const { latitude, longitude } = location.coords;

            // Validate coordinates
            if (isNaN(latitude) || isNaN(longitude)) {
                throw new Error('Invalid coordinates');
            }

            const initialRegion = {
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };

            setCurrentRegion(initialRegion);
            setMarkerCoordinate({ latitude, longitude });
            setSelectedCustomer(customer);

            // Small delay before showing map to ensure state is set
            setTimeout(() => {
                setShowMap(true);
            }, 100);

        } catch (error) {
            console.error("Error opening map:", error);
            Alert.alert(
                "Location Error",
                error.message === 'Location timeout'
                    ? "Location request timed out. Please try again."
                    : "Failed to retrieve current location. Please check your GPS settings."
            );
        } finally {
            setCapturing(false);
        }
    };

    const handleSaveLocation = async () => {
        if (!selectedCustomer || !markerCoordinate) {
            Alert.alert("Error", "Missing customer or location data");
            return;
        }

        try {
            setCapturing(true);

            const { latitude, longitude } = markerCoordinate;

            // Validate coordinates
            if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
                throw new Error("Invalid coordinates");
            }

            console.log('[LocationCapture] Saving location for:', selectedCustomer.name, { latitude, longitude });

            // 1. Save to local DB
            let localSaveSuccess = false;
            try {
                await dbService.init();
                await dbService.saveCustomerLocation(selectedCustomer.code, latitude, longitude);
                localSaveSuccess = true;
                console.log('[LocationCapture] Local save successful');
            } catch (dbError) {
                console.error('[LocationCapture] Database save failed:', dbError);
                Alert.alert(
                    "Database Error",
                    "Failed to save location locally. The location will still be sent to the server."
                );
            }

            // 2. POST to API
            let apiSaveSuccess = false;
            try {
                const token = await AsyncStorage.getItem("authToken");
                if (!token) {
                    throw new Error("No authentication token");
                }

                const apiPayload = {
                    firm_name: selectedCustomer.name,
                    latitude: latitude,
                    longitude: longitude
                };

                console.log('[LocationCapture] Posting to API:', apiPayload);

                const response = await fetch('https://tasksas.com/api/shop-location/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(apiPayload)
                });

                console.log('[LocationCapture] POST Status:', response.status);
                const responseText = await response.text();
                console.log('[LocationCapture] POST Response:', responseText);

                if (!response.ok) {
                    console.warn('[LocationCapture] POST Error:', response.status, responseText);
                    throw new Error(`API returned ${response.status}: ${responseText.substring(0, 100)}`);
                } else {
                    let result;
                    try {
                        result = JSON.parse(responseText);
                        console.log('[LocationCapture] API Success:', result);
                        apiSaveSuccess = true;
                    } catch (e) {
                        console.error('[LocationCapture] POST JSON Parse Error:', e);
                        // Still mark as success if status was OK, maybe it's "OK" string
                        apiSaveSuccess = true;
                    }
                }
            } catch (apiError) {
                console.error('[LocationCapture] API request failed:', apiError);

                let errorMessage = apiError.message;
                if (errorMessage === 'Network request failed') {
                    errorMessage = "Network request failed. Please check your internet connection and verify if the API endpoint is accessible.";
                }

                if (!localSaveSuccess) {
                    Alert.alert(
                        "Save Failed",
                        `Failed to save location both locally and to server. Error: ${errorMessage}`
                    );
                    setCapturing(false);
                    return;
                }
            }

            // 3. Update local state to reflect captured status
            setCapturedCustomers(prev => new Set(prev).add(selectedCustomer.code));

            // Show success message
            const successMessage = apiSaveSuccess
                ? `Location saved successfully for ${selectedCustomer.name}`
                : `Location saved locally for ${selectedCustomer.name}. Will sync to server when online.`;

            Alert.alert("Success", successMessage);

            // Close Modal
            setShowMap(false);
            setSelectedCustomer(null);
            setCurrentRegion(null);
            setMarkerCoordinate(null);

        } catch (error) {
            console.error("[LocationCapture] Error saving location:", error);
            Alert.alert("Error", `Failed to save location: ${error.message}`);
        } finally {
            setCapturing(false);
        }
    };

    const renderItem = ({ item }) => {
        const isCaptured = capturedCustomers.has(item.code);

        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.customerDetail}>{item.place || "No Place"} • {item.phone || "No Phone"}</Text>
                    {isCaptured && (
                        <View style={styles.capturedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={Colors.success.main} />
                            <Text style={styles.capturedText}>Location Captured</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.captureButton, isCaptured ? styles.captureButtonUpdate : null]}
                    onPress={() => openMapForCustomer(item)}
                    disabled={capturing && selectedCustomer?.code === item.code}
                >
                    {capturing && selectedCustomer?.code === item.code ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Ionicons name="location" size={20} color="#FFF" />
                    )}
                    <Text style={styles.captureButtonText}>
                        {isCaptured ? "Update" : "Capture"}
                    </Text>
                </TouchableOpacity>
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
                    <Text style={styles.title}>Location Capture</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={Colors.text.tertiary} style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search Customer..."
                        placeholderTextColor={Colors.text.tertiary}
                        style={styles.searchBox}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary.main} />
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={item => item.code}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Text style={styles.emptyText}>No customers found</Text>
                            </View>
                        }
                    />
                )}

                {/* Location Confirmation Modal */}
                <Modal
                    visible={showMap}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => {
                        setShowMap(false);
                        setCurrentRegion(null);
                        setMarkerCoordinate(null);
                    }}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.confirmModalContent}>
                            <View style={styles.modalHeader}>
                                <Ionicons name="location" size={48} color={Colors.primary.main} />
                                <Text style={styles.modalTitle}>Confirm Location</Text>
                                <Text style={styles.modalSubtitle}>{selectedCustomer?.name}</Text>
                            </View>

                            {markerCoordinate ? (
                                <View style={styles.coordinatesContainer}>
                                    <View style={styles.coordRow}>
                                        <Text style={styles.coordLabel}>Latitude:</Text>
                                        <Text style={styles.coordValue}>{markerCoordinate.latitude.toFixed(6)}</Text>
                                    </View>
                                    <View style={styles.coordRow}>
                                        <Text style={styles.coordLabel}>Longitude:</Text>
                                        <Text style={styles.coordValue}>{markerCoordinate.longitude.toFixed(6)}</Text>
                                    </View>
                                    <View style={styles.infoBox}>
                                        <Ionicons name="information-circle" size={16} color={Colors.primary.main} />
                                        <Text style={styles.infoBoxText}>
                                            This location will be saved for {selectedCustomer?.name}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <ActivityIndicator size="large" color={Colors.primary.main} />
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonCancel]}
                                    onPress={() => {
                                        setShowMap(false);
                                        setCurrentRegion(null);
                                        setMarkerCoordinate(null);
                                    }}
                                    disabled={capturing}
                                >
                                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonSave]}
                                    onPress={handleSaveLocation}
                                    disabled={capturing || !markerCoordinate}
                                >
                                    {capturing ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={20} color="#FFF" />
                                            <Text style={styles.modalButtonText}>Save Location</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
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
    searchContainer: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.light,
        height: 50,
        ...Shadows.sm,
    },
    searchIcon: {
        marginRight: Spacing.sm,
    },
    searchBox: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.text.primary,
    },
    list: {
        padding: Spacing.lg,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: Colors.border.light,
        ...Shadows.sm,
    },
    cardContent: {
        flex: 1,
        marginRight: Spacing.md,
    },
    customerName: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    customerDetail: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
    },
    capturedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    capturedText: {
        fontSize: 10,
        color: Colors.success.main,
        fontWeight: '600',
    },
    captureButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning.main,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        gap: 6,
    },
    captureButtonUpdate: {
        backgroundColor: Colors.success.main,
    },
    captureButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: Typography.sizes.sm,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.base,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    confirmModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        width: '90%',
        maxWidth: 400,
        ...Shadows.xl,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.text.primary,
        marginTop: Spacing.md,
    },
    modalSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        marginTop: 4,
    },
    coordinatesContainer: {
        backgroundColor: Colors.neutral[50],
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    coordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.light,
    },
    coordLabel: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    coordValue: {
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.primary.main,
        fontFamily: 'monospace',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.primary[50],
        borderRadius: BorderRadius.md,
    },
    infoBoxText: {
        flex: 1,
        fontSize: Typography.sizes.xs,
        color: Colors.primary[900],
    },
    modalActions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    modalButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: 6,
    },
    modalButtonCancel: {
        backgroundColor: Colors.neutral[100],
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    modalButtonSave: {
        backgroundColor: Colors.primary.main,
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: Typography.sizes.base,
    },
    modalButtonTextCancel: {
        color: Colors.text.primary,
        fontWeight: '600',
        fontSize: Typography.sizes.base,
    }
});
