import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AreaAssign() {
  const [area, setArea] = useState('');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Area Assign</Text>
      <Text style={styles.subtitle}>Create or assign an area to a user/store</Text>

      <TextInput
        placeholder="Area name"
        placeholderTextColor="#9aa4b2"
        value={area}
        onChangeText={setArea}
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={() => alert('Saved: ' + area)}>
        <Text style={styles.buttonText}>Save Area</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b132b', padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#9aa4b2', marginBottom: 16 },
  input: { backgroundColor: '#071029', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 },
  button: { backgroundColor: '#4fd1c5', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#022', fontWeight: '700' },
});
