import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  obtenerCuentas, refrescarDatos, obtenerResumenCreditos, obtenerConexiones, eliminarConexion,
  obtenerProgresoMensual, obtenerSinAsignarAgrupados, asignarMovimiento, desasignarMovimiento,
  autoAsignarMovimientos, obtenerCostosFijos, obtenerDeudas, obtenerSyncStatus,
} from '../servicios/api';
import {
  Building2, Link2, RefreshCw, Loader, AlertTriangle, ChevronDown, ChevronUp, Zap, LinkIcon,
  ShoppingCart, Bike, Car, Utensils, Repeat, Wifi, Heart, Home, GraduationCap,
  ShieldCheck, ShoppingBag, ArrowRightLeft, Banknote, MoreHorizontal, Satellite,
} from 'lucide-react';
import TarjetaCuenta from '../componentes/TarjetaCuenta';
import TablaMovimientos from '../componentes/TablaMovimientos';
import SaludFinanciera from '../componentes/SaludFinanciera';
import EstadoFinanciero from '../componentes/EstadoFinanciero';
import ObligacionFinanciera from '../componentes/ObligacionFinanciera';
import { formatearMoneda, formatearFecha, traducirTipoCuenta, calcularSaludFinanciera, obtenerInfoBanco, agruparCuentasPorBanco } from '../utilidades/formateadores';
import '../estilos/dashboard.css';
import '../estilos/compromisos.css';

const ICON_MAP = {
  'cart': ShoppingCart,
  'bicycle': Bike,
  'car': Car,
  'restaurant': Utensils,
  'refresh-circle': Repeat,
  'wifi': Wifi,
  'medkit': Heart,
  'home': Home,
  'school': GraduationCap,
  'shield-checkmark': ShieldCheck,
  'bag-handle': ShoppingBag,
  'swap-horizontal': ArrowRightLeft,
  'cash': Banknote,
  'ellipsis-horizontal': MoreHorizontal,
};

const getCatIcono = (iconName, size = 18, color) => {
  const Comp = ICON_MAP[iconName] || MoreHorizontal;
  return <Comp size={size} color={color} />;
};

