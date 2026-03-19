// Clasificador inteligente de movimientos bancarios (Chile)

const CATEGORIAS = [
  {
    nombre: 'Supermercado',
    icono: 'cart',
    color: '#22c55e',
    patrones: [
      /jumbo/i, /lider/i, /unimarc/i, /tottus/i, /santa\s*isabel/i,
      /acuenta/i, /ok\s*market/i, /bigger/i, /mayorista/i,
      /supermercado/i, /supermarket/i, /almacen/i, /minimarket/i,
    ],
  },
  {
    nombre: 'Delivery y apps',
    icono: 'bicycle',
    color: '#f97316',
    patrones: [
      /rappi/i, /cornershop/i, /pedidos\s*ya/i, /uber\s*eats/i,
      /didi\s*food/i, /just\s*eat/i, /ifood/i,
    ],
  },
  {
    nombre: 'Transporte',
    icono: 'car',
    color: '#3b82f6',
    patrones: [
      /uber(?!\s*eat)/i, /didi(?!\s*food)/i, /cabify/i, /beat/i, /indriver/i,
      /metro/i, /bip/i, /copec/i, /shell/i, /petrobras/i,
      /estacionamiento/i, /parking/i, /autopista/i, /tag/i, /peaje/i,
    ],
  },
  {
    nombre: 'Restaurantes y ocio',
    icono: 'restaurant',
    color: '#ec4899',
    patrones: [
      /restaurant/i, /starbucks/i, /mcdonald/i, /burger\s*king/i, /kfc/i,
      /domino/i, /papa\s*john/i, /subway/i, /dunkin/i, /caf[eé]/i,
      /bar\b/i, /pub\b/i, /cine/i, /cinemark/i, /cin[eé]polis/i,
      /teatro/i, /bowling/i, /karaoke/i, /pizza/i,
    ],
  },
  {
    nombre: 'Suscripciones',
    icono: 'refresh-circle',
    color: '#8b5cf6',
    patrones: [
      /netflix/i, /spotify/i, /disney/i, /hbo/i, /amazon\s*prime/i,
      /youtube\s*(premium|music)/i, /apple\s*(music|tv|one|icloud)/i,
      /google\s*(one|storage)/i, /crunchyroll/i, /paramount/i,
      /deezer/i, /tidal/i, /twitch/i, /chatgpt/i, /openai/i,
      /microsoft\s*365/i, /adobe/i, /canva/i, /dropbox/i,
    ],
  },
  {
    nombre: 'Telecomunicaciones',
    icono: 'wifi',
    color: '#06b6d4',
    patrones: [
      /entel/i, /movistar/i, /wom\b/i, /vtr/i, /claro\b/i, /telsur/i,
      /gtd/i, /mundo\s*pacifico/i, /virgin/i, /simple/i,
    ],
  },
  {
    nombre: 'Salud',
    icono: 'medkit',
    color: '#ef4444',
    patrones: [
      /farmacia/i, /cruz\s*verde/i, /salcobrand/i, /ahumada/i,
      /isapre/i, /fonasa/i, /colmena/i, /banm[eé]dica/i, /consalud/i,
      /vidatres/i, /nueva\s*masvida/i, /cl[ií]nica/i, /hospital/i,
      /consulta\s*m[eé]dica/i, /dentist/i, /lab(oratorio)?/i, /[oó]ptica/i,
    ],
  },
  {
    nombre: 'Vivienda y servicios',
    icono: 'home',
    color: '#a855f7',
    patrones: [
      /enel/i, /aguas\s*andinas/i, /metrogas/i, /essbio/i, /esval/i,
      /gas\s*natural/i, /lipigas/i, /abastible/i, /gasco/i,
      /arriendo/i, /condominio/i, /gastos\s*comunes/i, /rent/i,
      /dividendo/i, /hipotecario/i,
    ],
  },
  {
    nombre: 'Educación',
    icono: 'school',
    color: '#0ea5e9',
    patrones: [
      /universidad/i, /colegio/i, /instituto/i, /escuela/i,
      /duoc/i, /inacap/i, /aiep/i, /udemy/i, /coursera/i,
      /platzi/i, /matr[ií]cula/i, /arancel/i, /mensualidad/i,
    ],
  },
  {
    nombre: 'Seguros',
    icono: 'shield-checkmark',
    color: '#14b8a6',
    patrones: [
      /seguro/i, /mapfre/i, /sura/i, /bci\s*seguro/i, /liberty/i,
      /metlife/i, /zurich/i, /consorcio/i, /chilena\s*consolidada/i,
      /hdi/i, /p[oó]liza/i,
    ],
  },
  {
    nombre: 'Compras y retail',
    icono: 'bag-handle',
    color: '#f59e0b',
    patrones: [
      /falabella/i, /ripley/i, /paris/i, /la\s*polar/i, /abcdin/i,
      /hites/i, /amazon/i, /mercado\s*libre/i, /ali\s*express/i,
      /shopify/i, /shein/i, /zara/i, /h&m/i, /nike/i, /adidas/i,
      /sodimac/i, /easy/i, /homecenter/i, /ikea/i, /retail/i,
    ],
  },
  {
    nombre: 'Transferencia',
    icono: 'swap-horizontal',
    color: '#64748b',
    patrones: [
      /transferencia/i, /transf\b/i, /traspaso/i, /tef\b/i,
    ],
  },
  {
    nombre: 'Sueldo',
    icono: 'cash',
    color: '#10b981',
    patrones: [
      /sueldo/i, /remuneraci[oó]n/i, /n[oó]mina/i, /salario/i,
      /honorario/i, /pago\s*(de\s*)?empresa/i, /liquidaci[oó]n/i,
    ],
  },
];

const FALLBACK = { categoria: 'Otros', icono: 'ellipsis-horizontal', color: '#9ca3af' };

// Mapa rápido de nombre de categoría → { icono, color }
const CATEGORIA_INFO = new Map();
CATEGORIAS.forEach(c => CATEGORIA_INFO.set(c.nombre, { icono: c.icono, color: c.color }));

/**
 * Clasifica un movimiento basándose en su descripción.
 * @param {string} description - Descripción del movimiento bancario.
 * @param {Map} [customMap] - Mapa de descKey→nombreCategoria personalizado por el usuario.
 * @returns {{ categoria: string, icono: string, color: string }}
 */
function clasificarMovimiento(description, customMap) {
  if (!description) return FALLBACK;
  const desc = description.toLowerCase().trim();

  // 1. Verificar mappings personalizados del usuario
  if (customMap && customMap.has(desc)) {
    const catNombre = customMap.get(desc);
    const info = CATEGORIA_INFO.get(catNombre);
    if (info) return { categoria: catNombre, icono: info.icono, color: info.color };
  }

  // 2. Patrones regex predefinidos

  // 2. Patrones regex predefinidos
  for (const cat of CATEGORIAS) {
    for (const patron of cat.patrones) {
      if (patron.test(desc)) {
        return { categoria: cat.nombre, icono: cat.icono, color: cat.color };
      }
    }
  }

  return FALLBACK;
}

/**
 * Devuelve todas las categorías disponibles (para referencia en el frontend).
 */
function obtenerCategorias() {
  return CATEGORIAS.map(c => ({ nombre: c.nombre, icono: c.icono, color: c.color }));
}

module.exports = { clasificarMovimiento, obtenerCategorias, CATEGORIAS, CATEGORIA_INFO };
