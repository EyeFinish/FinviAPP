import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, FlatList, AppState,
  Animated, Easing,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import {
  obtenerCuentas, refrescarDatos,
  obtenerProgresoMensual, obtenerSinAsignarAgrupados,
  asignarMovimiento, desasignarMovimiento, autoAsignarMovimientos,
  obtenerCostosFijos, obtenerDeudas, obtenerSyncStatus,
} from '../../services/api';
import { formatearMoneda, formatearFecha, calcularSaludFinanciera } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

function IndicadorSalud({ puntaje, nivel, color }) {
  const radius = 36;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const progress = (puntaje / 100) * circumference;
  const size = 90;
  const center = size / 2;

  return (
    <View style={styles.saludContainer}>
      <Svg width={size} height={size}>
        <Circle
          cx={center} cy={center} r={radius}
          stroke={Colors.borde} strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={center} cy={center} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.saludTexto}>
        <Text style={[styles.saludPuntaje, { color }]}>{puntaje}</Text>
        <Text style={styles.saludNivel}>{nivel}</Text>
      </View>
    </View>
  );
}

function BannerProcesando() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotateDeg = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.flowRow}>
        {/* Banco */}
        <View style={bannerStyles.circleGray}>
          <Ionicons name="business-outline" size={22} color="#555a7e" />
        </View>

        {/* Línea izquierda */}
        <View style={bannerStyles.line} />

        {/* Ícono central animado */}
        <Animated.View style={[bannerStyles.circlePrimary, { transform: [{ scale: pulseAnim }] }]}>
          <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
            <Ionicons name="sync" size={22} color="#fff" />
          </Animated.View>
        </Animated.View>

        {/* Línea derecha */}
        <View style={bannerStyles.line} />

        {/* App / Wallet */}
        <View style={bannerStyles.circleGray}>
          <Ionicons name="wallet-outline" size={22} color="#555a7e" />
        </View>
      </View>

      <Text style={bannerStyles.texto}>Verificando tus transacciones...</Text>

      <View style={bannerStyles.notifRow}>
        <Ionicons name="notifications-outline" size={13} color="#5170ff" />
        <Text style={bannerStyles.notifTexto}>
          Por seguridad, nuevas transacciones toman ~1 hora en verificarse · Te avisamos al terminar
        </Text>
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 14,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.07)',
    elevation: 2,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  circleGray: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#f0f2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePrimary: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#5170ff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 14px rgba(81, 112, 255, 0.4)',
    elevation: 5,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#d8ddf5',
    marginHorizontal: 4,
  },
  texto: {
    fontSize: 12,
    color: '#555a7e',
    letterSpacing: 0.2,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f2ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  notifTexto: {
    fontSize: 11,
    color: '#5170ff',
    fontWeight: '500',
  },
});

