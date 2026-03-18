import { useState, useEffect, useCallback } from 'react';
import {
  obtenerResumenObligaciones, obtenerIngresos, crearIngreso, actualizarIngreso, eliminarIngreso,
  obtenerCostosFijos, crearCostoFijo, actualizarCostoFijo, eliminarCostoFijo,
  obtenerDeudas, crearDeuda, actualizarDeuda, eliminarDeuda, obtenerTablaAmortizacion,
} from '../servicios/api';
import { formatearMoneda } from '../utilidades/formateadores';
import {
  DollarSign, TrendingDown, CreditCard, PieChart, Plus,
  Trash2, Edit3, X, Check, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, BarChart3, Table,
} from 'lucide-react';
import '../estilos/obligaciones.css';

const CATEGORIAS_COSTO = {
  arriendo: 'Arriendo / Dividendo',
  servicios: 'Servicios básicos',
  alimentacion: 'Alimentación',
  educacion: 'Educación',
  salud: 'Salud',
  seguros: 'Seguros',
  transporte: 'Transporte',
  otro: 'Otro',
};

const CATEGORIAS_INGRESO = {
  sueldo: 'Sueldo',
  renta: 'Renta',
  beneficio: 'Beneficio',
  otro: 'Otro',
};

const SISTEMAS = {
  frances: 'Francés (cuota fija)',
  aleman: 'Alemán (amort. constante)',
  simple: 'Simple',
};

// ======================== Cálculo preview deuda ========================
function calcularPreviewDeuda({ montoTotal, tasaInteres, plazoAnios, plazoMeses, sistemaAmortizacion }) {
  const P = Number(montoTotal) || 0;
  const tasa = Number(tasaInteres) || 0;
  const n = (Number(plazoAnios) || 0) * 12 + (Number(plazoMeses) || 0);
  if (P <= 0 || n <= 0) return null;
  const r = tasa / 100 / 12;
  let cuotaMensual, interesTotal;

  if (sistemaAmortizacion === 'frances') {
    cuotaMensual = r > 0 ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
    interesTotal = cuotaMensual * n - P;
  } else if (sistemaAmortizacion === 'aleman') {
    const amort = P / n;
    let totInt = 0; let saldo = P;
    for (let i = 0; i < n; i++) { totInt += saldo * r; saldo -= amort; }
    interesTotal = totInt;
    cuotaMensual = amort + P * r;
  } else {
    interesTotal = P * (tasa / 100) * ((Number(plazoAnios) || 0) + (Number(plazoMeses) || 0) / 12);
    cuotaMensual = (P + interesTotal) / n;
  }
  return { cuotaMensual: Math.round(cuotaMensual), cuotasTotales: n, interesTotal: Math.round(interesTotal) };
}

// ========================= MODAL =========================

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="ob-modal-overlay" onClick={onCerrar}>
      <div className="ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-modal-header">
          <h3>{titulo}</h3>
          <button className="ob-modal-cerrar" onClick={onCerrar}><X size={20} /></button>
        </div>
        <div className="ob-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ========================= FORMULARIOS =========================

