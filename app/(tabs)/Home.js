// app/(tabs)/Home.js
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BorderRadius, Colors, Gradients, Spacing, Typography } from '../../constants/theme';
import DownloadButton from '../../src/components/DownloadButton';
import OfflineIndicator from '../../src/components/OfflineIndicator';

const { width } = Dimensions.get('window');

const Home = ({ navigation }) => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const quickActions = [
    {
      icon: 'wallet-outline',
      title: 'COLLECTION',
      description: 'Record customer payments',
      onPress: () => router.push("/Collection/Collection"),
      gradient: Gradients.accent,
      shadowColor: Colors.accent.main,
    },
    {
      icon: 'cart-outline',
      title: 'SALES',
      description: 'Create a new sales entry',
      onPress: () => router.push("/Sales"),
      gradient: Gradients.success,
      shadowColor: Colors.success.main,
    },
    {
      icon: 'return-up-back-outline',
      title: 'SALES RETURN',
      description: 'Process a return',
      onPress: () => router.push("/Sales-Return"),
      gradient: Colors.primary[400] ? [Colors.primary[400], Colors.primary[600]] : Gradients.primary,
      shadowColor: Colors.primary.main,
    },
    {
      icon: 'cube-outline',
      title: 'ORDER',
      description: 'Place a new stock order',
      onPress: () => router.push("/Order/Entry"),
      gradient: Gradients.secondary,
      shadowColor: Colors.secondary.main,
    },
    {
      icon: 'receipt-outline',
      title: 'VIEW ORDERS',
      description: 'View all placed orders',
      onPress: () => router.push("/Order/PlaceOrder"),
      gradient: Gradients.ocean,
      shadowColor: Colors.secondary[600],
      highlight: true,
    },
  ];

  const getCurrentDate = () => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <LinearGradient colors={Gradients.background} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.primary[50]} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>Hello, User</Text>
                <Text style={styles.date}>{getCurrentDate()}</Text>
              </View>
              <View>
                <OfflineIndicator />
              </View>
            </View>
          </Animated.View>

          {/* Download/Sync Button */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
          >
            <DownloadButton />
          </Animated.View>

          {/* Quick Actions Grid */}
          <Animated.View
            style={[
              styles.actionsGrid,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <View style={styles.gridContainer}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionCardContainer,
                    action.highlight && styles.highlightCard
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={action.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.actionCard,
                      { shadowColor: action.shadowColor }
                    ]}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={action.icon}
                        size={28}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={styles.actionTitle}>
                        {action.title}
                      </Text>
                      <Text style={styles.actionDescription} numberOfLines={2}>
                        {action.description}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward-circle"
                      size={24}
                      color="rgba(255,255,255,0.6)"
                      style={styles.arrowIcon}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  date: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  actionsGrid: {
    marginTop: Spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  actionCardContainer: {
    width: (width - (Spacing.lg * 2) - Spacing.md) / 2, // calculate exact width for 2 columns
    marginBottom: Spacing.sm,
  },
  highlightCard: {
    width: '100%', // full width for highlighted card
  },
  actionCard: {
    height: 160,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)', // works on some versions, ignored on others
  },
  cardContent: {
    marginTop: Spacing.sm,
  },
  actionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  actionDescription: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    fontWeight: '500',
  },
  arrowIcon: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
});

export default Home;