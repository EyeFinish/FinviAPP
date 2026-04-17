import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registrarTokenPush } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registrarPush() {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await registrarTokenPush(tokenData.data, Platform.OS);
  } catch {
    // Push notifications no disponibles en este entorno
  }
}

function RootNavigator() {
  const { user, cargando, pendienteOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;

    const enAuth = segments[0] === '(auth)';
    const enTabs = segments[0] === '(tabs)';
    const enOnboarding = segments[0] === 'onboarding';

    if (!user && !enAuth) {
      router.replace('/(auth)/login');
    } else if (user && pendienteOnboarding && !enOnboarding) {
      router.replace('/onboarding');
    } else if (user && !pendienteOnboarding && !enTabs && !enOnboarding && segments[0] !== 'configuracion') {
      router.replace('/(tabs)');
    }

    // Registrar token push en cuanto el usuario está autenticado
    if (user) registrarPush();
  }, [user, cargando, pendienteOnboarding, segments]);

  // Navegar a la pantalla correcta al tocar una notificación (app en foreground o background)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen) router.push(screen);
    });
    return () => sub.remove();
  }, []);

  // Arranque en frío: la notificación abrió la app desde cerrada
  useEffect(() => {
    if (cargando || !user) return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const screen = response.notification.request.content.data?.screen;
      if (screen) router.push(screen);
    });
  }, [user, cargando]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
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
