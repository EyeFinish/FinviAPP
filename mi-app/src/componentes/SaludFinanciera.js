import { formatearMoneda } from '../utilidades/formateadores';
import { Wallet, TrendingDown, Calendar } from 'lucide-react';

function SaludFinanciera({ salud, balanceTotal, totalDeuda, cuotaMensualTotal }) {
  // Arco SVG para el indicador
  const radio = 70;
  const circunferencia = 2 * Math.PI * radio;
  const porcentajeArco = (salud.puntaje / 100) * 0.75; // 270 grados max

  return (
    <div className="salud-financiera">
      <h2 className="salud-financiera-titulo">Salud Financiera</h2>

      <div className="salud-financiera-contenido">
        {/* Indicador circular */}
        <div className="salud-indicador">
          <svg viewBox="0 0 180 180" className="salud-indicador-svg">
            {/* Fondo del arco */}
            <circle
              cx="90" cy="90" r={radio}
              fill="none"
              stroke="#d8ddf5"
              strokeWidth="12"
              strokeDasharray={`${circunferencia * 0.75} ${circunferencia * 0.25}`}
              strokeLinecap="round"
              transform="rotate(135, 90, 90)"
            />
            {/* Arco de progreso */}
            <circle
              cx="90" cy="90" r={radio}
              fill="none"
              stroke={salud.color}
              strokeWidth="12"
              strokeDasharray={`${circunferencia * porcentajeArco} ${circunferencia}`}
              strokeLinecap="round"
              transform="rotate(135, 90, 90)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div className="salud-indicador-texto">
            <div className="salud-indicador-puntaje" style={{ color: salud.color }}>
              {salud.puntaje}
            </div>
            <div className="salud-indicador-nivel">{salud.nivel}</div>
          </div>
        </div>

        {/* Métricas */}
        <div className="salud-metricas">
          <div className="salud-metrica">
            <div className="salud-metrica-icono positivo"><Wallet size={20} /></div>
            <div>
              <div className="salud-metrica-label">Balance disponible</div>
              <div className="salud-metrica-valor positivo">
                {formatearMoneda(balanceTotal)}
              </div>
            </div>
          </div>

          <div className="salud-metrica">
            <div className="salud-metrica-icono negativo"><TrendingDown size={20} /></div>
            <div>
              <div className="salud-metrica-label">Deuda total</div>
              <div className="salud-metrica-valor negativo">
                {formatearMoneda(totalDeuda)}
              </div>
            </div>
          </div>

          <div className="salud-metrica">
            <div className="salud-metrica-icono neutro"><Calendar size={20} /></div>
            <div>
              <div className="salud-metrica-label">Compromiso mensual</div>
              <div className="salud-metrica-valor">
                {formatearMoneda(cuotaMensualTotal)}
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

export default SaludFinanciera;
