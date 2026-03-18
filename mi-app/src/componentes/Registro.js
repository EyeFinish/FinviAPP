import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrarUsuario } from '../servicios/api';
import { useAuth } from '../contextos/AuthContext';
import { UserPlus, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import '../estilos/auth.css';

function Registro() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const data = await registrarUsuario({ nombre, email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-pagina">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icono">F</div>
          <span className="auth-logo-texto">Finvi</span>
        </div>
        <h1 className="auth-titulo">Crear cuenta</h1>
        <p className="auth-subtitulo">Comienza a gestionar tus finanzas</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-campo">
            <label className="auth-label">Nombre</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icono" />
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="auth-input"
                placeholder="Tu nombre"
                required
              />
            </div>
          </div>

          <div className="auth-campo">
            <label className="auth-label">Email</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icono" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          <div className="auth-campo">
            <label className="auth-label">Contraseña</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icono" />
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
              <button
                type="button"
                className="auth-toggle-password"
                onClick={() => setVerPassword(!verPassword)}
              >
                {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-campo">
            <label className="auth-label">Confirmar contraseña</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icono" />
              <input
                type={verPassword ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="auth-input"
                placeholder="Repite tu contraseña"
                minLength={6}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creando cuenta...' : <><UserPlus size={18} /> Crear cuenta</>}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/login" className="auth-link">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

export default Registro;
