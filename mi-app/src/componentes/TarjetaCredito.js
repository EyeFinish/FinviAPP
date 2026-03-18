import { useState, useEffect } from 'react';
import { formatearMoneda, traducirTipoCredito, traducirEstadoCredito, formatearFecha } from '../utilidades/formateadores';
import { obtenerTransaccionesCredito } from '../servicios/api';
import { CreditCard, X, CheckCircle, ClipboardList, TrendingUp, Clock, BarChart3, Wallet, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const TIPOS_ROTATIVOS = ['tarjeta_credito', 'linea_credito'];

function TarjetaCredito({ credito, onEliminar }) {
  const esRotativo = TIPOS_ROTATIVOS.includes(credito.tipoCredito);
  const esLineaCredito = credito.tipoCredito === 'linea_credito';
  const [transacciones, setTransacciones] = useState([]);
  const [resumenTxs, setResumenTxs] = useState(null);
  const [mostrarTxs, setMostrarTxs] = useState(false);
  const [cargandoTxs, setCargandoTxs] = useState(false);

  const colorEstado = {
    activo: '#5170ff',
    pagado: '#10b981',
    moroso: '#ef4444',
    refinanciado: '#f59e0b',
  };

  // Cargar transacciones para rotativos
  useEffect(() => {
    if (esRotativo && mostrarTxs && transacciones.length === 0) {
      if (!esLineaCredito && !credito.fintocAccountId) return;
      setCargandoTxs(true);
      obtenerTransaccionesCredito(credito.id || credito._id)
        .then((res) => {
          if (res && res.movimientos) {
            setTransacciones(res.movimientos);
            setResumenTxs(res.resumen);
          } else {
            setTransacciones(Array.isArray(res) ? res : res.data || []);
          }
        })
        .catch(() => setTransacciones([]))
        .finally(() => setCargandoTxs(false));
    }
  }, [mostrarTxs, esRotativo, esLineaCredito, credito.fintocAccountId, credito.id, credito._id, transacciones.length]);

  // Vista para créditos rotativos
  if (esRotativo) {
    const cupo = credito.cupo || credito.montoOriginal || 0;
    const deuda = esLineaCredito && credito.saldoCalculado != null
      ? credito.saldoCalculado
      : (credito.deuda || credito.saldoPendiente || 0);
    const disponible = cupo > 0 ? Math.max(cupo - deuda, 0) : 0;
    const utilizacion = credito.utilizacion ?? (cupo > 0 ? Math.round((deuda / cupo) * 100) : 0);

    const colorUtilizacion = utilizacion > 80 ? '#ef4444' : utilizacion > 50 ? '#f59e0b' : '#10b981';

    return (
      <div className="credito-card">
        <div className="credito-card-header">
          <div className="credito-card-info">
            <div className="credito-card-icono"><CreditCard size={20} /></div>
            <div>
              <div className="credito-card-nombre">{credito.nombre}</div>
              <div className="credito-card-institucion">{credito.institucion}</div>
            </div>
          </div>
          <div className="credito-card-acciones-header">
            <span
              className="credito-card-estado"
              style={{ backgroundColor: colorEstado[credito.estado] + '20', color: colorEstado[credito.estado] }}
            >
              {traducirEstadoCredito(credito.estado)}
            </span>
            {onEliminar && (
              <button
                className="credito-card-btn-eliminar"
                onClick={(e) => { e.stopPropagation(); onEliminar(credito.id || credito._id); }}
                title="Eliminar crédito"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="credito-card-tipo-badge rotativo">
          {traducirTipoCredito(credito.tipoCredito)}
        </div>

        {/* Cupo / Usado / Disponible */}
        <div className="credito-card-montos rotativo-montos">
          <div className="credito-card-monto-item">
            <span className="credito-card-monto-label">Cupo total</span>
            <span className="credito-card-monto-valor">{formatearMoneda(cupo, credito.moneda)}</span>
          </div>
          <div className="credito-card-monto-item">
            <span className="credito-card-monto-label">Usado</span>
            <span className="credito-card-monto-valor deuda">{formatearMoneda(deuda, credito.moneda)}</span>
          </div>
          <div className="credito-card-monto-item">
            <span className="credito-card-monto-label">Disponible</span>
            <span className="credito-card-monto-valor disponible">{formatearMoneda(disponible, credito.moneda)}</span>
          </div>
        </div>

        {/* Resumen uso/pago para líneas de crédito */}
        {esLineaCredito && (credito.totalUsado != null || resumenTxs) && (
          <div className="credito-card-linea-resumen">
            <div className="credito-card-linea-item uso">
              <ArrowUpRight size={14} />
              <span>Total usado:</span>
              <strong>{formatearMoneda(credito.totalUsado ?? resumenTxs?.totalUsado ?? 0, credito.moneda)}</strong>
            </div>
            <div className="credito-card-linea-item pago">
              <ArrowDownLeft size={14} />
              <span>Total pagado:</span>
              <strong>{formatearMoneda(credito.totalPagado ?? resumenTxs?.totalPagado ?? 0, credito.moneda)}</strong>
            </div>
          </div>
        )}

        {/* Barra de utilización */}
        <div className="credito-card-progreso">
          <div className="credito-card-progreso-header">
            <span className="credito-card-progreso-label">Utilización del cupo</span>
            <span className="credito-card-progreso-porcentaje" style={{ color: colorUtilizacion }}>{utilizacion}%</span>
          </div>
          <div className="credito-card-progreso-barra">
            <div
              className="credito-card-progreso-relleno"
              style={{ width: `${Math.min(utilizacion, 100)}%`, backgroundColor: colorUtilizacion }}
            ></div>
          </div>
        </div>

        {/* Detalles */}
        <div className="credito-card-detalles">
          {credito.tasaInteres > 0 && (
            <span className="credito-card-detalle">
              <BarChart3 size={14} /> Tasa: {credito.tasaInteres}%
            </span>
          )}
        </div>

        {/* Transacciones — líneas de crédito siempre pueden ver, tarjetas solo con fintocAccountId */}
        {(esLineaCredito || credito.fintocAccountId) && (
          <div className="credito-card-transacciones">
            <button
              className="credito-card-txs-toggle"
              onClick={() => setMostrarTxs(!mostrarTxs)}
            >
              {mostrarTxs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {mostrarTxs ? 'Ocultar transacciones' : 'Ver transacciones'}
            </button>
            {mostrarTxs && (
              <div className="credito-card-txs-lista">
                {cargandoTxs ? (
                  <p className="credito-card-txs-cargando">Cargando...</p>
                ) : transacciones.length === 0 ? (
                  <p className="credito-card-txs-vacio">Sin transacciones de línea de crédito detectadas</p>
                ) : (
                  transacciones.slice(0, 10).map((tx) => (
                    <div key={tx._id} className="credito-card-tx-item">
                      <div className="credito-card-tx-info">
                        <span className="credito-card-tx-desc">{tx.description || 'Sin descripción'}</span>
                        <span className="credito-card-tx-fecha">{formatearFecha(tx.postDate)}</span>
                      </div>
                      <span className={`credito-card-tx-monto ${tx.amount < 0 ? 'negativo' : 'positivo'}`}>
                        {tx.amount > 0 ? '+' : ''}{formatearMoneda(Math.abs(tx.amount), credito.moneda)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Vista para créditos en cuotas (original)
  const progreso = credito.cuotasTotales > 0
    ? Math.round((credito.cuotasPagadas / credito.cuotasTotales) * 100) : 0;

  return (
    <div className="credito-card">
      {/* Header */}
      <div className="credito-card-header">
        <div className="credito-card-info">
          <div className="credito-card-icono"><CreditCard size={20} /></div>
          <div>
            <div className="credito-card-nombre">{credito.nombre}</div>
            <div className="credito-card-institucion">{credito.institucion}</div>
          </div>
        </div>
        <div className="credito-card-acciones-header">
          <span
            className="credito-card-estado"
            style={{ backgroundColor: colorEstado[credito.estado] + '20', color: colorEstado[credito.estado] }}
          >
            {traducirEstadoCredito(credito.estado)}
          </span>
          {onEliminar && (
            <button
              className="credito-card-btn-eliminar"
              onClick={(e) => { e.stopPropagation(); onEliminar(credito.id || credito._id); }}
              title="Eliminar crédito"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tipo */}
      <div className="credito-card-tipo-badge">
        {traducirTipoCredito(credito.tipoCredito)}
      </div>

      {/* Montos principales */}
      <div className="credito-card-montos">
        <div className="credito-card-monto-item">
          <span className="credito-card-monto-label">Saldo pendiente</span>
          <span className="credito-card-monto-valor deuda">
            {formatearMoneda(credito.saldoPendiente, credito.moneda)}
          </span>
        </div>
        <div className="credito-card-monto-item">
          <span className="credito-card-monto-label">Cuota mensual</span>
          <span className="credito-card-monto-valor">
            {formatearMoneda(credito.cuotaMensual, credito.moneda)}
          </span>
        </div>
      </div>

      {/* Resumen de pagos e intereses */}
      <div className="credito-card-resumen-pagos">
        <div className="credito-card-resumen-item pagado">
          <span className="credito-card-resumen-icono"><CheckCircle size={16} /></span>
          <div className="credito-card-resumen-info">
            <span className="credito-card-resumen-label">Total pagado</span>
            <span className="credito-card-resumen-valor pagado">
              {formatearMoneda(credito.totalPagado || 0, credito.moneda)}
            </span>
          </div>
        </div>
        <div className="credito-card-resumen-item total">
          <span className="credito-card-resumen-icono"><ClipboardList size={16} /></span>
          <div className="credito-card-resumen-info">
            <span className="credito-card-resumen-label">Total a pagar</span>
            <span className="credito-card-resumen-valor total">
              {formatearMoneda(credito.totalAPagar || 0, credito.moneda)}
            </span>
          </div>
        </div>
        {credito.costoInteres > 0 && (
          <div className="credito-card-resumen-item interes">
            <span className="credito-card-resumen-icono"><TrendingUp size={16} /></span>
            <div className="credito-card-resumen-info">
              <span className="credito-card-resumen-label">Costo interés</span>
              <span className="credito-card-resumen-valor interes">
                {formatearMoneda(credito.costoInteres, credito.moneda)}
              </span>
            </div>
          </div>
        )}
        <div className="credito-card-resumen-item restante">
          <span className="credito-card-resumen-icono"><Clock size={16} /></span>
          <div className="credito-card-resumen-info">
            <span className="credito-card-resumen-label">Restante por pagar</span>
            <span className="credito-card-resumen-valor restante">
              {formatearMoneda(credito.restantePorPagar || 0, credito.moneda)}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="credito-card-progreso">
        <div className="credito-card-progreso-header">
          <span className="credito-card-progreso-label">
            Progreso: {credito.cuotasPagadas}/{credito.cuotasTotales} cuotas
          </span>
          <span className="credito-card-progreso-porcentaje">{progreso}%</span>
        </div>
        <div className="credito-card-progreso-barra">
          <div
            className="credito-card-progreso-relleno"
            style={{ width: `${progreso}%` }}
          ></div>
        </div>
      </div>

      {/* Detalles */}
      <div className="credito-card-detalles">
        {credito.tasaInteres > 0 && (
          <span className="credito-card-detalle">
            <BarChart3 size={14} /> Tasa: {credito.tasaInteres}%
          </span>
        )}
        <span className="credito-card-detalle">
          <Wallet size={14} /> Original: {formatearMoneda(credito.montoOriginal, credito.moneda)}
        </span>
      </div>
    </div>
  );
}

export default TarjetaCredito;
