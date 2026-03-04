import { useState, useEffect, useCallback, useRef } from 'react';
import { obtenerProyeccionFlujoCompleta, actualizarCategoriaFlujo, reanalizarFlujo } from '../servicios/api';
import { formatearMoneda } from '../utilidades/formateadores';
import '../estilos/flujoCaja.css';

const PERIODOS = [
  { label: '6 meses', valor: 6 },
  { label: '12 meses', valor: 12 },
  { label: '24 meses', valor: 24 },
];

function FlujoCaja() {
  const [proyeccion, setProyeccion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(12);
  const [seccionExpandida, setSeccionExpandida] = useState(null);
  const [reanalizando, setReanalizando] = useState(false);
  const tablaRef = useRef(null);

  const cargarProyeccion = useCallback(async () => {
    try {
      setLoading(true);
      const data = await obtenerProyeccionFlujoCompleta(periodo);
      setProyeccion(data);
    } catch (err) {
      console.error('Error cargando proyección:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargarProyeccion();
  }, [cargarProyeccion]);

  const handleReanalizar = async () => {
    try {
      setReanalizando(true);
      await reanalizarFlujo();
      await cargarProyeccion();
    } catch (err) {
      console.error('Error re-analizando:', err);
    } finally {
      setReanalizando(false);
    }
  };

  const handleToggleCategoria = async (id, activo) => {
    try {
      await actualizarCategoriaFlujo(id, { activo: !activo });
      await cargarProyeccion();
    } catch (err) {
      console.error('Error toggling categoría:', err);
    }
  };

  const toggleSeccion = (seccion) => {
    setSeccionExpandida((prev) => (prev === seccion ? null : seccion));
  };

  if (loading) {
    return (
      <div className="fc-loading">
        <div className="loading-spinner"></div>
        <p>Analizando tu flujo de caja...</p>
      </div>
    );
  }

  if (!proyeccion) {
    return (
      <div className="fc-vacio">
        <div className="fc-vacio-icono">📊</div>
        <h2>Sin datos de flujo de caja</h2>
        <p>Conecta tu banco e importa movimientos para generar la proyección automáticamente.</p>
      </div>
    );
  }

  const { saldoActual, meses, categorias, resumen } = proyeccion;
  const ingresoCats = categorias ? categorias.filter((c) => c.tipo === 'ingreso') : [];
  const fijoCats = categorias ? categorias.filter((c) => c.tipo === 'costo_fijo' && !c.creditoId) : [];
  const variableCats = categorias ? categorias.filter((c) => c.tipo === 'costo_variable') : [];
  const creditoCats = categorias ? categorias.filter((c) => c.tipo === 'costo_fijo' && c.creditoId) : [];

  // Para el gráfico de barras
  const maxBarValue = meses && meses.length > 0
    ? Math.max(...meses.map((m) => Math.max(m.ingresos?.total || 0, m.totalEgresos || 0)), 1)
    : 1;

  return (
    <div className="fc">
      {/* ===== HEADER CON SELECTOR ===== */}
      <div className="fc-controles">
        <div className="fc-periodo-selector">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              className={`fc-periodo-btn ${periodo === p.valor ? 'activo' : ''}`}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          className="fc-btn-reanalizar"
          onClick={handleReanalizar}
          disabled={reanalizando}
        >
          {reanalizando ? '⏳ Analizando...' : '🔄 Re-analizar'}
        </button>
      </div>

      {/* ===== CARDS RESUMEN ===== */}
      {resumen && (
        <div className="fc-resumen">
          <div className="fc-card saldo">
            <span className="fc-card-icono">💰</span>
            <div className="fc-card-info">
              <span className="fc-card-label">Saldo actual</span>
              <span className="fc-card-valor">{formatearMoneda(saldoActual || 0)}</span>
            </div>
          </div>
          <div className="fc-card ingreso">
            <span className="fc-card-icono">📈</span>
            <div className="fc-card-info">
              <span className="fc-card-label">Ingresos / mes</span>
              <span className="fc-card-valor positivo">{formatearMoneda(resumen.ingresosMensuales || 0)}</span>
            </div>
          </div>
          <div className="fc-card gasto">
            <span className="fc-card-icono">📉</span>
            <div className="fc-card-info">
              <span className="fc-card-label">Gastos fijos / mes</span>
              <span className="fc-card-valor negativo">{formatearMoneda((resumen.costosFijosMensuales || 0) + (resumen.creditosMensuales || 0))}</span>
            </div>
          </div>
          <div className="fc-card variable">
            <span className="fc-card-icono">📊</span>
            <div className="fc-card-info">
              <span className="fc-card-label">Gastos variables / mes</span>
              <span className="fc-card-valor negativo">{formatearMoneda(resumen.costosVariablesMensuales || 0)}</span>
            </div>
          </div>
          <div className={`fc-card neto ${(resumen.flujoNeto || 0) >= 0 ? 'positivo-bg' : 'negativo-bg'}`}>
            <span className="fc-card-icono">{(resumen.flujoNeto || 0) >= 0 ? '✅' : '⚠️'}</span>
            <div className="fc-card-info">
              <span className="fc-card-label">Flujo neto / mes</span>
              <span className={`fc-card-valor ${(resumen.flujoNeto || 0) >= 0 ? 'positivo' : 'negativo'}`}>
                {(resumen.flujoNeto || 0) >= 0 ? '+' : ''}{formatearMoneda(resumen.flujoNeto || 0)}
              </span>
              {resumen.mesesHastaQuiebre && (
                <span className="fc-card-alerta">⚠️ Quiebre en {resumen.mesesHastaQuiebre} meses</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CATEGORÍAS DETECTADAS ===== */}
      {categorias && categorias.length > 0 && (
        <div className="fc-categorias">
          <div className="fc-categorias-header">
            <h3 className="fc-seccion-titulo">🔍 Categorías detectadas</h3>
          </div>

          {/* Ingresos */}
          <div className="fc-cat-grupo">
            <div className="fc-cat-grupo-header ingreso" onClick={() => toggleSeccion('ingresos')}>
              <span className="fc-cat-grupo-titulo">📈 Ingresos ({ingresoCats.length})</span>
              <span className="fc-cat-grupo-total positivo">+{formatearMoneda(resumen?.ingresosMensuales || 0)}/mes</span>
              <span className="fc-cat-chevron">{seccionExpandida === 'ingresos' ? '▲' : '▼'}</span>
            </div>
            {seccionExpandida === 'ingresos' && (
              <div className="fc-cat-lista">
                {ingresoCats.map((c) => (
                  <div key={c.id} className={`fc-cat-item ${!c.activo ? 'desactivado' : ''}`}>
                    <button className="fc-cat-toggle" onClick={() => handleToggleCategoria(c.id, c.activo)}>
                      {c.activo ? '✅' : '⬜'}
                    </button>
                    <span className="fc-cat-nombre">{c.nombre}</span>
                    <span className="fc-cat-confianza">{c.confianza}%</span>
                    <span className="fc-cat-monto positivo">+{formatearMoneda(c.montoPromedio)}</span>
                  </div>
                ))}
                {ingresoCats.length === 0 && <p className="fc-cat-vacio">No se detectaron ingresos recurrentes</p>}
              </div>
            )}
          </div>

          {/* Costos Fijos */}
          <div className="fc-cat-grupo">
            <div className="fc-cat-grupo-header fijo" onClick={() => toggleSeccion('fijos')}>
              <span className="fc-cat-grupo-titulo">📌 Costos fijos ({fijoCats.length})</span>
              <span className="fc-cat-grupo-total negativo">-{formatearMoneda(resumen?.costosFijosMensuales || 0)}/mes</span>
              <span className="fc-cat-chevron">{seccionExpandida === 'fijos' ? '▲' : '▼'}</span>
            </div>
            {seccionExpandida === 'fijos' && (
              <div className="fc-cat-lista">
                {fijoCats.map((c) => (
                  <div key={c.id} className={`fc-cat-item ${!c.activo ? 'desactivado' : ''}`}>
                    <button className="fc-cat-toggle" onClick={() => handleToggleCategoria(c.id, c.activo)}>
                      {c.activo ? '✅' : '⬜'}
                    </button>
                    <span className="fc-cat-nombre">{c.nombre}</span>
                    <span className="fc-cat-confianza">{c.confianza}%</span>
                    <span className="fc-cat-monto negativo">-{formatearMoneda(c.montoPromedio)}</span>
                  </div>
                ))}
                {fijoCats.length === 0 && <p className="fc-cat-vacio">No se detectaron costos fijos</p>}
              </div>
            )}
          </div>

          {/* Cuotas de Créditos */}
          {creditoCats.length > 0 && (
            <div className="fc-cat-grupo">
              <div className="fc-cat-grupo-header credito" onClick={() => toggleSeccion('creditos')}>
                <span className="fc-cat-grupo-titulo">💳 Cuotas créditos ({creditoCats.length})</span>
                <span className="fc-cat-grupo-total negativo">-{formatearMoneda(resumen?.creditosMensuales || 0)}/mes</span>
                <span className="fc-cat-chevron">{seccionExpandida === 'creditos' ? '▲' : '▼'}</span>
              </div>
              {seccionExpandida === 'creditos' && (
                <div className="fc-cat-lista">
                  {creditoCats.map((c) => (
                    <div key={c.id} className="fc-cat-item">
                      <span className="fc-cat-badge credito">Crédito</span>
                      <span className="fc-cat-nombre">{c.nombre}</span>
                      <span className="fc-cat-monto negativo">-{formatearMoneda(c.montoPromedio)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Costos Variables */}
          <div className="fc-cat-grupo">
            <div className="fc-cat-grupo-header variable" onClick={() => toggleSeccion('variables')}>
              <span className="fc-cat-grupo-titulo">📊 Costos variables ({variableCats.length})</span>
              <span className="fc-cat-grupo-total negativo">-{formatearMoneda(resumen?.costosVariablesMensuales || 0)}/mes</span>
              <span className="fc-cat-chevron">{seccionExpandida === 'variables' ? '▲' : '▼'}</span>
            </div>
            {seccionExpandida === 'variables' && (
              <div className="fc-cat-lista">
                {variableCats.map((c) => (
                  <div key={c.id} className={`fc-cat-item ${!c.activo ? 'desactivado' : ''}`}>
                    <button className="fc-cat-toggle" onClick={() => handleToggleCategoria(c.id, c.activo)}>
                      {c.activo ? '✅' : '⬜'}
                    </button>
                    <span className="fc-cat-nombre">{c.nombre}</span>
                    <span className="fc-cat-confianza">{c.confianza}%</span>
                    <span className="fc-cat-monto negativo">-{formatearMoneda(c.montoPromedio)}</span>
                  </div>
                ))}
                {variableCats.length === 0 && <p className="fc-cat-vacio">No se detectaron costos variables</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== GRÁFICO DE BARRAS APILADAS ===== */}
      {meses && meses.length > 0 && (
        <div className="fc-grafico-seccion">
          <h3 className="fc-seccion-titulo">📅 Proyección mes a mes</h3>
          <div className="fc-grafico">
            {meses.map((mes) => {
              const ingresoPct = ((mes.ingresos?.total || 0) / maxBarValue) * 100;
              const egresoPct = ((mes.totalEgresos || 0) / maxBarValue) * 100;

              return (
                <div key={mes.mes} className="fc-grafico-col">
                  <div className="fc-grafico-barras">
                    <div className="fc-barra-wrapper ingreso">
                      <div className="fc-barra ingreso" style={{ height: `${ingresoPct}%` }}></div>
                    </div>
                    <div className="fc-barra-wrapper egreso">
                      <div className="fc-barra egreso" style={{ height: `${egresoPct}%` }}></div>
                    </div>
                  </div>
                  <span className="fc-grafico-mes-label">{mes.mesLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="fc-leyenda">
            <div className="fc-leyenda-item">
              <span className="fc-leyenda-color ingreso"></span>
              <span>Ingresos</span>
            </div>
            <div className="fc-leyenda-item">
              <span className="fc-leyenda-color egreso"></span>
              <span>Egresos</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== TABLA HORIZONTAL DE FLUJO ===== */}
      {meses && meses.length > 0 && (
        <div className="fc-tabla-seccion">
          <h3 className="fc-seccion-titulo">📋 Tabla de flujo de caja</h3>
          <div className="fc-tabla-wrapper" ref={tablaRef}>
            <table className="fc-tabla">
              <thead>
                <tr>
                  <th className="fc-th-fija">Concepto</th>
                  {meses.map((m) => (
                    <th key={m.mes} className="fc-th-mes">{m.mesLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Saldo Inicial */}
                <tr className="fc-fila-resaltada saldo">
                  <td className="fc-td-fija">💰 Saldo inicial</td>
                  {meses.map((m) => (
                    <td key={m.mes} className={`fc-td-monto ${(m.saldoInicial || 0) < 0 ? 'negativo' : ''}`}>
                      {formatearMoneda(m.saldoInicial || 0)}
                    </td>
                  ))}
                </tr>

                {/* Separador: INGRESOS */}
                <tr className="fc-fila-seccion">
                  <td className="fc-td-fija fc-td-seccion">📈 INGRESOS</td>
                  {meses.map((m) => <td key={m.mes}></td>)}
                </tr>

                {/* Detalle ingresos */}
                {(meses[0]?.ingresos?.detalle || []).map((item) => (
                  <tr key={`ing-${item.id}`} className="fc-fila-detalle">
                    <td className="fc-td-fija fc-td-item">{item.nombre}</td>
                    {meses.map((m) => {
                      const d = (m.ingresos?.detalle || []).find((x) => x.id === item.id);
                      return (
                        <td key={m.mes} className="fc-td-monto positivo">
                          {d ? formatearMoneda(d.monto) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Total ingresos */}
                <tr className="fc-fila-subtotal ingreso">
                  <td className="fc-td-fija fc-td-subtotal">Total ingresos</td>
                  {meses.map((m) => (
                    <td key={m.mes} className="fc-td-monto fc-td-subtotal positivo">
                      {formatearMoneda(m.ingresos?.total || 0)}
                    </td>
                  ))}
                </tr>

                {/* Separador: COSTOS FIJOS */}
                <tr className="fc-fila-seccion">
                  <td className="fc-td-fija fc-td-seccion">📌 COSTOS FIJOS</td>
                  {meses.map((m) => <td key={m.mes}></td>)}
                </tr>

                {/* Detalle costos fijos */}
                {(meses[0]?.costosFijos?.detalle || []).map((item) => (
                  <tr key={`fij-${item.id}`} className="fc-fila-detalle">
                    <td className="fc-td-fija fc-td-item">{item.nombre}</td>
                    {meses.map((m) => {
                      const d = (m.costosFijos?.detalle || []).find((x) => x.id === item.id);
                      return (
                        <td key={m.mes} className="fc-td-monto negativo">
                          {d ? `-${formatearMoneda(d.monto)}` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Total costos fijos */}
                <tr className="fc-fila-subtotal fijo">
                  <td className="fc-td-fija fc-td-subtotal">Total costos fijos</td>
                  {meses.map((m) => (
                    <td key={m.mes} className="fc-td-monto fc-td-subtotal negativo">
                      -{formatearMoneda(m.costosFijos?.total || 0)}
                    </td>
                  ))}
                </tr>

                {/* Separador: CUOTAS CRÉDITOS */}
                {(meses[0]?.creditosCuotas?.detalle || []).length > 0 && (
                  <>
                    <tr className="fc-fila-seccion">
                      <td className="fc-td-fija fc-td-seccion">💳 CUOTAS CRÉDITOS</td>
                      {meses.map((m) => <td key={m.mes}></td>)}
                    </tr>

                    {meses[0].creditosCuotas.detalle.map((item) => (
                      <tr key={`cred-${item.id}`} className="fc-fila-detalle">
                        <td className="fc-td-fija fc-td-item">{item.nombre}</td>
                        {meses.map((m) => {
                          const d = (m.creditosCuotas?.detalle || []).find((x) => x.id === item.id);
                          return (
                            <td key={m.mes} className={`fc-td-monto ${d ? 'negativo' : 'terminado'}`}>
                              {d ? `-${formatearMoneda(d.monto)}` : '✓'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr className="fc-fila-subtotal credito">
                      <td className="fc-td-fija fc-td-subtotal">Total créditos</td>
                      {meses.map((m) => (
                        <td key={m.mes} className="fc-td-monto fc-td-subtotal negativo">
                          {(m.creditosCuotas?.total || 0) > 0 ? `-${formatearMoneda(m.creditosCuotas.total)}` : '$0'}
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* Separador: COSTOS VARIABLES */}
                <tr className="fc-fila-seccion">
                  <td className="fc-td-fija fc-td-seccion">📊 COSTOS VARIABLES</td>
                  {meses.map((m) => <td key={m.mes}></td>)}
                </tr>

                {/* Detalle costos variables */}
                {(meses[0]?.costosVariables?.detalle || []).map((item) => (
                  <tr key={`var-${item.id}`} className="fc-fila-detalle">
                    <td className="fc-td-fija fc-td-item">{item.nombre}</td>
                    {meses.map((m) => {
                      const d = (m.costosVariables?.detalle || []).find((x) => x.id === item.id);
                      return (
                        <td key={m.mes} className="fc-td-monto negativo">
                          {d ? `-${formatearMoneda(d.monto)}` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Total costos variables */}
                <tr className="fc-fila-subtotal variable">
                  <td className="fc-td-fija fc-td-subtotal">Total variables</td>
                  {meses.map((m) => (
                    <td key={m.mes} className="fc-td-monto fc-td-subtotal negativo">
                      -{formatearMoneda(m.costosVariables?.total || 0)}
                    </td>
                  ))}
                </tr>

                {/* TOTAL EGRESOS */}
                <tr className="fc-fila-total egresos">
                  <td className="fc-td-fija">📤 Total egresos</td>
                  {meses.map((m) => (
                    <td key={m.mes} className="fc-td-monto negativo">
                      -{formatearMoneda(m.totalEgresos || 0)}
                    </td>
                  ))}
                </tr>

                {/* FLUJO NETO */}
                <tr className="fc-fila-total neto">
                  <td className="fc-td-fija">🟰 Flujo neto</td>
                  {meses.map((m) => (
                    <td key={m.mes} className={`fc-td-monto ${(m.flujoNeto || 0) >= 0 ? 'positivo' : 'negativo'}`}>
                      {(m.flujoNeto || 0) >= 0 ? '+' : ''}{formatearMoneda(m.flujoNeto || 0)}
                    </td>
                  ))}
                </tr>

                {/* SALDO FINAL */}
                <tr className="fc-fila-resaltada saldo-final">
                  <td className="fc-td-fija">💰 Saldo final</td>
                  {meses.map((m) => (
                    <td key={m.mes} className={`fc-td-monto saldo-final ${(m.saldoFinal || 0) < 0 ? 'negativo alerta' : 'positivo'}`}>
                      {formatearMoneda(m.saldoFinal || 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlujoCaja;
