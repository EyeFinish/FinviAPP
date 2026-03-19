import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contextos/AuthContext';
import BarraNavegacion from './componentes/BarraNavegacion';
import BarraLateral from './componentes/BarraLateral';
import Dashboard from './componentes/Dashboard';
import ConectarBanco from './componentes/ConectarBanco';
import Configuracion from './componentes/Configuracion';
import Login from './componentes/Login';
import Registro from './componentes/Registro';
import './estilos/global.css';

function RutaProtegida({ children }) {
  const { user, cargando } = useAuth();

  if (cargando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function RutaPublica({ children }) {
  const { user, cargando } = useAuth();
  if (cargando) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="app">
      {user && <BarraNavegacion />}
      <div className={user ? 'app-cuerpo' : ''}>
        {user && <BarraLateral />}
        <div className={user ? 'contenido-principal' : ''}>
          <Routes>
            <Route path="/login" element={<RutaPublica><Login /></RutaPublica>} />
            <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />
            <Route path="/" element={<RutaProtegida><Dashboard seccion="dashboard" /></RutaProtegida>} />
            <Route path="/estado" element={<RutaProtegida><Dashboard seccion="estado" /></RutaProtegida>} />
            <Route path="/obligaciones" element={<RutaProtegida><Dashboard seccion="obligaciones" /></RutaProtegida>} />
            <Route path="/cuentas" element={<RutaProtegida><Dashboard seccion="cuentas" /></RutaProtegida>} />
            <Route path="/conexiones" element={<RutaProtegida><Dashboard seccion="conexiones" /></RutaProtegida>} />
            <Route path="/conectar" element={<RutaProtegida><ConectarBanco /></RutaProtegida>} />
            <Route path="/configuracion" element={<RutaProtegida><Configuracion /></RutaProtegida>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
