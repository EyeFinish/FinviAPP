import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primario }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}
