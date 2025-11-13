// Drawer navigator has been replaced by bottom tabs.
import { Text, View } from 'react-native';

export default function DrawerNavigator() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Deprecated navigator. Use the bottom tabs (Company, Customers, Area, Users).</Text>
    </View>
  );
}