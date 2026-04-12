import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { getItem, setItem, deleteItem } from '../utils/storage';
import { obtenerUsuarioActual, obtenerEstadoSuscripcion, setOnUnauthorized } from '../services/api';
import { inicializarPurchases } from '../services/purchases';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pendienteOnboarding, setPendienteOnboarding] = useState(false);

  useEffect(() => {
    verificarAuth();
    // Registrar callback para 401 → cierra sesión en el estado React
    setOnUnauthorized(() => setUser(null));
    return () => setOnUnauthorized(null);
  }, []);

  const verificarAuth = async () => {
    try {
      const token = await getItem('finvi_token');
      if (!token) {
        setCargando(false);
        return;
      }
      const res = await obtenerUsuarioActual();
      setUser(res.data);
      // Leer flag de onboarding pendiente
      const flag = await getItem('finvi_onboarding_pending');
      setPendienteOnboarding(flag === '1');
      // Inicializar RevenueCat SDK solo en nativo (no en web)
      if (Platform.OS !== 'web') {
        await inicializarPurchases(res.data.id);
      }
    } catch {
      await deleteItem('finvi_token');
      await deleteItem('finvi_user');
      setUser(null);
    } finally {
      setCargando(false);
    }
  };

  const marcarOnboardingCompleto = async () => {
    await deleteItem('finvi_onboarding_pending');
    setPendienteOnboarding(false);
  };

  const login = async (token, userData, esNuevoUsuario = false) => {
    try {
      await setItem('finvi_token', token);
      await setItem('finvi_user', JSON.stringify(userData));
    } catch {
      // Si falla el storage, el login sigue funcionando en memoria
    }
    if (esNuevoUsuario) setPendienteOnboarding(true);
    setUser(userData);
    // Inicializar RevenueCat SDK solo en nativo
    if (Platform.OS !== 'web') {
      await inicializarPurchases(userData.id);
    }
  };

  const logout = async () => {
    try {
      await deleteItem('finvi_token');
      await deleteItem('finvi_user');
    } catch {
      // Ignorar error de storage, igual cerramos sesión
    }
    setUser(null);
  };

  const actualizarUsuario = async (nuevosDatos) => {
    if (!user) return;
    const updated = { ...user, ...nuevosDatos };
    setUser(updated);
    try {
      await setItem('finvi_user', JSON.stringify(updated));
    } catch {
      // Si falla el storage, el estado en memoria ya fue actualizado
    }
  };

  // Refresca el estado de suscripción desde el backend y actualiza el contexto
  const refrescarSuscripcion = async () => {
    try {
      const res = await obtenerEstadoSuscripcion();
      await actualizarUsuario({ suscripcion: res.data });
    } catch {
      // Si falla, no interrumpir la experiencia del usuario
    }
  };

  return (
    <AuthContext.Provider value={{ user, cargando, pendienteOnboarding, login, logout, actualizarUsuario, refrescarSuscripcion, marcarOnboardingCompleto }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
