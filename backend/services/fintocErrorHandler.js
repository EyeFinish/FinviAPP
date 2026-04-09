/**
 * Clasifica errores de la API de Fintoc para decidir si son permanentes o transitorios.
 * - Permanentes (401/403): el link fue revocado o las credenciales son inválidas → marcar como 'error'
 * - Transitorios (timeout, 5xx, red): fallo puntual → reintentar en el siguiente cron
 */

const MAX_FALLAS_CONSECUTIVAS = 5;

/**
 * Retorna true si el error es permanente (credenciales revocadas o link inválido).
 */
function esPermanente(err) {
  const status = err.response?.status;
  return status === 401 || status === 403;
}

/**
 * Maneja el error de sincronización de un link:
 * - Error permanente → marca status: 'error' inmediatamente
 * - Error transitorio → incrementa contador; si supera MAX → marca 'error'
 * Retorna la actualización a aplicar en el documento FintocLink.
 */
function calcularActualizacionError(err, linkActual) {
  const mensaje = err.response?.data?.error?.message || err.message || 'Error desconocido';

  if (esPermanente(err)) {
    return {
      status: 'error',
      syncFailureCount: (linkActual.syncFailureCount || 0) + 1,
      lastSyncError: `[Permanente] ${mensaje}`,
    };
  }

  // Error transitorio
  const nuevasCantFallas = (linkActual.syncFailureCount || 0) + 1;
  const nuevoStatus = nuevasCantFallas >= MAX_FALLAS_CONSECUTIVAS ? 'error' : linkActual.status || 'active';

  return {
    status: nuevoStatus,
    syncFailureCount: nuevasCantFallas,
    lastSyncError: `[Transitorio #${nuevasCantFallas}] ${mensaje}`,
  };
}

/**
 * Actualización a aplicar cuando la sincronización fue exitosa.
 */
function calcularActualizacionExito() {
  return {
    status: 'active',          // resetea el link a activo si estaba en error
    syncFailureCount: 0,
    lastSyncError: null,
    lastSuccessSync: new Date(),
  };
}

module.exports = { esPermanente, calcularActualizacionError, calcularActualizacionExito, MAX_FALLAS_CONSECUTIVAS };
