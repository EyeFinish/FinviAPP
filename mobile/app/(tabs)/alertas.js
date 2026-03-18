import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { obtenerNotificaciones, marcarNotificacionLeida, registrarTokenPush } from '../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registrarPush() {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    await registrarTokenPush(token, Platform.OS);
  } catch {
    // Push notifications no disponibles en este entorno
  }
}

const iconoPorTipo = {
  pago_proximo: { name: 'calendar', color: Colors.advertencia },
  gasto_inusual: { name: 'alert-circle', color: Colors.error },
  resumen_semanal: { name: 'bar-chart', color: Colors.primario },
  salud_baja: { name: 'heart-dislike', color: Colors.error },
  general: { name: 'notifications', color: Colors.secundario },
};

export default function Alertas() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargarDatos = async () => {
    try {
      const res = await obtenerNotificaciones();
      setNotificaciones(res.data || []);
    } catch {
      // sin notificaciones aún
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(useCallback(() => {
    registrarPush();
    cargarDatos();
  }, []));

  const marcarLeida = async (id) => {
    try {
      await marcarNotificacionLeida(id);
      setNotificaciones(prev =>
        prev.map(n => n._id === id ? { ...n, leida: true } : n)
      );
    } catch {
      // silenciar
    }
  };

  const formatTiempo = (fecha) => {
    const diff = Date.now() - new Date(fecha).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const dias = Math.floor(hrs / 24);
    return `hace ${dias}d`;
  };

  const renderNotif = ({ item }) => {
    const icono = iconoPorTipo[item.tipo] || iconoPorTipo.general;
    return (
      <TouchableOpacity
        style={[styles.card, !item.leida && styles.cardNoLeida]}
        onPress={() => !item.leida && marcarLeida(item._id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: icono.color + '20' }]}>
          <Ionicons name={icono.name} size={22} color={icono.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.titulo, !item.leida && { fontWeight: '700' }]} numberOfLines={1}>
              {item.titulo}
            </Text>
            <Text style={styles.tiempo}>{formatTiempo(item.fecha)}</Text>
          </View>
          <Text style={styles.cuerpo} numberOfLines={2}>{item.cuerpo}</Text>
        </View>
        {!item.leida && <View style={styles.dot} />}
      </TouchableOpacity>
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
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item._id}
        renderItem={renderNotif}
        contentContainerStyle={notificaciones.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargarDatos(); }} colors={[Colors.primario]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.borde} />
            <Text style={styles.emptyText}>Sin notificaciones</Text>
            <Text style={styles.emptySubtext}>Las alertas de pagos y análisis aparecerán aquí</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  listContent: { padding: Spacing.lg },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center' },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textoSecundario, marginTop: 16 },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textoSecundario, marginTop: 6 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardNoLeida: { backgroundColor: Colors.primario + '08' },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  cardContent: { flex: 1, marginLeft: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: FontSize.sm, color: Colors.texto, flex: 1 },
  tiempo: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginLeft: 8 },
  cuerpo: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 4, lineHeight: 18 },
  dot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primario, marginLeft: 8,
  },
});
