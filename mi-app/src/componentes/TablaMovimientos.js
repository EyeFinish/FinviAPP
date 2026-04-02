import { formatearMoneda, formatearFecha } from '../utilidades/formateadores';
import { ClipboardList } from 'lucide-react';

function TablaMovimientos({ movimientos, moneda = 'CLP' }) {
  if (!movimientos || movimientos.length === 0) {
    return (
      <div className="movimientos-vacio">
        <div className="movimientos-vacio-icono"><ClipboardList size={36} /></div>
        <p className="movimientos-vacio-texto">No hay movimientos disponibles</p>
      </div>
    );
  }

  const gruposMap = movimientos.reduce((acc, mov) => {
    const key = (mov.description || 'Sin descripción').trim();
    if (!acc[key]) {
      acc[key] = { description: key, count: 0, totalAmount: 0, lastDate: null, type: mov.type, hasPending: false };
    }
    acc[key].count += 1;
    acc[key].totalAmount += mov.amount;
    const movDate = mov.postDate || mov.transactionDate;
    if (!acc[key].lastDate || new Date(movDate) > new Date(acc[key].lastDate)) {
      acc[key].lastDate = movDate;
    }
    if (mov.pending) acc[key].hasPending = true;
    return acc;
  }, {});

  const grupos = Object.values(gruposMap).sort(
    (a, b) => new Date(b.lastDate) - new Date(a.lastDate)
  );

  return (
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
          {grupos.map((grupo) => (
            <tr key={grupo.description}>
              <td style={{ whiteSpace: 'nowrap', color: '#555a7e' }}>
                {formatearFecha(grupo.lastDate)}
              </td>
              <td>
                <div className="movimiento-descripcion" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {grupo.description}
                  {grupo.count > 1 && (
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: '#6c6fa3',
                      background: '#eeeef8', borderRadius: '10px', padding: '1px 7px'
                    }}>
                      ×{grupo.count}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className="movimiento-tipo-badge">{grupo.type || '-'}</span>
              </td>
              <td className={`movimiento-monto ${grupo.totalAmount >= 0 ? 'ingreso' : 'egreso'}`}>
                {grupo.totalAmount >= 0 ? '+' : ''}
                {formatearMoneda(grupo.totalAmount, moneda)}
                {grupo.hasPending && <span className="movimiento-pendiente">(pendiente)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TablaMovimientos;
