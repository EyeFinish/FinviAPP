import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { actualizarPerfil, cambiarPassword, eliminarCuentaAPI } from '../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

const FAQ = [
  { q: '¿Cómo conecto mi banco?', r: 'Ve a "Cuentas" y usa la opción de conectar banco. Usamos Fintoc, una plataforma segura certificada por la CMF.' },
  { q: '¿Mis datos bancarios están seguros?', r: 'Sí. No almacenamos tus credenciales bancarias, solo la información de tus movimientos a través de Fintoc.' },
  { q: '¿Cómo se categorizan mis gastos?', r: 'Los gastos se categorizan automáticamente por el nombre del comercio. Puedes reasignar los que queden en "Otros".' },
  { q: '¿Qué es el estado financiero?', r: 'Un resumen mensual de ingresos y gastos organizados por categoría.' },
  { q: '¿Cómo registro una obligación financiera?', r: 'En "Obligaciones" puedes agregar ingresos fijos, costos fijos y deudas con su tabla de amortización.' },
];

export default function Configuracion() {
  const { user, logout, actualizarUsuario } = useAuth();
  const router = useRouter();

  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [perfilMsg, setPerfilMsg] = useState(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const [faqAbierto, setFaqAbierto] = useState(null);

  const guardarPerfil = async () => {
    setPerfilMsg(null);
    if (!nombre.trim()) return setPerfilMsg({ tipo: 'error', texto: 'El nombre es requerido' });
    if (!email.trim()) return setPerfilMsg({ tipo: 'error', texto: 'El email es requerido' });
    setGuardandoPerfil(true);
    try {
      const res = await actualizarPerfil({ nombre: nombre.trim(), email: email.trim() });
      await actualizarUsuario(res.data);
      setPerfilMsg({ tipo: 'exito', texto: 'Perfil actualizado' });
    } catch (err) {
      setPerfilMsg({ tipo: 'error', texto: err.response?.data?.message || 'Error al actualizar' });
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleCambiarPassword = async () => {
    setPasswordMsg(null);
    if (!passwordActual) return setPasswordMsg({ tipo: 'error', texto: 'Ingresa tu contraseña actual' });
    if (passwordNueva.length < 6) return setPasswordMsg({ tipo: 'error', texto: 'Mínimo 6 caracteres' });
    if (passwordNueva !== passwordConfirm) return setPasswordMsg({ tipo: 'error', texto: 'Las contraseñas no coinciden' });
    setGuardandoPassword(true);
    try {
      await cambiarPassword({ passwordActual, passwordNueva });
      setPasswordMsg({ tipo: 'exito', texto: 'Contraseña actualizada' });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirm('');
    } catch (err) {
      setPasswordMsg({ tipo: 'error', texto: err.response?.data?.message || 'Error al cambiar' });
    } finally {
      setGuardandoPassword(false);
    }
  };

  const handleEliminarCuenta = () => {
    Alert.prompt(
      'Eliminar cuenta',
      'Esta acción es permanente. Ingresa tu contraseña para confirmar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async (password) => {
            if (!password) return Alert.alert('Error', 'Debes ingresar tu contraseña');
            try {
              await eliminarCuentaAPI(password);
              await logout();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar la cuenta');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const handleEliminarAndroid = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro? Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmar eliminación',
              'Ingresa tu contraseña en el campo de "Contraseña actual" de la sección Seguridad y luego presiona aquí de nuevo para confirmar con esa contraseña.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar con contraseña actual',
                  style: 'destructive',
                  onPress: async () => {
                    if (!passwordActual) return Alert.alert('Error', 'Escribe tu contraseña en el campo "Contraseña actual" primero');
                    try {
                      await eliminarCuentaAPI(passwordActual);
                      await logout();
                    } catch (err) {
                      Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar la cuenta');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.texto} />
          </TouchableOpacity>
          <Text style={styles.titulo}>Configuración</Text>
        </View>

        {/* PERFIL */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={18} color={Colors.primario} />
            <Text style={styles.cardTitulo}>Datos personales</Text>
          </View>
          {perfilMsg && (
            <View style={[styles.msg, perfilMsg.tipo === 'exito' ? styles.msgExito : styles.msgError]}>
              <Ionicons name={perfilMsg.tipo === 'exito' ? 'checkmark-circle' : 'close-circle'} size={14} color={perfilMsg.tipo === 'exito' ? '#065f46' : '#991b1b'} />
              <Text style={[styles.msgTexto, { color: perfilMsg.tipo === 'exito' ? '#065f46' : '#991b1b' }]}>{perfilMsg.texto}</Text>
            </View>
          )}
          <Text style={styles.label}>Nombre</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Tu nombre" placeholderTextColor="#9ca3af" />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="tu@email.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={styles.btnPrimario} onPress={guardarPerfil} disabled={guardandoPerfil}>
            {guardandoPerfil ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarioTexto}>Guardar cambios</Text>}
          </TouchableOpacity>
        </View>

        {/* SEGURIDAD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.primario} />
            <Text style={styles.cardTitulo}>Cambiar contraseña</Text>
          </View>
          {passwordMsg && (
            <View style={[styles.msg, passwordMsg.tipo === 'exito' ? styles.msgExito : styles.msgError]}>
              <Ionicons name={passwordMsg.tipo === 'exito' ? 'checkmark-circle' : 'close-circle'} size={14} color={passwordMsg.tipo === 'exito' ? '#065f46' : '#991b1b'} />
              <Text style={[styles.msgTexto, { color: passwordMsg.tipo === 'exito' ? '#065f46' : '#991b1b' }]}>{passwordMsg.texto}</Text>
            </View>
          )}
          <Text style={styles.label}>Contraseña actual</Text>
          <TextInput style={styles.input} value={passwordActual} onChangeText={setPasswordActual} secureTextEntry placeholder="••••••••" placeholderTextColor="#9ca3af" />
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput style={styles.input} value={passwordNueva} onChangeText={setPasswordNueva} secureTextEntry placeholder="Mínimo 6 caracteres" placeholderTextColor="#9ca3af" />
          <Text style={styles.label}>Confirmar nueva contraseña</Text>
          <TextInput style={styles.input} value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry placeholder="Repite la nueva contraseña" placeholderTextColor="#9ca3af" />
          <TouchableOpacity style={styles.btnPrimario} onPress={handleCambiarPassword} disabled={guardandoPassword}>
            {guardandoPassword ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarioTexto}>Cambiar contraseña</Text>}
          </TouchableOpacity>
        </View>

        {/* AYUDA */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="help-circle-outline" size={18} color={Colors.primario} />
            <Text style={styles.cardTitulo}>Ayuda</Text>
          </View>
          {FAQ.map((item, i) => (
            <View key={i} style={styles.faqItem}>
              <TouchableOpacity style={styles.faqPregunta} onPress={() => setFaqAbierto(faqAbierto === i ? null : i)}>
                <Text style={styles.faqPreguntaTexto}>{item.q}</Text>
                <Ionicons name={faqAbierto === i ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
              </TouchableOpacity>
              {faqAbierto === i && <Text style={styles.faqRespuesta}>{item.r}</Text>}
            </View>
          ))}
        </View>

        {/* ZONA PELIGRO */}
        <View style={[styles.card, styles.cardPeligro]}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning-outline" size={18} color={Colors.error} />
            <Text style={[styles.cardTitulo, { color: Colors.error }]}>Zona de peligro</Text>
          </View>
          <Text style={styles.peligroDesc}>
            Eliminar tu cuenta es permanente. Se borrarán todos tus datos: cuentas, movimientos, obligaciones y configuraciones.
          </Text>
          <TouchableOpacity style={styles.btnPeligro} onPress={Platform.OS === 'ios' ? handleEliminarCuenta : handleEliminarAndroid}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.btnPeligroTexto}>Eliminar mi cuenta</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  content: { padding: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { padding: 4, marginRight: 12 },
  titulo: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.texto },

  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  cardTitulo: { fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },

  label: { fontSize: FontSize.xs, fontWeight: '500', color: '#6b7280', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: BorderRadius.sm,
    padding: 10, paddingHorizontal: 14, fontSize: FontSize.sm, color: Colors.texto,
    backgroundColor: '#fafafa',
  },

  btnPrimario: {
    backgroundColor: Colors.primario, borderRadius: BorderRadius.sm,
    paddingVertical: 11, alignItems: 'center', marginTop: 16,
  },
  btnPrimarioTexto: { color: '#fff', fontWeight: '600', fontSize: FontSize.sm },

  msg: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: BorderRadius.sm, marginBottom: 12 },
  msgExito: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  msgError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  msgTexto: { fontSize: FontSize.xs, flex: 1 },

  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  faqPregunta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  faqPreguntaTexto: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.texto, flex: 1, marginRight: 8 },
  faqRespuesta: { fontSize: FontSize.xs, color: '#6b7280', lineHeight: 20, paddingBottom: 14 },

  cardPeligro: { borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fffbfb' },
  peligroDesc: { fontSize: FontSize.xs, color: '#6b7280', lineHeight: 20, marginBottom: 14 },
  btnPeligro: {
    backgroundColor: Colors.error, borderRadius: BorderRadius.sm,
    paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  btnPeligroTexto: { color: '#fff', fontWeight: '600', fontSize: FontSize.sm },
});
