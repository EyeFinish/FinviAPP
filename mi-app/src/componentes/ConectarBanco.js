import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFintoc } from '@fintoc/fintoc-js';
import { crearLinkIntent, intercambiarToken } from '../servicios/api';
import '../estilos/conectarBanco.css';

function ConectarBanco() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('idle'); // idle | opening | connecting | syncing | success | error
  const [error, setError] = useState(null);
  const [resultadoSync, setResultadoSync] = useState(null);

  const handleConectar = async () => {
    setLoading(true);
    setError(null);
    setEstado('opening');

    try {
      // 1. Pedir al backend que cree un Link Intent
      const { widgetToken, publicKey } = await crearLinkIntent();

      // 2. Obtener la instancia de Fintoc
      const Fintoc = await getFintoc();

      // 3. Crear y abrir el Widget
      setEstado('connecting');
      const widget = Fintoc.create({
        publicKey: publicKey,
        widgetToken: widgetToken,
        onSuccess: async (linkIntent) => {
          try {
            setEstado('syncing');
            console.log('onSuccess recibido:', linkIntent);
            // El widget puede entregar un string directo o un objeto con exchangeToken
            const token = typeof linkIntent === 'string'
              ? linkIntent
              : linkIntent?.exchangeToken || linkIntent?.exchange_token;
            console.log('Exchange token extraído:', token);
            const result = await intercambiarToken(token);
            console.log('Sincronización exitosa:', result);
            setResultadoSync(result);
            setEstado('success');

            setTimeout(() => {
              navigate('/');
            }, 4000);
          } catch (err) {
            console.error('Error al sincronizar:', err);
            setError(err.response?.data?.message || 'Error al sincronizar los datos bancarios');
            setEstado('error');
            setLoading(false);
          }
        },
        onExit: () => {
          console.log('Widget cerrado por el usuario');
          setEstado('idle');
          setLoading(false);
        },
        onEvent: (eventName, metadata) => {
          console.log('Evento del widget:', eventName, metadata);
          if (eventName === 'on_error') {
            console.error('Detalle del error Fintoc:', JSON.stringify(metadata, null, 2));
          }
        },
      });

      widget.open();
    } catch (err) {
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
            {estado === 'success' ? '✅' : '🔒'}
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
          {estado === 'syncing' && (
            <div className="conectar-banco-sync">
              <div className="loading-spinner"></div>
              <span className="conectar-banco-sync-texto">Sincronizando datos bancarios...</span>
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
                    🏦 <strong>{resultadoSync.link?.institution || 'Banco'}</strong> — {resultadoSync.link?.holder || ''}
                  </p>
                  <p className="sync-resumen-item">
                    📁 {resultadoSync.totalCuentas || resultadoSync.accounts?.length || 0} cuenta(s) importada(s)
                  </p>
                  {resultadoSync.tiposEncontrados && (
                    <div className="sync-resumen-tipos">
                      {Object.entries(resultadoSync.tiposEncontrados).map(([tipo, cant]) => (
                        <span key={tipo} className="sync-tipo-tag">
                          {tipo === 'checking_account' && '🏧 '}
                          {tipo === 'savings_account' && '💰 '}
                          {tipo === 'credit_card' && '💳 '}
                          {tipo === 'line_of_credit' && '📊 '}
                          {tipo.replace(/_/g, ' ')} ({cant})
                        </span>
                      ))}
                    </div>
                  )}
                  {(resultadoSync.creditosImportados || 0) > 0 ? (
                    <p className="sync-resumen-item sync-creditos-ok">
                      💳 {resultadoSync.creditosImportados} tarjeta(s) de crédito detectada(s) — completa sus datos en la sección Créditos
                    </p>
                  ) : (
                    <p className="sync-resumen-item sync-creditos-no">
                      ℹ️ No se detectaron tarjetas de crédito. Si tienes tarjetas, puedes agregarlas manualmente en Créditos.
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
            className={`btn btn-primario btn-grande ${loading && estado !== 'error' ? '' : ''}`}
          >
            {estado === 'opening' && 'Preparando conexión...'}
            {estado === 'connecting' && 'Esperando autenticación...'}
            {estado === 'syncing' && 'Sincronizando...'}
            {estado === 'success' && '✓ Conectado'}
            {(estado === 'idle' || estado === 'error') && '🔒 Conectar mi banco'}
          </button>

          {/* Seguridad */}
          <div className="conectar-banco-seguridad">
            <div className="seguridad-item">
              <span className="seguridad-item-icono">🛡️</span>
              <span>Conexión encriptada</span>
            </div>
            <div className="seguridad-item">
              <span className="seguridad-item-icono">👁️</span>
              <span>Solo lectura</span>
            </div>
            <div className="seguridad-item">
              <span className="seguridad-item-icono">📋</span>
              <span>Certificado CMF</span>
            </div>
          </div>
        </div>

        {/* Info sandbox */}
        <div className="mensaje-advertencia">
          <p className="mensaje-advertencia-texto">
            <strong>Modo Sandbox:</strong> Para probar, usa RUT{' '}
            <code>41614850-3</code> y contraseña <code>jonsnow</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConectarBanco;
