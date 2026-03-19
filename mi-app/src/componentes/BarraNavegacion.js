import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contextos/AuthContext';
import { LogOut, Settings } from 'lucide-react';
import '../estilos/navbar.css';
import '../estilos/auth.css';

function BarraNavegacion() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const obtenerIniciales = (nombre) => {
    return nombre
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="navbar">
      <div className="navbar-contenedor">
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icono">F</div>
          <span className="navbar-logo-texto">Finvi</span>
        </Link>

        {user && (
          <div className="navbar-usuario">
            <div className="navbar-usuario-avatar">
              {obtenerIniciales(user.nombre)}
            </div>
            <div className="navbar-usuario-info">
              <span className="navbar-usuario-nombre">{user.nombre}</span>
              <span className="navbar-usuario-email">{user.email}</span>
            </div>
            <button className="navbar-btn-config" onClick={() => navigate('/configuracion')} title="Configuración">
              <Settings size={16} />
            </button>
            <button className="navbar-btn-salir" onClick={handleLogout}>
              <LogOut size={14} /> Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default BarraNavegacion;
