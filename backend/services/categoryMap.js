// Mapa de cruce entre categorías de movimientos (categorizador) y categorías de obligaciones (gastos fijos / ingresos)

/**
 * Cada clave es el nombre exacto de la categoría del categorizador (categorizador.js).
 * El valor define a qué categoría(s) de obligación se mapea:
 *   - tipoObligacion: 'costoFijo' | 'ingreso' | null
 *   - categoriasObligacion: array de valores válidos del campo `categoria` en FixedCost / Income
 */
const CATEGORY_CROSS_MAP = {
  'Supermercado':           { tipoObligacion: 'costoFijo', categoriasObligacion: ['alimentacion'] },
  'Delivery y apps':        { tipoObligacion: 'costoFijo', categoriasObligacion: ['alimentacion'] },
  'Transporte':             { tipoObligacion: 'costoFijo', categoriasObligacion: ['transporte'] },
  'Restaurantes y ocio':    { tipoObligacion: null, categoriasObligacion: [] },
  'Suscripciones':          { tipoObligacion: 'costoFijo', categoriasObligacion: ['servicios'] },
  'Telecomunicaciones':     { tipoObligacion: 'costoFijo', categoriasObligacion: ['servicios'] },
  'Salud':                  { tipoObligacion: 'costoFijo', categoriasObligacion: ['salud'] },
  'Vivienda y servicios':   { tipoObligacion: 'costoFijo', categoriasObligacion: ['arriendo', 'servicios'] },
  'Educación':              { tipoObligacion: 'costoFijo', categoriasObligacion: ['educacion'] },
  'Seguros':                { tipoObligacion: 'costoFijo', categoriasObligacion: ['seguros'] },
  'Compras y retail':       { tipoObligacion: null, categoriasObligacion: [] },
  'Transferencia':          { tipoObligacion: null, categoriasObligacion: [] },
  'Sueldo':                 { tipoObligacion: 'ingreso', categoriasObligacion: ['sueldo'] },
  'Otros':                  { tipoObligacion: null, categoriasObligacion: [] },
};

/**
 * Dado el nombre de categoría de un movimiento (del categorizador),
 * retorna info del cruce con obligaciones.
 * @param {string} categoriaMovimiento
 * @returns {{ tipoObligacion: string|null, categoriasObligacion: string[] }}
 */
function obtenerCruceCategoria(categoriaMovimiento) {
  return CATEGORY_CROSS_MAP[categoriaMovimiento] || { tipoObligacion: null, categoriasObligacion: [] };
}

module.exports = { CATEGORY_CROSS_MAP, obtenerCruceCategoria };
