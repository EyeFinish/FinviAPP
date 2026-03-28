import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';

function RootNavigator() {
  const { user, cargando } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;

    const enAuth = segments[0] === '(auth)';
    const enTabs = segments[0] === '(tabs)';

    if (!user && !enAuth) {
      router.replace('/(auth)/login');
    } else if (user && !enTabs && segments[0] !== 'configuracion') {
      router.replace('/(tabs)');
    }
  }, [user, cargando]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="configuracion" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
