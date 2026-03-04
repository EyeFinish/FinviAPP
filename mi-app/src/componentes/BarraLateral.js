import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { obtenerCreditosPendientes } from '../servicios/api';
import '../estilos/sidebar.css';

function BarraLateral() {
  const location = useLocation();
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await obtenerCreditosPendientes();
        setPendientesCount(data.length);
      } catch (err) {
        /* silenciar */
      }
    };
    cargar();
    const interval = setInterval(cargar, 30000);
    return () => clearInterval(interval);
  }, []);

  const esActivo = (ruta) => location.pathname === ruta;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-seccion-titulo">MENÚ PRINCIPAL</div>

        <Link to="/" className={`sidebar-item ${esActivo('/') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">📊</span>
          <span className="sidebar-item-texto">Dashboard</span>
        </Link>

        <Link to="/creditos" className={`sidebar-item ${esActivo('/creditos') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">💳</span>
          <span className="sidebar-item-texto">Créditos activos</span>
          {pendientesCount > 0 && (
            <span className="sidebar-badge">{pendientesCount}</span>
          )}
        </Link>

        <Link to="/flujo-caja" className={`sidebar-item ${esActivo('/flujo-caja') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">📈</span>
          <span className="sidebar-item-texto">Flujo de caja</span>
        </Link>

        <Link to="/cuentas" className={`sidebar-item ${esActivo('/cuentas') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">🏦</span>
          <span className="sidebar-item-texto">Cuentas de banco</span>
        </Link>

        <Link to="/conexiones" className={`sidebar-item ${esActivo('/conexiones') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">🔗</span>
          <span className="sidebar-item-texto">Mis bancos</span>
        </Link>

        <div className="sidebar-separador"></div>
        <div className="sidebar-seccion-titulo">ACCIONES</div>

        <Link to="/conectar" className={`sidebar-item ${esActivo('/conectar') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono">🔗</span>
          <span className="sidebar-item-texto">Conectar banco</span>
        </Link>
      </nav>
    </aside>
  );
}

export default BarraLateral;
