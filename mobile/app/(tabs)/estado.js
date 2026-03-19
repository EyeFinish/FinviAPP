import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { obtenerEstadoFinanciero, resincronizarDatos, obtenerCategoriasDisponibles, categorizarMovimiento } from '../../services/api';
import { formatearMoneda, formatearFecha } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function Estado() {
  const hoy = new Date();
  const mesInicial = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const [mes, setMes] = useState(mesInicial);
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [vista, setVista] = useState('categoria');
  const [resyncLoading, setResyncLoading] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [moverItem, setMoverItem] = useState(null);
  const [catDisponibles, setCatDisponibles] = useState([]);

  const hacerResync = async () => {
    try {
      setResyncLoading(true);
      await resincronizarDatos();
      await cargarDatos();
    } catch {
      // Error silencioso, el usuario verá si los datos cambiaron
    } finally {
      setResyncLoading(false);
    }
  };

  const cargarDatos = async (mesParam) => {
    try {
      const res = await obtenerEstadoFinanciero(mesParam || mes);
      setEstado(res.data);
    } catch {
      setEstado(null);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(useCallback(() => { cargarDatos(); }, [mes]));

  const abrirMover = async (descripcion) => {
    try {
      const res = await obtenerCategoriasDisponibles();
      setCatDisponibles((res.data || res).filter(c => c.nombre !== 'Otros'));
      setMoverItem({ descripcion });
    } catch { /* silencioso */ }
  };

  const confirmarMover = async (categoria) => {
    if (!moverItem) return;
    try {
      await categorizarMovimiento(moverItem.descripcion, categoria);
      setMoverItem(null);
      await cargarDatos();
    } catch { /* silencioso */ }
  };

  const cambiarMes = (delta) => {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    const nuevoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setMes(nuevoMes);
    setCargando(true);
    cargarDatos(nuevoMes);
  };

  const esMesActual = mes === mesInicial;

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primario} />
      </View>
    );
  }

  if (!estado) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.borde} />
        <Text style={styles.emptyText}>Error al cargar datos</Text>
      </View>
    );
  }

  const { resumen, categorias, porTipo, topGastos, topIngresos, transferenciasInternas, suscripciones } = estado;
  const ingresosCateg = categorias.filter((c) => c.tipo === 'ingreso');
  const gastosCateg = categorias.filter((c) => c.tipo === 'gasto');

  const renderBarraItem = (item, colorBarra, index) => {
    const key = `${item.tipo}-${index}`;
    const abierto = expandido === key;
    return (
      <View key={item.nombre + item.tipo}>
        <TouchableOpacity
          style={styles.catItem}
          onPress={() => setExpandido(abierto ? null : key)}
          activeOpacity={0.7}
        >
          <View style={styles.catItemTop}>
            <View style={styles.catNombreRow}>
              <View style={[styles.catIcono, { backgroundColor: (item.color || colorBarra) + '18' }]}>
                <Ionicons name={item.icono || 'ellipsis-horizontal'} size={16} color={item.color || colorBarra} />
              </View>
              <Text style={styles.catNombre} numberOfLines={1}>{item.nombre}</Text>
            </View>
            <View style={styles.catMontoRow}>
              <Text style={[styles.catMonto, { color: colorBarra }]}>{formatearMoneda(item.monto)}</Text>
              <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
            </View>
          </View>
          <View style={styles.barraContainer}>
            <View style={[styles.barra, { width: `${item.porcentaje}%`, backgroundColor: colorBarra }]} />
          </View>
          <View style={styles.catItemBottom}>
            <Text style={styles.catCantidad}>{item.cantidad} mov.</Text>
            <Text style={styles.catPorcentaje}>{item.porcentaje}%</Text>
          </View>
        </TouchableOpacity>
        {abierto && item.movimientos && (
          <View style={styles.detalleContainer}>
            {item.movimientos.map((m, j) => (
              <View key={j} style={styles.detalleItem}>
                <View style={styles.detalleInfo}>
                  <Text style={styles.detalleDesc} numberOfLines={1}>{m.descripcion}</Text>
                  <Text style={styles.detalleMeta}>{m.cantidad} {m.cantidad === 1 ? 'movimiento' : 'movimientos'}</Text>
                </View>
                <View style={styles.detalleAcciones}>
                  {item.nombre === 'Otros' && (
                    <TouchableOpacity style={styles.moverBtn} onPress={() => abrirMover(m.descripcion)}>
                      <Ionicons name="add-circle-outline" size={16} color={Colors.primario} />
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.detalleMonto, { color: colorBarra }]}>
                    {formatearMoneda(m.monto)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => { setRefrescando(true); cargarDatos(); }}
          colors={[Colors.primario]}
        />
      }
    >
      {/* Selector de mes + resync */}
      <View style={styles.mesSelectorRow}>
        <TouchableOpacity onPress={() => cambiarMes(-1)} style={styles.mesBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.texto} />
        </TouchableOpacity>
        <Text style={styles.mesLabel}>{estado.mesLabel}</Text>
        <TouchableOpacity
          onPress={() => cambiarMes(1)}
          style={[styles.mesBtn, esMesActual && styles.mesBtnDisabled]}
          disabled={esMesActual}
        >
          <Ionicons name="chevron-forward" size={22} color={esMesActual ? Colors.borde : Colors.texto} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.resyncBtn, resyncLoading && { opacity: 0.6 }]}
        onPress={hacerResync}
        disabled={resyncLoading}
      >
        {resyncLoading ? (
          <ActivityIndicator size="small" color={Colors.primario} />
        ) : (
          <Ionicons name="refresh" size={16} color={Colors.primario} />
        )}
        <Text style={styles.resyncBtnText}>{resyncLoading ? 'Sincronizando...' : 'Re-sincronizar datos'}</Text>
      </TouchableOpacity>

      {resumen.cantidadMovimientos === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color={Colors.borde} />
          <Text style={styles.emptyText}>Sin movimientos en este periodo</Text>
        </View>
      ) : (
        <>
          {/* Resumen */}
          <View style={styles.row}>
            <View style={[styles.miniCard, { flex: 1 }]}>
              <Ionicons name="trending-up" size={22} color={Colors.exito} />
              <Text style={styles.miniLabel}>Ingresos</Text>
              <Text style={[styles.miniValor, { color: Colors.exito }]}>{formatearMoneda(resumen.totalIngresos)}</Text>
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.miniCard, { flex: 1 }]}>
              <Ionicons name="trending-down" size={22} color={Colors.error} />
              <Text style={styles.miniLabel}>Gastos</Text>
              <Text style={[styles.miniValor, { color: Colors.error }]}>{formatearMoneda(resumen.totalGastos)}</Text>
            </View>
          </View>

          <View style={styles.netoCard}>
            <View style={styles.netoRow}>
              <View>
                <Text style={styles.netoLabel}>Balance neto</Text>
                <Text style={[styles.netoMonto, { color: resumen.montoNeto >= 0 ? Colors.exito : Colors.error }]}>
                  {resumen.montoNeto >= 0 ? '+' : ''}{formatearMoneda(resumen.montoNeto)}
                </Text>
              </View>
              <View style={styles.netoAhorro}>
                <Text style={styles.netoAhorroLabel}>Tasa ahorro</Text>
                <Text style={[styles.netoAhorroValor, { color: resumen.tasaAhorro >= 0 ? Colors.exito : Colors.error }]}>
                  {resumen.tasaAhorro}%
                </Text>
              </View>
            </View>
          </View>

          {/* Banner transferencias internas */}
          {transferenciasInternas && transferenciasInternas.cantidad > 0 && (
            <View style={styles.transferBanner}>
              <Ionicons name="swap-horizontal" size={18} color="#0369a1" />
              <Text style={styles.transferText}>
                Se excluyeron <Text style={{ fontWeight: '700' }}>{transferenciasInternas.cantidad}</Text> transferencias entre tus cuentas por <Text style={{ fontWeight: '700' }}>{formatearMoneda(transferenciasInternas.monto)}</Text>
              </Text>
            </View>
          )}

          {/* Toggle vista */}
          <View style={styles.vistaToggle}>
            <TouchableOpacity
              style={[styles.vistaBtn, vista === 'categoria' && styles.vistaBtnActivo]}
              onPress={() => setVista('categoria')}
            >
              <Ionicons name="bar-chart" size={16} color={vista === 'categoria' ? Colors.primario : Colors.textoSecundario} />
              <Text style={[styles.vistaBtnText, vista === 'categoria' && styles.vistaBtnTextActivo]}>Categoría</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vistaBtn, vista === 'tipo' && styles.vistaBtnActivo]}
              onPress={() => setVista('tipo')}
            >
              <Ionicons name="list" size={16} color={vista === 'tipo' ? Colors.primario : Colors.textoSecundario} />
              <Text style={[styles.vistaBtnText, vista === 'tipo' && styles.vistaBtnTextActivo]}>Tipo</Text>
            </TouchableOpacity>
          </View>

          {/* Vista categoría */}
          {vista === 'categoria' && (
            <>
              {ingresosCateg.length > 0 && (
                <View style={styles.grupoCard}>
                  <View style={styles.grupoHeader}>
                    <Text style={[styles.grupoTitulo, { color: Colors.exito }]}>Ingresos</Text>
                    <Text style={styles.grupoTotal}>{formatearMoneda(resumen.totalIngresos)}</Text>
                  </View>
                  {ingresosCateg.map((c, i) => renderBarraItem(c, Colors.exito, i))}
                </View>
              )}
              {gastosCateg.length > 0 && (
                <View style={styles.grupoCard}>
                  <View style={styles.grupoHeader}>
                    <Text style={[styles.grupoTitulo, { color: Colors.error }]}>Gastos</Text>
                    <Text style={styles.grupoTotal}>{formatearMoneda(resumen.totalGastos)}</Text>
                  </View>
                  {gastosCateg.map((c, i) => renderBarraItem(c, Colors.error, i))}
                </View>
              )}
            </>
          )}

          {/* Vista tipo */}
          {vista === 'tipo' && (
            <View style={styles.grupoCard}>
              <View style={styles.grupoHeader}>
                <Text style={styles.grupoTitulo}>Por tipo</Text>
                <Text style={styles.grupoTotal}>{resumen.cantidadMovimientos} mov.</Text>
              </View>
              {porTipo.map((t) => (
                <View key={t.tipo} style={styles.tipoItem}>
                  <View style={styles.tipoInfo}>
                    <Text style={styles.tipoNombre}>{t.tipoLabel}</Text>
                    <Text style={styles.tipoCantidad}>{t.cantidad} mov.</Text>
                  </View>
                  <View style={styles.tipoMontos}>
                    {t.montoIngresos > 0 && <Text style={[styles.tipoMonto, { color: Colors.exito }]}>+{formatearMoneda(t.montoIngresos)}</Text>}
                    {t.montoGastos > 0 && <Text style={[styles.tipoMonto, { color: Colors.error }]}>-{formatearMoneda(t.montoGastos)}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Top movimientos */}
          {/* Suscripciones detectadas */}
          {suscripciones && suscripciones.length > 0 && (
            <View style={styles.topCard}>
              <View style={styles.suscripcionesHeader}>
                <Ionicons name="refresh-circle" size={18} color="#8b5cf6" />
                <Text style={styles.topTitulo}>Suscripciones detectadas</Text>
                <View style={styles.suscripcionesBadge}>
                  <Text style={styles.suscripcionesBadgeText}>{suscripciones.length}</Text>
                </View>
              </View>
              {suscripciones.map((s, i) => (
                <View key={i} style={styles.suscripcionItem}>
                  <View style={[styles.suscripcionIcono, { backgroundColor: (s.color || '#9ca3af') + '18' }]}>
                    <Ionicons name={s.icono || 'ellipsis-horizontal'} size={18} color={s.color || '#9ca3af'} />
                  </View>
                  <View style={styles.suscripcionInfo}>
                    <Text style={styles.topDesc} numberOfLines={1}>{s.descripcion}</Text>
                  </View>
                  <Text style={[styles.topMonto, { color: Colors.error }]}>{formatearMoneda(s.monto)}</Text>
                </View>
              ))}
            </View>
          )}

          {topIngresos.length > 0 && (
            <View style={styles.topCard}>
              <Text style={styles.topTitulo}>
                <Ionicons name="trending-up" size={16} color={Colors.exito} /> Mayores ingresos
              </Text>
              {topIngresos.map((m, i) => (
                <View key={i} style={styles.topItem}>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topDesc} numberOfLines={1}>{m.descripcion}</Text>
                    <Text style={styles.topFecha}>{formatearFecha(m.fecha)} · {m.cuenta}</Text>
                  </View>
                  <Text style={[styles.topMonto, { color: Colors.exito }]}>+{formatearMoneda(m.monto)}</Text>
                </View>
              ))}
            </View>
          )}

          {topGastos.length > 0 && (
            <View style={styles.topCard}>
              <Text style={styles.topTitulo}>
                <Ionicons name="trending-down" size={16} color={Colors.error} /> Mayores gastos
              </Text>
              {topGastos.map((m, i) => (
                <View key={i} style={styles.topItem}>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topDesc} numberOfLines={1}>{m.descripcion}</Text>
                    <Text style={styles.topFecha}>{formatearFecha(m.fecha)} · {m.cuenta}</Text>
                  </View>
                  <Text style={[styles.topMonto, { color: Colors.error }]}>{formatearMoneda(m.monto)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 100 }} />

      {/* Modal seleccionar categoría */}
      <Modal visible={!!moverItem} transparent animationType="slide" onRequestClose={() => setMoverItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Mover a categoría</Text>
              <TouchableOpacity onPress={() => setMoverItem(null)}>
                <Ionicons name="close" size={22} color={Colors.texto} />
              </TouchableOpacity>
            </View>
            {moverItem && (
              <Text style={styles.modalDesc}>
                <Text style={{ fontWeight: '700' }}>{moverItem.descripcion}</Text> se moverá y siempre se reconocerá en la categoría elegida.
              </Text>
            )}
            <ScrollView style={styles.modalLista}>
              {catDisponibles.map((cat) => (
                <TouchableOpacity key={cat.nombre} style={styles.modalCatBtn} onPress={() => confirmarMover(cat.nombre)}>
                  <View style={[styles.modalCatIcono, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={cat.icono || 'ellipsis-horizontal'} size={20} color={cat.color} />
                  </View>
                  <Text style={styles.modalCatText}>{cat.nombre}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textoSecundario, marginTop: 16 },

  // Selector de mes
  mesSelectorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 16,
  },
  mesBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  mesBtnDisabled: { opacity: 0.3 },
  mesLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto, textTransform: 'capitalize', minWidth: 160, textAlign: 'center' },

  // Botón resync
  resyncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: Spacing.lg, marginTop: 4, marginBottom: Spacing.sm,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.borde, backgroundColor: '#fff',
  },
  resyncBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primario },

  // Mini cards
  row: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  miniCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md,
    alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  miniLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 6 },
  miniValor: { fontSize: FontSize.md, fontWeight: '700', marginTop: 4 },

  // Card neto
  netoCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, marginHorizontal: Spacing.lg,
    marginTop: Spacing.md, padding: Spacing.md, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  netoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netoLabel: { fontSize: FontSize.sm, color: Colors.textoSecundario },
  netoMonto: { fontSize: FontSize.xl, fontWeight: '800', marginTop: 2 },
  netoAhorro: { alignItems: 'flex-end' },
  netoAhorroLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  netoAhorroValor: { fontSize: FontSize.xl, fontWeight: '800' },

  // Toggle vista
  vistaToggle: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: '#e8eaf6', borderRadius: BorderRadius.md, padding: 4,
  },
  vistaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: BorderRadius.sm, gap: 6,
  },
  vistaBtnActivo: { backgroundColor: '#fff', elevation: 2 },
  vistaBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textoSecundario },
  vistaBtnTextActivo: { color: Colors.primario },

  // Grupo
  grupoCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg,
    marginTop: Spacing.md, padding: Spacing.md, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  grupoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borde },
  grupoTitulo: { fontSize: FontSize.md, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  grupoTotal: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto },

  // Cat item
  catItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  catItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  catNombreRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  catIcono: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  catNombre: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto, flex: 1 },
  catMonto: { fontSize: FontSize.sm, fontWeight: '700' },
  catMontoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barraContainer: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3, minWidth: 3 },
  catItemBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  catCantidad: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  catPorcentaje: { fontSize: FontSize.xs, color: Colors.textoSecundario },

  // Detalle expandido
  detalleContainer: {
    backgroundColor: '#f9fafb', borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8,
  },
  detalleItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  detalleInfo: { flex: 1, marginRight: 12 },
  detalleDesc: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.texto },
  detalleMeta: { fontSize: 11, color: Colors.textoSecundario, marginTop: 2 },
  detalleMonto: { fontSize: FontSize.xs, fontWeight: '700' },

  // Tipo item
  tipoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  tipoInfo: { flex: 1 },
  tipoNombre: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto },
  tipoCantidad: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  tipoMontos: { flexDirection: 'row', gap: 12 },
  tipoMonto: { fontSize: FontSize.sm, fontWeight: '700' },

  // Top movimientos
  topCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg,
    marginTop: Spacing.md, padding: Spacing.md, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  topTitulo: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto, marginBottom: 12 },
  topItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  topItemInfo: { flex: 1, marginRight: 12 },
  topDesc: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto },
  topFecha: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  topMonto: { fontSize: FontSize.sm, fontWeight: '700' },

  // Transfer banner
  transferBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#f0f9ff', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#bae6fd',
  },
  transferText: { flex: 1, fontSize: FontSize.xs, color: '#0369a1' },

  // Suscripciones
  suscripcionesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borde },
  suscripcionesBadge: { backgroundColor: '#8b5cf6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  suscripcionesBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  suscripcionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suscripcionIcono: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  suscripcionInfo: { flex: 1 },

  // Move button & acciones
  detalleAcciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moverBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.primario + '12',
    justifyContent: 'center', alignItems: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto },
  modalDesc: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginBottom: 16 },
  modalLista: { maxHeight: 400 },
  modalCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  modalCatIcono: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalCatText: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },
});
