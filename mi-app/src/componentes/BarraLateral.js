import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PieChart, Building2, Link2, Plus, ClipboardList } from 'lucide-react';
import '../estilos/sidebar.css';

function BarraLateral() {
  const location = useLocation();

  const esActivo = (ruta) => location.pathname === ruta;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-seccion-titulo">MENÚ PRINCIPAL</div>

        <Link to="/" className={`sidebar-item ${esActivo('/') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><LayoutDashboard size={20} /></span>
          <span className="sidebar-item-texto">Dashboard</span>
        </Link>

        <Link to="/estado" className={`sidebar-item ${esActivo('/estado') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><PieChart size={20} /></span>
          <span className="sidebar-item-texto">Estado financiero</span>
        </Link>

        <Link to="/obligaciones" className={`sidebar-item ${esActivo('/obligaciones') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><ClipboardList size={20} /></span>
          <span className="sidebar-item-texto">Obligación financiera</span>
        </Link>

        <Link to="/cuentas" className={`sidebar-item ${esActivo('/cuentas') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><Building2 size={20} /></span>
          <span className="sidebar-item-texto">Cuentas de banco</span>
        </Link>

        <Link to="/conexiones" className={`sidebar-item ${esActivo('/conexiones') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><Link2 size={20} /></span>
          <span className="sidebar-item-texto">Mis bancos</span>
        </Link>

        <div className="sidebar-separador"></div>
        <div className="sidebar-seccion-titulo">ACCIONES</div>

        <Link to="/conectar" className={`sidebar-item ${esActivo('/conectar') ? 'activo' : ''}`}>
          <span className="sidebar-item-icono"><Plus size={20} /></span>
          <span className="sidebar-item-texto">Conectar banco</span>
        </Link>
      </nav>
    </aside>
  );
}

export default BarraLateral;
