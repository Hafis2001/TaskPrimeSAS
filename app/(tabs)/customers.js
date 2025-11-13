import { StyleSheet, Text, View } from 'react-native';

export default function Customers() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customers</Text>
      <Text style={styles.note}>Tap a customer to view ledger (existing feature).</Text>
      {/* The original customers list logic lives in app/(drawer)/customers.js —
          For now this placeholder will route to the existing implementation if needed.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b132b',
     padding: 20 },

  title: { color: '#fff', 
    fontSize: 22, fontWeight: '700',
     marginBottom: 8,
    marginTop:15, },

  note: { color: '#9aa4b2' },
});
