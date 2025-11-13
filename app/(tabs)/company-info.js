import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = 'https://taskprime.app/api/get-misel-data/';

export default function CompanyInfoScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState({ name: '', clientId: '' });

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
          if (json && Array.isArray(json.data) && json.data.length) setCompany(json.data[0]);
        } catch (e) {
          console.warn('company fetch failed', e);
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color="#4fd1c5" size="large" /></View>
  );

  return (
    <LinearGradient colors={["#0b132b", "#1c2541"]} style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <Text style={styles.title}>Company Info</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Firm Name</Text>
          <Text style={styles.value}>{company?.firm_name || '—'}</Text>

          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{company?.address || '—'}</Text>
<Text style={styles.value}>{company?.address1 || '—'}</Text>
<Text style={styles.value}>{company?.address2 || '—'}</Text>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{company?.phones || company?.mobile || '—'}</Text>

              <Text style={styles.label}>E-mail</Text>
          <Text style={styles.value}>{company?.pagers || '—'}</Text>

          <Text style={styles.label}>GST / TIN</Text>
          <Text style={styles.value}>{company?.tinno || '—'}</Text>
        </View>

        <View style={styles.userCard}>
          <Text style={styles.welcome}>Welcome,</Text>
          <Text style={styles.userName}>{user.name || 'User'}</Text>
          <Text style={styles.clientId}>ID: {user.clientId}</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  center: { flex: 1,
     justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0b132b' },
  
      title: { color: '#fff',
               fontSize: 24,
                fontWeight: '700',
                 marginBottom: 16,
                marginTop:15,
            marginLeft:85 },
  
    card: { backgroundColor: '#0f1a2b',
     borderRadius: 12,
      padding: 16,
       marginBottom: 16,
    height:500, },
  
    label: { color: '#9aa4b2',
     marginTop: 12,
      fontWeight: '600' },
  
      value: { color: '#fff', 
    fontSize: 16,
     marginTop: 14 },
  
     userCard: { backgroundColor: '#071029',
     padding: 14,
      borderRadius: 12,
       alignItems: 'center' },
  
       welcome: { color: '#9aa4b2' },
  
  userName: { color: '#4fd1c5',
     fontSize: 18,
      fontWeight: '700' },
  
      clientId: { color: '#9aa4b2' },
});
