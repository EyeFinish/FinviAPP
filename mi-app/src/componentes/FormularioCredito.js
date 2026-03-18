import { useState, useMemo } from 'react';
import { crearCredito } from '../servicios/api';
import { formatearMoneda } from '../utilidades/formateadores';
import { X, BarChart3, Loader, Save } from 'lucide-react';
import '../estilos/formCredito.css';

const TIPOS_ROTATIVOS = ['tarjeta_credito', 'linea_credito'];

// Cuota mensual con fórmula de amortización francesa: C = P * [r(1+r)^n] / [(1+r)^n - 1]
function calcularCuotaMensual(monto, tasaAnual, cuotasTotales) {
  if (!monto || !cuotasTotales || cuotasTotales <= 0) return 0;
  if (!tasaAnual || tasaAnual <= 0) return monto / cuotasTotales;
  const r = tasaAnual / 100 / 12;
  const n = cuotasTotales;
  const cuota = monto * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(cuota);
}

// Calcula meses transcurridos desde fecha inicio hasta hoy
function calcularMesesTranscurridos(fechaInicio) {
  if (!fechaInicio) return 0;
  const inicio = new Date(fechaInicio);
  const hoy = new Date();
  const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  return Math.max(meses, 0);
}

// Saldo pendiente tras k cuotas pagadas
function calcularSaldoPendiente(monto, tasaAnual, cuotasTotales, cuotasPagadas) {
  if (!monto || !cuotasTotales) return 0;
  if (cuotasPagadas >= cuotasTotales) return 0;
  if (!tasaAnual || tasaAnual <= 0) {
    return Math.max(Math.round(monto - (monto / cuotasTotales) * cuotasPagadas), 0);
  }
  const r = tasaAnual / 100 / 12;
  const n = cuotasTotales;
  const k = cuotasPagadas;
  const saldo = monto * (Math.pow(1 + r, n) - Math.pow(1 + r, k)) / (Math.pow(1 + r, n) - 1);
  return Math.max(Math.round(saldo), 0);
}

