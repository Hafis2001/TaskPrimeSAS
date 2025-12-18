// src/components/DownloadButton.js
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
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
import { BorderRadius, Colors, Gradients, Shadows, Spacing, Typography } from '../../constants/theme';
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
            <LinearGradient
                colors={['#ffffff', '#fcfcfc']}
                style={styles.card}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={
                                isDownloading || isSyncing ? Gradients.primary :
                                    isOnline ? Gradients.success : Gradients.warning
                            }
                            style={styles.iconGradient}
                        >
                            <Ionicons
                                name={isDownloading || isSyncing ? "cloud-download" : isOnline ? "cloud-done" : "cloud-offline"}
                                size={24}
                                color="#FFF"
                            />
                        </LinearGradient>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>
                            {isDownloading ? 'Downloading...' : isSyncing ? 'Syncing...' : 'Data Sync'}
                        </Text>
                        <Text style={styles.subtitle}>
                            {isOnline ? 'Online' : 'Offline'} • Last sync: {formatLastSync(stats?.lastSyncTime)}
                        </Text>
                    </View>
                    {!isOnline && (
                        <View style={styles.offlineBadge}>
                            <Ionicons name="wifi-off" size={12} color="#fff" />
                        </View>
                    )}
                </View>

                {/* Progress Bar (when downloading) */}
                {isDownloading && (
                    <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>{progress.message}</Text>
                        <View style={styles.progressBar}>
                            <LinearGradient
                                colors={Gradients.primary}
                                style={[styles.progressFill, { width: `${progress.progress}%` }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                        </View>
                        <Text style={styles.progressPercentage}>{Math.round(progress.progress)}%</Text>
                    </View>
                )}

                {/* Stats */}
                {!isDownloading && !isSyncing && stats && (
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <Ionicons name="people" size={18} color={Colors.text.secondary} />
                            <Text style={styles.statText}>{stats.customers} Customers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="cube" size={18} color={Colors.text.secondary} />
                            <Text style={styles.statText}>{stats.products} Products</Text>
                        </View>
                        {stats.hasPendingUploads && (
                            <View style={styles.statItem}>
                                <Ionicons name="cloud-upload" size={18} color={Colors.warning.main} />
                                <Text style={[styles.statText, { color: Colors.warning.main, fontWeight: '700' }]}>
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
                            style={styles.buttonWrapper}
                            onPress={handleRefreshData}
                            disabled={isDownloading || isSyncing || !isOnline}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={Gradients.secondary} // Teal for refresh/sync
                                style={styles.buttonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isSyncing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="refresh" size={20} color="#fff" />
                                        <Text style={styles.buttonText}>Refresh Data</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.buttonWrapper}
                            onPress={handleDownload}
                            disabled={isDownloading || isSyncing || !isOnline}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={Gradients.primary} // Indigo for initial download
                                style={styles.buttonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isDownloading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-download" size={20} color="#fff" />
                                        <Text style={styles.buttonText}>Download Data</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Info Message */}
                {!stats?.hasData && !isDownloading && (
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={18} color={Colors.primary.main} />
                        <Text style={styles.infoText}>
                            Download data to work offline. Upload collections/orders from the Upload screen.
                        </Text>
                    </View>
                )}

                {/* Pending uploads info */}
                {stats?.hasPendingUploads && !isDownloading && (
                    <View style={styles.warningBox}>
                        <Ionicons name="cloud-upload-outline" size={18} color={Colors.warning.dark} />
                        <Text style={styles.warningText}>
                            You have {stats.pendingCollections + stats.pendingOrders} pending items. Go to Upload screen to sync.
                        </Text>
                    </View>
                )}
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md,
        borderRadius: BorderRadius.xl,
        ...Shadows.md,
        backgroundColor: '#fff',
    },
    card: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    iconContainer: {
        marginRight: Spacing.md,
        ...Shadows.sm,
    },
    iconGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
    },
    offlineBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.warning.main,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    progressContainer: {
        marginBottom: Spacing.md,
    },
    progressText: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
        marginBottom: 8,
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.neutral[200],
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressPercentage: {
        fontSize: 10,
        color: Colors.text.tertiary,
        textAlign: 'right',
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: Spacing.md,
        gap: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    actions: {
        marginTop: 4,
    },
    buttonWrapper: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.sm,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    buttonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: '#fff',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary[50],
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginTop: Spacing.sm,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    infoText: {
        flex: 1,
        fontSize: Typography.sizes.xs,
        color: Colors.primary.dark,
        lineHeight: 16,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning[50],
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginTop: Spacing.sm,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.warning[200],
    },
    warningText: {
        flex: 1,
        fontSize: Typography.sizes.xs,
        color: Colors.warning.dark,
        lineHeight: 16,
    },
});
