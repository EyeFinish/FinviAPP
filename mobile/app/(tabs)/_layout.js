import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { Redirect } from 'expo-router';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';

function HeaderRight() {
  const router = useRouter();
  const { logout } = useAuth();

  const confirmarCerrarSesion = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres cerrar la sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={hs.row}>
      <TouchableOpacity style={hs.btn} onPress={() => router.push('/configuracion')}>
        <Ionicons name="settings-outline" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={hs.btn} onPress={confirmarCerrarSesion}>
        <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </View>
  );
}

function HeaderTitle({ title }) {
  const { user } = useAuth();
  return (
    <View style={{ marginLeft: 12 }}>
      <Text style={hs.title}>{title}</Text>
      {user && <Text style={hs.subtitle}>{user.nombre}</Text>}
    </View>
  );
}

const hs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 8 },
  btn: { padding: 8, borderRadius: 20 },
  title: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.xs },
});

export default function TabLayout() {
  const { user, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primario} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerBackground: () => (
          <View style={{
            position: 'absolute', top: 8, left: 12, right: 12, bottom: 0,
            backgroundColor: Colors.primario,
            borderRadius: 20,
          }} />
        ),
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: Colors.primario,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          position: 'absolute',
          bottom: 16,
          left: 20,
          right: 20,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#fff',
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 8 },
        tabBarIconStyle: { marginTop: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerTitle: () => <HeaderTitle title="Finvi" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="estado"
        options={{
          title: 'Estado',
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="obligaciones"
        options={{
          title: 'Obligaciones',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cuentas"
        options={{
          title: 'Cuentas',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
