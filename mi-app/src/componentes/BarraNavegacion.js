import { Link } from 'react-router-dom';
import '../estilos/navbar.css';

function BarraNavegacion() {
  return (
    <nav className="navbar">
      <div className="navbar-contenedor">
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icono">F</div>
          <span className="navbar-logo-texto">Finvi</span>
        </Link>
      </div>
    </nav>
  );
}

export default BarraNavegacion;
