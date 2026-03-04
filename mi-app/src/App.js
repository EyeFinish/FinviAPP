import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BarraNavegacion from './componentes/BarraNavegacion';
import BarraLateral from './componentes/BarraLateral';
import Dashboard from './componentes/Dashboard';
import ConectarBanco from './componentes/ConectarBanco';
import './estilos/global.css';

function App() {
  return (
    <Router>
      <div className="app">
        <BarraNavegacion />
        <div className="app-cuerpo">
          <BarraLateral />
          <div className="contenido-principal">
            <Routes>
              <Route path="/" element={<Dashboard seccion="dashboard" />} />
              <Route path="/creditos" element={<Dashboard seccion="creditos" />} />
              <Route path="/flujo-caja" element={<Dashboard seccion="flujo-caja" />} />
              <Route path="/cuentas" element={<Dashboard seccion="cuentas" />} />
              <Route path="/conexiones" element={<Dashboard seccion="conexiones" />} />
              <Route path="/conectar" element={<ConectarBanco />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
