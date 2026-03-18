import React, { createContext, useContext, useState, useEffect } from 'react';
import { getItem, setItem, deleteItem } from '../utils/storage';
import { obtenerUsuarioActual } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarAuth();
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
    await setItem('finvi_token', token);
    await setItem('finvi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    await deleteItem('finvi_token');
    await deleteItem('finvi_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
