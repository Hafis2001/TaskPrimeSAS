import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4fd1c5',
        tabBarInactiveTintColor: '#9aa4b2',
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: '#0b132b',
        },
        tabBarIcon: ({ color, size }) => {
          let name = 'square';
          if (route.name === 'company-info') name = 'business';
          else if (route.name === 'customers') name = 'people';
          else if (route.name === 'area-assign') name = 'map';
          else if (route.name === 'user-management') name = 'person';
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="company-info" options={{ title: 'Company' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="area-assign" options={{ title: 'Area' }} />
      <Tabs.Screen name="user-management" options={{ title: 'Users' }} />
    </Tabs>
  );
}
