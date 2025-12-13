// Company.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { useEffect, useRef } from 'react';


const Home = ({ navigation }) => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
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
      bgColor: '#FFF5F0',
      iconBg: '#FFE8DD',
      titleColor: '#D2916B',
      borderColor: '#F4D4C4',
    },
    {
      icon: 'cart-outline',
      title: 'SALES',
      description: 'Create a new sales entry',
      onPress: () => router.push("/Sales"),
      bgColor: '#F0FFF5',
      iconBg: '#DDF5E8',
      titleColor: '#7AB89A',
      borderColor: '#C4E8D4',
    },
    {
      icon: 'return-up-back-outline',
      title: 'SALES RETURN',
      description: 'Process a return',
      onPress: () => router.push("/Sales-Return"),
      bgColor: '#F8F0FF',
      iconBg: '#EBE0FF',
      titleColor: '#A88BC4',
      borderColor: '#D9CCE8',
    },
    {
      icon: 'cube-outline',
      title: 'ORDER',
      description: 'Place a new stock order',
      onPress: () => router.push("/Order/Entry"),
      bgColor: '#F0F8FF',
      iconBg: '#DDE8F5',
      titleColor: '#7A9BB8',
      borderColor: '#C4D4E8',
    },
    {
      icon: 'receipt-outline',
      title: 'VIEW ORDERS',
      description: 'View all placed orders',
      onPress: () => router.push("/Order/PlaceOrder"),
      bgColor: '#FFF8F0',
      iconBg: '#FFE8DD',
      titleColor: '#D2A16B',
      borderColor: '#F4D9C4',
      highlight: true,
    },
  ];

  const getCurrentDate = () => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5FF" />
      
      <View style={styles.content}>
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
          <Text style={styles.date}>{getCurrentDate()}</Text>
          {/* <Text style={styles.mainTitle}>HOME DASHBOARD</Text> */}
        </Animated.View>

        {/* Quick Actions Grid */}
        <Animated.View 
          style={[
            styles.actionsGrid,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionCard,
                { 
                  backgroundColor: action.bgColor,
                  borderColor: action.borderColor,
                }
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                { backgroundColor: action.iconBg }
              ]}>
                <Ionicons 
                  name={action.icon} 
                  size={32} 
                  color={action.titleColor}
                />
              </View>
              <Text style={[styles.actionTitle, { color: action.titleColor }]}>
                {action.title}
              </Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerSection: {
    marginBottom: 32,
  },
  date: {
    fontSize: 16,
    color: '#9B9BA5',
    marginBottom: 8,
    fontWeight: '400',
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#A8B8E0',
    letterSpacing: 1,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '47.5%',
    height: 170,
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  actionDescription: {
    fontSize: 13,
    color: '#1A1A1A',
    lineHeight: 18,
    fontWeight: '400',
  },
});

export default Home;