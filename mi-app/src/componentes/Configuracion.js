import { useState } from 'react';
import { useAuth } from '../contextos/AuthContext';
import { actualizarPerfil, cambiarPassword, eliminarCuenta } from '../servicios/api';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Trash2, HelpCircle, ChevronDown, AlertTriangle, Check, X } from 'lucide-react';
import '../estilos/configuracion.css';

const FAQ = [
  { q: '¿Cómo conecto mi banco?', r: 'Ve a "Conectar banco" en el menú lateral. Selecciona tu banco e ingresa tus credenciales. Usamos Fintoc, una plataforma segura que no almacena tus claves bancarias.' },
  { q: '¿Mis datos bancarios están seguros?', r: 'Sí. Nos conectamos a tu banco a través de Fintoc, certificado por la CMF. Nunca almacenamos tus credenciales bancarias, solo la información de tus movimientos.' },
  { q: '¿Cómo se categorizan mis gastos?', r: 'Los gastos se categorizan automáticamente según el nombre del comercio. Si un gasto queda en "Otros", puedes reasignarlo a la categoría correcta y se recordará para futuras transacciones.' },
  { q: '¿Qué es el estado financiero?', r: 'Es un resumen mensual de tus ingresos y gastos, organizados por categoría. Te permite ver en qué estás gastando más y cómo cambia mes a mes.' },
  { q: '¿Cómo registro una obligación financiera?', r: 'En "Obligación financiera" puedes agregar ingresos fijos, costos fijos (arriendos, servicios) y deudas con su tabla de amortización. Esto te permite proyectar tu flujo de caja.' },
  { q: '¿Puedo usar Finvi en mi celular?', r: 'Sí. Finvi tiene una app móvil disponible que se sincroniza con tu cuenta. Todos tus datos están disponibles en ambas plataformas.' },
];

