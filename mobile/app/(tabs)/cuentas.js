import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
import { Ionicons } from '@expo/vector-icons';
import { obtenerCuentas, obtenerMovimientos, crearLinkIntent, intercambiarToken } from '../../services/api';
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

  // Estado de conexión bancaria
  const [conectando, setConectando] = useState(false); // modal abierto
  const [pasoConexion, setPasoConexion] = useState('idle'); // idle | widget | syncing | success | error
  const [widgetHtml, setWidgetHtml] = useState('');
  const [errorConexion, setErrorConexion] = useState('');
  const [resultadoSync, setResultadoSync] = useState(null);

  const cargarCuentas = async () => {
    try {
      const res = await obtenerCuentas();
      setCuentas(res.data || []);
    } catch {
      setCuentas([]);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(useCallback(() => { cargarCuentas(); }, []));

  const verMovimientos = async (cuenta) => {
    if (cuentaSeleccionada?.id === cuenta.id) {
      setCuentaSeleccionada(null);
      setMovimientos([]);
      return;
    }
    setCuentaSeleccionada(cuenta);
    setCargandoMov(true);
    try {
      const res = await obtenerMovimientos(cuenta.id);
      setMovimientos(res.data || []);
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
            {cargandoMov ? (
              <ActivityIndicator color={Colors.primario} style={{ padding: 20 }} />
            ) : movimientos.length === 0 ? (
              <Text style={styles.sinMov}>Sin movimientos</Text>
            ) : (
              movimientos.slice(0, 20).map((mov) => (
                <View key={mov._id || mov.fintocId} style={styles.movRow}>
                  <View style={styles.movInfo}>
                    <Text style={styles.movDesc} numberOfLines={1}>
                      {mov.description || 'Sin descripción'}
                    </Text>
                    <Text style={styles.movFecha}>{formatearFecha(mov.postDate)}</Text>
                  </View>
                  <Text style={[styles.movMonto, { color: mov.amount >= 0 ? Colors.exito : Colors.error }]}>
                    {mov.amount >= 0 ? '+' : ''}{formatearMoneda(mov.amount)}
                  </Text>
                </View>
              ))
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
          data={cuentas}
          keyExtractor={(item) => item.id}
          renderItem={renderCuenta}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargarCuentas(); }} colors={[Colors.primario]} />
          }
          ListHeaderComponent={
            <TouchableOpacity style={styles.btnAgregar} onPress={iniciarConexion}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primario} />
              <Text style={styles.btnAgregarTexto}>Agregar otro banco</Text>
            </TouchableOpacity>
          }
        />
      )}

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
  btnAgregar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.primario, borderStyle: 'dashed', justifyContent: 'center',
  },
  btnAgregarTexto: { color: Colors.primario, fontWeight: '600', fontSize: FontSize.sm },
  cuentaCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
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
  movRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  movInfo: { flex: 1, marginRight: 12 },
  movDesc: { fontSize: FontSize.sm, color: Colors.texto },
  movFecha: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  movMonto: { fontSize: FontSize.sm, fontWeight: '700' },

  // Modal conexión
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
