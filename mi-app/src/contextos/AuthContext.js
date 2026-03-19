import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { obtenerUsuarioActual } from '../servicios/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('finvi_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [cargando, setCargando] = useState(true);

  const verificarAuth = useCallback(async () => {
    const token = localStorage.getItem('finvi_token');
    if (!token) {
      setUser(null);
      setCargando(false);
      return;
    }
    try {
      const userData = await obtenerUsuarioActual();
      setUser(userData);
      localStorage.setItem('finvi_user', JSON.stringify(userData));
    } catch {
      setUser(null);
      localStorage.removeItem('finvi_token');
      localStorage.removeItem('finvi_user');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    verificarAuth();
  }, [verificarAuth]);

  const login = (token, userData) => {
    localStorage.setItem('finvi_token', token);
    localStorage.setItem('finvi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('finvi_token');
    localStorage.removeItem('finvi_user');
    setUser(null);
  };

  const actualizarUsuario = (nuevosDatos) => {
    const updated = { ...user, ...nuevosDatos };
    setUser(updated);
    localStorage.setItem('finvi_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, cargando, login, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
