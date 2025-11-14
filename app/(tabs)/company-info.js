import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  Modal 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const API_URL = 'https://taskprime.app/api/get-misel-data/';

export default function CompanyInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState({ name: '', clientId: '' });
  const [logoutVisible, setLogoutVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const p = JSON.parse(stored);
        setUser({ name: p.name || '', clientId: p.clientId || '' });

        try {
          const res = await fetch(`${API_URL}?client_id=${p.clientId}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${p.token}` },
          });
          const json = await res.json();
          if (json && Array.isArray(json.data) && json.data.length) {
            setCompany(json.data[0]);
          }
        } catch (e) {
          console.warn("company fetch failed", e);
        }
      }
      setLoading(false);
    })();
  }, []);

  // ✅ FIXED LOGOUT — No route error
  const handleLogout = async () => {
    await AsyncStorage.clear();
    setLogoutVisible(false);

    // FIXED: remove leading "/" to avoid unexpected route error
    router.replace("/LoginScreen");
  };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4fd1c5" size="large" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#0b132b", "#1c2541"]} style={styles.container}>
      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 50 }}
      >
        
        {/* ----- Title ----- */}
        <Text style={styles.title}>Company Info</Text>

        {/* ----- Company Details Card ----- */}
        <View style={styles.card}>
          <Text style={styles.label}>Firm Name</Text>
          <Text style={styles.value}>{company?.firm_name || '—'}</Text>

          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{company?.address || '—'}</Text>
          <Text style={styles.value}>{company?.address1 || ''}</Text>
          <Text style={styles.value}>{company?.address2 || ''}</Text>

          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{company?.phones || company?.mobile || '—'}</Text>

          <Text style={styles.label}>E-mail</Text>
          <Text style={styles.value}>{company?.pagers || '—'}</Text>

          <Text style={styles.label}>GST / TIN</Text>
          <Text style={styles.value}>{company?.tinno || '—'}</Text>
        </View>

        {/* ----- User Card with Logout Row ----- */}
        <View style={styles.userCard}>
          
          {/* Row Alignment FIXED */}
          <View style={styles.row}>
            <View>
              <Text style={styles.welcome}>Welcome</Text>
              <Text style={styles.userName}>{user.name || 'User'}</Text>
              <Text style={styles.clientId}>ID: {user.clientId}</Text>
            </View>

            {/* Logout Button Inside Row (Perfect alignment) */}
            <TouchableOpacity 
              style={styles.logoutBtn}
              onPress={() => setLogoutVisible(true)}
            >
              <Ionicons name="log-out-outline" size={26} color="#6bf3ffff" />
            </TouchableOpacity>
          </View>

        </View>

      </ScrollView>

      {/* ----- Logout Popup Modal ----- */}
      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Logout</Text>

            <Text style={styles.modalMsg}>
              Are you sure you want to logout,  
              <Text style={{ color: "#4fd1c5", fontWeight: '700' }}> {user.name}</Text>?
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: "#1c2541" }]}
                onPress={() => setLogoutVisible(false)}
              >
                <Text style={styles.btnText}>No</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: "#4fd1c5" }]}
                onPress={handleLogout}
              >
                <Text style={styles.btnText}>Yes</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1 },

  center: {
    flex: 1, justifyContent: 'center', 
    alignItems: 'center', backgroundColor: '#0b132b'
  },

  title: {
    color: '#fff', fontSize: 24, fontWeight: '700',
    marginBottom: 16, marginTop: 15, textAlign: "center"
  },

  card: {
    backgroundColor: '#0f1a2b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    height:"75%",
  },

  label: {
    color: '#9aa4b2', marginTop: 12, fontWeight: '600'
  },

  value: {
    color: '#fff', fontSize: 16, marginTop: 10
  },

  userCard: {
    backgroundColor: '#071029',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },

  welcome: { color: '#9aa4b2' },
  userName: { color: '#4fd1c5', fontSize: 18, fontWeight: '700', marginTop: 4 },
  clientId: { color: '#9aa4b2', marginTop: 3 },

  logoutBtn: {
    backgroundColor: "#0b132b",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1b1c38ff"
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center"
  },

  modalBox: {
    width: "80%",
    backgroundColor: "#0f1a2b",
    padding: 20,
    borderRadius: 12,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10
  },

  modalMsg: {
    color: "#9aa4b2",
    fontSize: 15,
    marginBottom: 20
  },

  modalBtns: {
    flexDirection: "row",
    justifyContent: "space-between"
  },

  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: "center"
  },

  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700"
  }
});
