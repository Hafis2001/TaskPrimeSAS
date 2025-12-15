// src/components/DownloadButton.js
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import syncService from '../services/syncService';

export default function DownloadButton({ onDownloadComplete }) {
    const [isOnline, setIsOnline] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [stats, setStats] = useState(null);
    const [progress, setProgress] = useState({ message: '', progress: 0 });

    useEffect(() => {
        // Monitor network status
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
        });

        // Load stats safely
        loadStats().catch(err => {
            console.error('Error loading stats on mount:', err);
            // Don't crash, just set stats to null
        });

        return () => unsubscribe();
    }, []);

    const loadStats = async () => {
        try {
            const data = await syncService.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
            // Set default stats to prevent undefined errors
            setStats({
                customers: 0,
                products: 0,
                offlineCollections: 0,
                offlineOrders: 0,
                pendingCollections: 0,
                pendingOrders: 0,
                lastSyncTime: null,
                hasData: false,
                hasPendingUploads: false
            });
        }
    };

    const handleDownload = async () => {
        if (!isOnline) {
            Alert.alert(
                'No Internet',
                'Please connect to the internet to download data.'
            );
            return;
        }

        Alert.alert(
            'Download Data',
            'This will download all customers and products data to your device for offline use. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Download',
                    onPress: async () => {
                        setIsDownloading(true);

                        // Set progress callback
                        syncService.setProgressCallback((progressData) => {
                            setProgress(progressData);
                        });

                        try {
                            const result = await syncService.downloadAllData();

                            await loadStats();

                            Alert.alert(
                                'Success',
                                'All data has been downloaded successfully! The app will now work offline.',
                                [{ text: 'OK', onPress: onDownloadComplete }]
                            );
                        } catch (error) {
                            console.error('Download error:', error);
                            Alert.alert(
                                'Download Failed',
                                error.message || 'Failed to download data. Please try again.'
                            );
                        } finally {
                            setIsDownloading(false);
                            setProgress({ message: '', progress: 0 });
                        }
                    }
                }
            ]
        );
    };

    const handleRefreshData = async () => {
        if (!isOnline) {
            Alert.alert(
                'No Internet',
                'Please connect to the internet to refresh data.'
            );
            return;
        }

        Alert.alert(
            'Refresh Data',
            'Download latest customers and products from server?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Refresh',
                    onPress: async () => {
                        setIsSyncing(true);

                        // Set progress callback
                        syncService.setProgressCallback((progressData) => {
                            setProgress(progressData);
                        });

                        try {
                            // Only download data, don't upload
                            await syncService.downloadAllData();
                            await loadStats();

                            Alert.alert(
                                'Success',
                                'Data refreshed successfully! You have the latest customers and products.'
                            );
                        } catch (error) {
                            console.error('Refresh error:', error);
                            Alert.alert(
                                'Refresh Failed',
                                error.message || 'Failed to refresh data. Please try again.'
                            );
                        } finally {
                            setIsSyncing(false);
                            setProgress({ message: '', progress: 0 });
                        }
                    }
                }
            ]
        );
    };

    const formatLastSync = (timestamp) => {
        if (!timestamp) return 'Never';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    return (
        <Animated.View entering={FadeInDown.delay(150)} style={styles.container}>
            <View style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={isDownloading || isSyncing ? "cloud-download" : isOnline ? "cloud-done" : "cloud-offline"}
                            size={28}
                            color={isOnline ? "#4CAF50" : "#FF9800"}
                        />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>
                            {isDownloading ? 'Downloading...' : isSyncing ? 'Syncing...' : 'Offline Data'}
                        </Text>
                        <Text style={styles.subtitle}>
                            {isOnline ? 'Online' : 'Offline'} • Last sync: {formatLastSync(stats?.lastSyncTime)}
                        </Text>
                    </View>
                    {!isOnline && (
                        <View style={styles.offlineBadge}>
                            <Ionicons name="wifi-off" size={14} color="#fff" />
                        </View>
                    )}
                </View>

                {/* Progress Bar (when downloading) */}
                {isDownloading && (
                    <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>{progress.message}</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress.progress}%` }]} />
                        </View>
                        <Text style={styles.progressPercentage}>{Math.round(progress.progress)}%</Text>
                    </View>
                )}

                {/* Stats */}
                {!isDownloading && !isSyncing && stats && (
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <Ionicons name="people" size={20} color="#6b7c8a" />
                            <Text style={styles.statText}>{stats.customers} Customers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="cube" size={20} color="#6b7c8a" />
                            <Text style={styles.statText}>{stats.products} Products</Text>
                        </View>
                        {stats.hasPendingUploads && (
                            <View style={styles.statItem}>
                                <Ionicons name="cloud-upload" size={20} color="#FF9800" />
                                <Text style={[styles.statText, { color: '#FF9800' }]}>
                                    {stats.pendingCollections + stats.pendingOrders} Pending
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    {stats && stats.hasData ? (
                        <TouchableOpacity
                            style={[styles.button, styles.syncButton]}
                            onPress={handleRefreshData}
                            disabled={isDownloading || isSyncing || !isOnline}
                            activeOpacity={0.7}
                        >
                            {isSyncing ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.buttonText}>Refresh Data</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.button, styles.downloadButton]}
                            onPress={handleDownload}
                            disabled={isDownloading || isSyncing || !isOnline}
                            activeOpacity={0.7}
                        >
                            {isDownloading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="cloud-download" size={20} color="#fff" />
                                    <Text style={styles.buttonText}>Download Data</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Info Message */}
                {!stats?.hasData && !isDownloading && (
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={16} color="#1976D2" />
                        <Text style={styles.infoText}>
                            Download data to work offline. Upload collections/orders from the Upload screen.
                        </Text>
                    </View>
                )}

                {/* Pending uploads info */}
                {stats?.hasPendingUploads && !isDownloading && (
                    <View style={styles.warningBox}>
                        <Ionicons name="cloud-upload-outline" size={16} color="#FF9800" />
                        <Text style={styles.warningText}>
                            You have {stats.pendingCollections + stats.pendingOrders} pending items. Go to Upload screen to sync.
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        color: '#6b7c8a',
    },
    offlineBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FF9800',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressText: {
        fontSize: 13,
        color: '#6b7c8a',
        marginBottom: 8,
    },
    progressBar: {
        height: 6,
        backgroundColor: '#E0E0E0',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 3,
    },
    progressPercentage: {
        fontSize: 12,
        color: '#6b7c8a',
        textAlign: 'right',
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 13,
        color: '#6b7c8a',
        fontWeight: '500',
    },
    actions: {
        marginTop: 4,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    downloadButton: {
        backgroundColor: '#1976D2',
    },
    syncButton: {
        backgroundColor: '#4CAF50',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: '#1565C0',
        lineHeight: 16,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: '#E65100',
        lineHeight: 16,
    },
});
