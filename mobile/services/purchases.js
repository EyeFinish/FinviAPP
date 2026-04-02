import { Platform } from 'react-native';

// react-native-purchases es un módulo nativo — no disponible en Expo Go.
// Se importa dinámicamente para evitar crashes al correr sin EAS Build.
let Purchases = null;
let LOG_LEVEL = null;
try {
  const pkg = require('react-native-purchases');
  Purchases = pkg.default;
  LOG_LEVEL = pkg.LOG_LEVEL;
} catch {
  // Expo Go o web: el SDK no está disponible, las funciones retornan valores vacíos
}

// Reemplaza con las API keys públicas de tu proyecto en RevenueCat Dashboard
// App Store Connect API key → Project Settings → iOS app
// Google Play → Project Settings → Android app
const RC_KEY_IOS     = 'appl_REEMPLAZAR_CON_TU_KEY_IOS';
const RC_KEY_ANDROID = 'goog_REEMPLAZAR_CON_TU_KEY_ANDROID';

let _inicializado = false;

/**
 * Inicializa el SDK de RevenueCat con el ID del usuario de MongoDB.
 * Debe llamarse justo después de obtener el usuario autenticado.
 */
export async function inicializarPurchases(userId) {
  if (!Purchases) return; // no disponible en Expo Go
  try {
    const apiKey = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
    if (__DEV__ && LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    await Purchases.configure({ apiKey, appUserID: String(userId) });
    _inicializado = true;
  } catch (err) {
    console.warn('[Purchases] Error al inicializar:', err.message);
  }
}

/**
 * Devuelve la oferta actual configurada en RevenueCat (el "default" offering).
 * Contiene el paquete mensual con el precio real de la tienda.
 */
export async function obtenerOferta() {
  if (!_inicializado) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (err) {
    console.warn('[Purchases] Error al obtener oferta:', err.message);
    return null;
  }
}

/**
 * Inicia el flujo de compra nativo para un paquete dado.
 * Retorna true si el usuario ahora tiene acceso al entitlement 'premium'.
 */
export async function suscribirse(paquete) {
  if (!Purchases) return false;
  const { customerInfo } = await Purchases.purchasePackage(paquete);
  return tieneAcceso(customerInfo);
}

/**
 * Restaura compras previas del usuario (requerido por las tiendas).
 * Retorna true si tiene acceso activo.
 */
export async function restaurarCompras() {
  if (!Purchases) return false;
  const customerInfo = await Purchases.restorePurchases();
  return tieneAcceso(customerInfo);
}

/**
 * Devuelve el estado actual de la suscripción desde el SDK (fuente: tiendas).
 */
export async function obtenerEstadoRC() {
  if (!_inicializado) return { tieneAcceso: false, enTrial: false, fechaExpiracion: null, productoActivo: null };
  try {
    const ci = await Purchases.getCustomerInfo();
    const entitlement = ci.entitlements.active['premium'];
    return {
      tieneAcceso:    !!entitlement,
      enTrial:        entitlement?.periodType === 'TRIAL',
      fechaExpiracion: entitlement?.expirationDate || null,
      productoActivo: entitlement?.productIdentifier || null,
    };
  } catch (err) {
    console.warn('[Purchases] Error al obtener estado RC:', err.message);
    return { tieneAcceso: false, enTrial: false, fechaExpiracion: null, productoActivo: null };
  }
}

/**
 * Abre la pantalla nativa de gestión de suscripciones (App Store / Play Store).
 * Desde ahí el usuario puede cancelar o cambiar su plan.
 */
export async function abrirGestionSuscripcion() {
  if (!Purchases) return;
  try {
    await Purchases.showManageSubscriptions();
  } catch (err) {
    console.warn('[Purchases] Error al abrir gestión:', err.message);
  }
}

function tieneAcceso(customerInfo) {
  return !!customerInfo?.entitlements?.active?.['premium'];
}
