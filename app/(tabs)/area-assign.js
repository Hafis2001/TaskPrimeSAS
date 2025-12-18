// app/(tabs)/area-assign.js
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from "../../constants/theme";

export default function AreaAssign() {
  const router = useRouter();
  const [area, setArea] = useState('');

  const handleSave = () => {
    // Logic would go here
    setArea('');
  };

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary.main} />
          </TouchableOpacity>
          <Text style={styles.title}>Area Assignment</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="map" size={32} color={Colors.primary.main} />
            </View>
            <Text style={styles.cardTitle}>Create New Area</Text>
            <Text style={styles.cardSubtitle}>
              Define a new sales territory or area for assignment.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Area Name</Text>
              <TextInput
                placeholder="e.g. North District"
                placeholderTextColor={Colors.text.tertiary}
                value={area}
                onChangeText={setArea}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Save Area</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: Typography.sizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  button: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    ...Shadows.colored.primary,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.sizes.base,
  },
});
