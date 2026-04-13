import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { verificarCodigo, solicitarRecuperacion } from '../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function VerifyCode() {
  const { email } = useLocalSearchParams();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const handleVerificar = async () => {
    if (codigo.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await verificarCodigo({ email, codigo });
      router.push({ pathname: '/(auth)/reset-password', params: { email, codigo } });
    } catch (err) {
      setError(err.response?.data?.message || 'Código incorrecto o expirado');
    } finally {
      setCargando(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    setError('');
    setReenviado(false);
    try {
      await solicitarRecuperacion({ email });
      setReenviado(true);
      setCodigo('');
    } catch {
      setError('No se pudo reenviar el código. Intenta nuevamente.');
    } finally {
      setReenviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../Imagenes/logografica.png')}
              style={styles.logoImg}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.volverBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.primario} />
            <Text style={styles.volverText}>Volver</Text>
          </TouchableOpacity>

          <View style={styles.iconoContainer}>
            <Ionicons name="mail-open-outline" size={48} color={Colors.primario} />
          </View>

          <Text style={styles.titulo}>Revisa tu correo</Text>
          <Text style={styles.descripcion}>
            Enviamos un código de 6 dígitos a{'\n'}
            <Text style={styles.emailTexto}>{email}</Text>
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {reenviado ? (
            <View style={styles.exitoBox}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.exito} />
              <Text style={styles.exitoText}>Código reenviado. Revisa tu correo.</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Ionicons name="keypad-outline" size={20} color={Colors.textoSecundario} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#999"
              value={codigo}
              onChangeText={(val) => setCodigo(val.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, (cargando || codigo.length !== 6) && styles.btnDisabled]}
            onPress={handleVerificar}
            disabled={cargando || codigo.length !== 6}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Verificar código</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reenviarBtn}
            onPress={handleReenviar}
            disabled={reenviando}
          >
            {reenviando ? (
              <ActivityIndicator size="small" color={Colors.primario} />
            ) : (
              <Text style={styles.reenviarText}>¿No llegó? Reenviar código</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    marginBottom: 4,
  },
  logoImg: { width: '100%', height: '100%' },
  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  volverBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  volverText: { color: Colors.primario, fontSize: FontSize.sm, fontWeight: '600' },
  iconoContainer: { alignItems: 'center', marginBottom: 16 },
  titulo: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.texto,
    textAlign: 'center',
    marginBottom: 10,
  },
  descripcion: {
    fontSize: FontSize.sm,
    color: Colors.textoSecundario,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  emailTexto: { color: Colors.primario, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  exitoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.sm,
    padding: 12,
    marginBottom: 16,
  },
  exitoText: { color: Colors.exito, fontSize: FontSize.sm, flex: 1 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borde,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.texto,
    letterSpacing: 8,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.primario,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  reenviarBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 4 },
  reenviarText: { color: Colors.primario, fontSize: FontSize.sm, fontWeight: '600' },
});
