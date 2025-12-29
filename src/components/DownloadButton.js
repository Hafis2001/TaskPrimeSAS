// src/components/DownloadButton.js - ENHANCED WITH CHECKLIST
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
    const [downloadStages, setDownloadStages] = useState({
        customers: { status: 'pending', message: 'Customers' },
        products: { status: 'pending', message: 'Products' },
        batches: { status: 'pending', message: 'Batches' },
        areas: { status: 'pending', message: 'Areas' }
    });
    const [overallProgress, setOverallProgress] = useState(0);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
        });

        loadStats();

        return () => unsubscribe();
    }, []);

    const loadStats = async () => {
        try {
            const data = await syncService.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
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

    const resetDownloadStages = () => {
        setDownloadStages({
            customers: { status: 'pending', message: 'Customers' },
            products: { status: 'pending', message: 'Products' },
            batches: { status: 'pending', message: 'Batches' },
            areas: { status: 'pending', message: 'Areas' }
        });
        setOverallProgress(0);
    };

    const handleDownload = async () => {
        if (!isOnline) {
            Alert.alert('No Internet', 'Please connect to the internet to download data.');
            return;
        }

        Alert.alert(
            'Download Data',
            'This will download all customers, products, and other data for offline use. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Download',
                    onPress: async () => {
                        setIsDownloading(true);
                        resetDownloadStages();

                        // Set progress callback
                        syncService.setProgressCallback((progressData) => {
                            const { stage, message, progress, completed } = progressData;
                            
                            setOverallProgress(progress);

                            // Update specific stage status
                            if (stage && stage !== 'init' && stage !== 'complete' && stage !== 'error') {
                                setDownloadStages(prev => ({
                                    ...prev,
                                    [stage]: {
                                        status: completed ? 'completed' : 'downloading',
                                        message: message
                                    }
                                }));
                            }
                        });

                        try {
                            const result = await syncService.downloadAllData(false);
                            await loadStats();

                            Alert.alert(
                                'Success ✅',
                                'All data downloaded successfully! The app will now work offline.',
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
                            resetDownloadStages();
                        }
                    }
                }
            ]
        );
    };

    const handleRefreshData = async () => {
        if (!isOnline) {
            Alert.alert('No Internet', 'Please connect to the internet to refresh data.');
            return;
        }

        Alert.alert(
            'Refresh Data',
            'This will clear old data and download the latest. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Refresh',
                    onPress: async () => {
                        setIsSyncing(true);
                        resetDownloadStages();

                        syncService.setProgressCallback((progressData) => {
                            const { stage, message, progress, completed } = progressData;
                            
                            setOverallProgress(progress);

                            if (stage && stage !== 'init' && stage !== 'complete' && stage !== 'error') {
                                setDownloadStages(prev => ({
                                    ...prev,
                                    [stage]: {
                                        status: completed ? 'completed' : 'downloading',
                                        message: message
                                    }
                                }));
                            }
                        });

                        try {
                            await syncService.downloadAllData(true); // Force refresh
                            await loadStats();

                            Alert.alert('Success ✅', 'Data refreshed successfully!');
                        } catch (error) {
                            console.error('Refresh error:', error);
                            Alert.alert('Refresh Failed', error.message || 'Failed to refresh data.');
                        } finally {
                            setIsSyncing(false);
                            resetDownloadStages();
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

    const getStageIcon = (status) => {
        switch (status) {
            case 'completed':
                return <Ionicons name="checkmark-circle" size={20} color={Colors.success.main} />;
            case 'downloading':
                return <ActivityIndicator size="small" color={Colors.primary.main} />;
            case 'failed':
                return <Ionicons name="close-circle" size={20} color={Colors.error.main} />;
            default:
                return <Ionicons name="ellipse-outline" size={20} color={Colors.neutral[300]} />;
        }
    };

    return (
        <Animated.View entering={FadeInDown.delay(150)} style={styles.container}>
            <LinearGradient colors={['#ffffff', '#fcfcfc']} style={styles.card}>
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
                            {isDownloading ? 'Downloading...' : isSyncing ? 'Refreshing...' : 'Data Sync'}
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

                {/* Download Checklist */}
                {(isDownloading || isSyncing) && (
                    <View style={styles.checklistContainer}>
                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBar}>
                                <LinearGradient
                                    colors={Gradients.primary}
                                    style={[styles.progressFill, { width: `${overallProgress}%` }]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                />
                            </View>
                            <Text style={styles.progressPercentage}>{Math.round(overallProgress)}%</Text>
                        </View>

                        <View style={styles.checklist}>
                            {Object.entries(downloadStages).map(([key, stage]) => (
                                <View key={key} style={styles.checklistItem}>
                                    {getStageIcon(stage.status)}
                                    <Text style={[
                                        styles.checklistText,
                                        stage.status === 'completed' && styles.checklistTextCompleted
                                    ]}>
                                        {stage.message}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Stats */}
                {!isDownloading && !isSyncing && stats && (
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <Ionicons name="people" size={18} color={Colors.text.secondary} />
                            <Text style={styles.statText}>{stats.customers || 0} Customers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="cube" size={18} color={Colors.text.secondary} />
                            <Text style={styles.statText}>{stats.products || 0} Products</Text>
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
                                colors={Gradients.secondary}
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
                                colors={Gradients.primary}
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

                {/* Info Messages */}
                {!stats?.hasData && !isDownloading && (
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={18} color={Colors.primary.main} />
                        <Text style={styles.infoText}>
                            Download data once to work offline. Data persists across app restarts.
                        </Text>
                    </View>
                )}

                {stats?.hasPendingUploads && !isDownloading && (
                    <View style={styles.warningBox}>
                        <Ionicons name="cloud-upload-outline" size={18} color={Colors.warning.dark} />
                        <Text style={styles.warningText}>
                            {stats.pendingCollections + stats.pendingOrders} pending uploads. Sync from Upload screen.
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
    checklistContainer: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.neutral[50],
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    progressBarContainer: {
        marginBottom: Spacing.md,
    },
    progressBar: {
        height: 8,
        backgroundColor: Colors.neutral[200],
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressPercentage: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.secondary,
        textAlign: 'right',
        fontWeight: '600',
    },
    checklist: {
        gap: Spacing.sm,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    checklistText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    checklistTextCompleted: {
        color: Colors.success.main,
        fontWeight: '600',
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