export default function Dashboard() {
  const { user } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Estado para compromisos mensuales
  const [progreso, setProgreso] = useState(null);
  const [categoriasAgrupadas, setCategoriasAgrupadas] = useState([]);
  const [totalSinAsignar, setTotalSinAsignar] = useState(0);
  const [obligacionesLista, setObligacionesLista] = useState([]);
  const [expandedCat, setExpandedCat] = useState(null);

  // Totales combinados (créditos + obligaciones)
  const [resumenOblig, setResumenOblig] = useState({ totalDeuda: 0, compromisoMensual: 0 });

  // Modal de asignación
  const [modalVisible, setModalVisible] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);
  const [asignando, setAsignando] = useState(false);

  // Última sincronización
  const [lastSync, setLastSync] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null); // { texto, tipo: 'ok'|'error' }
  const pollRef = useRef(null);
  const lastSyncRef = useRef(null);

  // Auto-asignar
  const [autoAsignando, setAutoAsignando] = useState(false);
  const [modalAutoAsignar, setModalAutoAsignar] = useState(false);
  const [previewAutoAsignar, setPreviewAutoAsignar] = useState(null);

  const mesActual = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  };

  const cargarDatos = async () => {
    try {
      const mes = mesActual();
      const [resCuentas, resProgreso, resAgrupados, resCostos, resDeudas] = await Promise.all([
        obtenerCuentas().catch(() => ({ data: [] })),
        obtenerProgresoMensual(mes).catch(() => ({ data: null })),
        obtenerSinAsignarAgrupados(mes).catch(() => ({ data: { categorias: [], totalMovimientos: 0 } })),
        obtenerCostosFijos().catch(() => ({ data: [] })),
        obtenerDeudas().catch(() => ({ data: [] })),
      ]);
      setCuentas(resCuentas.data || []);
      setProgreso(resProgreso.data);

      const agrupados = resAgrupados.data || { categorias: [], totalMovimientos: 0 };
      setCategoriasAgrupadas(agrupados.categorias || []);
      setTotalSinAsignar(agrupados.totalMovimientos || 0);

      // Datos crudos de obligaciones
      const rawCostos = resCostos.data || [];
      const rawDeudas = resDeudas.data || [];

      // Calcular totales de obligaciones para cruce con Dashboard
      // Deuda total = (montoTotal + interesTotal) proporcional a cuotas restantes
      const deudaObligTotal = rawDeudas.reduce((s, d) => {
        const restantes = (d.cuotasTotales || 0) - (d.cuotasPagadas || 0);
        const total = d.cuotasTotales || 1;
        const totalConInteres = (d.montoTotal || 0) + (d.interesTotal || 0);
        return s + totalConInteres * (restantes / total);
      }, 0);
      const compromisoOblig = rawCostos.reduce((s, c) => s + (c.monto || 0), 0)
        + rawDeudas.reduce((s, d) => s + (d.cuotaMensual || 0), 0);
      setResumenOblig({ totalDeuda: deudaObligTotal, compromisoMensual: compromisoOblig });

      // Construir lista de obligaciones para el selector
      const costos = rawCostos.map((c) => ({
        _id: c._id, nombre: c.nombre, tipo: 'costoFijo',
        detalle: c.categoria, monto: c.monto,
      }));
      const deudas = rawDeudas.map((d) => ({
        _id: d._id, nombre: d.nombre, tipo: 'deuda',
        detalle: 'Cuota mensual', monto: d.cuotaMensual,
      }));
      setObligacionesLista([...costos, ...deudas]);
    } catch {
      // silenciar
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // Refresca Fintoc en background: dispara el refresh y hace polling hasta que lleguen datos nuevos
  const refrescarEnSegundoPlano = async () => {
    try {
      // Capturar el lastSync ANTES del refresh para detectar el cambio
      let syncAntes = null;
      try {
        const statusAntes = await obtenerSyncStatus();
        syncAntes = statusAntes.data?.lastSync;
        lastSyncRef.current = syncAntes;
        setLastSync(syncAntes);
      } catch { /* silencioso */ }

      // Disparar el refresh — el backend responde inmediato (async)
      refrescarDatos().catch(() => {});

      // Polling cada 3s para detectar cuándo el backend terminó
      let intentos = 0;
      const maxIntentos = 40; // 40 * 3s = 2 minutos máximo
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

      while (intentos < maxIntentos) {
        await esperar(3000);
        try {
          const statusNuevo = await obtenerSyncStatus();
          const syncNuevo = statusNuevo.data?.lastSync;
          setLastSync(syncNuevo);

          // Si el lastSync es más reciente, hay datos nuevos
          if (syncNuevo && (!syncAntes || new Date(syncNuevo) > new Date(syncAntes))) {
            lastSyncRef.current = syncNuevo;
            const r = statusNuevo.data?.ultimoResultado;
            if (r) {
              if (r.error) {
                setSyncMsg({ texto: `Error al sincronizar: ${r.error}`, tipo: 'error' });
              } else if (r.movimientos > 0) {
                setSyncMsg({ texto: `${r.movimientos} transacciones actualizadas`, tipo: 'ok' });
                setTimeout(() => setSyncMsg(null), 8000);
              }
            }
            await cargarDatos();
            return; // terminamos
          }

        } catch { /* silencioso */ }
        intentos++;
      }
    } catch { /* silencioso */ } finally {
      setRefrescando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
      refrescarEnSegundoPlano();

      // Polling cada minuto para detectar sincronizaciones del cron
      pollRef.current = setInterval(async () => {
        try {
          const status = await obtenerSyncStatus();
          const nuevoSync = status.data?.lastSync;
          setLastSync(nuevoSync);
          if (nuevoSync && lastSyncRef.current && new Date(nuevoSync) > new Date(lastSyncRef.current)) {
            lastSyncRef.current = nuevoSync;
            const r = status.data?.ultimoResultado;
            if (r) {
              if (r.error) {
                setSyncMsg({ texto: `Error al sincronizar: ${r.error}`, tipo: 'error' });
              } else if (r.movimientos > 0) {
                setSyncMsg({ texto: `${r.movimientos} transacciones actualizadas`, tipo: 'ok' });
                setTimeout(() => setSyncMsg(null), 8000);
              }
            }
            await cargarDatos();
          }
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
    }, [])
  );

  const onRefresh = () => {
    setRefrescando(true);
    refrescarEnSegundoPlano(); // dispara sync con Fintoc + recarga al terminar
  };

  const balanceTotal = cuentas.reduce(
    (sum, c) => sum + (c.balance?.available || c.balance?.current || 0), 0
  );
  // Totales combinados: créditos (Fintoc) + obligaciones (manuales)
  const totalDeuda = resumenOblig.totalDeuda;
  const compromisoMensual = resumenOblig.compromisoMensual;
  const salud = calcularSaludFinanciera(balanceTotal, totalDeuda, compromisoMensual);

  const handleAbrirAsignacion = (grupo) => {
    setMovimientoSeleccionado(grupo);
    setModalVisible(true);
  };

  const handleAsignar = async (obligacion) => {
    if (!movimientoSeleccionado || asignando) return;
    setAsignando(true);
    try {
      for (const movId of movimientoSeleccionado.ids) {
        await asignarMovimiento(movId, obligacion.tipo, obligacion._id);
      }
      setModalVisible(false);
      setMovimientoSeleccionado(null);
      await cargarDatos();
    } catch {
      // silenciar
    } finally {
      setAsignando(false);
    }
  };

  const handleDesasignar = async (movId) => {
    try {
      await desasignarMovimiento(movId);
      await cargarDatos();
    } catch {
      // silenciar
    }
  };

  const handleAutoAsignarPreview = async () => {
    setAutoAsignando(true);
    try {
      const res = await autoAsignarMovimientos(mesActual(), 'preview');
      setPreviewAutoAsignar(res.data);
      setModalAutoAsignar(true);
    } catch {
      // silenciar
    } finally {
      setAutoAsignando(false);
    }
  };

  const handleAutoAsignarConfirmar = async () => {
    setAutoAsignando(true);
    try {
      await autoAsignarMovimientos(mesActual(), 'aplicar');
      setModalAutoAsignar(false);
      setPreviewAutoAsignar(null);
      await cargarDatos();
    } catch {
      // silenciar
    } finally {
      setAutoAsignando(false);
    }
  };

  const handleAsignarTodosCategoria = async (cat) => {
    if (!cat.obligacionesSugeridas || cat.obligacionesSugeridas.length !== 1) return;
    const oblig = cat.obligacionesSugeridas[0];
    setAsignando(true);
    try {
      for (const mov of cat.movimientos) {
        await asignarMovimiento(mov._id, oblig.tipo, oblig._id);
      }
      await cargarDatos();
    } catch {
      // silenciar
    } finally {
      setAsignando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primario} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} colors={[Colors.primario]} />}
    >
      {/* Header con usuario */}
      <View style={styles.header}>
        <View>
          <Text style={styles.saludo}>Hola, {user?.nombre?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitulo}>Tu resumen financiero</Text>
          {syncMsg ? (
            <Text style={syncMsg.tipo === 'error' ? styles.syncMsgError : styles.syncMsgOk}>
              {syncMsg.tipo === 'error' ? '⚠ ' : '✓ '}{syncMsg.texto}
            </Text>
          ) : lastSync ? (
            <Text style={styles.syncIndicador}>
              Sinc. {new Date(lastSync).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Resumen compacto: Salud + métricas en grid */}
      <View style={styles.resumenGrid}>
        {/* Salud Financiera */}
        <View style={[styles.gridItem, { flex: 1 }]}>
          <IndicadorSalud puntaje={salud.puntaje} nivel={salud.nivel} color={salud.color} />
          <Text style={styles.gridLabel}>Salud</Text>
        </View>
        {/* Balance */}
        <View style={[styles.gridItem, { flex: 1 }]}>
          <Ionicons name="wallet-outline" size={20} color={Colors.exito} />
          <Text style={styles.gridLabel}>Balance</Text>
          <Text style={[styles.gridValor, { color: balanceTotal >= 0 ? Colors.exito : Colors.error }]}>
            {formatearMoneda(balanceTotal)}
          </Text>
        </View>
        {/* Deuda */}
        <View style={[styles.gridItem, { flex: 1 }]}>
          <Ionicons name="card-outline" size={20} color={Colors.error} />
          <Text style={styles.gridLabel}>Deuda</Text>
          <Text style={[styles.gridValor, { color: Colors.error }]}>
            {formatearMoneda(totalDeuda)}
          </Text>
        </View>
      </View>

      <View style={styles.resumenGrid}>
        {/* Compromiso */}
        <View style={[styles.gridItem, { flex: 1 }]}>
          <Ionicons name="calendar-outline" size={20} color={Colors.secundario} />
          <Text style={styles.gridLabel}>Compromiso</Text>
          <Text style={styles.gridValor}>{formatearMoneda(compromisoMensual)}</Text>
        </View>
        {/* Cuentas */}
        <View style={[styles.gridItem, { flex: 1 }]}>
          <Ionicons name="business-outline" size={20} color={Colors.primario} />
          <Text style={styles.gridLabel}>Cuentas</Text>
          <Text style={styles.gridValor}>{cuentas.length}</Text>
        </View>
      </View>

      <View style={{ height: 12 }} />

      {/* ====== COMPROMISOS DEL MES ====== */}
      {progreso && (
        <View style={styles.card}>
          <View style={styles.compromisoHeader}>
            <Text style={styles.cardTitulo}>Compromisos del Mes</Text>
            <View style={styles.progresoBadge}>
              <Text style={styles.progresoBadgeTexto}>{progreso.porcentajeGeneral}%</Text>
            </View>
          </View>

          {/* Barra de progreso general */}
          <View style={styles.barraFondo}>
            <View style={[styles.barraProgreso, {
              width: `${progreso.porcentajeGeneral}%`,
              backgroundColor: progreso.porcentajeGeneral >= 100 ? Colors.exito : Colors.primario,
            }]} />
          </View>
          <Text style={styles.progresoResumen}>
            {formatearMoneda(progreso.totalPagado)} de {formatearMoneda(progreso.totalComprometido)}
          </Text>

          {/* Lista de obligaciones */}
          {progreso.obligaciones.map((ob) => (
            <View key={`${ob.tipo}_${ob._id}`} style={styles.obligacionItem}>
              <View style={styles.obligacionInfo}>
                <View style={styles.obligacionRow}>
                  <Ionicons
                    name={ob.tipo === 'costoFijo' ? 'receipt-outline' : 'trending-down-outline'}
                    size={16}
                    color={ob.tipo === 'costoFijo' ? Colors.secundario : Colors.peligro}
                  />
                  <Text style={styles.obligacionNombre} numberOfLines={1}>{ob.nombre}</Text>
                </View>
                <View style={styles.barraFondoSmall}>
                  <View style={[styles.barraProgreso, {
                    width: `${ob.porcentaje}%`,
                    backgroundColor: ob.porcentaje >= 100 ? Colors.exito
                      : ob.porcentaje >= 50 ? Colors.advertencia : Colors.error,
                  }]} />
                </View>
              </View>
              <View style={styles.obligacionMontos}>
                <Text style={styles.obligacionPagado}>{formatearMoneda(ob.montoPagado)}</Text>
                <Text style={styles.obligacionObjetivo}>/ {formatearMoneda(ob.montoObjetivo)}</Text>
              </View>
            </View>
          ))}

          {progreso.obligaciones.length === 0 && (
            <Text style={styles.emptyText}>No hay obligaciones registradas este mes</Text>
          )}
        </View>
      )}

      {/* ====== TRANSACCIONES SIN ASIGNAR (AGRUPADAS POR CATEGORÍA) ====== */}
      {categoriasAgrupadas.length > 0 && (
        <View style={styles.card}>
          <View style={styles.compromisoHeader}>
            <Text style={styles.cardTitulo}>Transacciones sin asignar</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.btnAutoAsignar}
                onPress={handleAutoAsignarPreview}
                disabled={autoAsignando}
                activeOpacity={0.7}
              >
                {autoAsignando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={14} color="#fff" />
                    <Text style={styles.btnAutoAsignarTexto}>Auto</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={[styles.progresoBadge, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.progresoBadgeTexto, { color: Colors.error }]}>{totalSinAsignar}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.sinAsignarSub}>
            Agrupadas por categoría. Toca una categoría para expandir.
          </Text>

          {categoriasAgrupadas.map((cat) => (
            <View key={cat.nombre} style={styles.catGroup}>
              <TouchableOpacity
                style={styles.catHeader}
                onPress={() => setExpandedCat(expandedCat === cat.nombre ? null : cat.nombre)}
                activeOpacity={0.7}
              >
                <View style={[styles.catIcono, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={cat.icono || 'ellipsis-horizontal'} size={18} color={cat.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.catNombre}>{cat.nombre}</Text>
                  <Text style={styles.catDetalle}>{cat.cantidad} transaccion{cat.cantidad !== 1 ? 'es' : ''}</Text>
                </View>
                <Text style={styles.catTotal}>{formatearMoneda(cat.total)}</Text>
                {cat.obligacionesSugeridas?.length === 1 && (
                  <View style={styles.catSugerencia}>
                    <Ionicons name="link" size={12} color={Colors.primario} />
                  </View>
                )}
                <Ionicons
                  name={expandedCat === cat.nombre ? 'chevron-up' : 'chevron-down'}
                  size={18} color={Colors.textoSecundario}
                />
              </TouchableOpacity>

              {expandedCat === cat.nombre && (
                <View style={styles.catExpanded}>
                  {cat.obligacionesSugeridas?.length > 0 && (
                    <View style={styles.sugerenciaBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sugerenciaLabel}>Sugerencia:</Text>
                        {cat.obligacionesSugeridas.map(ob => (
                          <Text key={ob._id} style={styles.sugerenciaNombre}>
                            {ob.nombre} ({formatearMoneda(ob.monto)}/mes)
                          </Text>
                        ))}
                      </View>
                      {cat.obligacionesSugeridas.length === 1 && (
                        <TouchableOpacity
                          style={styles.btnAsignarTodos}
                          onPress={() => handleAsignarTodosCategoria(cat)}
                          disabled={asignando}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.btnAsignarTodosTexto}>
                            {asignando ? '...' : 'Asignar todos'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {Object.values(
                    cat.movimientos.reduce((acc, mov) => {
                      const key = (mov.description || 'Sin descripción').trim();
                      if (!acc[key]) acc[key] = { description: key, ids: [mov._id], totalAmount: mov.amount, lastDate: mov.postDate || mov.transactionDate };
                      else {
                        acc[key].ids.push(mov._id);
                        acc[key].totalAmount += mov.amount;
                        if (mov.postDate && new Date(mov.postDate) > new Date(acc[key].lastDate)) acc[key].lastDate = mov.postDate;
                      }
                      return acc;
                    }, {})
                  ).map((grupo) => (
                    <TouchableOpacity
                      key={grupo.description}
                      style={styles.movItem}
                      onPress={() => handleAbrirAsignacion(grupo)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.movDescripcion} numberOfLines={1}>
                            {grupo.description}
                          </Text>
                          {grupo.ids.length > 1 && (
                            <View style={{ backgroundColor: '#eeeef8', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6c6fa3' }}>×{grupo.ids.length}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.movFecha}>
                          {formatearFecha(grupo.lastDate)}
                        </Text>
                      </View>
                      <Text style={styles.movMonto}>{formatearMoneda(Math.abs(grupo.totalAmount))}</Text>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textoSecundario} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ====== BANNER: FinviApp procesando transacciones ====== */}
      <BannerProcesando />

      <View style={{ height: 100 }} />

      {/* ====== MODAL DE ASIGNACIÓN ====== */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Asignar transacción</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.texto} />
              </TouchableOpacity>
            </View>

            {movimientoSeleccionado && (
              <View style={styles.modalMovInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.modalMovDesc} numberOfLines={2}>
                    {movimientoSeleccionado.description || 'Sin descripción'}
                  </Text>
                  {movimientoSeleccionado.ids?.length > 1 && (
                    <View style={{ backgroundColor: '#eeeef8', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#6c6fa3' }}>×{movimientoSeleccionado.ids.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalMovMonto}>
                  {formatearMoneda(Math.abs(movimientoSeleccionado.totalAmount))}
                </Text>
              </View>
            )}

            <Text style={styles.modalSubtitulo}>Selecciona la obligación:</Text>

            {asignando && (
              <ActivityIndicator size="small" color={Colors.primario} style={{ marginVertical: 12 }} />
            )}

            <FlatList
              data={obligacionesLista}
              keyExtractor={(item) => `${item.tipo}_${item._id}`}
              style={styles.modalLista}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.obligacionOpcion}
                  onPress={() => handleAsignar(item)}
                  disabled={asignando}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.tipo === 'costoFijo' ? 'receipt-outline' : 'trending-down-outline'}
                    size={20}
                    color={item.tipo === 'costoFijo' ? Colors.secundario : Colors.peligro}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.opcionNombre}>{item.nombre}</Text>
                    <Text style={styles.opcionDetalle}>
                      {item.tipo === 'costoFijo' ? 'Costo fijo' : 'Deuda'} · {formatearMoneda(item.monto)}/mes
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.primario} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay obligaciones registradas</Text>
              }
            />
          </View>
        </View>
      </Modal>
      {/* ====== MODAL AUTO-ASIGNAR PREVIEW ====== */}
      <Modal
        visible={modalAutoAsignar}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAutoAsignar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Auto-asignar</Text>
              <TouchableOpacity onPress={() => setModalAutoAsignar(false)}>
                <Ionicons name="close" size={24} color={Colors.texto} />
              </TouchableOpacity>
            </View>

            {previewAutoAsignar && (
              <View>
                <View style={styles.previewResumen}>
                  <View style={styles.previewItem}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.exito} />
                    <Text style={styles.previewNum}>{previewAutoAsignar.asignables}</Text>
                    <Text style={styles.previewLabel}>asignables</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Ionicons name="help-circle" size={20} color={Colors.advertencia} />
                    <Text style={styles.previewNum}>{previewAutoAsignar.requierenRevision?.length || 0}</Text>
                    <Text style={styles.previewLabel}>revisión manual</Text>
                  </View>
                </View>

                {previewAutoAsignar.asignaciones?.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.modalSubtitulo}>Se asignarán:</Text>
                    <ScrollView style={{ maxHeight: 200 }}>
                      {previewAutoAsignar.asignaciones.map((a) => (
                        <View key={a.movimientoId} style={styles.previewRow}>
                          <Text style={styles.previewDesc} numberOfLines={1}>{a.description}</Text>
                          <Ionicons name="arrow-forward" size={14} color={Colors.textoSecundario} />
                          <Text style={styles.previewOblig} numberOfLines={1}>{a.obligacion.nombre}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {previewAutoAsignar.asignables > 0 && (
                  <TouchableOpacity
                    style={styles.btnConfirmarAuto}
                    onPress={handleAutoAsignarConfirmar}
                    disabled={autoAsignando}
                    activeOpacity={0.7}
                  >
                    {autoAsignando ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.btnConfirmarAutoTexto}>
                        Confirmar ({previewAutoAsignar.asignables} movimientos)
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {previewAutoAsignar.asignables === 0 && (
                  <Text style={styles.emptyText}>No se encontraron asignaciones automáticas posibles</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  saludo: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.texto },
  subtitulo: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 2 },
  syncIndicador: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 1, opacity: 0.7 },
  syncMsgOk: { fontSize: FontSize.xs, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  syncMsgError: { fontSize: FontSize.xs, color: '#dc2626', fontWeight: '600', marginTop: 2 },
  logoutBtn: { padding: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm, padding: Spacing.md,
    boxShadow: '0px 4px 14px rgba(0, 0, 0, 0.10)', elevation: 5,
  },
  cardTitulo: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto, marginBottom: 8 },
  saludContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  saludTexto: { position: 'absolute', alignItems: 'center' },
  saludPuntaje: { fontSize: 22, fontWeight: '800' },
  saludNivel: { fontSize: 9, color: Colors.textoSecundario, fontWeight: '600' },
  resumenGrid: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.sm, gap: 8,
  },
  gridItem: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, paddingVertical: 10, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(0, 0, 0, 0.09)', elevation: 4,
  },
  gridLabel: { fontSize: 10, color: Colors.textoSecundario, marginTop: 4, textAlign: 'center' },
  gridValor: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto, marginTop: 2, textAlign: 'center' },
  creditoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  creditoLabel: { fontSize: FontSize.md, color: Colors.textoSecundario },
  creditoValor: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto },

  // --- Compromisos del mes ---
  compromisoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  progresoBadge: {
    backgroundColor: '#eef2ff', borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  progresoBadgeTexto: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primario },
  barraFondo: {
    height: 8, backgroundColor: Colors.borde, borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  barraFondoSmall: {
    height: 5, backgroundColor: Colors.borde, borderRadius: 3, overflow: 'hidden', marginTop: 4, flex: 1,
  },
  barraProgreso: { height: '100%', borderRadius: 4 },
  progresoResumen: { fontSize: FontSize.xs, color: Colors.textoSecundario, textAlign: 'right', marginBottom: 12 },
  obligacionItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  obligacionInfo: { flex: 1, marginRight: 12 },
  obligacionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  obligacionNombre: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto, flex: 1 },
  obligacionMontos: { alignItems: 'flex-end' },
  obligacionPagado: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto },
  obligacionObjetivo: { fontSize: FontSize.xs, color: Colors.textoSecundario },

  // --- Transacciones sin asignar ---
  sinAsignarSub: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginBottom: 10 },
  movItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  movDescripcion: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto },
  movFecha: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  movMonto: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.error, marginRight: 6 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textoSecundario, textAlign: 'center', paddingVertical: 16 },

  // --- Categorías agrupadas ---
  catGroup: {
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  catHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
  },
  catIcono: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  catNombre: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto },
  catDetalle: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 1 },
  catTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.error, marginRight: 6 },
  catSugerencia: {
    backgroundColor: '#eef2ff', borderRadius: 10, padding: 4, marginRight: 4,
  },
  catExpanded: {
    paddingLeft: 46, paddingBottom: 8,
  },
  sugerenciaBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff',
    borderRadius: BorderRadius.md, padding: 10, marginBottom: 8,
  },
  sugerenciaLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  sugerenciaNombre: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primario },
  btnAsignarTodos: {
    backgroundColor: Colors.primario, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8,
  },
  btnAsignarTodosTexto: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  btnAutoAsignar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primario, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  btnAutoAsignarTexto: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },

  // --- Modal auto-asignar ---
  previewResumen: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.fondo, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 12,
  },
  previewItem: { alignItems: 'center', gap: 4 },
  previewNum: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.texto },
  previewLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  previewDesc: { flex: 1, fontSize: FontSize.xs, color: Colors.texto },
  previewOblig: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', color: Colors.primario },
  btnConfirmarAuto: {
    backgroundColor: Colors.exito, borderRadius: BorderRadius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: 16,
  },
  btnConfirmarAutoTexto: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // --- Modal de asignación ---
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto },
  modalMovInfo: {
    backgroundColor: Colors.fondo, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalMovDesc: { fontSize: FontSize.sm, color: Colors.texto, flex: 1, marginRight: 12 },
  modalMovMonto: { fontSize: FontSize.md, fontWeight: '700', color: Colors.error },
  modalSubtitulo: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textoSecundario, marginBottom: 8 },
  modalLista: { maxHeight: 350 },
  obligacionOpcion: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borde,
  },
  opcionNombre: { fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },
  opcionDetalle: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
});
