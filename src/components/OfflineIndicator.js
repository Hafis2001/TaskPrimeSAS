// src/components/OfflineIndicator.js
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Gradients, Shadows, Spacing, Typography } from '../../constants/theme';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Monitor network status
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
        });

        return () => unsubscribe();
    }, []);

    if (isOnline) {
        return null; // Don't show anything when online
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={Gradients.warning}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Ionicons name="cloud-offline" size={14} color="#fff" />
                <Text style={styles.text}>Offline Mode</Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.full,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        gap: 6,
    },
    text: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: '#fff',
    },
});
