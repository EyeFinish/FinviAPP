import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { obtenerCuentas, obtenerMovimientos } from '../../services/api';
import { formatearMoneda, formatearFecha, traducirTipoCuenta, obtenerInfoBanco } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMov, setCargandoMov] = useState(false);

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
          <Text style={styles.emptySubtext}>Conecta tu banco desde la app web</Text>
        </View>
      ) : (
        <FlatList
          data={cuentas}
          keyExtractor={(item) => item.id}
          renderItem={renderCuenta}
          contentContainerStyle={{ padding: Spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargarCuentas(); }} colors={[Colors.primario]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textoSecundario, marginTop: 16 },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 6 },
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
});