export default function Configuracion() {
  const { user, logout, actualizarUsuario } = useAuth();
  const navigate = useNavigate();

  // Perfil
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [perfilMsg, setPerfilMsg] = useState(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // Password
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  // Eliminar cuenta
  const [modalEliminar, setModalEliminar] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // FAQ
  const [faqAbierto, setFaqAbierto] = useState(null);

  const guardarPerfil = async () => {
    setPerfilMsg(null);
    if (!nombre.trim()) return setPerfilMsg({ tipo: 'error', texto: 'El nombre es requerido' });
    if (!email.trim()) return setPerfilMsg({ tipo: 'error', texto: 'El email es requerido' });
    setGuardandoPerfil(true);
    try {
      const updated = await actualizarPerfil({ nombre: nombre.trim(), email: email.trim() });
      actualizarUsuario(updated);
      setPerfilMsg({ tipo: 'exito', texto: 'Perfil actualizado correctamente' });
    } catch (err) {
      setPerfilMsg({ tipo: 'error', texto: err.response?.data?.message || 'Error al actualizar' });
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleCambiarPassword = async () => {
    setPasswordMsg(null);
    if (!passwordActual) return setPasswordMsg({ tipo: 'error', texto: 'Ingresa tu contraseña actual' });
    if (passwordNueva.length < 6) return setPasswordMsg({ tipo: 'error', texto: 'La nueva contraseña debe tener al menos 6 caracteres' });
    if (passwordNueva !== passwordConfirm) return setPasswordMsg({ tipo: 'error', texto: 'Las contraseñas no coinciden' });
    setGuardandoPassword(true);
    try {
      await cambiarPassword({ passwordActual, passwordNueva });
      setPasswordMsg({ tipo: 'exito', texto: 'Contraseña actualizada correctamente' });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirm('');
    } catch (err) {
      setPasswordMsg({ tipo: 'error', texto: err.response?.data?.message || 'Error al cambiar contraseña' });
    } finally {
      setGuardandoPassword(false);
    }
  };

  const handleEliminarCuenta = async () => {
    setDeleteMsg(null);
    if (confirmText !== 'ELIMINAR') return setDeleteMsg({ tipo: 'error', texto: 'Escribe ELIMINAR para confirmar' });
    if (!deletePassword) return setDeleteMsg({ tipo: 'error', texto: 'Ingresa tu contraseña' });
    setEliminando(true);
    try {
      await eliminarCuenta(deletePassword);
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteMsg({ tipo: 'error', texto: err.response?.data?.message || 'Error al eliminar cuenta' });
      setEliminando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="config-container">
      <h1 className="config-titulo">Configuración</h1>

      {/* PERFIL */}
      <div className="config-card">
        <h2 className="config-card-titulo"><User size={18} /> Datos personales</h2>
        {perfilMsg && (
          <div className={`config-msg config-msg-${perfilMsg.tipo}`}>
            {perfilMsg.tipo === 'exito' ? <Check size={14} /> : <X size={14} />}
            {perfilMsg.texto}
          </div>
        )}
        <div className="config-campo">
          <label className="config-label">Nombre</label>
          <input className="config-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
        </div>
        <div className="config-campo">
          <label className="config-label">Email</label>
          <input className="config-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        </div>
        {user?.creadoEn && (
          <p className="config-info-fecha">Cuenta creada el {formatearFecha(user.creadoEn)}</p>
        )}
        <button className="config-btn config-btn-primario" onClick={guardarPerfil} disabled={guardandoPerfil} style={{ marginTop: 12 }}>
          {guardandoPerfil ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* SEGURIDAD */}
      <div className="config-card">
        <h2 className="config-card-titulo"><Lock size={18} /> Cambiar contraseña</h2>
        {passwordMsg && (
          <div className={`config-msg config-msg-${passwordMsg.tipo}`}>
            {passwordMsg.tipo === 'exito' ? <Check size={14} /> : <X size={14} />}
            {passwordMsg.texto}
          </div>
        )}
        <div className="config-campo">
          <label className="config-label">Contraseña actual</label>
          <input className="config-input" type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="config-campo">
          <label className="config-label">Nueva contraseña</label>
          <input className="config-input" type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        <div className="config-campo">
          <label className="config-label">Confirmar nueva contraseña</label>
          <input className="config-input" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Repite la nueva contraseña" />
        </div>
        <button className="config-btn config-btn-primario" onClick={handleCambiarPassword} disabled={guardandoPassword}>
          {guardandoPassword ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </div>

      {/* AYUDA */}
      <div className="config-card">
        <h2 className="config-card-titulo"><HelpCircle size={18} /> Ayuda</h2>
        {FAQ.map((item, i) => (
          <div key={i} className="config-faq-item">
            <button className="config-faq-pregunta" onClick={() => setFaqAbierto(faqAbierto === i ? null : i)}>
              {item.q}
              <ChevronDown size={16} className={`config-faq-chevron ${faqAbierto === i ? 'abierto' : ''}`} />
            </button>
            {faqAbierto === i && <p className="config-faq-respuesta">{item.r}</p>}
          </div>
        ))}
      </div>

      {/* ZONA PELIGRO */}
      <div className="config-card config-peligro">
        <h2 className="config-card-titulo"><AlertTriangle size={18} /> Zona de peligro</h2>
        <p className="config-peligro-desc">
          Eliminar tu cuenta es una acción permanente. Se borrarán todos tus datos: cuentas bancarias, movimientos, obligaciones, créditos y configuraciones. Esta acción no se puede deshacer.
        </p>
        <button className="config-btn config-btn-peligro" onClick={() => setModalEliminar(true)}>
          <Trash2 size={14} /> Eliminar mi cuenta
        </button>
      </div>

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {modalEliminar && (
        <div className="config-modal-overlay" onClick={() => setModalEliminar(false)}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="config-modal-titulo"><AlertTriangle size={20} /> Eliminar cuenta</h3>
            <p className="config-modal-desc">
              Esta acción eliminará permanentemente tu cuenta y todos tus datos. Para confirmar, escribe <strong>ELIMINAR</strong> y luego ingresa tu contraseña.
            </p>
            {deleteMsg && (
              <div className={`config-msg config-msg-${deleteMsg.tipo}`}>
                <X size={14} /> {deleteMsg.texto}
              </div>
            )}
            <div className="config-campo">
              <label className="config-label">Escribe ELIMINAR para confirmar</label>
              <input className="config-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ELIMINAR" />
            </div>
            <div className="config-campo">
              <label className="config-label">Tu contraseña</label>
              <input className="config-input" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="config-modal-acciones">
              <button className="config-btn config-btn-cancelar" onClick={() => { setModalEliminar(false); setConfirmText(''); setDeletePassword(''); setDeleteMsg(null); }}>
                Cancelar
              </button>
              <button className="config-btn config-btn-peligro" onClick={handleEliminarCuenta} disabled={eliminando}>
                {eliminando ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
