import { formatearMoneda, formatearFecha } from '../utilidades/formateadores';

function TablaMovimientos({ movimientos, moneda = 'CLP' }) {
  if (!movimientos || movimientos.length === 0) {
    return (
      <div className="movimientos-vacio">
        <div className="movimientos-vacio-icono">📋</div>
        <p className="movimientos-vacio-texto">No hay movimientos disponibles</p>
      </div>
    );
  }

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
          {movimientos.map((mov, index) => (
            <tr key={mov.id || index}>
              <td style={{ whiteSpace: 'nowrap', color: '#6b7280' }}>
                {formatearFecha(mov.postDate || mov.transactionDate)}
              </td>
              <td>
                <div className="movimiento-descripcion">
                  {mov.description || 'Sin descripción'}
                </div>
                {mov.comment && (
                  <div className="movimiento-comentario">{mov.comment}</div>
                )}
              </td>
              <td>
                <span className="movimiento-tipo-badge">{mov.type || '-'}</span>
              </td>
              <td className={`movimiento-monto ${mov.amount >= 0 ? 'ingreso' : 'egreso'}`}>
                {mov.amount >= 0 ? '+' : ''}
                {formatearMoneda(mov.amount, moneda)}
                {mov.pending && <span className="movimiento-pendiente">(pendiente)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TablaMovimientos;
