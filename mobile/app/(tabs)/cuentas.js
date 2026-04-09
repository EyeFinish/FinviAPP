import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, Platform, AppState,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
import { Ionicons } from '@expo/vector-icons';
import { obtenerCuentas, obtenerMovimientos, crearLinkIntent, intercambiarToken, refrescarDatos, obtenerSyncStatus, eliminarConexion, obtenerConexiones } from '../../services/api';
import { formatearMoneda, formatearFecha, traducirTipoCuenta, obtenerInfoBanco } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const FINTOC_WIDGET_HTML = (publicKey, widgetToken) => `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>body{margin:0;background:#f8f9fe;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}
.msg{text-align:center;color:#6b7280;font-size:14px;padding:20px}</style>
</head><body>
<div class="msg">Cargando widget bancario...</div>
<script src="https://js.fintoc.com/v1/"></script>
<script>
  try {
    const widget = Fintoc.create({
      publicKey: '${publicKey}',
      widgetToken: '${widgetToken}',
      onSuccess: function(link) {
        var token = typeof link === 'string' ? link : (link.exchangeToken || link.exchange_token || '');
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'success', exchangeToken: token}));
      },
      onExit: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'exit'}));
      },
      onEvent: function(name, meta) {
        if (name === 'on_error') {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message: meta?.message || 'Error en el widget'}));
        }
      }
    });
    widget.open();
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message: e.message}));
  }
</script>
</body></html>
`;

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMov, setCargandoMov] = useState(false);
  const [limiteMovs, setLimiteMovs] = useState(15);

  // Estado de conexión bancaria
  const [conectando, setConectando] = useState(false); // modal abierto
  const [pasoConexion, setPasoConexion] = useState('idle'); // idle | widget | syncing | success | error
  const [widgetHtml, setWidgetHtml] = useState('');
  const [errorConexion, setErrorConexion] = useState('');
  const [resultadoSync, setResultadoSync] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [eliminando, setEliminando] = useState(null); // linkId en proceso
  const [conexiones, setConexiones] = useState([]); // { _id, institutionName }
  const [confirmModal, setConfirmModal] = useState(null); // { linkId, nombreBanco }
  const [hayConexionEnError, setHayConexionEnError] = useState(false);
  const lastSyncRef = useRef(null);
  const pollRef = useRef(null);

  const ejecutarDesconexion = async () => {
    if (!confirmModal) return;
    const { linkId } = confirmModal;
    setConfirmModal(null);
    setEliminando(linkId);
    try {
      await eliminarConexion(linkId);
      setCuentaSeleccionada(null);
      setMovimientos([]);
      await cargarCuentas();
    } catch (err) {
      setConfirmModal({ error: err.response?.data?.message || 'No se pudo desconectar el banco' });
    } finally {
      setEliminando(null);
    }
  };

  const desconectarBanco = (linkId, nombreBanco) => {
    if (!linkId) {
      setConfirmModal({ error: 'No se encontró la conexión bancaria. Recarga la pantalla e intenta nuevamente.' });
      return;
    }
    setConfirmModal({ linkId, nombreBanco });
  };

  const cargarCuentas = async () => {
    try {
      // Separamos las llamadas para que un error en conexiones no oculte las cuentas
      const resCuentas = await obtenerCuentas();
      setCuentas(resCuentas.data || []);
      try {
        const resConexiones = await obtenerConexiones();
        setConexiones(resConexiones.data || []);
      } catch {
        // silencioso: conexiones no críticas para mostrar cuentas
      }
    } catch {
      setCuentas([]);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // Dispara refresh y hace polling hasta detectar datos nuevos
  const refrescarEnSegundoPlano = async () => {
    try {
      let syncAntes = null;
      try {
        const st = await obtenerSyncStatus();
        syncAntes = st.data?.lastSync;
        lastSyncRef.current = syncAntes;
        setHayConexionEnError(st.data?.hayConexionEnError || false);
      } catch { /* silencioso */ }

      refrescarDatos().catch(() => {});

      let intentos = 0;
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
      while (intentos < 40) {
        await esperar(3000);
        try {
          const st = await obtenerSyncStatus();
          const syncNuevo = st.data?.lastSync;
          if (syncNuevo && (!syncAntes || new Date(syncNuevo) > new Date(syncAntes))) {
            await cargarCuentas();
            return;
          }
        } catch { /* silencioso */ }
        intentos++;
      }
    } catch { /* silencioso */ } finally {
      setRefrescando(false);
    }
  };

  useFocusEffect(useCallback(() => {
    cargarCuentas();
    refrescarEnSegundoPlano();

    // Polling cada minuto para detectar sincronizaciones del cron
    pollRef.current = setInterval(async () => {
      try {
        const status = await obtenerSyncStatus();
        const nuevoSync = status.data?.lastSync;
        setHayConexionEnError(status.data?.hayConexionEnError || false);
        if (nuevoSync && lastSyncRef.current && new Date(nuevoSync) > new Date(lastSyncRef.current)) {
          lastSyncRef.current = nuevoSync;
          await cargarCuentas();
          if (status.data?.ultimoResultado) {
            const r = status.data.ultimoResultado;
            if (r.error) {
              setSyncMsg({ texto: `Error al sincronizar: ${r.error}`, tipo: 'error' });
            } else if (r.movimientos > 0) {
              setSyncMsg({ texto: `${r.movimientos} transacciones actualizadas`, tipo: 'ok' });
              setTimeout(() => setSyncMsg(null), 8000);
            }
          }
        }
        if (!lastSyncRef.current) lastSyncRef.current = nuevoSync;
      } catch { /* silencioso */ }
    }, 60 * 1000);

    // Sincronizar automáticamente cuando la app vuelve al primer plano
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refrescarEnSegundoPlano();
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      appStateSub.remove();
    };
  }, []));

  const verMovimientos = async (cuenta) => {
    if (cuentaSeleccionada?.id === cuenta.id) {
      setCuentaSeleccionada(null);
      setMovimientos([]);
      return;
    }
    setCuentaSeleccionada(cuenta);
    setCargandoMov(true);
    setLimiteMovs(15); // resetear al cambiar de cuenta
    try {
      const res = await obtenerMovimientos(cuenta.id, 500);
      const data = res.data;
      const lista = Array.isArray(data) ? data : (data?.movements || []);
      // Ordenar por fecha descendente (sin filtro de fecha — mostrar todas las transacciones)
      const filtrados = lista
        .sort((a, b) => new Date(b.postDate || b.transactionDate) - new Date(a.postDate || a.transactionDate));
      setMovimientos(filtrados);
    } catch {
      setMovimientos([]);
    } finally {
      setCargandoMov(false);
    }
  };

  // --- FLUJO DE CONEXIÓN ---
  const cargarFintocWeb = (publicKey, widgetToken) => {
    return new Promise((resolve, reject) => {
      const cargar = () => {
        try {
          const widget = window.Fintoc.create({
            publicKey,
            widgetToken,
            onSuccess: (link) => {
              const token = typeof link === 'string' ? link : (link.exchangeToken || link.exchange_token || '');
              resolve(token);
            },
            onExit: () => reject(new Error('cancelled')),
            onEvent: (name, meta) => {
              if (name === 'on_error') reject(new Error(meta?.message || 'Error en el widget'));
            },
          });
          widget.open();
        } catch (e) {
          reject(e);
        }
      };

      if (window.Fintoc) { cargar(); return; }
      const script = document.createElement('script');
      script.src = 'https://js.fintoc.com/v1/';
      script.onload = cargar;
      script.onerror = () => reject(new Error('No se pudo cargar el widget bancario'));
      document.head.appendChild(script);
    });
  };

  const iniciarConexion = async () => {
    setConectando(true);
    setPasoConexion('idle');
    setErrorConexion('');
    setResultadoSync(null);
    try {
      const res = await crearLinkIntent();
      const { widgetToken, publicKey } = res.data;

      if (Platform.OS === 'web') {
        setPasoConexion('widget');
        const exchangeToken = await cargarFintocWeb(publicKey, widgetToken);
        setPasoConexion('syncing');
        const syncRes = await intercambiarToken(exchangeToken);
        setResultadoSync(syncRes.data);
        setPasoConexion('success');
        cargarCuentas();
      } else {
        setWidgetHtml(FINTOC_WIDGET_HTML(publicKey, widgetToken));
        setPasoConexion('widget');
      }
    } catch (err) {
      if (err.message === 'cancelled') { cerrarConexion(); return; }
      setErrorConexion(err.response?.data?.message || err.message || 'Error al iniciar conexión');
      setPasoConexion('error');
    }
  };

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') {
        setPasoConexion('syncing');
        const res = await intercambiarToken(data.exchangeToken);
        setResultadoSync(res.data);
        setPasoConexion('success');
        cargarCuentas();
      } else if (data.type === 'exit') {
        if (pasoConexion === 'widget') {
          cerrarConexion();
        }
      } else if (data.type === 'error') {
        setErrorConexion(data.message || 'Error en el widget bancario');
        setPasoConexion('error');
      }
    } catch {
      // mensaje no JSON, ignorar
    }
  };

  const cerrarConexion = () => {
    setConectando(false);
    setPasoConexion('idle');
    setWidgetHtml('');
    setErrorConexion('');
    setResultadoSync(null);
  };

  // --- RENDER ---
  const renderCuenta = ({ item }) => {
    const banco = obtenerInfoBanco(item.institution);
    const seleccionada = cuentaSeleccionada?.id === item.id;

    return (
      <View>
        <TouchableOpacity
          style={[styles.cuentaCard, seleccionada && styles.cuentaCardActiva]}
          onPress={() => verMovimientos(item)}
        >
          <View style={[styles.bancoIcon, { backgroundColor: banco.colorClaro }]}>
            <Text style={[styles.bancoLetra, { color: banco.color }]}>
              {banco.nombre.charAt(0)}
            </Text>
          </View>
          <View style={styles.cuentaInfo}>
            <Text style={styles.cuentaNombre}>{item.name || item.officialName}</Text>
            <Text style={styles.cuentaTipo}>
              {traducirTipoCuenta(item.type)} • {banco.nombre}
            </Text>
          </View>
          <View style={styles.cuentaBalance}>
            <Text style={[styles.balanceTexto, {
              color: (item.balance?.available || 0) >= 0 ? Colors.exito : Colors.error
            }]}>
              {formatearMoneda(item.balance?.available || item.balance?.current || 0)}
            </Text>
            <Ionicons
              name={seleccionada ? 'chevron-up' : 'chevron-down'}
              size={16} color={Colors.textoSecundario}
            />
          </View>
        </TouchableOpacity>

        {seleccionada && (
          <View style={styles.movContainer}>
            <Text style={styles.movTitulo}>Transacciones</Text>
            {cargandoMov ? (
              <ActivityIndicator color={Colors.primario} style={{ padding: 20 }} />
            ) : movimientos.length === 0 ? (
              <Text style={styles.sinMov}>Sin transacciones registradas</Text>
            ) : (
              <>
                {movimientos.slice(0, limiteMovs).map((mov) => {
                  const fecha = mov.postDate || mov.transactionDate;
                  const esIngreso = mov.amount >= 0;
                  return (
                    <View key={mov._id || mov.fintocId} style={styles.movRow}>
                      <View style={styles.movInfo}>
                        <Text style={styles.movDesc} numberOfLines={1}>
                          {mov.description || 'Sin descripción'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.movFecha}>{formatearFecha(fecha)}</Text>
                          {mov.pending && (
                            <View style={styles.pendienteBadge}>
                              <Text style={styles.pendienteTexto}>pendiente</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.movMonto, { color: esIngreso ? Colors.exito : Colors.error }]}>
                        {esIngreso ? '+' : ''}{formatearMoneda(mov.amount)}
                      </Text>
                    </View>
                  );
                })}
                {movimientos.length > limiteMovs && (
                  <TouchableOpacity
                    style={styles.btnVerMas}
                    onPress={() => setLimiteMovs((prev) => prev + 30)}
                  >
                    <Text style={styles.btnVerMasTexto}>
                      Ver más ({movimientos.length - limiteMovs} restantes)
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.primario} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primario} />
      </View>
    );
  }

  // Mapa institution (lowercase) → linkId desde /fintoc/links
  const linkIdPorInstitution = new Map();
  conexiones.forEach((con) => {
    if (con._id) {
      const key = (con.institutionName || '').toLowerCase().trim();
      linkIdPorInstitution.set(key, String(con._id));
    }
  });

  // Agrupar cuentas por banco, usando linkId de conexiones como fuente primaria
  const gruposBancos = [];
  const mapaGrupos = new Map();
  cuentas.forEach((c) => {
    const instKey = (c.institution || '').toLowerCase().trim();
    const linkId = linkIdPorInstitution.get(instKey) || c.linkId || null;
    const key = linkId || c.institution || 'unknown';
    if (!mapaGrupos.has(key)) {
      mapaGrupos.set(key, { linkId, institution: c.institution, holder: c.holder, cuentas: [] });
      gruposBancos.push(mapaGrupos.get(key));
    }
    mapaGrupos.get(key).cuentas.push(c);
  });

  return (
    <View style={styles.container}>
      {cuentas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color={Colors.borde} />
          <Text style={styles.emptyText}>No hay cuentas conectadas</Text>
          <Text style={styles.emptySubtext}>Conecta tu banco para ver tus cuentas y movimientos</Text>
          <TouchableOpacity style={styles.btnConectar} onPress={iniciarConexion}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.btnConectarTexto}>Conectar banco</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={gruposBancos}
          keyExtractor={(item) => item.linkId || item.institution}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); refrescarEnSegundoPlano(); }} colors={[Colors.primario]} />
          }
          ListHeaderComponent={
            <View>
              {syncMsg && (
                <View style={[styles.syncMsg, syncMsg.tipo === 'error' ? styles.syncMsgError : styles.syncMsgOk]}>
                  <Text style={syncMsg.tipo === 'error' ? styles.syncMsgErrorText : styles.syncMsgOkText}>
                    {syncMsg.tipo === 'error' ? '⚠ ' : '✓ '}{syncMsg.texto}
                  </Text>
                </View>
              )}
              {hayConexionEnError && (
                <TouchableOpacity
                  style={styles.bannerError}
                  onPress={() => { setRefrescando(true); refrescarEnSegundoPlano(); }}
                >
                  <Ionicons name="warning-outline" size={16} color="#856404" />
                  <Text style={styles.bannerErrorTexto}>
                    Hay una conexión bancaria con problemas. Toca para intentar reconectar.
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnAgregar} onPress={iniciarConexion}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.primario} />
                <Text style={styles.btnAgregarTexto}>Agregar otro banco</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: grupo }) => {
            const banco = obtenerInfoBanco(grupo.institution);
            const estaEliminando = !!eliminando && eliminando === grupo.linkId;
            return (
              <View style={styles.grupoCard}>
                {/* Header del banco con botón desconectar */}
                <View style={styles.grupoHeader}>
                  <View style={styles.grupoHeaderLeft}>
                    <View style={[styles.bancoIconGrande, { backgroundColor: banco.colorClaro }]}>
                      <Text style={[styles.bancoLetraGrande, { color: banco.color }]}>
                        {banco.nombre.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.grupoBancoNombre}>{banco.nombre}</Text>
                      {grupo.holder ? <Text style={styles.grupoHolder}>{grupo.holder}</Text> : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.btnDesconectar, estaEliminando && { opacity: 0.5 }]}
                    onPress={() => desconectarBanco(grupo.linkId, banco.nombre)}
                    disabled={estaEliminando}
                  >
                    {estaEliminando
                      ? <ActivityIndicator size="small" color={Colors.error} />
                      : <Ionicons name="unlink-outline" size={15} color={Colors.error} />
                    }
                    <Text style={styles.btnDesconectarTexto}>
                      {estaEliminando ? 'Desconectando...' : 'Desconectar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Cuentas del banco */}
                {grupo.cuentas.map((item) => (
                  <View key={item.id}>{renderCuenta({ item })}</View>
                ))}
              </View>
            );
          }}
        />
      )}

      {/* MODAL CONFIRMACIÓN DESCONECTAR */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            {confirmModal?.error ? (
              <>
                <View style={styles.confirmIconCircle}>
                  <Ionicons name="alert-circle" size={32} color={Colors.error} />
                </View>
                <Text style={styles.confirmTitulo}>Error</Text>
                <Text style={styles.confirmMensaje}>{confirmModal.error}</Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnPrimario]}
                  onPress={() => setConfirmModal(null)}
                >
                  <Text style={styles.confirmBtnPrimarioTexto}>Entendido</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.confirmIconCircle, styles.confirmIconPeligro]}>
                  <Ionicons name="unlink-outline" size={28} color={Colors.error} />
                </View>
                <Text style={styles.confirmTitulo}>Desconectar banco</Text>
                <Text style={styles.confirmBancoNombre}>{confirmModal?.nombreBanco}</Text>
                <Text style={styles.confirmMensaje}>
                  Se eliminarán todas las cuentas y movimientos asociados. Esta acción no se puede deshacer.
                </Text>
                <View style={styles.confirmBtns}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnCancelar]}
                    onPress={() => setConfirmModal(null)}
                  >
                    <Text style={styles.confirmBtnCancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnPeligro]}
                    onPress={ejecutarDesconexion}
                  >
                    <Ionicons name="trash-outline" size={15} color="#fff" />
                    <Text style={styles.confirmBtnPeligroTexto}>Sí, desconectar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONEXIÓN BANCARIA */}
      <Modal visible={conectando} animationType="slide" onRequestClose={cerrarConexion}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Conectar banco</Text>
            <TouchableOpacity onPress={cerrarConexion} style={styles.modalCerrar}>
              <Ionicons name="close" size={24} color={Colors.texto} />
            </TouchableOpacity>
          </View>

          {pasoConexion === 'idle' && (
            <View style={styles.modalCenter}>
              <ActivityIndicator size="large" color={Colors.primario} />
              <Text style={styles.modalMsg}>Preparando conexión segura...</Text>
            </View>
          )}

          {pasoConexion === 'widget' && Platform.OS !== 'web' && WebView && (
            <WebView
              source={{ html: widgetHtml }}
              onMessage={handleWebViewMessage}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.modalCenter}>
                  <ActivityIndicator size="large" color={Colors.primario} />
                  <Text style={styles.modalMsg}>Cargando widget bancario...</Text>
                </View>
              )}
            />
          )}

          {pasoConexion === 'widget' && Platform.OS === 'web' && (
            <View style={styles.modalCenter}>
              <ActivityIndicator size="large" color={Colors.primario} />
              <Text style={styles.modalMsg}>Abriendo widget bancario...</Text>
              <Text style={styles.modalSubMsg}>Selecciona tu banco en la ventana que se abrió</Text>
            </View>
          )}

          {pasoConexion === 'syncing' && (
            <View style={styles.modalCenter}>
              <ActivityIndicator size="large" color={Colors.primario} />
              <Text style={styles.modalMsg}>Sincronizando cuentas y movimientos...</Text>
              <Text style={styles.modalSubMsg}>Esto puede tomar unos segundos</Text>
            </View>
          )}

          {pasoConexion === 'success' && (
            <View style={styles.modalCenter}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={40} color="#fff" />
              </View>
              <Text style={styles.successTitulo}>¡Banco conectado!</Text>
              {resultadoSync && (
                <View style={styles.successInfo}>
                  <Text style={styles.successLabel}>{resultadoSync.link?.institution || 'Banco'}</Text>
                  <Text style={styles.successDetalle}>{resultadoSync.totalCuentas || 0} cuenta(s) sincronizada(s)</Text>
                </View>
              )}
              <TouchableOpacity style={styles.btnConectar} onPress={cerrarConexion}>
                <Text style={styles.btnConectarTexto}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {pasoConexion === 'error' && (
            <View style={styles.modalCenter}>
              <View style={[styles.successCircle, { backgroundColor: Colors.error }]}>
                <Ionicons name="close" size={40} color="#fff" />
              </View>
              <Text style={[styles.successTitulo, { color: Colors.error }]}>Error de conexión</Text>
              <Text style={styles.modalSubMsg}>{errorConexion}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={[styles.btnConectar, { backgroundColor: '#e5e7eb' }]} onPress={cerrarConexion}>
                  <Text style={[styles.btnConectarTexto, { color: Colors.texto }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnConectar} onPress={iniciarConexion}>
                  <Text style={styles.btnConectarTexto}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textoSecundario, marginTop: 16 },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 6, textAlign: 'center' },
  btnConectar: {
    backgroundColor: Colors.primario, borderRadius: BorderRadius.sm,
    paddingVertical: 12, paddingHorizontal: 24, marginTop: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  btnConectarTexto: { color: '#fff', fontWeight: '600', fontSize: FontSize.sm },
  syncMsg: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  syncMsgOk: { backgroundColor: '#f0fdf4' },
  syncMsgError: { backgroundColor: '#fef2f2' },
  syncMsgOkText: { fontSize: FontSize.xs, color: '#16a34a', fontWeight: '600' },
  syncMsgErrorText: { fontSize: FontSize.xs, color: '#dc2626', fontWeight: '600' },
  bannerError: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff3cd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#ffc107',
  },
  bannerErrorTexto: { flex: 1, fontSize: FontSize.xs, color: '#856404', fontWeight: '500' },
  grupoCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, marginBottom: 14,
    overflow: 'hidden',
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.10)', elevation: 5,
  },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: '#f4f5fb', borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  grupoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bancoIconGrande: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  bancoLetraGrande: { fontSize: 16, fontWeight: '700' },
  grupoBancoNombre: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto },
  grupoHolder: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 1 },
  btnDesconectar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  btnDesconectarTexto: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  btnAgregar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.primario, borderStyle: 'dashed', justifyContent: 'center',
  },
  btnAgregarTexto: { color: Colors.primario, fontWeight: '600', fontSize: FontSize.sm },
  cuentaCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    boxShadow: '0px 3px 10px rgba(0, 0, 0, 0.09)', elevation: 4,
  },
  cuentaCardActiva: { borderWidth: 2, borderColor: Colors.primario },
  bancoIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.sm,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  bancoLetra: { fontSize: FontSize.lg, fontWeight: '800' },
  cuentaInfo: { flex: 1 },
  cuentaNombre: { fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },
  cuentaTipo: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  cuentaBalance: { alignItems: 'flex-end' },
  balanceTexto: { fontSize: FontSize.md, fontWeight: '700' },
  movContainer: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, marginBottom: 10,
    marginTop: -6, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  sinMov: { textAlign: 'center', color: Colors.textoSecundario, paddingVertical: 20 },
  movTitulo: {
    fontSize: FontSize.xs, fontWeight: '600', color: Colors.textoSecundario,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingTop: Spacing.sm, paddingBottom: 4,
  },
  movRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  movInfo: { flex: 1, marginRight: 12 },
  movDesc: { fontSize: FontSize.sm, color: Colors.texto },
  movFecha: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  movMonto: { fontSize: FontSize.sm, fontWeight: '700' },
  pendienteBadge: {
    backgroundColor: '#fff8e1', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
  },
  pendienteTexto: { fontSize: 10, color: '#b45309', fontWeight: '600' },
  btnVerMas: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12,
  },
  btnVerMasTexto: { fontSize: FontSize.sm, color: Colors.primario, fontWeight: '600' },

  // Modal conexión
  // Modal confirmación desconectar
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(10, 10, 30, 0.55)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  confirmCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.xl,
    padding: 28, width: '100%', maxWidth: 360, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  confirmIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  confirmIconPeligro: { backgroundColor: '#fef2f2' },
  confirmTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto, marginBottom: 4 },
  confirmBancoNombre: {
    fontSize: FontSize.md, fontWeight: '600', color: Colors.primario,
    marginBottom: 10, textAlign: 'center',
  },
  confirmMensaje: {
    fontSize: FontSize.sm, color: Colors.textoSecundario,
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  confirmBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: BorderRadius.md,
  },
  confirmBtnCancelar: { backgroundColor: Colors.fondo, borderWidth: 1, borderColor: Colors.borde },
  confirmBtnCancelarTexto: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textoSecundario },
  confirmBtnPeligro: { backgroundColor: Colors.error },
  confirmBtnPeligroTexto: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  confirmBtnPrimario: { backgroundColor: Colors.primario, marginTop: 4 },
  confirmBtnPrimarioTexto: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  modalContainer: { flex: 1, backgroundColor: Colors.fondo },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  modalTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto },
  modalCerrar: { padding: 4 },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalMsg: { fontSize: FontSize.md, fontWeight: '500', color: Colors.texto, marginTop: 16, textAlign: 'center' },
  modalSubMsg: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 8, textAlign: 'center' },
  successCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.exito,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  successTitulo: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.texto },
  successInfo: { marginTop: 12, alignItems: 'center' },
  successLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },
  successDetalle: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 4 },
});
