import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import {
  obtenerCuentas,
  obtenerProgresoMensual, obtenerMovimientosSinAsignar,
  asignarMovimiento, desasignarMovimiento,
  obtenerCostosFijos, obtenerDeudas,
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

export default function Dashboard() {
  const { user } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Estado para compromisos mensuales
  const [progreso, setProgreso] = useState(null);
  const [sinAsignar, setSinAsignar] = useState([]);
  const [obligacionesLista, setObligacionesLista] = useState([]);

  // Totales combinados (créditos + obligaciones)
  const [resumenOblig, setResumenOblig] = useState({ totalDeuda: 0, compromisoMensual: 0 });

  // Modal de asignación
  const [modalVisible, setModalVisible] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);
  const [asignando, setAsignando] = useState(false);

  const mesActual = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  };

  const cargarDatos = async () => {
    try {
      const mes = mesActual();
      const [resCuentas, resProgreso, resSinAsignar, resCostos, resDeudas] = await Promise.all([
        obtenerCuentas().catch(() => ({ data: [] })),
        obtenerProgresoMensual(mes).catch(() => ({ data: null })),
        obtenerMovimientosSinAsignar(mes).catch(() => ({ data: [] })),
        obtenerCostosFijos().catch(() => ({ data: [] })),
        obtenerDeudas().catch(() => ({ data: [] })),
      ]);
      setCuentas(resCuentas.data || []);
      setProgreso(resProgreso.data);
      setSinAsignar(resSinAsignar.data || []);

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

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  const onRefresh = () => {
    setRefrescando(true);
    cargarDatos();
  };

  const balanceTotal = cuentas.reduce(
    (sum, c) => sum + (c.balance?.available || c.balance?.current || 0), 0
  );
  // Totales combinados: créditos (Fintoc) + obligaciones (manuales)
  const totalDeuda = resumenOblig.totalDeuda;
  const compromisoMensual = resumenOblig.compromisoMensual;
  const salud = calcularSaludFinanciera(balanceTotal, totalDeuda, compromisoMensual);

  const handleAbrirAsignacion = (movimiento) => {
    setMovimientoSeleccionado(movimiento);
    setModalVisible(true);
  };

  const handleAsignar = async (obligacion) => {
    if (!movimientoSeleccionado || asignando) return;
    setAsignando(true);
    try {
      await asignarMovimiento(movimientoSeleccionado._id, obligacion.tipo, obligacion._id);
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

      {/* ====== TRANSACCIONES SIN ASIGNAR ====== */}
      {sinAsignar.length > 0 && (
        <View style={styles.card}>
          <View style={styles.compromisoHeader}>
            <Text style={styles.cardTitulo}>Transacciones sin asignar</Text>
            <View style={[styles.progresoBadge, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.progresoBadgeTexto, { color: Colors.error }]}>{sinAsignar.length}</Text>
            </View>
          </View>
          <Text style={styles.sinAsignarSub}>
            Toca una transacción para asignarla a una obligación
          </Text>

          {sinAsignar.slice(0, 10).map((mov) => (
            <TouchableOpacity
              key={mov._id}
              style={styles.movItem}
              onPress={() => handleAbrirAsignacion(mov)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.movDescripcion} numberOfLines={1}>
                  {mov.description || 'Sin descripción'}
                </Text>
                <Text style={styles.movFecha}>
                  {formatearFecha(mov.postDate)}
                </Text>
              </View>
              <Text style={styles.movMonto}>{formatearMoneda(Math.abs(mov.amount))}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textoSecundario} />
            </TouchableOpacity>
          ))}

          {sinAsignar.length > 10 && (
            <Text style={styles.emptyText}>y {sinAsignar.length - 10} más...</Text>
          )}
        </View>
      )}

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
                <Text style={styles.modalMovDesc} numberOfLines={2}>
                  {movimientoSeleccionado.description || 'Sin descripción'}
                </Text>
                <Text style={styles.modalMovMonto}>
                  {formatearMoneda(Math.abs(movimientoSeleccionado.amount))}
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
  logoutBtn: { padding: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm, padding: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
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
