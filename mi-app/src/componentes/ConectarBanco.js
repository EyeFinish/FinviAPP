import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFintoc } from '@fintoc/fintoc-js';
import { crearLinkIntent, intercambiarToken } from '../servicios/api';
import { CheckCircle, Lock, Building2, FolderOpen, Landmark, PiggyBank, CreditCard, BarChart3, Shield, Eye, ClipboardList, Check, Info, XCircle, RefreshCw } from 'lucide-react';
import '../estilos/conectarBanco.css';

function ConectarBanco() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('idle'); // idle | opening | connecting | syncing | success | error
  const [error, setError] = useState(null);
  const [resultadoSync, setResultadoSync] = useState(null);
  const [pasoSync, setPasoSync] = useState(''); // texto descriptivo del paso actual
  const abortRef = useRef(false);
  const widgetRef = useRef(null);

  const resetear = useCallback(() => {
    abortRef.current = true;
    setEstado('idle');
    setLoading(false);
    setError(null);
    setPasoSync('');
    if (widgetRef.current) {
      try { widgetRef.current.close(); } catch (_) {}
      widgetRef.current = null;
    }
  }, []);

  const handleConectar = async () => {
    abortRef.current = false;
    setLoading(true);
    setError(null);
    setEstado('opening');
    setPasoSync('Preparando conexión segura...');

    try {
      // 1. Pedir al backend que cree un Link Intent
      setPasoSync('Conectando con Fintoc...');
      const { widgetToken, publicKey } = await crearLinkIntent();

      if (abortRef.current) return;

      // 2. Obtener la instancia de Fintoc
      const Fintoc = await getFintoc();

      if (abortRef.current) return;

      // 3. Crear y abrir el Widget
      setEstado('connecting');
      setPasoSync('Esperando autenticación bancaria...');

      const widget = Fintoc.create({
        publicKey: publicKey,
        widgetToken: widgetToken,
        onSuccess: async (linkIntent) => {
          if (abortRef.current) return;
          try {
            setEstado('syncing');
            setPasoSync('Intercambiando credenciales...');

            // Extraer el exchange token del callback
            const token = typeof linkIntent === 'string'
              ? linkIntent
              : linkIntent?.exchangeToken || linkIntent?.exchange_token;

            if (!token) {
              throw new Error('No se recibió un token válido del banco. Intenta conectar nuevamente.');
            }

            console.log('Exchange token extraído:', token ? '***' + token.slice(-6) : 'null');

            // Llamar al exchange con timeout de 90 segundos
            setPasoSync('Sincronizando cuentas y movimientos...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            let result;
            try {
              result = await intercambiarToken(token);
              clearTimeout(timeoutId);
            } catch (err) {
              clearTimeout(timeoutId);
              if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
                throw new Error('La sincronización tardó demasiado. Tus cuentas se guardaron parcialmente, revisa el dashboard.');
              }
              throw err;
            }

            if (abortRef.current) return;

            console.log('Sincronización exitosa:', result);
            setResultadoSync(result);
            setEstado('success');
            setPasoSync('');

            setTimeout(() => {
              navigate('/');
            }, 4000);
          } catch (err) {
            if (abortRef.current) return;
            console.error('Error al sincronizar:', err);
            setError(err.response?.data?.message || err.message || 'Error al sincronizar los datos bancarios');
            setEstado('error');
            setLoading(false);
          }
        },
        onExit: () => {
          console.log('Widget cerrado por el usuario');
          if (!abortRef.current && estado !== 'syncing' && estado !== 'success') {
            setEstado('idle');
            setLoading(false);
            setPasoSync('');
          }
        },
        onEvent: (eventName, metadata) => {
          console.log('Evento del widget:', eventName, metadata);
          if (eventName === 'on_error') {
            console.error('Detalle del error Fintoc:', JSON.stringify(metadata, null, 2));
          }
        },
      });

      widgetRef.current = widget;
      widget.open();
    } catch (err) {
      if (abortRef.current) return;
      console.error('Error al abrir el widget:', err);
      setError(err.response?.data?.message || 'Error al iniciar la conexión bancaria. Verifica tus API Keys.');
      setEstado('error');
      setLoading(false);
    }
  };

  return (
    <div className="conectar-banco">
      <div className="conectar-banco-contenedor">
        {/* Card Principal */}
        <div className="conectar-banco-card">
          {/* Icono */}
          <div className="conectar-banco-icono">
            {estado === 'success' ? <CheckCircle size={48} /> : <Lock size={48} />}
          </div>

          {/* Título */}
          <h1 className="conectar-banco-titulo">Conectar Banco</h1>
          <p className="conectar-banco-descripcion">
            Conecta tu cuenta bancaria de forma segura para visualizar tus saldos
            y movimientos automáticamente. Usamos{' '}
            <a href="https://fintoc.com" target="_blank" rel="noopener noreferrer">
              Fintoc
            </a>{' '}
            como plataforma de conexión bancaria certificada.
          </p>

          {/* Estado sincronizando */}
          {(estado === 'syncing' || estado === 'opening') && (
            <div className="conectar-banco-sync">
              <div className="loading-spinner"></div>
              <span className="conectar-banco-sync-texto">{pasoSync || 'Procesando...'}</span>
              {estado === 'syncing' && (
                <button onClick={resetear} className="btn-cancelar-sync">
                  <XCircle size={14} /> Cancelar
                </button>
              )}
            </div>
          )}

          {/* Mensaje éxito con resumen */}
          {estado === 'success' && (
            <div className="mensaje-exito">
              <p className="mensaje-exito-texto">
                ¡Conexión exitosa! Redirigiendo al dashboard...
              </p>
              {resultadoSync && (
                <div className="sync-resumen">
                  <p className="sync-resumen-item">
                    <Building2 size={14} /> <strong>{resultadoSync.link?.institution || 'Banco'}</strong> — {resultadoSync.link?.holder || ''}
                  </p>
                  <p className="sync-resumen-item">
                    <FolderOpen size={14} /> {resultadoSync.totalCuentas || resultadoSync.accounts?.length || 0} cuenta(s) importada(s)
                  </p>
                  {resultadoSync.tiposEncontrados && (
                    <div className="sync-resumen-tipos">
                      {Object.entries(resultadoSync.tiposEncontrados).map(([tipo, cant]) => (
                        <span key={tipo} className="sync-tipo-tag">
                          {tipo === 'checking_account' && <><Landmark size={12} /> </>}
                          {tipo === 'savings_account' && <><PiggyBank size={12} /> </>}
                          {tipo === 'credit_card' && <><CreditCard size={12} /> </>}
                          {tipo === 'line_of_credit' && <><BarChart3 size={12} /> </>}
                          {tipo.replace(/_/g, ' ')} ({cant})
                        </span>
                      ))}
                    </div>
                  )}
                  {(resultadoSync.lineaCredito) ? (
                    <p className="sync-resumen-item sync-creditos-ok">
                      <BarChart3 size={14} /> Línea de crédito detectada: ${resultadoSync.lineaCredito.toLocaleString('es-CL')} disponible
                    </p>
                  ) : null}
                  {(resultadoSync.creditosImportados || 0) > 0 ? (
                    <p className="sync-resumen-item sync-creditos-ok">
                      <CreditCard size={14} /> {resultadoSync.creditosImportados} crédito(s) detectado(s) — completa sus datos en la sección Créditos
                    </p>
                  ) : (
                    <p className="sync-resumen-item sync-creditos-no">
                      <Info size={14} /> Las tarjetas de crédito no están disponibles vía Fintoc para tu banco. Puedes agregarlas manualmente en Créditos.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mensaje error */}
          {error && (
            <div className="mensaje-error">
              <p className="mensaje-error-texto">{error}</p>
            </div>
          )}

          {/* Botón */}
          <button
            onClick={handleConectar}
            disabled={loading && estado !== 'error'}
            className="btn btn-primario btn-grande"
          >
            {estado === 'opening' && 'Preparando conexión...'}
            {estado === 'connecting' && 'Esperando autenticación...'}
            {estado === 'syncing' && 'Sincronizando...'}
            {estado === 'success' && <><Check size={16} /> Conectado</>}
            {estado === 'error' && <><RefreshCw size={16} /> Reintentar conexión</>}
            {estado === 'idle' && <><Lock size={16} /> Conectar mi banco</>}
          </button>

          {/* Seguridad */}
          <div className="conectar-banco-seguridad">
            <div className="seguridad-item">
              <span className="seguridad-item-icono"><Shield size={16} /></span>
              <span>Conexión encriptada</span>
            </div>
            <div className="seguridad-item">
              <span className="seguridad-item-icono"><Eye size={16} /></span>
              <span>Solo lectura</span>
            </div>
            <div className="seguridad-item">
              <span className="seguridad-item-icono"><ClipboardList size={16} /></span>
              <span>Certificado CMF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConectarBanco;