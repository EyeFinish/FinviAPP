import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { obtenerCreditos, obtenerResumenCreditos, obtenerPagosDetectados, obtenerTransaccionesCredito } from '../../services/api';
import { formatearMoneda, formatearFecha, traducirTipoCredito, traducirEstadoCredito } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const TIPOS_ROTATIVOS = ['tarjeta_credito', 'linea_credito'];

export default function Creditos() {
  const [creditos, setCreditos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ultimosPagos, setUltimosPagos] = useState({});
  const [txsExpandidas, setTxsExpandidas] = useState({});
  const [transacciones, setTransacciones] = useState({});

  const cargarDatos = async () => {
    try {
      const [resCred, resResumen] = await Promise.all([
        obtenerCreditos(),
        obtenerResumenCreditos(),
      ]);
      setCreditos(resCred.data || []);
      setResumen(resResumen.data);

      const creditosActivos = (resCred.data || []).filter((c) => ['activo', 'moroso'].includes(c.estado));
      const pagosMap = {};
      await Promise.all(creditosActivos.map(async (c) => {
        try {
          const res = await obtenerPagosDetectados(c._id);
          if (res.data?.length > 0) {
            pagosMap[c._id] = res.data[0];
          }
        } catch { /* silenciar */ }
      }));
      setUltimosPagos(pagosMap);
    } catch {
      setCreditos([]);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(useCallback(() => { cargarDatos(); }, []));

  const toggleTransacciones = async (creditoId) => {
    if (txsExpandidas[creditoId]) {
      setTxsExpandidas((prev) => ({ ...prev, [creditoId]: false }));
      return;
    }
    setTxsExpandidas((prev) => ({ ...prev, [creditoId]: true }));
    if (!transacciones[creditoId]) {
      try {
        const res = await obtenerTransaccionesCredito(creditoId);
        const data = res.data;
        // Nuevo formato: { movimientos, resumen }
        if (data && data.movimientos) {
          setTransacciones((prev) => ({ ...prev, [creditoId]: data.movimientos }));
        } else {
          setTransacciones((prev) => ({ ...prev, [creditoId]: data || [] }));
        }
      } catch {
        setTransacciones((prev) => ({ ...prev, [creditoId]: [] }));
      }
    }
  };

  const renderResumen = () => {
    if (!resumen) return null;
    return (
      <View style={styles.resumenContainer}>
        <View style={styles.resumenRow}>
          <View style={[styles.resumenCard, { flex: 1 }]}>
            <Ionicons name="trending-down" size={22} color={Colors.error} />
            <Text style={styles.resumenLabel}>Deuda Total</Text>
            <Text style={[styles.resumenValor, { color: Colors.error }]}>
              {formatearMoneda(resumen.totalDeuda)}
            </Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.resumenCard, { flex: 1 }]}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.exito} />
            <Text style={styles.resumenLabel}>Pagado</Text>
            <Text style={[styles.resumenValor, { color: Colors.exito }]}>
              {formatearMoneda(resumen.totalPagadoGlobal)}
            </Text>
          </View>
        </View>
        <View style={[styles.resumenRow, { marginTop: 10 }]}>
          <View style={[styles.resumenCard, { flex: 1 }]}>
            <Ionicons name="cash" size={22} color={Colors.advertencia} />
            <Text style={styles.resumenLabel}>Total a Pagar</Text>
            <Text style={styles.resumenValor}>{formatearMoneda(resumen.totalAPagarGlobal)}</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.resumenCard, { flex: 1 }]}>
            <Ionicons name="calendar" size={22} color={Colors.secundario} />
            <Text style={styles.resumenLabel}>Cuota/Mes</Text>
            <Text style={styles.resumenValor}>{formatearMoneda(resumen.cuotaMensualTotal)}</Text>
          </View>
        </View>
        {/* Resumen rotativos */}
        {resumen.cantidadRotativos > 0 && (
          <View style={[styles.resumenRow, { marginTop: 10 }]}>
            <View style={[styles.resumenCard, { flex: 1 }]}>
              <Ionicons name="card" size={22} color={Colors.primario} />
              <Text style={styles.resumenLabel}>Cupo Rotativos</Text>
              <Text style={styles.resumenValor}>{formatearMoneda(resumen.cupoTotalRotativos)}</Text>
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.resumenCard, { flex: 1 }]}>
              <Ionicons name="pie-chart" size={22} color={resumen.utilizacionRotativos > 80 ? Colors.error : resumen.utilizacionRotativos > 50 ? Colors.advertencia : Colors.exito} />
              <Text style={styles.resumenLabel}>Utilización</Text>
              <Text style={styles.resumenValor}>{resumen.utilizacionRotativos}%</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const estadoColor = (estado) => {
    if (estado === 'activo') return Colors.exito;
    if (estado === 'moroso') return Colors.error;
    if (estado === 'pagado') return Colors.secundario;
    return Colors.textoSecundario;
  };

  const renderCreditoRotativo = (item) => {
    const esLineaCredito = item.tipoCredito === 'linea_credito';
    const cupo = item.montoOriginal || 0;
    const deuda = item.saldoPendiente || 0;
    const disponible = Math.max(cupo - deuda, 0);
    const utilizacion = cupo > 0 ? Math.round((deuda / cupo) * 100) : 0;
    const colorUtil = utilizacion > 80 ? Colors.error : utilizacion > 50 ? Colors.advertencia : Colors.exito;
    const txs = transacciones[item._id] || [];
    const expandido = txsExpandidas[item._id];

    return (
      <View style={styles.creditoCard}>
        <View style={styles.creditoHeader}>
          <View style={styles.creditoTitulo}>
            <Text style={styles.creditoNombre} numberOfLines={1}>{item.nombre}</Text>
            <View style={[styles.estadoBadge, { backgroundColor: estadoColor(item.estado) + '20' }]}>
              <Text style={[styles.estadoTexto, { color: estadoColor(item.estado) }]}>
                {traducirEstadoCredito(item.estado)}
              </Text>
            </View>
          </View>
          <Text style={styles.creditoInstitucion}>
            {item.institucion} • {traducirTipoCredito(item.tipoCredito)}
          </Text>
        </View>

        {/* Barra de utilización */}
        <View style={styles.progresoContainer}>
          <View style={styles.progresoBar}>
            <View style={[styles.progresoFill, { width: `${Math.min(utilizacion, 100)}%`, backgroundColor: colorUtil }]} />
          </View>
          <Text style={[styles.progresoTexto, { color: colorUtil }]}>{utilizacion}%</Text>
        </View>

        <View style={styles.creditoDetalles}>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Cupo</Text>
            <Text style={styles.detalleValor}>{formatearMoneda(cupo)}</Text>
          </View>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Usado</Text>
            <Text style={[styles.detalleValor, { color: Colors.error }]}>{formatearMoneda(deuda)}</Text>
          </View>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Disponible</Text>
            <Text style={[styles.detalleValor, { color: Colors.exito }]}>{formatearMoneda(disponible)}</Text>
          </View>
        </View>

        {item.tasaInteres > 0 && (
          <View style={styles.creditoFechas}>
            <Text style={styles.fechaTexto}>Tasa: {item.tasaInteres}% anual</Text>
          </View>
        )}

        {/* Transacciones — líneas de crédito siempre pueden ver */}
        {(esLineaCredito || item.fintocAccountId) && (
          <View style={styles.txsContainer}>
            <TouchableOpacity onPress={() => toggleTransacciones(item._id)} style={styles.txsToggle}>
              <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primario} />
              <Text style={styles.txsToggleTexto}>{expandido ? 'Ocultar transacciones' : 'Ver transacciones'}</Text>
            </TouchableOpacity>
            {expandido && (
              <View style={styles.txsLista}>
                {txs.length === 0 ? (
                  <Text style={styles.txsVacio}>Sin transacciones de línea de crédito</Text>
                ) : (
                  txs.slice(0, 10).map((tx) => (
                    <View key={tx._id} style={styles.txItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txDesc} numberOfLines={1}>{tx.description || 'Sin descripción'}</Text>
                        <Text style={styles.txFecha}>{formatearFecha(tx.postDate)}</Text>
                      </View>
                      <Text style={[styles.txMonto, tx.amount < 0 ? { color: Colors.error } : { color: Colors.exito }]}>
                        {tx.amount > 0 ? '+' : ''}{formatearMoneda(Math.abs(tx.amount))}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderCreditoCuotas = (item) => {
    const progreso = item.cuotasTotales > 0
      ? Math.round((item.cuotasPagadas / item.cuotasTotales) * 100) : 0;

    return (
      <View style={styles.creditoCard}>
        <View style={styles.creditoHeader}>
          <View style={styles.creditoTitulo}>
            <Text style={styles.creditoNombre} numberOfLines={1}>{item.nombre}</Text>
            <View style={[styles.estadoBadge, { backgroundColor: estadoColor(item.estado) + '20' }]}>
              <Text style={[styles.estadoTexto, { color: estadoColor(item.estado) }]}>
                {traducirEstadoCredito(item.estado)}
              </Text>
            </View>
          </View>
          <Text style={styles.creditoInstitucion}>
            {item.institucion} • {traducirTipoCredito(item.tipoCredito)}
          </Text>
        </View>

        <View style={styles.progresoContainer}>
          <View style={styles.progresoBar}>
            <View style={[styles.progresoFill, { width: `${progreso}%`, backgroundColor: estadoColor(item.estado) }]} />
          </View>
          <Text style={styles.progresoTexto}>{progreso}%</Text>
        </View>

        <View style={styles.creditoDetalles}>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Saldo</Text>
            <Text style={styles.detalleValor}>{formatearMoneda(item.saldoPendiente)}</Text>
          </View>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Cuota</Text>
            <Text style={styles.detalleValor}>{formatearMoneda(item.cuotaMensual)}</Text>
          </View>
          <View style={styles.detalleItem}>
            <Text style={styles.detalleLabel}>Cuotas</Text>
            <Text style={styles.detalleValor}>{item.cuotasPagadas}/{item.cuotasTotales}</Text>
          </View>
        </View>

        <View style={styles.creditoFechas}>
          <Text style={styles.fechaTexto}>Inicio: {formatearFecha(item.fechaInicio)}</Text>
          {item.fechaVencimiento && (
            <Text style={styles.fechaTexto}>Vence: {formatearFecha(item.fechaVencimiento)}</Text>
          )}
        </View>

        {ultimosPagos[item._id] && (
          <View style={styles.pagoDetectado}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.exito} />
            <Text style={styles.pagoDetectadoTexto}>
              Último pago detectado: {formatearFecha(ultimosPagos[item._id].postDate)} · {formatearMoneda(Math.abs(ultimosPagos[item._id].amount))}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCredito = ({ item }) => {
    const esRotativo = TIPOS_ROTATIVOS.includes(item.tipoCredito);
    return esRotativo ? renderCreditoRotativo(item) : renderCreditoCuotas(item);
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
      <FlatList
        data={creditos}
        keyExtractor={(item) => item._id}
        renderItem={renderCredito}
        ListHeaderComponent={renderResumen}
        contentContainerStyle={{ padding: Spacing.lg }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color={Colors.borde} />
            <Text style={styles.emptyText}>No hay créditos registrados</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargarDatos(); }} colors={[Colors.primario]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textoSecundario, marginTop: 16 },
  resumenContainer: { marginBottom: Spacing.md },
  resumenRow: { flexDirection: 'row' },
  resumenCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  resumenLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 4 },
  resumenValor: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto, marginTop: 2 },
  creditoCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  creditoHeader: { marginBottom: 10 },
  creditoTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditoNombre: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto, flex: 1 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  estadoTexto: { fontSize: FontSize.xs, fontWeight: '700' },
  creditoInstitucion: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  progresoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progresoBar: {
    flex: 1, height: 8, backgroundColor: Colors.borde, borderRadius: 4, overflow: 'hidden', marginRight: 8,
  },
  progresoFill: { height: '100%', borderRadius: 4 },
  progresoTexto: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textoSecundario, width: 36, textAlign: 'right' },
  creditoDetalles: { flexDirection: 'row', justifyContent: 'space-between' },
  detalleItem: { alignItems: 'center', flex: 1 },
  detalleLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  detalleValor: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto, marginTop: 2 },
  creditoFechas: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borde,
  },
  fechaTexto: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  pagoDetectado: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: '#ecfdf5', padding: 8, borderRadius: 6,
  },
  pagoDetectadoTexto: { fontSize: FontSize.xs, color: '#065f46', fontWeight: '500' },
  txsContainer: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borde, paddingTop: 8 },
  txsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txsToggleTexto: { fontSize: FontSize.xs, color: Colors.primario, fontWeight: '600' },
  txsLista: { marginTop: 8 },
  txsVacio: { fontSize: FontSize.xs, color: Colors.textoSecundario, fontStyle: 'italic' },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borde + '40' },
  txDesc: { fontSize: FontSize.xs, color: Colors.texto, fontWeight: '500' },
  txFecha: { fontSize: 10, color: Colors.textoSecundario, marginTop: 1 },
  txMonto: { fontSize: FontSize.sm, fontWeight: '700' },
});
