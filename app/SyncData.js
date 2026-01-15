import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Gradients, Spacing, Typography } from '../constants/theme';
import DownloadButton from '../src/components/DownloadButton';

export default function SyncData() {
    const router = useRouter();

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Data Synchronization</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.content}>
                    {/* The Widget */}
                    <DownloadButton onDownloadComplete={() => { }} />
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        backgroundColor: '#fff',
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary[100],
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    backButton: {
        padding: 8,
        backgroundColor: Colors.primary[50],
        borderRadius: 12,
        minWidth: 40,
        minHeight: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.text.primary,
        flex: 1,
        textAlign: 'center',
    },
    content: {
        flex: 1,
        paddingTop: Spacing.xl,
        paddingHorizontal: Spacing.md,
    },
});
