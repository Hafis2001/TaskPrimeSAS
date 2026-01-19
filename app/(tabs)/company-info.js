// app/(tabs)/company-info.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";

const API_URL = 'https://tasksas.com/api/get-misel-data/';

export default function CompanyInfoScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState({ name: '', clientId: '' });
  const [logoutVisible, setLogoutVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken, storedClientId] = await Promise.all([
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('client_id') // or 'clientId' depending on exact save, LoginScreen uses "client_id" for the user field but "clientId" for the license check. Login saves "client_id" at line 203.
        ]);

        if (storedUser) {
          const p = JSON.parse(storedUser);
          setUser({ name: p.name || '', clientId: storedClientId || p.client_id || '' });
        }

        const token = storedToken;
        // detailed check: LoginScreen saves "client_id" in line 203. "clientId" in line 137 (license).
        // Best to use the one explicitly saved during login success if available, or license one.
        const activeClientId = storedClientId;

        if (activeClientId && token) {
          console.log('[CompanyInfo] Fetching for clientId:', activeClientId);
          const res = await fetch(`${API_URL}?client_id=${activeClientId}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          console.log('[CompanyInfo] API Response:', JSON.stringify(json, null, 2));

          if (json?.data) {
            if (Array.isArray(json.data) && json.data.length > 0) {
              setCompany(json.data[0]);
            } else if (typeof json.data === 'object') {
              setCompany(json.data);
            }
          }
        } else {
          console.warn('[CompanyInfo] Missing token or client_id', { token: !!token, clientId: activeClientId });
        }
      } catch (e) {
        console.error("[CompanyInfo] Fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      // SMART LOGOUT: Preserve License & Device Info, Clear User Data
      const keys = await AsyncStorage.getAllKeys();
      const preservedKeys = [
        'clientId',
        'licenseInfo',
        'licenseKey',
        'deviceId',
        'device_hardware_id',
        'app_settings'
      ];

      const keysToRemove = keys.filter(key => !preservedKeys.includes(key));

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log('[CompanyInfo] Smart Logout: Cleared', keysToRemove);
      }
    } catch (e) {
      console.error('[CompanyInfo] Logout Error:', e);
    }

    setLogoutVisible(false);
    router.replace("/LoginScreen");
  };

  if (loading) {
    return (
      <LinearGradient colors={Gradients.background} style={styles.center}>
        <ActivityIndicator color={Colors.primary.main} size="large" />
      </LinearGradient>
    );
  }

  const InfoRow = ({ label, value, icon, isLast }) => (
    <View style={[styles.infoRow, isLast && styles.noBorder]}>
      <View style={styles.labelContainer}>
        <Ionicons name={icon} size={18} color={Colors.primary.main} style={styles.labelIcon} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Company Info</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Company Card */}
          <View style={styles.card}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardHeader}
            >
              <View style={styles.companyIcon}>
                <Ionicons name="business" size={24} color={Colors.primary.main} />
              </View>
              <View>
                <Text style={styles.companyName}>
                  {company?.firm_name || 'Company Name'}
                </Text>
                <Text style={styles.companyId}>ID: {user.clientId}</Text>
              </View>
            </LinearGradient>

            <View style={styles.cardBody}>
              <InfoRow
                label="Address"
                value={[
                  company?.address,
                  company?.address1,
                  company?.address2,
                  company?.address3
                ].filter(Boolean).join(', ')}
                icon="location-outline"
              />
              <InfoRow
                label="Phone"
                value={[company?.phones, company?.mobile].filter(Boolean).join(' / ')}
                icon="call-outline"
              />
              <InfoRow
                label="Email"
                value={company?.pagers}
                icon="mail-outline"
              />
              <InfoRow
                label="GST / TIN"
                value={company?.tinno}
                icon="document-text-outline"
                isLast
              />
            </View>
          </View>

          {/* User Profile Card */}
          <Text style={styles.sectionTitle}>User Profile</Text>
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{user.name || 'User'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setLogoutVisible(true)}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error.main} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Logout Modal */}
        <Modal
          visible={logoutVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLogoutVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Ionicons name="log-out" size={32} color={Colors.error.main} />
              </View>
              <Text style={styles.modalTitle}>Confirm Logout</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to end your session?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setLogoutVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleLogout}
                >
                  <Text style={styles.confirmButtonText}>Logout</Text>
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
  container: { flex: 1 },
  safeArea: { flex: 1, marginTop: 35, paddingBottom: Spacing.md },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    ...Shadows.md,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  companyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyName: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  companyId: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  cardBody: {
    padding: Spacing.lg,
  },
  infoRow: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  noBorder: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  label: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  value: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    paddingLeft: 26, // align with text
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.primary.main,
  },
  welcomeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
  },
  userName: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: Colors.error[50],
    borderRadius: BorderRadius.md,
  },
  logoutText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error.main,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.xl,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  modalMessage: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.error.main,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
