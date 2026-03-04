import { formatearMoneda, traducirTipoCredito, traducirEstadoCredito } from '../utilidades/formateadores';

function TarjetaCredito({ credito, onEliminar }) {
  const progreso = Math.round((credito.cuotasPagadas / credito.cuotasTotales) * 100);

  const colorEstado = {
    activo: '#3b82f6',
    pagado: '#10b981',
    moroso: '#ef4444',
    refinanciado: '#f59e0b',
  };

  return (
    <div className="credito-card">
      {/* Header */}
      <div className="credito-card-header">
        <div className="credito-card-info">
          <div className="credito-card-icono">💳</div>
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
              onClick={(e) => { e.stopPropagation(); onEliminar(credito.id); }}
              title="Eliminar crédito"
            >
              ✕
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
          <span className="credito-card-resumen-icono">✅</span>
          <div className="credito-card-resumen-info">
            <span className="credito-card-resumen-label">Total pagado</span>
            <span className="credito-card-resumen-valor pagado">
              {formatearMoneda(credito.totalPagado || 0, credito.moneda)}
            </span>
          </div>
        </div>
        <div className="credito-card-resumen-item total">
          <span className="credito-card-resumen-icono">📋</span>
          <div className="credito-card-resumen-info">
            <span className="credito-card-resumen-label">Total a pagar</span>
            <span className="credito-card-resumen-valor total">
              {formatearMoneda(credito.totalAPagar || 0, credito.moneda)}
            </span>
          </div>
        </div>
        {credito.costoInteres > 0 && (
          <div className="credito-card-resumen-item interes">
            <span className="credito-card-resumen-icono">📈</span>
            <div className="credito-card-resumen-info">
              <span className="credito-card-resumen-label">Costo interés</span>
              <span className="credito-card-resumen-valor interes">
                {formatearMoneda(credito.costoInteres, credito.moneda)}
              </span>
            </div>
          </div>
        )}
        <div className="credito-card-resumen-item restante">
          <span className="credito-card-resumen-icono">⏳</span>
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
            📊 Tasa: {credito.tasaInteres}%
          </span>
        )}
        <span className="credito-card-detalle">
          💰 Original: {formatearMoneda(credito.montoOriginal, credito.moneda)}
        </span>
      </div>
    </div>
  );
}

export default TarjetaCredito;
