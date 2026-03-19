import { useState, useEffect, useCallback } from 'react';
import { obtenerEstadoFinanciero, resincronizarDatos, obtenerCategoriasDisponibles, categorizarMovimiento } from '../servicios/api';
import { formatearMoneda, formatearFecha } from '../utilidades/formateadores';
import { TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, BarChart3, List, Loader, RefreshCw, ChevronDown, ArrowLeftRight, Repeat, ShoppingCart, Car, Utensils, Wifi, Heart, Home, GraduationCap, ShieldCheck, ShoppingBag, ArrowRightLeft, Banknote, MoreHorizontal, Bike, Plus, X } from 'lucide-react';
import '../estilos/estado.css';

// Mapa de icono backend → componente lucide-react
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

function EstadoFinanciero() {
  const hoy = new Date();
  const mesInicial = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const [mes, setMes] = useState(mesInicial);
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState('categoria');
  const [resyncLoading, setResyncLoading] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [moverItem, setMoverItem] = useState(null); // { descripcion }
  const [catDisponibles, setCatDisponibles] = useState([]);

  const toggleExpandir = (key) => {
    setExpandido((prev) => (prev === key ? null : key));
  };

  const hacerResync = async () => {
    if (!window.confirm('Esto eliminará todos los movimientos guardados y los volverá a importar desde tu banco. ¿Continuar?')) return;
    try {
      setResyncLoading(true);
      await resincronizarDatos();
      await cargar();
    } catch (err) {
      console.error('Error en resync:', err);
    } finally {
      setResyncLoading(false);
    }
  };

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await obtenerEstadoFinanciero(mes);
      setEstado(data);
    } catch (err) {
      console.error('Error cargando estado financiero:', err);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirMover = async (descripcion) => {
    try {
      const cats = await obtenerCategoriasDisponibles();
      setCatDisponibles(cats.filter(c => c.nombre !== 'Otros'));
      setMoverItem({ descripcion });
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  };

  const confirmarMover = async (categoria) => {
    if (!moverItem) return;
    try {
      await categorizarMovimiento(moverItem.descripcion, categoria);
      setMoverItem(null);
      await cargar();
    } catch (err) {
      console.error('Error moviendo categoría:', err);
    }
  };

  const cambiarMes = (delta) => {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const esMesActual = mes === mesInicial;

  if (loading) {
    return (
      <div className="ef-loading">
        <Loader size={32} className="icon-spin" />
        <p>Analizando tus movimientos...</p>
      </div>
    );
  }

  if (!estado) return null;

  const { resumen, categorias, porTipo, topGastos, topIngresos, transferenciasInternas, suscripciones } = estado;
  const ingresosCateg = categorias.filter((c) => c.tipo === 'ingreso');
  const gastosCateg = categorias.filter((c) => c.tipo === 'gasto');

  const getIcono = (iconName, size = 16, color) => {
    const Comp = ICON_MAP[iconName] || MoreHorizontal;
    return <Comp size={size} color={color} />;
  };

  return (
    <div className="ef">
      {/* Header: selector de mes + botón resync */}
      <div className="ef-header-row">
        <div className="ef-selector-mes">
          <button className="ef-mes-btn" onClick={() => cambiarMes(-1)}>
            <ChevronLeft size={20} />
          </button>
          <span className="ef-mes-label">{estado.mesLabel}</span>
          <button className="ef-mes-btn" onClick={() => cambiarMes(1)} disabled={esMesActual}>
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="ef-resync-btn" onClick={hacerResync} disabled={resyncLoading} title="Re-sincronizar movimientos desde el banco">
          <RefreshCw size={16} className={resyncLoading ? 'icon-spin' : ''} />
          {resyncLoading ? 'Sincronizando...' : 'Re-sincronizar'}
        </button>
      </div>

      {/* Resumen */}
      {resumen.cantidadMovimientos === 0 ? (
        <div className="ef-vacio">
          <Wallet size={48} />
          <p>No hay movimientos en este periodo</p>
        </div>
      ) : (
        <>
          <div className="ef-resumen">
            <div className="ef-resumen-card ingreso">
              <div className="ef-resumen-icono"><TrendingUp size={20} /></div>
              <div className="ef-resumen-label">Ingresos</div>
              <div className="ef-resumen-monto">{formatearMoneda(resumen.totalIngresos)}</div>
              <div className="ef-resumen-info">{categorias.filter((c) => c.tipo === 'ingreso').reduce((s, c) => s + c.cantidad, 0)} movimientos</div>
            </div>
            <div className="ef-resumen-card gasto">
              <div className="ef-resumen-icono"><TrendingDown size={20} /></div>
              <div className="ef-resumen-label">Gastos</div>
              <div className="ef-resumen-monto">{formatearMoneda(resumen.totalGastos)}</div>
              <div className="ef-resumen-info">{categorias.filter((c) => c.tipo === 'gasto').reduce((s, c) => s + c.cantidad, 0)} movimientos</div>
            </div>
            <div className={`ef-resumen-card ${resumen.montoNeto >= 0 ? 'positivo' : 'negativo'}`}>
              <div className="ef-resumen-icono"><Wallet size={20} /></div>
              <div className="ef-resumen-label">Balance neto</div>
              <div className="ef-resumen-monto">
                {resumen.montoNeto >= 0 ? '+' : ''}{formatearMoneda(resumen.montoNeto)}
              </div>
              <div className="ef-resumen-info">
                Tasa ahorro: {resumen.tasaAhorro}%
              </div>
            </div>
          </div>

          {/* Banner transferencias internas */}
          {transferenciasInternas && transferenciasInternas.cantidad > 0 && (
            <div className="ef-transferencias-banner">
              <ArrowLeftRight size={18} />
              <span>
                Se excluyeron <strong>{transferenciasInternas.cantidad}</strong> transferencias entre tus cuentas por <strong>{formatearMoneda(transferenciasInternas.monto)}</strong>
              </span>
            </div>
          )}

          {/* Toggle vista */}
          <div className="ef-vista-toggle">
            <button
              className={`ef-vista-btn ${vista === 'categoria' ? 'activo' : ''}`}
              onClick={() => setVista('categoria')}
            >
              <BarChart3 size={16} /> Por categoría
            </button>
            <button
              className={`ef-vista-btn ${vista === 'tipo' ? 'activo' : ''}`}
              onClick={() => setVista('tipo')}
            >
              <List size={16} /> Por tipo
            </button>
          </div>

          {/* Vista por categoría */}
          {vista === 'categoria' && (
            <div className="ef-categorias">
              {ingresosCateg.length > 0 && (
                <div className="ef-grupo">
                  <div className="ef-grupo-header">
                    <span className="ef-grupo-titulo ingreso">Ingresos</span>
                    <span className="ef-grupo-total">{formatearMoneda(resumen.totalIngresos)}</span>
                  </div>
                  {ingresosCateg.map((c, i) => {
                    const key = `ingreso-${i}`;
                    const abierto = expandido === key;
                    return (
                      <div key={i} className="ef-item-wrap">
                        <div className="ef-item ef-item-clickable" onClick={() => toggleExpandir(key)}>
                          <div className="ef-item-info">
                            <span className="ef-item-nombre">
                              <span className="ef-item-icono" style={{ color: c.color }}>{getIcono(c.icono, 16, c.color)}</span>
                              {c.nombre}
                            </span>
                            <span className="ef-item-cantidad">{c.cantidad} mov.</span>
                          </div>
                          <div className="ef-item-barra-container">
                            <div className="ef-item-barra ingreso" style={{ width: `${c.porcentaje}%` }} />
                          </div>
                          <div className="ef-item-datos">
                            <span className="ef-item-monto ingreso">{formatearMoneda(c.monto)}</span>
                            <span className="ef-item-porcentaje">{c.porcentaje}% <ChevronDown size={12} className={`ef-chevron ${abierto ? 'abierto' : ''}`} /></span>
                          </div>
                        </div>
                        {abierto && c.movimientos && (
                          <div className="ef-detalle">
                            {c.movimientos.map((m, j) => (
                              <div key={j} className="ef-detalle-item">
                                <div className="ef-detalle-desc">
                                  <span>{m.descripcion}</span>
                                  <span className="ef-detalle-meta">{m.cantidad} {m.cantidad === 1 ? 'movimiento' : 'movimientos'}</span>
                                </div>
                                <div className="ef-detalle-acciones">
                                  {c.nombre === 'Otros' && (
                                    <button className="ef-mover-btn" onClick={(e) => { e.stopPropagation(); abrirMover(m.descripcion); }} title="Mover a otra categoría">
                                      <Plus size={14} />
                                    </button>
                                  )}
                                  <span className="ef-detalle-monto ingreso">{formatearMoneda(m.monto)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {gastosCateg.length > 0 && (
                <div className="ef-grupo">
                  <div className="ef-grupo-header">
                    <span className="ef-grupo-titulo gasto">Gastos</span>
                    <span className="ef-grupo-total">{formatearMoneda(resumen.totalGastos)}</span>
                  </div>
                  {gastosCateg.map((c, i) => {
                    const key = `gasto-${i}`;
                    const abierto = expandido === key;
                    return (
                      <div key={i} className="ef-item-wrap">
                        <div className="ef-item ef-item-clickable" onClick={() => toggleExpandir(key)}>
                          <div className="ef-item-info">
                            <span className="ef-item-nombre">
                              <span className="ef-item-icono" style={{ color: c.color }}>{getIcono(c.icono, 16, c.color)}</span>
                              {c.nombre}
                            </span>
                            <span className="ef-item-cantidad">{c.cantidad} mov.</span>
                          </div>
                          <div className="ef-item-barra-container">
                            <div className="ef-item-barra gasto" style={{ width: `${c.porcentaje}%` }} />
                          </div>
                          <div className="ef-item-datos">
                            <span className="ef-item-monto gasto">{formatearMoneda(c.monto)}</span>
                            <span className="ef-item-porcentaje">{c.porcentaje}% <ChevronDown size={12} className={`ef-chevron ${abierto ? 'abierto' : ''}`} /></span>
                          </div>
                        </div>
                        {abierto && c.movimientos && (
                          <div className="ef-detalle">
                            {c.movimientos.map((m, j) => (
                              <div key={j} className="ef-detalle-item">
                                <div className="ef-detalle-desc">
                                  <span>{m.descripcion}</span>
                                  <span className="ef-detalle-meta">{m.cantidad} {m.cantidad === 1 ? 'movimiento' : 'movimientos'}</span>
                                </div>
                                <div className="ef-detalle-acciones">
                                  {c.nombre === 'Otros' && (
                                    <button className="ef-mover-btn" onClick={(e) => { e.stopPropagation(); abrirMover(m.descripcion); }} title="Mover a otra categoría">
                                      <Plus size={14} />
                                    </button>
                                  )}
                                  <span className="ef-detalle-monto gasto">{formatearMoneda(m.monto)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Vista por tipo */}
          {vista === 'tipo' && (
            <div className="ef-categorias">
              <div className="ef-grupo">
                <div className="ef-grupo-header">
                  <span className="ef-grupo-titulo">Por tipo de movimiento</span>
                  <span className="ef-grupo-total">{resumen.cantidadMovimientos} movimientos</span>
                </div>
                {porTipo.map((t, i) => (
                  <div key={i} className="ef-item ef-item-tipo">
                    <div className="ef-item-info">
                      <span className="ef-item-nombre">{t.tipoLabel}</span>
                      <span className="ef-item-cantidad">{t.cantidad} mov.</span>
                    </div>
                    <div className="ef-tipo-montos">
                      {t.montoIngresos > 0 && (
                        <span className="ef-item-monto ingreso">+{formatearMoneda(t.montoIngresos)}</span>
                      )}
                      {t.montoGastos > 0 && (
                        <span className="ef-item-monto gasto">-{formatearMoneda(t.montoGastos)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suscripciones detectadas */}
          {suscripciones && suscripciones.length > 0 && (
            <div className="ef-suscripciones">
              <div className="ef-suscripciones-header">
                <Repeat size={18} />
                <span>Suscripciones detectadas</span>
                <span className="ef-suscripciones-badge">{suscripciones.length}</span>
              </div>
              <div className="ef-suscripciones-lista">
                {suscripciones.map((s, i) => (
                  <div key={i} className="ef-suscripcion-item">
                    <span className="ef-suscripcion-icono" style={{ color: s.color }}>{getIcono(s.icono, 18, s.color)}</span>
                    <div className="ef-suscripcion-info">
                      <span className="ef-suscripcion-nombre">{s.descripcion}</span>
                    </div>
                    <span className="ef-suscripcion-monto">{formatearMoneda(s.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top movimientos */}
          <div className="ef-tops">
            {topIngresos.length > 0 && (
              <div className="ef-top-seccion">
                <h3 className="ef-top-titulo">
                  <TrendingUp size={18} /> Mayores ingresos
                </h3>
                <table className="ef-top-tabla">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cuenta</th>
                      <th>Fecha</th>
                      <th className="ef-th-monto">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topIngresos.map((m, i) => (
                      <tr key={i}>
                        <td>{m.descripcion}</td>
                        <td className="ef-td-cuenta">{m.cuenta}</td>
                        <td className="ef-td-fecha">{formatearFecha(m.fecha)}</td>
                        <td className="ef-td-monto ingreso">+{formatearMoneda(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {topGastos.length > 0 && (
              <div className="ef-top-seccion">
                <h3 className="ef-top-titulo">
                  <TrendingDown size={18} /> Mayores gastos
                </h3>
                <table className="ef-top-tabla">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cuenta</th>
                      <th>Fecha</th>
                      <th className="ef-th-monto">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topGastos.map((m, i) => (
                      <tr key={i}>
                        <td>{m.descripcion}</td>
                        <td className="ef-td-cuenta">{m.cuenta}</td>
                        <td className="ef-td-fecha">{formatearFecha(m.fecha)}</td>
                        <td className="ef-td-monto gasto">{formatearMoneda(m.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal seleccionar categoría */}
      {moverItem && (
        <div className="ef-modal-overlay" onClick={() => setMoverItem(null)}>
          <div className="ef-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ef-modal-header">
              <span className="ef-modal-titulo">Mover a categoría</span>
              <button className="ef-modal-cerrar" onClick={() => setMoverItem(null)}><X size={18} /></button>
            </div>
            <p className="ef-modal-desc">
              <strong>{moverItem.descripcion}</strong> se moverá y siempre se reconocerá en la categoría elegida.
            </p>
            <div className="ef-modal-lista">
              {catDisponibles.map((cat) => (
                <button key={cat.nombre} className="ef-modal-cat" onClick={() => confirmarMover(cat.nombre)}>
                  <span className="ef-modal-cat-icono" style={{ color: cat.color }}>{getIcono(cat.icono, 20, cat.color)}</span>
                  <span>{cat.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstadoFinanciero;
