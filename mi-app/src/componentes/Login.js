import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUsuario } from '../servicios/api';
import { useAuth } from '../contextos/AuthContext';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import '../estilos/auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUsuario({ email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
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
        <h1 className="auth-titulo">Iniciar sesión</h1>
        <p className="auth-subtitulo">Ingresa a tu cuenta para continuar</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
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
                placeholder="••••••••"
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

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Ingresando...' : <><LogIn size={18} /> Iniciar sesión</>}
          </button>
        </form>

        <p className="auth-footer">
          ¿No tienes cuenta? <Link to="/registro" className="auth-link">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
