// src/components/OfflineIndicator.js
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
            <Ionicons name="cloud-offline" size={14} color="#fff" />
            <Text style={styles.text}>Offline Mode</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF9800',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
});
