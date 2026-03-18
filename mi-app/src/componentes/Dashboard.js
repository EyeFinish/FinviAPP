import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  obtenerCuentas, refrescarDatos, obtenerResumenCreditos, obtenerConexiones, eliminarConexion,
  obtenerProgresoMensual, obtenerMovimientosSinAsignar, asignarMovimiento, desasignarMovimiento,
  obtenerCostosFijos, obtenerDeudas,
} from '../servicios/api';
import { Building2, Link2, RefreshCw, Loader, AlertTriangle } from 'lucide-react';
import TarjetaCuenta from '../componentes/TarjetaCuenta';
import TablaMovimientos from '../componentes/TablaMovimientos';
import SaludFinanciera from '../componentes/SaludFinanciera';
import EstadoFinanciero from '../componentes/EstadoFinanciero';
import ObligacionFinanciera from '../componentes/ObligacionFinanciera';
import { formatearMoneda, traducirTipoCuenta, calcularSaludFinanciera, obtenerInfoBanco, agruparCuentasPorBanco } from '../utilidades/formateadores';
import '../estilos/dashboard.css';
import '../estilos/compromisos.css';

function Dashboard({ seccion = 'dashboard' }) {
  const [cuentas, setCuentas] = useState([]); 
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  // Estado para créditos
  const [resumenCreditos, setResumenCreditos] = useState(null);

  // Estado para conexiones
  const [conexiones, setConexiones] = useState([]);

  // Estado para compromisos mensuales
  const [progreso, setProgreso] = useState(null);
  const [sinAsignar, setSinAsignar] = useState([]);
  const [obligacionesLista, setObligacionesLista] = useState([]);
  const [seleccionAsignar, setSeleccionAsignar] = useState({}); // { movId: 'tipo_refId' }
  const [asignando, setAsignando] = useState(null); // movId being assigned

  // Totales combinados (créditos + obligaciones)
  const [resumenOblig, setResumenOblig] = useState({ totalDeuda: 0, compromisoMensual: 0 });

  const mesActual = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  };

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

  const cargarCompromisos = useCallback(async () => {
    try {
      const mes = mesActual();
      const [resProgreso, resSinAsignar, resCostos, resDeudas] = await Promise.all([
        obtenerProgresoMensual(mes).catch(() => null),
        obtenerMovimientosSinAsignar(mes).catch(() => []),
        obtenerCostosFijos().catch(() => []),
        obtenerDeudas().catch(() => []),
      ]);
      setProgreso(resProgreso);
      setSinAsignar(resSinAsignar || []);

      // Datos crudos de obligaciones
      const rawCostos = resCostos || [];
      const rawDeudas = resDeudas || [];

      // Calcular totales de obligaciones para cruce con Dashboard
      // Deuda total = (montoTotal + interesTotal) proporcional a cuotas restantes
      const deudaObligTotal = rawDeudas.reduce((s, d) => {
        const restantes = (d.cuotasTotales || 0) - (d.cuotasPagadas || 0);
        const total = d.cuotasTotales || 1;
        const totalConInteres = (d.montoTotal || 0) + (d.interesTotal || 0);
        return s + totalConInteres * (restantes / total);
      }, 0);
      const compromisoOblig = rawCostos.reduce((s, c) => s + (c.monto || 0), 0)
        + rawDeudas.reduce((s, d) => s + (d.cuotaMensual || 0), 0);
      setResumenOblig({ totalDeuda: deudaObligTotal, compromisoMensual: compromisoOblig });

      const costos = rawCostos.map((c) => ({
        _id: c._id, nombre: c.nombre, tipo: 'costoFijo', monto: c.monto,
      }));
      const deudas = rawDeudas.map((d) => ({
        _id: d._id, nombre: d.nombre, tipo: 'deuda', monto: d.cuotaMensual,
      }));
      setObligacionesLista([...costos, ...deudas]);
    } catch (err) {
      console.error('Error cargando compromisos:', err);
    }
  }, []);

  useEffect(() => {
    cargarCuentas();
    cargarCreditos();
    cargarConexiones();
    cargarCompromisos();
  }, [cargarCuentas, cargarCreditos, cargarConexiones, cargarCompromisos, seccion]);

  const handleRefrescar = async () => {
    try {
      setRefrescando(true);
      await refrescarDatos();
      await cargarCuentas();
      await cargarCreditos();
      await cargarCompromisos();
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

  const handleAsignar = async (movId) => {
    const valor = seleccionAsignar[movId];
    if (!valor) return;
    const [tipo, referenciaId] = valor.split('_');
    setAsignando(movId);
    try {
      await asignarMovimiento(movId, tipo, referenciaId);
      setSeleccionAsignar((prev) => { const n = { ...prev }; delete n[movId]; return n; });
      await cargarCompromisos();
    } catch (err) {
      console.error('Error asignando:', err);
    } finally {
      setAsignando(null);
    }
  };

  const handleDesasignar = async (movId) => {
    try {
      await desasignarMovimiento(movId);
      await cargarCompromisos();
    } catch (err) {
      console.error('Error desasignando:', err);
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
        <div className="estado-vacio-icono"><Building2 size={48} /></div>
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
              {refrescando ? <><Loader size={16} className="icon-spin" /> Actualizando...</> : <><RefreshCw size={16} /> Actualizar</>}
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
            (resumenCreditos?.totalDeuda || 0) + resumenOblig.totalDeuda,
            (resumenCreditos?.cuotaMensualTotal || 0) + resumenOblig.compromisoMensual
          )}
          balanceTotal={balanceTotal}
          totalDeuda={(resumenCreditos?.totalDeuda || 0) + resumenOblig.totalDeuda}
          cuotaMensualTotal={(resumenCreditos?.cuotaMensualTotal || 0) + resumenOblig.compromisoMensual}
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
              {formatearMoneda((resumenCreditos?.totalDeuda || 0) + resumenOblig.totalDeuda)}
            </div>
            <div className="deuda-total-info">
              {resumenCreditos?.totalCreditosActivos || 0} crédito{(resumenCreditos?.totalCreditosActivos || 0) !== 1 ? 's' : ''}
              {resumenOblig.totalDeuda > 0 && <span> + deudas registradas</span>}
              {(resumenCreditos?.totalCreditosMorosos || 0) > 0 && (
                <span className="alerta-moroso"> · <AlertTriangle size={14} /> {resumenCreditos.totalCreditosMorosos} moroso{resumenCreditos.totalCreditosMorosos !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div className="deuda-total" style={{ borderLeftColor: '#5170ff' }}>
            <div className="deuda-total-label">Compromiso mensual</div>
            <div className="deuda-total-monto" style={{ color: '#5170ff' }}>
              {formatearMoneda((resumenCreditos?.cuotaMensualTotal || 0) + resumenOblig.compromisoMensual)}
            </div>
            <div className="deuda-total-info">
              {resumenOblig.compromisoMensual > 0 && <span>Costos fijos + cuotas deudas</span>}
              {(resumenCreditos?.cuotaMensualTotal || 0) > 0 && <span>{resumenOblig.compromisoMensual > 0 ? ' + ' : ''}Cuotas créditos</span>}
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
                      <Building2 size={18} />
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

        {/* ====== COMPROMISOS DEL MES ====== */}
        {progreso && (
          <div className="compromisos-seccion">
            <div className="compromisos-header">
              <h3 className="compromisos-titulo">Compromisos del Mes</h3>
              <span className="compromisos-badge">{progreso.porcentajeGeneral}% cumplido</span>
            </div>

            <div className="progreso-general">
              <div className="progreso-general-header">
                <span className="progreso-general-label">Progreso general</span>
                <span className="progreso-general-valor">
                  {formatearMoneda(progreso.totalPagado)} / {formatearMoneda(progreso.totalComprometido)}
                </span>
              </div>
              <div className="barra-fondo">
                <div
                  className="barra-progreso"
                  style={{
                    width: `${progreso.porcentajeGeneral}%`,
                    backgroundColor: progreso.porcentajeGeneral >= 100 ? '#10b981' : '#1800ad',
                  }}
                />
              </div>
            </div>

            {progreso.obligaciones.length > 0 && (
              <div className="obligaciones-grid">
                {progreso.obligaciones.map((ob) => (
                  <div key={`${ob.tipo}_${ob._id}`} className={`obligacion-card ${ob.tipo === 'costoFijo' ? 'costo-fijo' : 'deuda'}`}>
                    <div className="obligacion-card-header">
                      <div>
                        <div className="obligacion-card-nombre">{ob.nombre}</div>
                        <div className="obligacion-card-tipo">
                          {ob.tipo === 'costoFijo' ? `Costo fijo · ${ob.categoria || ''}` : 'Deuda'}
                        </div>
                      </div>
                      <span
                        className="obligacion-card-porcentaje"
                        style={{
                          backgroundColor: ob.porcentaje >= 100 ? '#d1fae5' : ob.porcentaje >= 50 ? '#fef3c7' : '#fef2f2',
                          color: ob.porcentaje >= 100 ? '#065f46' : ob.porcentaje >= 50 ? '#92400e' : '#991b1b',
                        }}
                      >
                        {ob.porcentaje}%
                      </span>
                    </div>
                    <div className="barra-fondo-sm">
                      <div
                        className="barra-progreso"
                        style={{
                          width: `${ob.porcentaje}%`,
                          backgroundColor: ob.porcentaje >= 100 ? '#10b981' : ob.porcentaje >= 50 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <div className="obligacion-card-montos">
                      <span>Pagado: <strong>{formatearMoneda(ob.montoPagado)}</strong></span>
                      <span>Objetivo: <strong>{formatearMoneda(ob.montoObjetivo)}</strong></span>
                    </div>

                    {ob.movimientos.length > 0 && (
                      <div className="obligacion-movs">
                        {ob.movimientos.map((mov) => (
                          <div key={mov._id} className="obligacion-mov-item">
                            <span className="mov-desc">{mov.description || 'Sin descripción'}</span>
                            <span className="mov-monto">{formatearMoneda(Math.abs(mov.amount))}</span>
                            <button className="btn-desasignar-sm" onClick={() => handleDesasignar(mov._id)} title="Quitar asignación">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== TRANSACCIONES SIN ASIGNAR ====== */}
        {sinAsignar.length > 0 && (
          <div className="sin-asignar-seccion">
            <div className="compromisos-header">
              <h3 className="compromisos-titulo">Transacciones sin asignar</h3>
              <span className="compromisos-badge alerta">{sinAsignar.length}</span>
            </div>
            <p className="sin-asignar-subtitulo">
              Selecciona a qué obligación pertenece cada transacción para llevar el control de tus pagos.
            </p>
            <table className="sin-asignar-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Asignar a</th>
                </tr>
              </thead>
              <tbody>
                {sinAsignar.slice(0, 20).map((mov) => (
                  <tr key={mov._id}>
                    <td>{mov.postDate ? new Date(mov.postDate).toLocaleDateString('es-CL') : '-'}</td>
                    <td>{mov.description || 'Sin descripción'}</td>
                    <td className="sin-asignar-monto">{formatearMoneda(Math.abs(mov.amount))}</td>
                    <td>
                      <div className="td-asignar">
                        <select
                          className="select-obligacion"
                          value={seleccionAsignar[mov._id] || ''}
                          onChange={(e) => setSeleccionAsignar((prev) => ({ ...prev, [mov._id]: e.target.value }))}
                        >
                          <option value="">-- Seleccionar --</option>
                          <optgroup label="Costos Fijos">
                            {obligacionesLista.filter((o) => o.tipo === 'costoFijo').map((o) => (
                              <option key={o._id} value={`costoFijo_${o._id}`}>
                                {o.nombre} ({formatearMoneda(o.monto)})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Deudas">
                            {obligacionesLista.filter((o) => o.tipo === 'deuda').map((o) => (
                              <option key={o._id} value={`deuda_${o._id}`}>
                                {o.nombre} ({formatearMoneda(o.monto)})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          className="btn-asignar"
                          disabled={!seleccionAsignar[mov._id] || asignando === mov._id}
                          onClick={() => handleAsignar(mov._id)}
                        >
                          {asignando === mov._id ? '...' : 'Asignar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sinAsignar.length > 20 && (
              <p style={{ textAlign: 'center', color: '#555a7e', fontSize: '13px', marginTop: '12px' }}>
                y {sinAsignar.length - 20} transacciones más...
              </p>
            )}
          </div>
        )}

      </div>
    );
  }

  // ===== SECCIÓN: ESTADO FINANCIERO =====
  if (seccion === 'estado') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-titulo">Estado financiero</h1>
            <p className="dashboard-subtitulo">Tu realidad financiera actual</p>
          </div>
        </div>
        <EstadoFinanciero />
      </div>
    );
  }

  // ===== SECCIÓN: OBLIGACIÓN FINANCIERA =====
  if (seccion === 'obligaciones') {
    return (
      <div className="dashboard">
        <ObligacionFinanciera />
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
              {refrescando ? <><Loader size={16} className="icon-spin" /> Actualizando...</> : <><RefreshCw size={16} /> Actualizar</>}
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
                      <Building2 size={20} />
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
            <div className="estado-vacio-icono"><Building2 size={48} /></div>
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
                        <Building2 size={20} />
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
            <div className="estado-vacio-icono"><Link2 size={48} /></div>
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