function Dashboard({ seccion = 'dashboard' }) {
  const [cuentas, setCuentas] = useState([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [limiteMovs, setLimiteMovs] = useState(15);

  // Estado para créditos
  const [resumenCreditos, setResumenCreditos] = useState(null);

  // Estado para conexiones
  const [conexiones, setConexiones] = useState([]);

  // Estado para compromisos mensuales
  const [progreso, setProgreso] = useState(null);
  const [categoriasAgrupadas, setCategoriasAgrupadas] = useState([]);
  const [totalSinAsignar, setTotalSinAsignar] = useState(0);
  const [obligacionesLista, setObligacionesLista] = useState([]);
  const [seleccionAsignar, setSeleccionAsignar] = useState({}); // { movId: 'tipo_refId' }
  const [asignando, setAsignando] = useState(null); // movId being assigned
  const [expandedCat, setExpandedCat] = useState(null);

  // Última sincronización con Fintoc
  const [lastSync, setLastSync] = useState(null);

  // Auto-asignar
  const [autoAsignando, setAutoAsignando] = useState(false);
  const [modalAutoAsignar, setModalAutoAsignar] = useState(false);
  const [previewAutoAsignar, setPreviewAutoAsignar] = useState(null);

  // Totales combinados (créditos + obligaciones)
  const [resumenOblig, setResumenOblig] = useState({ totalDeuda: 0, compromisoMensual: 0 });

  const mesActual = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  };

  const cargarCuentas = useCallback(async (silente = false) => {
    try {
      if (!silente) { setLoading(true); setError(null); }
      const data = await obtenerCuentas();
      setCuentas(data);
      if (data.length > 0) {
        setCuentaSeleccionada((prev) => prev || data[0]);
      }
    } catch (err) {
      if (!silente) setError(err.response?.data?.message || 'Error al cargar las cuentas');
    } finally {
      if (!silente) setLoading(false);
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
      const [resProgreso, resAgrupados, resCostos, resDeudas] = await Promise.all([
        obtenerProgresoMensual(mes).catch(() => null),
        obtenerSinAsignarAgrupados(mes).catch(() => ({ categorias: [], totalMovimientos: 0 })),
        obtenerCostosFijos().catch(() => []),
        obtenerDeudas().catch(() => []),
      ]);
      setProgreso(resProgreso);

      const agrupados = resAgrupados || { categorias: [], totalMovimientos: 0 };
      setCategoriasAgrupadas(agrupados.categorias || []);
      setTotalSinAsignar(agrupados.totalMovimientos || 0);

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

    // Refrescar en background: dispara y hace polling hasta detectar datos nuevos
    (async () => {
      try {
        let syncAntes = null;
        try {
          const st = await obtenerSyncStatus();
          syncAntes = st.lastSync;
        } catch { /* silencioso */ }

        refrescarDatos().catch(() => {});

        let intentos = 0;
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        while (intentos < 40) {
          await esperar(3000);
          try {
            const st = await obtenerSyncStatus();
            setLastSync(st.lastSync);
            if (st.lastSync && (!syncAntes || new Date(st.lastSync) > new Date(syncAntes))) {
              await cargarCuentas(true);
              await cargarCompromisos();
              return;
            }
            if (!st.sincronizando) break;
          } catch { /* silencioso */ }
          intentos++;
        }
      } catch { /* silencioso */ }
    })();
  }, [cargarCuentas, cargarCreditos, cargarConexiones, cargarCompromisos, seccion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling cada 5 minutos para detectar sincronizaciones del cron
  useEffect(() => {
    let prevSync = null;

    const checkSync = async () => {
      try {
        const status = await obtenerSyncStatus();
        setLastSync(status.lastSync);
        if (status.lastSync && prevSync && new Date(status.lastSync) > new Date(prevSync)) {
          await cargarCuentas(true);
          await cargarCompromisos();
        }
        prevSync = status.lastSync;
      } catch {
        // silencioso
      }
    };

    const intervalo = setInterval(checkSync, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefrescar = async () => {
    try {
      setRefrescando(true);
      await refrescarDatos();
      await cargarCuentas();
      await cargarCreditos();
      await cargarConexiones();
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
    setLimiteMovs(15);
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

  const handleAsignarGrupo = async (grupoKey, movIds) => {
    const valor = seleccionAsignar[grupoKey];
    if (!valor) return;
    const [tipo, referenciaId] = valor.split('_');
    setAsignando(grupoKey);
    try {
      for (const movId of movIds) {
        await asignarMovimiento(movId, tipo, referenciaId);
      }
      setSeleccionAsignar((prev) => { const n = { ...prev }; delete n[grupoKey]; return n; });
      await cargarCompromisos();
    } catch (err) {
      console.error('Error asignando grupo:', err);
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

  const handleDesasignarGrupo = async (movIds) => {
    try {
      for (const movId of movIds) {
        await desasignarMovimiento(movId);
      }
      await cargarCompromisos();
    } catch (err) {
      console.error('Error desasignando grupo:', err);
    }
  };

  const handleAutoAsignarPreview = async () => {
    setAutoAsignando(true);
    try {
      const res = await autoAsignarMovimientos(mesActual(), 'preview');
      setPreviewAutoAsignar(res);
      setModalAutoAsignar(true);
    } catch (err) {
      console.error('Error preview auto-asignar:', err);
    } finally {
      setAutoAsignando(false);
    }
  };

  const handleAutoAsignarConfirmar = async () => {
    setAutoAsignando(true);
    try {
      await autoAsignarMovimientos(mesActual(), 'aplicar');
      setModalAutoAsignar(false);
      setPreviewAutoAsignar(null);
      await cargarCompromisos();
    } catch (err) {
      console.error('Error auto-asignar:', err);
    } finally {
      setAutoAsignando(false);
    }
  };

  const handleAsignarTodosCategoria = async (cat) => {
    if (!cat.obligacionesSugeridas || cat.obligacionesSugeridas.length !== 1) return;
    const oblig = cat.obligacionesSugeridas[0];
    setAsignando('batch');
    try {
      for (const mov of cat.movimientos) {
        await asignarMovimiento(mov._id, oblig.tipo, oblig._id);
      }
      await cargarCompromisos();
    } catch (err) {
      console.error('Error asignando categoría:', err);
    } finally {
      setAsignando(null);
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
            {lastSync && (
              <span className="ultima-actualizacion" title="Última sincronización automática">
                Sincronizado {new Date(lastSync).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
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
                        {Object.values(
                          ob.movimientos.reduce((acc, mov) => {
                            const key = (mov.description || 'Sin descripción').trim();
                            if (!acc[key]) acc[key] = { description: key, ids: [], totalAmount: 0 };
                            acc[key].ids.push(mov._id);
                            acc[key].totalAmount += mov.amount;
                            return acc;
                          }, {})
                        ).map((grupo) => (
                          <div key={grupo.description} className="obligacion-mov-item">
                            <span className="mov-desc">
                              {grupo.description}
                              {grupo.ids.length > 1 && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 600, color: '#6c6fa3', background: '#eeeef8', borderRadius: '10px', padding: '1px 7px' }}>
                                  ×{grupo.ids.length}
                                </span>
                              )}
                            </span>
                            <span className="mov-monto">{formatearMoneda(Math.abs(grupo.totalAmount))}</span>
                            <button className="btn-desasignar-sm" onClick={() => handleDesasignarGrupo(grupo.ids)} title="Quitar asignación">✕</button>
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

        {/* ====== TRANSACCIONES SIN ASIGNAR (AGRUPADAS POR CATEGORÍA) ====== */}
        {categoriasAgrupadas.length > 0 && (
          <div className="sin-asignar-seccion">
            <div className="compromisos-header">
              <h3 className="compromisos-titulo">Transacciones sin asignar</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn-auto-asignar"
                  onClick={handleAutoAsignarPreview}
                  disabled={autoAsignando}
                >
                  <Zap size={14} />
                  {autoAsignando ? 'Analizando...' : 'Auto-asignar'}
                </button>
                <span className="compromisos-badge alerta">{totalSinAsignar}</span>
              </div>
            </div>
            <p className="sin-asignar-subtitulo">
              Agrupadas por categoría. Haz clic en una categoría para expandir.
            </p>

            <div className="categorias-agrupadas">
              {categoriasAgrupadas.map((cat) => (
                <div key={cat.nombre} className="cat-group">
                  <div
                    className="cat-header"
                    onClick={() => setExpandedCat(expandedCat === cat.nombre ? null : cat.nombre)}
                  >
                    <div className="cat-icono" style={{ backgroundColor: cat.color + '20' }}>
                      {getCatIcono(cat.icono, 18, cat.color)}
                    </div>
                    <div className="cat-info">
                      <span className="cat-nombre">{cat.nombre}</span>
                      <span className="cat-detalle">{cat.cantidad} transaccion{cat.cantidad !== 1 ? 'es' : ''}</span>
                    </div>
                    <span className="cat-total">{formatearMoneda(cat.total)}</span>
                    {cat.obligacionesSugeridas?.length > 0 && (
                      <span className="cat-link-badge" title="Tiene sugerencia de asignación">
                        <LinkIcon size={12} />
                      </span>
                    )}
                    {expandedCat === cat.nombre ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>

                  {expandedCat === cat.nombre && (
                    <div className="cat-expanded">
                      {cat.obligacionesSugeridas?.length > 0 && (
                        <div className="sugerencia-box">
                          <div className="sugerencia-info">
                            <span className="sugerencia-label">Sugerencia:</span>
                            {cat.obligacionesSugeridas.map(ob => (
                              <span key={ob._id} className="sugerencia-nombre">
                                {ob.nombre} ({formatearMoneda(ob.monto)}/mes)
                              </span>
                            ))}
                          </div>
                          {cat.obligacionesSugeridas.length === 1 && (
                            <button
                              className="btn-asignar-todos"
                              onClick={() => handleAsignarTodosCategoria(cat)}
                              disabled={asignando === 'batch'}
                            >
                              {asignando === 'batch' ? '...' : 'Asignar todos'}
                            </button>
                          )}
                        </div>
                      )}

                      {(() => {
                        const gruposMap = cat.movimientos.reduce((acc, mov) => {
                          const key = (mov.description || 'Sin descripción').trim();
                          if (!acc[key]) acc[key] = { description: key, ids: [], totalAmount: 0, lastDate: null };
                          acc[key].ids.push(mov._id);
                          acc[key].totalAmount += mov.amount;
                          const d = mov.postDate || mov.transactionDate;
                          if (!acc[key].lastDate || new Date(d) > new Date(acc[key].lastDate)) acc[key].lastDate = d;
                          return acc;
                        }, {});
                        const grupos = Object.values(gruposMap).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
                        return (
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
                              {grupos.map((grupo) => {
                                const grupoKey = `${cat.nombre}__${grupo.description}`;
                                return (
                                  <tr key={grupoKey}>
                                    <td>{grupo.lastDate ? new Date(grupo.lastDate).toLocaleDateString('es-CL') : '-'}</td>
                                    <td>
                                      <span>{grupo.description}</span>
                                      {grupo.ids.length > 1 && (
                                        <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 600, color: '#6c6fa3', background: '#eeeef8', borderRadius: '10px', padding: '1px 7px' }}>
                                          ×{grupo.ids.length}
                                        </span>
                                      )}
                                    </td>
                                    <td className="sin-asignar-monto">{formatearMoneda(Math.abs(grupo.totalAmount))}</td>
                                    <td>
                                      <div className="td-asignar">
                                        <select
                                          className="select-obligacion"
                                          value={seleccionAsignar[grupoKey] || ''}
                                          onChange={(e) => setSeleccionAsignar((prev) => ({ ...prev, [grupoKey]: e.target.value }))}
                                        >
                                          <option value="">-- Seleccionar --</option>
                                          {cat.obligacionesSugeridas?.length > 0 && (
                                            <optgroup label="★ Sugeridas">
                                              {cat.obligacionesSugeridas.map((o) => (
                                                <option key={o._id} value={`${o.tipo}_${o._id}`}>
                                                  {o.nombre} ({formatearMoneda(o.monto)})
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
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
                                          disabled={!seleccionAsignar[grupoKey] || asignando === grupoKey}
                                          onClick={() => handleAsignarGrupo(grupoKey, grupo.ids)}
                                        >
                                          {asignando === grupoKey ? '...' : 'Asignar'}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== MODAL AUTO-ASIGNAR ====== */}
        {modalAutoAsignar && (
          <div className="modal-overlay" onClick={() => setModalAutoAsignar(false)}>
            <div className="modal-auto-asignar" onClick={(e) => e.stopPropagation()}>
              <div className="modal-auto-header">
                <h3>Auto-asignar transacciones</h3>
                <button className="modal-close" onClick={() => setModalAutoAsignar(false)}>✕</button>
              </div>

              {previewAutoAsignar && (
                <div>
                  <div className="preview-resumen">
                    <div className="preview-item exito">
                      <span className="preview-num">{previewAutoAsignar.asignables}</span>
                      <span className="preview-label">asignables automáticamente</span>
                    </div>
                    <div className="preview-item advertencia">
                      <span className="preview-num">{previewAutoAsignar.requierenRevision?.length || 0}</span>
                      <span className="preview-label">requieren revisión manual</span>
                    </div>
                  </div>

                  {previewAutoAsignar.asignaciones?.length > 0 && (
                    <div className="preview-detalle">
                      <h4>Se asignarán:</h4>
                      <div className="preview-lista">
                        {previewAutoAsignar.asignaciones.map((a) => (
                          <div key={a.movimientoId} className="preview-row">
                            <span className="preview-desc">{a.description}</span>
                            <span className="preview-arrow">→</span>
                            <span className="preview-oblig">{a.obligacion.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewAutoAsignar.asignables > 0 ? (
                    <button
                      className="btn-confirmar-auto"
                      onClick={handleAutoAsignarConfirmar}
                      disabled={autoAsignando}
                    >
                      {autoAsignando ? 'Asignando...' : `Confirmar (${previewAutoAsignar.asignables} movimientos)`}
                    </button>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#555a7e', marginTop: '16px' }}>
                      No se encontraron asignaciones automáticas posibles
                    </p>
                  )}
                </div>
              )}
            </div>
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

            {cuentaSeleccionada && (() => {
              const hace30 = new Date();
              hace30.setDate(hace30.getDate() - 30);
              const movsFiltrados = (cuentaSeleccionada.movements || [])
                .filter((m) => new Date(m.postDate || m.transactionDate) >= hace30)
                .sort((a, b) => new Date(b.postDate || b.transactionDate) - new Date(a.postDate || a.transactionDate));
              const movsVisibles = movsFiltrados.slice(0, limiteMovs);
              const hayMas = movsFiltrados.length > limiteMovs;

              return (
                <div className="movimientos-seccion" style={{ marginTop: '24px' }}>
                  <div className="movimientos-header">
                    <div>
                      <div className="movimientos-titulo">Últimos movimientos</div>
                      <div className="movimientos-cuenta-info">
                        {cuentaSeleccionada.name || traducirTipoCuenta(cuentaSeleccionada.type)}
                        {cuentaSeleccionada.number && ` · ****${cuentaSeleccionada.number.slice(-4)}`}
                        {' · '}<span style={{ color: '#888' }}>últimos 30 días</span>
                      </div>
                    </div>
                    <span className="movimientos-registros">
                      {movsFiltrados.length} movimiento{movsFiltrados.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {movsFiltrados.length === 0 ? (
                    <div className="movimientos-vacio">
                      <p className="movimientos-vacio-texto">Sin movimientos en los últimos 30 días</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="movimientos-tabla">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Tipo</th>
                            <th className="col-monto">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movsVisibles.map((mov) => {
                            const fecha = mov.postDate || mov.transactionDate;
                            const esIngreso = mov.amount >= 0;
                            return (
                              <tr key={mov._id || mov.fintocId}>
                                <td style={{ whiteSpace: 'nowrap', color: '#555a7e' }}>
                                  {formatearFecha(fecha)}
                                </td>
                                <td>
                                  <div className="movimiento-descripcion" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {mov.description || 'Sin descripción'}
                                    {mov.pending && (
                                      <span style={{
                                        fontSize: '11px', fontWeight: 600, color: '#b45309',
                                        background: '#fff8e1', borderRadius: '6px', padding: '1px 6px'
                                      }}>
                                        pendiente
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className="movimiento-tipo-badge">{mov.type || '-'}</span>
                                </td>
                                <td className={`movimiento-monto ${esIngreso ? 'ingreso' : 'egreso'}`}>
                                  {esIngreso ? '+' : ''}{formatearMoneda(mov.amount, cuentaSeleccionada.currency)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {hayMas && (
                        <button
                          className="btn-ver-mas-movs"
                          onClick={() => setLimiteMovs((prev) => prev + 30)}
                        >
                          Ver más ({movsFiltrados.length - limiteMovs} restantes)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
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
