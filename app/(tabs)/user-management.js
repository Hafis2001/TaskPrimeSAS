import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function UserManagement() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <Text style={styles.desc}>Create or manage application users.</Text>

      <TouchableOpacity style={styles.action} onPress={() => alert('Create user')}>
        <Text style={styles.actionText}>Create User</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b132b', padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  desc: { color: '#9aa4b2', marginBottom: 16 },
  action: { backgroundColor: '#4fd1c5', padding: 12, borderRadius: 10, marginTop: 8, alignItems: 'center' },
  actionText: { color: '#022', fontWeight: '700' },
});
