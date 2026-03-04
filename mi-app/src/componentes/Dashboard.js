import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { obtenerCuentas, refrescarDatos, obtenerResumenCreditos, eliminarCredito, obtenerConexiones, eliminarConexion, obtenerCreditosPendientes } from '../servicios/api';
import TarjetaCuenta from '../componentes/TarjetaCuenta';
import TablaMovimientos from '../componentes/TablaMovimientos';
import TarjetaCredito from '../componentes/TarjetaCredito';
import SaludFinanciera from '../componentes/SaludFinanciera';
import FormularioCredito from '../componentes/FormularioCredito';
import CompletarCredito from '../componentes/CompletarCredito';
import FlujoCaja from '../componentes/FlujoCaja';
import { formatearMoneda, traducirTipoCuenta, calcularSaludFinanciera, obtenerInfoBanco, agruparCuentasPorBanco } from '../utilidades/formateadores';
import '../estilos/dashboard.css';

function Dashboard({ seccion = 'dashboard' }) {
  const [cuentas, setCuentas] = useState([]); 
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  // Estado para créditos
  const [resumenCreditos, setResumenCreditos] = useState(null);
  const [mostrarFormCredito, setMostrarFormCredito] = useState(false);
  const [creditosPendientes, setCreditosPendientes] = useState([]);
  const [creditoCompletar, setCreditoCompletar] = useState(null);

  // Estado para conexiones
  const [conexiones, setConexiones] = useState([]);

  const cargarCuentas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerCuentas();
      setCuentas(data);
      if (data.length > 0) {
        setCuentaSeleccionada((prev) => prev || data[0]);
      }
    } catch (err) {
      console.error('Error cargando cuentas:', err);
      setError(err.response?.data?.message || 'Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarCreditos = useCallback(async () => {
    try {
      const resumen = await obtenerResumenCreditos();
      setResumenCreditos(resumen);
    } catch (err) {
      console.error('Error cargando créditos:', err);
    }
  }, []);

  const cargarConexiones = useCallback(async () => {
    try {
      const data = await obtenerConexiones();
      setConexiones(data);
    } catch (err) {
      console.error('Error cargando conexiones:', err);
    }
  }, []);

  const cargarPendientes = useCallback(async () => {
    try {
      const data = await obtenerCreditosPendientes();
      setCreditosPendientes(data);
    } catch (err) {
      console.error('Error cargando créditos pendientes:', err);
    }
  }, []);

  useEffect(() => {
    cargarCuentas();
    cargarCreditos();
    cargarConexiones();
    cargarPendientes();
  }, [cargarCuentas, cargarCreditos, cargarConexiones, cargarPendientes, seccion]);

  const handleRefrescar = async () => {
    try {
      setRefrescando(true);
      await refrescarDatos();
      await cargarCuentas();
      await cargarCreditos();
    } catch (err) {
      console.error('Error refrescando datos:', err);
      setError(err.response?.data?.message || 'Error al actualizar los datos');
    } finally {
      setRefrescando(false);
    }
  };

  const handleSeleccionarCuenta = (cuenta) => {
    setCuentaSeleccionada(cuenta);
  };

  const handleCreditoCreado = () => {
    setMostrarFormCredito(false);
    cargarCreditos();
  };

  const handleEliminarCredito = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este crédito?')) return;
    try {
      await eliminarCredito(id);
      cargarCreditos();
    } catch (err) {
      console.error('Error eliminando crédito:', err);
    }
  };

  const handleEliminarConexion = async (linkId) => {
    if (!window.confirm('¿Deseas desconectar este banco? Se eliminarán las cuentas y movimientos asociados.')) return;
    try {
      await eliminarConexion(linkId);
      cargarConexiones();
      cargarCuentas();
    } catch (err) {
      console.error('Error eliminando conexión:', err);
    }
  };

  // Calcular totales
  const balanceTotal = cuentas.reduce(
    (sum, acc) => sum + (acc.balance?.available || acc.balance?.current || 0),
    0
  );

  // Agrupar cuentas por banco
  const gruposBanco = agruparCuentasPorBanco(cuentas);

  // Estado de carga
  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p className="loading-texto">Cargando tus finanzas...</p>
      </div>
    );
  }

  // Sin cuentas conectadas (solo en dashboard)
  if (cuentas.length === 0 && !error && seccion === 'dashboard') {
    return (
      <div className="estado-vacio">
        <div className="estado-vacio-icono">🏦</div>
        <h2 className="estado-vacio-titulo">No hay bancos conectados</h2>
        <p className="estado-vacio-texto">
          Conecta tu primera cuenta bancaria para comenzar a visualizar tus finanzas.
        </p>
        <Link to="/conectar" className="btn btn-primario">
          + Conectar mi banco
        </Link>
      </div>
    );
  }

  // ===== SECCIÓN: DASHBOARD =====
  if (seccion === 'dashboard') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Dashboard</h1>
            <p className="dashboard-subtitulo">Resumen de tus finanzas personales</p>
          </div>
          <div className="dashboard-acciones">
            <button
              onClick={handleRefrescar}
              disabled={refrescando}
              className="btn btn-secundario"
            >
              {refrescando ? '⏳ Actualizando...' : '🔄 Actualizar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mensaje-error">
            <p className="mensaje-error-texto">{error}</p>
          </div>
        )}

        <SaludFinanciera
          salud={calcularSaludFinanciera(
            balanceTotal,
            resumenCreditos?.totalDeuda || 0,
            resumenCreditos?.cuotaMensualTotal || 0
          )}
          balanceTotal={balanceTotal}
          totalDeuda={resumenCreditos?.totalDeuda || 0}
          cuotaMensualTotal={resumenCreditos?.cuotaMensualTotal || 0}
        />

        <div className="resumen-cards">
          <div className="balance-total">
            <div className="balance-total-label">Balance disponible</div>
            <div className="balance-total-monto">{formatearMoneda(balanceTotal)}</div>
            <div className="balance-total-info">
              {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} conectada{cuentas.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="deuda-total">
            <div className="deuda-total-label">Deuda total</div>
            <div className="deuda-total-monto">
              {formatearMoneda(resumenCreditos?.totalDeuda || 0)}
            </div>
            <div className="deuda-total-info">
              {resumenCreditos?.totalCreditosActivos || 0} crédito{(resumenCreditos?.totalCreditosActivos || 0) !== 1 ? 's' : ''} activo{(resumenCreditos?.totalCreditosActivos || 0) !== 1 ? 's' : ''}
              {(resumenCreditos?.totalCreditosMorosos || 0) > 0 && (
                <span className="alerta-moroso"> · ⚠️ {resumenCreditos.totalCreditosMorosos} moroso{resumenCreditos.totalCreditosMorosos !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>

        {/* Desglose por bancos */}
        {gruposBanco.length > 1 && (
          <div className="bancos-resumen">
            <h3 className="bancos-resumen-titulo">Balance por banco</h3>
            <div className="bancos-resumen-grid">
              {gruposBanco.map((grupo) => (
                <div
                  key={grupo.institution}
                  className="banco-mini-card"
                  style={{ borderLeftColor: grupo.infoBanco.color }}
                >
                  <div className="banco-mini-card-header">
                    <span className="banco-mini-card-icono" style={{ backgroundColor: grupo.infoBanco.colorClaro }}>
                      {grupo.infoBanco.icono}
                    </span>
                    <span className="banco-mini-card-nombre">{grupo.infoBanco.nombre}</span>
                  </div>
                  <div className="banco-mini-card-balance">{formatearMoneda(grupo.balanceTotal)}</div>
                  <div className="banco-mini-card-info">
                    {grupo.cuentas.length} cuenta{grupo.cuentas.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mostrarFormCredito && (
          <FormularioCredito
            onCreditoCreado={handleCreditoCreado}
            onCancelar={() => setMostrarFormCredito(false)}
          />
        )}
      </div>
    );
  }

  // ===== SECCIÓN: CRÉDITOS =====
  if (seccion === 'creditos') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Créditos activos</h1>
            <p className="dashboard-subtitulo">Gestiona tus créditos y deudas</p>
          </div>
          <div className="dashboard-acciones">
            <button
              className="btn btn-primario"
              onClick={() => setMostrarFormCredito(true)}
            >
              + Agregar crédito
            </button>
          </div>
        </div>

        {/* Banner de créditos pendientes de completar */}
        {creditosPendientes.length > 0 && (
          <div className="pendientes-banner">
            <div className="pendientes-banner-icono">🔔</div>
            <div className="pendientes-banner-contenido">
              <strong>Se detectaron {creditosPendientes.length} tarjeta{creditosPendientes.length > 1 ? 's' : ''} importada{creditosPendientes.length > 1 ? 's' : ''} desde Fintoc</strong>
              <p>Completa los datos de interés y plazos para incluirlas en tu flujo de caja y proyecciones.</p>
            </div>
            <div className="pendientes-banner-acciones">
              {creditosPendientes.map((c) => (
                <button
                  key={c._id}
                  className="btn btn-pendiente"
                  onClick={() => setCreditoCompletar(c)}
                >
                  Completar {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="resumen-cards">
          <div className="deuda-total">
            <div className="deuda-total-label">Deuda total</div>
            <div className="deuda-total-monto">
              {formatearMoneda(resumenCreditos?.totalDeuda || 0)}
            </div>
            <div className="deuda-total-info">
              {resumenCreditos?.totalCreditosActivos || 0} crédito{(resumenCreditos?.totalCreditosActivos || 0) !== 1 ? 's' : ''} activo{(resumenCreditos?.totalCreditosActivos || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="balance-total" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <div className="balance-total-label">Total pagado</div>
            <div className="balance-total-monto">
              {formatearMoneda(resumenCreditos?.totalPagadoGlobal || 0)}
            </div>
            <div className="balance-total-info">
              En cuotas hasta la fecha
            </div>
          </div>
          <div className="balance-total" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <div className="balance-total-label">Total a pagar (con interés)</div>
            <div className="balance-total-monto">
              {formatearMoneda(resumenCreditos?.totalAPagarGlobal || 0)}
            </div>
            <div className="balance-total-info">
              Costo interés: {formatearMoneda(resumenCreditos?.costoInteresGlobal || 0)}
            </div>
          </div>
          <div className="balance-total" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
            <div className="balance-total-label">Cuota mensual total</div>
            <div className="balance-total-monto">
              {formatearMoneda(resumenCreditos?.cuotaMensualTotal || 0)}
            </div>
            <div className="balance-total-info">
              Progreso promedio: {resumenCreditos?.progresoPromedio || 0}%
            </div>
          </div>
        </div>

        {resumenCreditos?.creditos?.length > 0 ? (
          <div className="creditos-grid">
            {resumenCreditos.creditos.map((credito) => (
              <TarjetaCredito
                key={credito.id}
                credito={credito}
                onEliminar={handleEliminarCredito}
              />
            ))}
          </div>
        ) : (
          <div className="creditos-vacio">
            <div className="creditos-vacio-icono">💳</div>
            <p className="creditos-vacio-texto">
              No tienes créditos registrados. Agrega tus créditos para ver tu salud financiera completa.
            </p>
            <button
              className="btn btn-primario"
              onClick={() => setMostrarFormCredito(true)}
            >
              + Agregar mi primer crédito
            </button>
          </div>
        )}

        {mostrarFormCredito && (
          <FormularioCredito
            onCreditoCreado={handleCreditoCreado}
            onCancelar={() => setMostrarFormCredito(false)}
          />
        )}

        {creditoCompletar && (
          <CompletarCredito
            credito={creditoCompletar}
            onCompletado={() => {
              setCreditoCompletar(null);
              cargarCreditos();
              cargarPendientes();
            }}
            onCancelar={() => setCreditoCompletar(null)}
          />
        )}
      </div>
    );
  }

  // ===== SECCIÓN: FLUJO DE CAJA =====
  if (seccion === 'flujo-caja') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Flujo de caja</h1>
            <p className="dashboard-subtitulo">Proyección mes a mes de tus pagos y deudas</p>
          </div>
        </div>
        <FlujoCaja />
      </div>
    );
  }

  // ===== SECCIÓN: CUENTAS DE BANCO =====
  if (seccion === 'cuentas') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Cuentas de banco</h1>
            <p className="dashboard-subtitulo">Tus cuentas bancarias conectadas</p>
          </div>
          <div className="dashboard-acciones">
            <button
              onClick={handleRefrescar}
              disabled={refrescando}
              className="btn btn-secundario"
            >
              {refrescando ? '⏳ Actualizando...' : '🔄 Actualizar'}
            </button>
            <Link to="/conectar" className="btn btn-primario">
              + Conectar otro banco
            </Link>
          </div>
        </div>

        {error && (
          <div className="mensaje-error">
            <p className="mensaje-error-texto">{error}</p>
          </div>
        )}

        <div className="balance-total" style={{ marginBottom: '24px' }}>
          <div className="balance-total-label">Balance total</div>
          <div className="balance-total-monto">{formatearMoneda(balanceTotal)}</div>
          <div className="balance-total-info">
            {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} conectada{cuentas.length !== 1 ? 's' : ''}
          </div>
        </div>

        {cuentas.length > 0 ? (
          <>
            {gruposBanco.map((grupo) => (
              <div key={grupo.institution} className="banco-grupo">
                <div className="banco-grupo-header">
                  <div className="banco-grupo-info">
                    <span
                      className="banco-grupo-icono"
                      style={{ backgroundColor: grupo.infoBanco.colorClaro, color: grupo.infoBanco.color }}
                    >
                      {grupo.infoBanco.icono}
                    </span>
                    <div>
                      <div className="banco-grupo-nombre">{grupo.infoBanco.nombre}</div>
                      <div className="banco-grupo-detalle">
                        {grupo.cuentas.length} cuenta{grupo.cuentas.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="banco-grupo-balance">
                    <div className="banco-grupo-balance-label">Balance</div>
                    <div className="banco-grupo-balance-monto" style={{ color: grupo.infoBanco.color }}>
                      {formatearMoneda(grupo.balanceTotal)}
                    </div>
                  </div>
                </div>
                <div className="cuentas-grid">
                  {grupo.cuentas.map((cuenta) => (
                    <TarjetaCuenta
                      key={cuenta.id}
                      cuenta={cuenta}
                      onClick={handleSeleccionarCuenta}
                    />
                  ))}
                </div>
              </div>
            ))}

            {cuentaSeleccionada && (
              <div className="movimientos-seccion" style={{ marginTop: '24px' }}>
                <div className="movimientos-header">
                  <div>
                    <div className="movimientos-titulo">Últimos movimientos</div>
                    <div className="movimientos-cuenta-info">
                      {cuentaSeleccionada.name || traducirTipoCuenta(cuentaSeleccionada.type)}
                      {cuentaSeleccionada.number && ` · ****${cuentaSeleccionada.number.slice(-4)}`}
                    </div>
                  </div>
                  <span className="movimientos-registros">
                    {cuentaSeleccionada.movements?.length || 0} registros
                  </span>
                </div>
                <TablaMovimientos
                  movimientos={cuentaSeleccionada.movements || []}
                  moneda={cuentaSeleccionada.currency}
                />
              </div>
            )}
          </>
        ) : (
          <div className="estado-vacio">
            <div className="estado-vacio-icono">🏦</div>
            <h2 className="estado-vacio-titulo">No hay bancos conectados</h2>
            <p className="estado-vacio-texto">
              Conecta tu primera cuenta bancaria para ver tus saldos y movimientos.
            </p>
            <Link to="/conectar" className="btn btn-primario">
              + Conectar mi banco
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ===== SECCIÓN: CONEXIONES BANCARIAS =====
  if (seccion === 'conexiones') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Mis bancos</h1>
            <p className="dashboard-subtitulo">Gestiona tus conexiones bancarias</p>
          </div>
          <div className="dashboard-acciones">
            <Link to="/conectar" className="btn btn-primario">
              + Conectar banco
            </Link>
          </div>
        </div>

        {conexiones.length > 0 ? (
          <div className="conexiones-grid">
            {conexiones.map((conexion) => {
              const infoBanco = obtenerInfoBanco(conexion.institutionName);
              return (
                <div key={conexion._id} className="conexion-card">
                  <div className="conexion-card-header">
                    <div className="conexion-card-banco">
                      <span
                        className="conexion-card-icono"
                        style={{ backgroundColor: infoBanco.colorClaro, color: infoBanco.color }}
                      >
                        {infoBanco.icono}
                      </span>
                      <div>
                        <div className="conexion-card-nombre">{infoBanco.nombre}</div>
                        <div className="conexion-card-titular">{conexion.holderName || 'Titular'}</div>
                      </div>
                    </div>
                    <span className={`conexion-estado conexion-estado-${conexion.status}`}>
                      {conexion.status === 'active' ? '● Activo' : conexion.status === 'error' ? '● Error' : '● Inactivo'}
                    </span>
                  </div>

                  <div className="conexion-card-stats">
                    <div className="conexion-card-stat">
                      <div className="conexion-card-stat-label">Cuentas</div>
                      <div className="conexion-card-stat-valor">{conexion.accountsCount || 0}</div>
                    </div>
                    <div className="conexion-card-stat">
                      <div className="conexion-card-stat-label">Balance total</div>
                      <div className="conexion-card-stat-valor">{formatearMoneda(conexion.totalBalance || 0)}</div>
                    </div>
                  </div>

                  <div className="conexion-card-footer">
                    <span className="conexion-card-fecha">
                      Conectado: {conexion.createdAt ? new Date(conexion.createdAt).toLocaleDateString('es-CL') : '-'}
                    </span>
                    <button
                      className="btn-desconectar"
                      onClick={() => handleEliminarConexion(conexion._id)}
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="estado-vacio">
            <div className="estado-vacio-icono">🔗</div>
            <h2 className="estado-vacio-titulo">Sin conexiones bancarias</h2>
            <p className="estado-vacio-texto">
              Conecta tu primera cuenta bancaria para comenzar a gestionar tus finanzas.
            </p>
            <Link to="/conectar" className="btn btn-primario">
              + Conectar mi banco
            </Link>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default Dashboard;