function FormIngreso({ inicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(inicial || { nombre: '', monto: '', categoria: 'otro' });
  const cambiar = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const enviar = (e) => {
    e.preventDefault();
    onGuardar({ ...form, monto: Number(form.monto) });
  };
  return (
    <form className="ob-form" onSubmit={enviar}>
      <label>Nombre del ingreso<input value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej: Sueldo, Renta fija, Pensión" required /></label>
      <label>Monto mensual<input type="number" min="0" value={form.monto} onChange={(e) => cambiar('monto', e.target.value)} required /></label>
      <label>Categoría
        <select value={form.categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
          {Object.entries(CATEGORIAS_INGRESO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <div className="ob-form-acciones">
        <button type="button" className="btn btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primario"><Check size={16} /> Guardar</button>
      </div>
    </form>
  );
}

function FormCosto({ inicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(inicial || { nombre: '', monto: '', categoria: 'arriendo', tipoCompromiso: 'permanente', duracion: '' });
  const cambiar = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const enviar = (e) => {
    e.preventDefault();
    const datos = { ...form, monto: Number(form.monto) };
    if (datos.tipoCompromiso === 'temporal') datos.duracion = Number(form.duracion);
    else delete datos.duracion;
    onGuardar(datos);
  };
  return (
    <form className="ob-form" onSubmit={enviar}>
      <label>Nombre del costo<input value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej: Arriendo, Luz, Internet" required /></label>
      <label>Monto mensual<input type="number" min="0" value={form.monto} onChange={(e) => cambiar('monto', e.target.value)} required /></label>
      <label>Categoría
        <select value={form.categoria} onChange={(e) => cambiar('categoria', e.target.value)}>
          {Object.entries(CATEGORIAS_COSTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Tipo de compromiso</label>
      <div className="ob-toggle-row">
        <button type="button" className={`ob-toggle-btn ${form.tipoCompromiso === 'permanente' ? 'activo' : ''}`} onClick={() => cambiar('tipoCompromiso', 'permanente')}>Permanente</button>
        <button type="button" className={`ob-toggle-btn ${form.tipoCompromiso === 'temporal' ? 'activo' : ''}`} onClick={() => cambiar('tipoCompromiso', 'temporal')}>Temporal (con plazo)</button>
      </div>
      {form.tipoCompromiso === 'temporal' && (
        <label>Duración del compromiso (meses)<input type="number" min="1" value={form.duracion} onChange={(e) => cambiar('duracion', e.target.value)} required /></label>
      )}
      <div className="ob-form-acciones">
        <button type="button" className="btn btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primario"><Check size={16} /> Guardar</button>
      </div>
    </form>
  );
}

function FormDeuda({ inicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(inicial ? {
    nombre: inicial.nombre || '',
    montoTotal: inicial.montoTotal?.toString() || '',
    tasaInteres: inicial.tasaInteres?.toString() || '',
    plazoAnios: inicial.plazoAnios?.toString() || '0',
    plazoMeses: inicial.plazoMeses?.toString() || '0',
    sistemaAmortizacion: inicial.sistemaAmortizacion || 'frances',
    cuotasPagadas: inicial.cuotasPagadas?.toString() || '0',
  } : { nombre: '', montoTotal: '', tasaInteres: '', plazoAnios: '0', plazoMeses: '0', sistemaAmortizacion: 'frances', cuotasPagadas: '0' });

  const cambiar = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const preview = calcularPreviewDeuda(form);

  const enviar = (e) => {
    e.preventDefault();
    onGuardar({
      nombre: form.nombre,
      montoTotal: Number(form.montoTotal),
      tasaInteres: Number(form.tasaInteres),
      plazoAnios: Number(form.plazoAnios),
      plazoMeses: Number(form.plazoMeses),
      sistemaAmortizacion: form.sistemaAmortizacion,
      cuotasPagadas: Number(form.cuotasPagadas),
    });
  };

  return (
    <form className="ob-form" onSubmit={enviar}>
      <label>Nombre del crédito o institución<input value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej: Banco Estado, Hipotecario" required /></label>
      <label>Monto total del crédito<input type="number" min="0" value={form.montoTotal} onChange={(e) => cambiar('montoTotal', e.target.value)} required /></label>
      <label>Tasa de interés anual (%)<input type="number" min="0" step="0.01" value={form.tasaInteres} onChange={(e) => cambiar('tasaInteres', e.target.value)} required /></label>
      <div className="ob-form-row">
        <label>Plazo - Años<input type="number" min="0" value={form.plazoAnios} onChange={(e) => cambiar('plazoAnios', e.target.value)} /></label>
        <label>Plazo - Meses<input type="number" min="0" max="11" value={form.plazoMeses} onChange={(e) => cambiar('plazoMeses', e.target.value)} /></label>
      </div>
      <label>Sistema de amortización
        <select value={form.sistemaAmortizacion} onChange={(e) => cambiar('sistemaAmortizacion', e.target.value)}>
          {Object.entries(SISTEMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Cuotas ya pagadas<input type="number" min="0" max={preview ? preview.cuotasTotales : 999} value={form.cuotasPagadas} onChange={(e) => cambiar('cuotasPagadas', e.target.value)} /></label>
      {preview && (
        <div className="ob-preview">
          <h4>Cálculo automático</h4>
          <div className="ob-preview-grid">
            <div><span>Cuota mensual</span><strong>{formatearMoneda(preview.cuotaMensual)}</strong></div>
            <div><span>Total cuotas</span><strong>{preview.cuotasTotales}</strong></div>
            <div><span>Interés total</span><strong>{formatearMoneda(preview.interesTotal)}</strong></div>
          </div>
        </div>
      )}
      <div className="ob-form-acciones">
        <button type="button" className="btn btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primario"><Check size={16} /> Guardar</button>
      </div>
    </form>
  );
}

// ========================= COMPONENTE PRINCIPAL =========================

export default function ObligacionFinanciera() {
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [costos, setCostos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [modal, setModal] = useState(null);
  const [proyeccionAbierta, setProyeccionAbierta] = useState(null);
  const [tablaAmort, setTablaAmort] = useState(null); // { deudaId, tabla }

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [res, ing, cos, deu] = await Promise.all([
        obtenerResumenObligaciones(), obtenerIngresos(), obtenerCostosFijos(), obtenerDeudas(),
      ]);
      setResumen(res); setIngresos(ing); setCostos(cos); setDeudas(deu);
    } catch (err) {
      console.error('Error cargando obligaciones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ===== HANDLERS CRUD =====
  const handleGuardarIngreso = async (datos) => {
    try {
      if (modal.editando) await actualizarIngreso(modal.editando._id, datos);
      else await crearIngreso(datos);
      setModal(null); cargar();
    } catch (err) { console.error('Error guardando ingreso:', err); }
  };
  const handleEliminarIngreso = async (id) => {
    if (!window.confirm('¿Eliminar este ingreso?')) return;
    try { await eliminarIngreso(id); cargar(); } catch (err) { console.error(err); }
  };
  const handleGuardarCosto = async (datos) => {
    try {
      if (modal.editando) await actualizarCostoFijo(modal.editando._id, datos);
      else await crearCostoFijo(datos);
      setModal(null); cargar();
    } catch (err) { console.error('Error guardando costo:', err); }
  };
  const handleEliminarCosto = async (id) => {
    if (!window.confirm('¿Eliminar este costo fijo?')) return;
    try { await eliminarCostoFijo(id); cargar(); } catch (err) { console.error(err); }
  };
  const handleGuardarDeuda = async (datos) => {
    try {
      if (modal.editando) await actualizarDeuda(modal.editando._id, datos);
      else await crearDeuda(datos);
      setModal(null); cargar();
    } catch (err) { console.error('Error guardando deuda:', err); }
  };
  const handleEliminarDeuda = async (id) => {
    if (!window.confirm('¿Eliminar esta deuda?')) return;
    try { await eliminarDeuda(id); cargar(); } catch (err) { console.error(err); }
  };
  const handleVerTabla = async (deudaId) => {
    if (tablaAmort?.deudaId === deudaId) { setTablaAmort(null); return; }
    try {
      const data = await obtenerTablaAmortizacion(deudaId);
      setTablaAmort({ deudaId, ...data });
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="ob-loading">
        <div className="loading-spinner"></div>
        <p>Cargando obligaciones financieras...</p>
      </div>
    );
  }

  const colorNivel = (nivel) => {
    if (nivel === 'Bajo') return '#10b981';
    if (nivel === 'Moderado') return '#f59e0b';
    if (nivel === 'Alto') return '#ef4444';
    return '#dc2626';
  };

  return (
    <div className="ob">
      <div className="ob-header">
        <div>
          <h1 className="ob-titulo">Obligación Financiera</h1>
          <p className="ob-subtitulo">Gestiona tus ingresos, costos fijos y deudas</p>
        </div>
      </div>

      <div className="ob-tabs">
        {[
          { id: 'resumen', label: 'Resumen', icon: <PieChart size={16} /> },
          { id: 'ingresos', label: 'Ingresos', icon: <DollarSign size={16} /> },
          { id: 'costos', label: 'Costos fijos', icon: <TrendingDown size={16} /> },
          { id: 'deudas', label: 'Deudas', icon: <CreditCard size={16} /> },
          { id: 'proyeccion', label: 'Proyección', icon: <BarChart3 size={16} /> },
        ].map((t) => (
          <button key={t.id} className={`ob-tab ${tab === t.id ? 'activo' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: RESUMEN ===== */}
      {tab === 'resumen' && resumen && (
        <div className="ob-contenido">
          <div className="ob-metricas">
            <div className="ob-metrica ingreso">
              <div className="ob-metrica-icono"><DollarSign size={22} /></div>
              <div className="ob-metrica-label">Ingresos seguros</div>
              <div className="ob-metrica-valor">{formatearMoneda(resumen.totalIngresos)}</div>
              <div className="ob-metrica-info">{resumen.cantidadIngresos} fuente{resumen.cantidadIngresos !== 1 ? 's' : ''}</div>
            </div>
            <div className="ob-metrica gasto">
              <div className="ob-metrica-icono"><TrendingDown size={22} /></div>
              <div className="ob-metrica-label">Costos fijos</div>
              <div className="ob-metrica-valor">{formatearMoneda(resumen.totalCostos)}</div>
              <div className="ob-metrica-info">{resumen.cantidadCostos} gasto{resumen.cantidadCostos !== 1 ? 's' : ''}</div>
            </div>
            <div className="ob-metrica deuda">
              <div className="ob-metrica-icono"><CreditCard size={22} /></div>
              <div className="ob-metrica-label">Pago de deudas</div>
              <div className="ob-metrica-valor">{formatearMoneda(resumen.totalDeudas)}</div>
              <div className="ob-metrica-info">{resumen.cantidadDeudas} deuda{resumen.cantidadDeudas !== 1 ? 's' : ''}</div>
            </div>
            <div className={`ob-metrica ${resumen.flujoCaja >= 0 ? 'positivo' : 'negativo'}`}>
              <div className="ob-metrica-icono"><PieChart size={22} /></div>
              <div className="ob-metrica-label">Flujo de caja</div>
              <div className="ob-metrica-valor">{formatearMoneda(resumen.flujoCaja)}</div>
              <div className="ob-metrica-info">Disponible mensual</div>
            </div>
          </div>

          <div className="ob-riesgo-cards">
            <div className="ob-riesgo-card">
              <div className="ob-riesgo-titulo">Ingresos comprometidos</div>
              <div className="ob-riesgo-barra-fondo">
                <div className="ob-riesgo-barra" style={{ width: `${Math.min(resumen.porcentajeComprometido, 100)}%`, backgroundColor: colorNivel(resumen.nivelCarga) }} />
              </div>
              <div className="ob-riesgo-valor" style={{ color: colorNivel(resumen.nivelCarga) }}>{resumen.porcentajeComprometido}%</div>
            </div>
            <div className="ob-riesgo-card">
              <div className="ob-riesgo-titulo">Carga financiera</div>
              <div className="ob-riesgo-badge" style={{ backgroundColor: colorNivel(resumen.nivelCarga) + '20', color: colorNivel(resumen.nivelCarga) }}>{resumen.nivelCarga}</div>
            </div>
            <div className="ob-riesgo-card">
              <div className="ob-riesgo-titulo">Riesgo sobreendeudamiento</div>
              <div className="ob-riesgo-badge" style={{ backgroundColor: colorNivel(resumen.nivelCarga) + '20', color: colorNivel(resumen.nivelCarga) }}>
                <AlertTriangle size={14} /> {resumen.riesgoSobreendeudamiento}
              </div>
            </div>
          </div>

          {resumen.desgloseCostos && Object.keys(resumen.desgloseCostos).length > 0 && (
            <div className="ob-desglose">
              <h3 className="ob-desglose-titulo">Composición de costos fijos</h3>
              <div className="ob-desglose-lista">
                {Object.entries(resumen.desgloseCostos).map(([cat, monto]) => {
                  const pct = resumen.totalCostos > 0 ? Math.round((monto / resumen.totalCostos) * 100) : 0;
                  return (
                    <div key={cat} className="ob-desglose-item">
                      <div className="ob-desglose-item-info">
                        <span className="ob-desglose-item-nombre">{CATEGORIAS_COSTO[cat] || cat}</span>
                        <span className="ob-desglose-item-pct">{pct}%</span>
                      </div>
                      <div className="ob-desglose-barra-fondo"><div className="ob-desglose-barra" style={{ width: `${pct}%` }} /></div>
                      <div className="ob-desglose-item-monto">{formatearMoneda(monto)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: INGRESOS ===== */}
      {tab === 'ingresos' && (
        <div className="ob-contenido">
          <div className="ob-seccion-header">
            <h2>Ingresos seguros</h2>
            <button className="btn btn-primario" onClick={() => setModal({ tipo: 'ingreso', editando: null })}>
              <Plus size={16} /> Agregar ingreso
            </button>
          </div>
          {ingresos.length === 0 ? (
            <div className="ob-vacio">
              <DollarSign size={48} />
              <p>No tienes ingresos registrados</p>
              <button className="btn btn-primario" onClick={() => setModal({ tipo: 'ingreso', editando: null })}>+ Agregar ingreso</button>
            </div>
          ) : (
            <div className="ob-lista">
              {ingresos.map((ing) => (
                <div key={ing._id} className="ob-lista-item">
                  <div className="ob-lista-item-info">
                    <span className="ob-lista-item-nombre">{ing.nombre}</span>
                    <span className="ob-lista-item-detalle">{CATEGORIAS_INGRESO[ing.categoria] || 'Otro'}</span>
                  </div>
                  <div className="ob-lista-item-monto ingreso">{formatearMoneda(ing.monto)}</div>
                  <div className="ob-lista-item-acciones">
                    <button className="ob-btn-icon" onClick={() => setModal({ tipo: 'ingreso', editando: ing })}><Edit3 size={16} /></button>
                    <button className="ob-btn-icon danger" onClick={() => handleEliminarIngreso(ing._id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              <div className="ob-lista-total">
                <span>Total mensual</span>
                <span className="ingreso">{formatearMoneda(ingresos.reduce((s, i) => s + i.monto, 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: COSTOS FIJOS ===== */}
      {tab === 'costos' && (
        <div className="ob-contenido">
          <div className="ob-seccion-header">
            <h2>Costos fijos esenciales</h2>
            <button className="btn btn-primario" onClick={() => setModal({ tipo: 'costo', editando: null })}>
              <Plus size={16} /> Agregar costo
            </button>
          </div>
          {costos.length === 0 ? (
            <div className="ob-vacio">
              <TrendingDown size={48} />
              <p>No tienes costos fijos registrados</p>
              <button className="btn btn-primario" onClick={() => setModal({ tipo: 'costo', editando: null })}>+ Agregar costo</button>
            </div>
          ) : (
            <div className="ob-lista">
              {costos.map((c) => (
                <div key={c._id} className="ob-lista-item">
                  <div className="ob-lista-item-info">
                    <span className="ob-lista-item-nombre">{c.nombre}</span>
                    <span className="ob-lista-item-detalle">
                      {CATEGORIAS_COSTO[c.categoria]} · {c.tipoCompromiso === 'permanente' ? 'Permanente' : `Temporal (${c.duracion} meses)`}
                    </span>
                  </div>
                  <div className="ob-lista-item-monto gasto">{formatearMoneda(c.monto)}</div>
                  <div className="ob-lista-item-acciones">
                    <button className="ob-btn-icon" onClick={() => setModal({ tipo: 'costo', editando: c })}><Edit3 size={16} /></button>
                    <button className="ob-btn-icon danger" onClick={() => handleEliminarCosto(c._id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              <div className="ob-lista-total">
                <span>Total mensual</span>
                <span className="gasto">{formatearMoneda(costos.reduce((s, c) => s + c.monto, 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: DEUDAS ===== */}
      {tab === 'deudas' && (
        <div className="ob-contenido">
          <div className="ob-seccion-header">
            <h2>Deudas y créditos activos</h2>
            <button className="btn btn-primario" onClick={() => setModal({ tipo: 'deuda', editando: null })}>
              <Plus size={16} /> Agregar deuda
            </button>
          </div>
          {deudas.length === 0 ? (
            <div className="ob-vacio">
              <CreditCard size={48} />
              <p>No tienes deudas registradas</p>
              <button className="btn btn-primario" onClick={() => setModal({ tipo: 'deuda', editando: null })}>+ Agregar deuda</button>
            </div>
          ) : (
            <div className="ob-deudas-grid">
              {deudas.map((d) => {
                const progreso = d.cuotasTotales > 0 ? Math.round(((d.cuotasPagadas || 0) / d.cuotasTotales) * 100) : 0;
                return (
                  <div key={d._id} className="ob-deuda-card">
                    <div className="ob-deuda-card-header">
                      <h4>{d.nombre}</h4>
                      <div className="ob-deuda-card-acciones">
                        <button className="ob-btn-icon" onClick={() => setModal({ tipo: 'deuda', editando: d })}><Edit3 size={14} /></button>
                        <button className="ob-btn-icon danger" onClick={() => handleEliminarDeuda(d._id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="ob-deuda-card-body">
                      <div className="ob-deuda-fila"><span>Monto total</span><span>{formatearMoneda(d.montoTotal)}</span></div>
                      <div className="ob-deuda-fila"><span>Saldo pendiente</span><span className="gasto">{formatearMoneda(d.saldoPendiente)}</span></div>
                      <div className="ob-deuda-fila"><span>Cuota mensual</span><span>{formatearMoneda(d.cuotaMensual)}</span></div>
                      <div className="ob-deuda-fila"><span>Interés total</span><span>{formatearMoneda(d.interesTotal)}</span></div>
                      <div className="ob-deuda-fila"><span>Cuotas pagadas</span><span>{d.cuotasPagadas || 0} de {d.cuotasTotales}</span></div>
                      <div className="ob-deuda-fila"><span>Cuotas restantes</span><span>{d.cuotasRestantes || 0}</span></div>
                      <div className="ob-deuda-fila"><span>Tasa anual</span><span>{d.tasaInteres}%</span></div>
                      <div className="ob-deuda-fila"><span>Sistema</span><span>{SISTEMAS[d.sistemaAmortizacion] || d.sistemaAmortizacion}</span></div>
                    </div>
                    <div className="ob-deuda-progreso">
                      <div className="ob-deuda-progreso-label"><span>Progreso</span><span>{progreso}%</span></div>
                      <div className="ob-deuda-progreso-barra"><div className="ob-deuda-progreso-fill" style={{ width: `${progreso}%` }} /></div>
                    </div>
                    <button className="ob-btn-tabla" onClick={() => handleVerTabla(d._id)}>
                      <Table size={14} /> {tablaAmort?.deudaId === d._id ? 'Ocultar tabla' : 'Ver tabla de amortización'}
                    </button>
                    {tablaAmort?.deudaId === d._id && tablaAmort.tabla && (
                      <div className="ob-amort-tabla-wrapper">
                        <table className="ob-amort-tabla">
                          <thead>
                            <tr><th>#</th><th>Cuota</th><th>Interés</th><th>Amortización</th><th>Saldo</th></tr>
                          </thead>
                          <tbody>
                            {tablaAmort.tabla.map((row) => (
                              <tr key={row.cuota} className={row.cuota <= (d.cuotasPagadas || 0) ? 'pagada' : ''}>
                                <td>{row.cuota}</td>
                                <td>{formatearMoneda(row.montoCuota)}</td>
                                <td>{formatearMoneda(row.interes)}</td>
                                <td>{formatearMoneda(row.amortizacion)}</td>
                                <td>{formatearMoneda(row.saldo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {deudas.length > 0 && (
            <div className="ob-lista-total" style={{ marginTop: 16 }}>
              <span>Total cuotas mensuales</span>
              <span className="gasto">{formatearMoneda(deudas.reduce((s, d) => s + d.cuotaMensual, 0))}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: PROYECCIÓN ===== */}
      {tab === 'proyeccion' && resumen?.proyeccion && (
        <div className="ob-contenido">
          <h2 className="ob-proy-titulo">Proyección 12 meses</h2>
          <div className="ob-proy-grid">
            {resumen.proyeccion.map((m, i) => {
              const abierto = proyeccionAbierta === i;
              return (
                <div key={m.mes} className="ob-proy-card">
                  <div className="ob-proy-card-header" onClick={() => setProyeccionAbierta(abierto ? null : i)}>
                    <span className="ob-proy-mes">{m.mesLabel}</span>
                    <span className={`ob-proy-flujo ${m.flujo >= 0 ? 'positivo' : 'negativo'}`}>{formatearMoneda(m.flujo)}</span>
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {abierto && (
                    <div className="ob-proy-detalle">
                      <div className="ob-proy-fila ingreso"><span>Ingresos</span><span>{formatearMoneda(m.ingresos)}</span></div>
                      <div className="ob-proy-fila gasto"><span>Costos fijos</span><span>-{formatearMoneda(m.costos)}</span></div>
                      <div className="ob-proy-fila gasto"><span>Deudas</span><span>-{formatearMoneda(m.deudas)}</span></div>
                      {m.items && m.items.length > 0 && (
                        <>
                          <div className="ob-proy-separador" />
                          <div className="ob-proy-venc-titulo"><Calendar size={14} /> Detalle</div>
                          {m.items.map((v, j) => (
                            <div key={j} className={`ob-proy-venc ${v.tipo}`}>
                              <span>{v.nombre}{v.detalle ? ` (${v.detalle})` : ''}</span>
                              <span>{v.tipo === 'ingreso' ? '+' : '-'}{formatearMoneda(v.monto)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== MODALES ===== */}
      {modal?.tipo === 'ingreso' && (
        <Modal titulo={modal.editando ? 'Editar ingreso' : 'Nuevo ingreso seguro'} onCerrar={() => setModal(null)}>
          <FormIngreso inicial={modal.editando} onGuardar={handleGuardarIngreso} onCancelar={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'costo' && (
        <Modal titulo={modal.editando ? 'Editar costo fijo' : 'Nuevo costo fijo'} onCerrar={() => setModal(null)}>
          <FormCosto inicial={modal.editando} onGuardar={handleGuardarCosto} onCancelar={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'deuda' && (
        <Modal titulo={modal.editando ? 'Editar deuda' : 'Nueva deuda'} onCerrar={() => setModal(null)}>
          <FormDeuda inicial={modal.editando} onGuardar={handleGuardarDeuda} onCancelar={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
