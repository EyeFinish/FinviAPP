import { formatearMoneda, traducirTipoCuenta, obtenerInfoBanco } from '../utilidades/formateadores';
import { Building2 } from 'lucide-react';

function TarjetaCuenta({ cuenta, onClick }) {
  const infoBanco = obtenerInfoBanco(cuenta.institution);

  return (
    <div className="cuenta-card" onClick={() => onClick && onClick(cuenta)}>
      {/* Header */}
      <div className="cuenta-card-header">
        <div className="cuenta-card-info">
          <div
            className="cuenta-card-icono"
            style={{ backgroundColor: infoBanco.colorClaro, color: infoBanco.color }}
          >
            <Building2 size={18} />
          </div>
          <div>
            <div className="cuenta-card-nombre">
              {cuenta.name || traducirTipoCuenta(cuenta.type)}
            </div>
            <div className="cuenta-card-tipo">
              {traducirTipoCuenta(cuenta.type)}
              {cuenta.number && ` · ****${cuenta.number.slice(-4)}`}
            </div>
          </div>
        </div>
        {cuenta.institution && (
          <span
            className="cuenta-card-institucion"
            style={{ backgroundColor: infoBanco.colorClaro, color: infoBanco.color }}
          >
            {infoBanco.nombre}
          </span>
        )}
      </div>

      {/* Saldo */}
      <div>
        <div className="cuenta-card-saldo-label">Saldo disponible</div>
        <div className="cuenta-card-saldo">
          {formatearMoneda(cuenta.balance?.available || cuenta.balance?.current || 0, cuenta.currency)}
        </div>
      </div>

      {/* Footer */}
      <div className="cuenta-card-footer">
        <span className="cuenta-card-movimientos-count">
          {cuenta.movements?.length || 0} movimientos
        </span>
        <span className="cuenta-card-ver-detalle">Ver detalle →</span>
      </div>
    </div>
  );
}

export default TarjetaCuenta;
