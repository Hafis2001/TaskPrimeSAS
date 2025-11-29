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
} from 'react-native';

const Home = ({ navigation }) => {

const router = useRouter();

  const quickActions = [
    {
      icon: 'wallet-outline',
      title: 'COLLECTION',
      description: 'Record customer payments',
      onPress: () => router.push("/Collection"),
    },
    {
      icon: 'cart-outline',
      title: 'SALES',
      description: 'Create a new sales entry',
      onPress: () => router.push("/Sales"),
    },
    {
      icon: 'return-up-back-outline',
      title: 'SALES RETURN',
      description: 'Process a return',
      onPress: () => router.push("/Sales-Return"),
    },
    {
      icon: 'cube-outline',
      title: 'ORDER',
      description: 'Place a new stock order',
      onPress: () => router.push("/Order/Entry"),
    },
    {
      icon: 'receipt-outline',
      title: 'VIEW ORDERS',
      description: 'View all placed orders',
      onPress: () => router.push("/Order/PlaceOrder"),
      highlight: true,
    },
  ];

  const getCurrentDate = () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      
      <View style={styles.content}>
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.date}>{getCurrentDate()}</Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionCard,
                action.highlight && styles.highlightCard
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                action.highlight && styles.highlightIconContainer
              ]}>
                <Ionicons 
                  name={action.icon} 
                  size={24} 
                  color={action.highlight ? "#303cacff" : "#3b82f6"} 
                />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Punch In Button - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.punchButton}
          onPress={() => router.push("/Punch-In")}
          activeOpacity={0.8}
        >
          <Ionicons name="finger-print-outline" size={20} color="#ffffff" />
          <Text style={styles.punchButtonText}>PUNCH IN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  greetingSection: {
    marginBottom: 40,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  date: {
    fontSize: 18,
    color: '#a7a7afff',
    marginTop: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  highlightCard: {
    borderColor: '#22204eff',
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  highlightIconContainer: {
    backgroundColor: '#2a265aff',
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  actionDescription: {
    fontSize: 11,
    color: '#71717a',
    lineHeight: 16,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  punchButton: {
    backgroundColor: '#3155c2ff',
    borderRadius: 8,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  punchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default Home;