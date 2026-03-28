import React, { createContext, useContext, useState, useEffect } from 'react';
import { getItem, setItem, deleteItem } from '../utils/storage';
import { obtenerUsuarioActual, setOnUnauthorized } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

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
    } catch {
      await deleteItem('finvi_token');
      await deleteItem('finvi_user');
      setUser(null);
    } finally {
      setCargando(false);
    }
  };

  const login = async (token, userData) => {
    try {
      await setItem('finvi_token', token);
      await setItem('finvi_user', JSON.stringify(userData));
    } catch {
      // Si falla el storage, el login sigue funcionando en memoria
    }
    setUser(userData);
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

  return (
    <AuthContext.Provider value={{ user, cargando, login, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