function FormularioCredito({ onCreditoCreado, onCancelar, bancos = [] }) {
  const [datos, setDatos] = useState({
    nombre: '',
    institucion: '',
    tipoCredito: 'consumo',
    montoOriginal: '',
    tasaInteres: '',
    fechaInicio: '',
    cuotasTotales: '',
    estado: 'activo',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const esRotativo = TIPOS_ROTATIVOS.includes(datos.tipoCredito);

  // Valores calculados automáticamente (solo para créditos en cuotas)
  const calculados = useMemo(() => {
    if (esRotativo) return null;
    const monto = Number(datos.montoOriginal) || 0;
    const tasa = Number(datos.tasaInteres) || 0;
    const cuotasTotales = Number(datos.cuotasTotales) || 0;
    const cuotasPagadas = Math.min(calcularMesesTranscurridos(datos.fechaInicio), cuotasTotales);
    const cuotaMensual = calcularCuotaMensual(monto, tasa, cuotasTotales);
    const saldoPendiente = calcularSaldoPendiente(monto, tasa, cuotasTotales, cuotasPagadas);
    const totalAPagar = cuotaMensual * cuotasTotales;
    const costoInteres = totalAPagar - monto;
    return { cuotasTotales, cuotasPagadas, cuotaMensual, saldoPendiente, totalAPagar, costoInteres };
  }, [datos.montoOriginal, datos.tasaInteres, datos.fechaInicio, datos.cuotasTotales, esRotativo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDatos((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!esRotativo && (!calculados || calculados.cuotasTotales <= 0)) {
      setError('Debes ingresar un número de cuotas mayor a 0');
      setLoading(false);
      return;
    }

    try {
      let payload;
      if (esRotativo) {
        payload = {
          nombre: datos.nombre,
          institucion: datos.institucion,
          tipoCredito: datos.tipoCredito,
          estado: datos.estado,
          montoOriginal: Number(datos.montoOriginal),
          saldoPendiente: Number(datos.montoOriginal), // cupo = saldo inicial para rotativos
          tasaInteres: Number(datos.tasaInteres) || 0,
        };
      } else {
        payload = {
          ...datos,
          montoOriginal: Number(datos.montoOriginal),
          tasaInteres: Number(datos.tasaInteres) || 0,
          saldoPendiente: calculados.saldoPendiente,
          cuotaMensual: calculados.cuotaMensual,
          cuotasPagadas: calculados.cuotasPagadas,
          cuotasTotales: calculados.cuotasTotales,
        };
      }
      const nuevo = await crearCredito(payload);
      onCreditoCreado(nuevo);
    } catch (err) {
      console.error('Error creando crédito:', err);
      setError(err.response?.data?.message || 'Error al crear el crédito');
    } finally {
      setLoading(false);
    }
  };

  const hayDatosSuficientes = esRotativo
    ? Number(datos.montoOriginal) > 0
    : Number(datos.montoOriginal) > 0 && datos.fechaInicio && Number(datos.cuotasTotales) > 0;

  return (
    <div className="form-credito-overlay">
      <div className="form-credito">
        <div className="form-credito-header">
          <h2 className="form-credito-titulo">Agregar Crédito</h2>
          <button className="form-credito-cerrar" onClick={onCancelar}><X size={18} /></button>
        </div>

        {error && (
          <div className="mensaje-error">
            <p className="mensaje-error-texto">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-credito-grid">
            <div className="form-grupo">
              <label className="form-label">Nombre del crédito</label>
              <input
                type="text"
                name="nombre"
                value={datos.nombre}
                onChange={handleChange}
                className="form-input"
                placeholder={esRotativo ? 'Ej: Tarjeta Visa Banco Estado' : 'Ej: Crédito de consumo Banco Estado'}
                required
              />
            </div>

            <div className="form-grupo">
              <label className="form-label">Institución financiera</label>
              <select
                name="institucion"
                value={datos.institucion}
                onChange={handleChange}
                className="form-input"
                required
              >
                <option value="">Selecciona un banco</option>
                {bancos.map((banco) => (
                  <option key={banco._id} value={banco.institutionName}>
                    {banco.institutionName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grupo">
              <label className="form-label">Tipo de crédito</label>
              <select
                name="tipoCredito"
                value={datos.tipoCredito}
                onChange={handleChange}
                className="form-input"
              >
                <option value="consumo">Consumo</option>
                <option value="hipotecario">Hipotecario</option>
                <option value="automotriz">Automotriz</option>
                <option value="educacion">Educación</option>
                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                <option value="linea_credito">Línea de Crédito</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="form-grupo">
              <label className="form-label">Estado</label>
              <select
                name="estado"
                value={datos.estado}
                onChange={handleChange}
                className="form-input"
              >
                <option value="activo">Activo</option>
                <option value="moroso">Moroso</option>
                <option value="refinanciado">Refinanciado</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>

            <div className="form-grupo">
              <label className="form-label">{esRotativo ? 'Cupo total ($)' : 'Monto original ($)'}</label>
              <input
                type="number"
                name="montoOriginal"
                value={datos.montoOriginal}
                onChange={handleChange}
                className="form-input"
                placeholder={esRotativo ? '2000000' : '5000000'}
                min="0"
                required
              />
            </div>

            <div className="form-grupo">
              <label className="form-label">Tasa de interés anual (%)</label>
              <input
                type="number"
                name="tasaInteres"
                value={datos.tasaInteres}
                onChange={handleChange}
                className="form-input"
                placeholder={esRotativo ? 'Opcional' : '12.5'}
                min="0"
                step="0.1"
              />
            </div>

            {/* Campos solo para créditos en cuotas */}
            {!esRotativo && (
              <>
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
                  <label className="form-label">Número de cuotas</label>
                  <input
                    type="number"
                    name="cuotasTotales"
                    value={datos.cuotasTotales}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Ej: 36"
                    min="1"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {/* Vista previa de cálculos automáticos */}
          {hayDatosSuficientes && !esRotativo && calculados && (
            <div className="form-credito-preview">
              <h3 className="form-credito-preview-titulo"><BarChart3 size={16} /> Cálculo automático</h3>
              <div className="form-credito-preview-grid">
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Cuotas totales</span>
                  <span className="form-credito-preview-valor">{calculados.cuotasTotales} meses</span>
                </div>
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Cuotas pagadas</span>
                  <span className="form-credito-preview-valor verde">{calculados.cuotasPagadas} de {calculados.cuotasTotales}</span>
                </div>
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Cuota mensual</span>
                  <span className="form-credito-preview-valor">{formatearMoneda(calculados.cuotaMensual)}</span>
                </div>
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Saldo pendiente</span>
                  <span className="form-credito-preview-valor rojo">{formatearMoneda(calculados.saldoPendiente)}</span>
                </div>
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Total a pagar</span>
                  <span className="form-credito-preview-valor">{formatearMoneda(calculados.totalAPagar)}</span>
                </div>
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Costo interés</span>
                  <span className="form-credito-preview-valor amarillo">{formatearMoneda(calculados.costoInteres)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview para rotativos */}
          {hayDatosSuficientes && esRotativo && (
            <div className="form-credito-preview">
              <h3 className="form-credito-preview-titulo"><BarChart3 size={16} /> Resumen</h3>
              <div className="form-credito-preview-grid">
                <div className="form-credito-preview-item">
                  <span className="form-credito-preview-label">Cupo total</span>
                  <span className="form-credito-preview-valor">{formatearMoneda(Number(datos.montoOriginal))}</span>
                </div>
                {Number(datos.tasaInteres) > 0 && (
                  <div className="form-credito-preview-item">
                    <span className="form-credito-preview-label">Tasa anual</span>
                    <span className="form-credito-preview-valor amarillo">{datos.tasaInteres}%</span>
                  </div>
                )}
              </div>
              <p className="form-credito-nota">
                Los créditos rotativos no tienen cuotas fijas. La deuda y el disponible se actualizan automáticamente desde Fintoc.
              </p>
            </div>
          )}

          <div className="form-credito-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primario" disabled={loading}>
              {loading ? <><Loader size={14} className="icon-spin" /> Guardando...</> : <><Save size={14} /> Guardar crédito</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioCredito;
