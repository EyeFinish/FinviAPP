import { useState, useMemo } from 'react';
import { actualizarCredito } from '../servicios/api';
import { formatearMoneda } from '../utilidades/formateadores';
import '../estilos/completarCredito.css';

const traducirTipo = {
  tarjeta_credito: 'Tarjeta de Crédito',
  linea_credito: 'Línea de Crédito',
};

function CompletarCredito({ credito, onCompletado, onCancelar }) {
  const [datos, setDatos] = useState({
    tasaInteres: '',
    cuotasTotales: '12',
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaVencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculados = useMemo(() => {
    const monto = credito.saldoPendiente || 0;
    const tasa = Number(datos.tasaInteres) || 0;
    const cuotas = Number(datos.cuotasTotales) || 12;

    if (monto <= 0 || cuotas <= 0) return { cuotaMensual: 0, totalAPagar: 0, costoInteres: 0 };

    let cuotaMensual;
    if (tasa <= 0) {
      cuotaMensual = monto / cuotas;
    } else {
      const r = tasa / 100 / 12;
      cuotaMensual = monto * (r * Math.pow(1 + r, cuotas)) / (Math.pow(1 + r, cuotas) - 1);
    }

    const totalAPagar = cuotaMensual * cuotas;
    const costoInteres = totalAPagar - monto;

    return {
      cuotaMensual: Math.round(cuotaMensual),
      totalAPagar: Math.round(totalAPagar),
      costoInteres: Math.round(costoInteres),
    };
  }, [credito.saldoPendiente, datos.tasaInteres, datos.cuotasTotales]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDatos((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await actualizarCredito(credito._id, {
        tasaInteres: Number(datos.tasaInteres) || 0,
        cuotaMensual: calculados.cuotaMensual,
        cuotasTotales: Number(datos.cuotasTotales),
        cuotasPagadas: 0,
        fechaInicio: datos.fechaInicio,
        fechaVencimiento: datos.fechaVencimiento,
        requiereCompletar: false,
      });
      onCompletado();
    } catch (err) {
      console.error('Error completando crédito:', err);
      setError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleOmitir = async () => {
    setLoading(true);
    try {
      await actualizarCredito(credito._id, { requiereCompletar: false });
      onCompletado();
    } catch (err) {
      console.error('Error omitiendo crédito:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="completar-overlay">
      <div className="completar-modal">
        <div className="completar-header">
          <h2 className="completar-titulo">Completar datos del crédito</h2>
          <button className="completar-cerrar" onClick={onCancelar}>✕</button>
        </div>

        {/* Datos importados (solo lectura) */}
        <div className="completar-importado">
          <div className="completar-importado-tag">
            🔗 Importado desde Fintoc
          </div>
          <div className="completar-importado-grid">
            <div className="completar-importado-item">
              <span className="completar-importado-label">Nombre</span>
              <span className="completar-importado-valor">{credito.nombre}</span>
            </div>
            <div className="completar-importado-item">
              <span className="completar-importado-label">Institución</span>
              <span className="completar-importado-valor">{credito.institucion}</span>
            </div>
            <div className="completar-importado-item">
              <span className="completar-importado-label">Tipo</span>
              <span className="completar-importado-valor">{traducirTipo[credito.tipoCredito] || credito.tipoCredito}</span>
            </div>
            <div className="completar-importado-item">
              <span className="completar-importado-label">Cupo total</span>
              <span className="completar-importado-valor">{formatearMoneda(credito.montoOriginal)}</span>
            </div>
            <div className="completar-importado-item">
              <span className="completar-importado-label">Deuda actual</span>
              <span className="completar-importado-valor deuda">{formatearMoneda(credito.saldoPendiente)}</span>
            </div>
            <div className="completar-importado-item">
              <span className="completar-importado-label">Disponible</span>
              <span className="completar-importado-valor disponible">
                {formatearMoneda(credito.montoOriginal - credito.saldoPendiente)}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mensaje-error">
            <p className="mensaje-error-texto">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <p className="completar-instruccion">
            Completa los datos que Fintoc no provee para incluir este crédito en tu flujo de caja y proyecciones:
          </p>

          <div className="completar-form-grid">
            <div className="form-grupo">
              <label className="form-label">Tasa de interés anual (%)</label>
              <input
                type="number"
                name="tasaInteres"
                value={datos.tasaInteres}
                onChange={handleChange}
                className="form-input"
                placeholder="Ej: 24.5"
                min="0"
                step="0.1"
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Cuotas para pagar</label>
              <input
                type="number"
                name="cuotasTotales"
                value={datos.cuotasTotales}
                onChange={handleChange}
                className="form-input"
                placeholder="12"
                min="1"
                required
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Fecha de inicio</label>
              <input
                type="date"
                name="fechaInicio"
                value={datos.fechaInicio}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Fecha de vencimiento</label>
              <input
                type="date"
                name="fechaVencimiento"
                value={datos.fechaVencimiento}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Preview de cálculos */}
          {credito.saldoPendiente > 0 && (
            <div className="completar-preview">
              <h4 className="completar-preview-titulo">📊 Cálculo estimado</h4>
              <div className="completar-preview-grid">
                <div className="completar-preview-item">
                  <span className="completar-preview-label">Cuota mensual</span>
                  <span className="completar-preview-valor">{formatearMoneda(calculados.cuotaMensual)}</span>
                </div>
                <div className="completar-preview-item">
                  <span className="completar-preview-label">Total a pagar</span>
                  <span className="completar-preview-valor">{formatearMoneda(calculados.totalAPagar)}</span>
                </div>
                <div className="completar-preview-item">
                  <span className="completar-preview-label">Costo interés</span>
                  <span className="completar-preview-valor interes">{formatearMoneda(calculados.costoInteres)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="completar-acciones">
            <button type="button" className="btn btn-texto" onClick={handleOmitir} disabled={loading}>
              Omitir por ahora
            </button>
            <div className="completar-acciones-derecha">
              <button type="button" className="btn btn-secundario" onClick={onCancelar}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={loading}>
                {loading ? '⏳ Guardando...' : '✅ Completar crédito'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CompletarCredito;
