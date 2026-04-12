import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { solicitarRecuperacion } from '../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleEnviar = async () => {
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await solicitarRecuperacion({ email: email.trim().toLowerCase() });
      setExito(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el correo. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  if (exito) {
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
            <View style={styles.exitoIcono}>
              <Ionicons name="mail-open-outline" size={52} color={Colors.primario} />
            </View>
            <Text style={styles.titulo}>Revisa tu correo</Text>
            <Text style={styles.exitoTexto}>
              Si ese correo está registrado en Finvi, recibirás un enlace para restablecer tu contraseña.
              {'\n\n'}
              Revisa también tu carpeta de spam.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.btnText}>Volver al inicio de sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          <Text style={styles.subtitulo}>Tu salud financiera en un solo lugar</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.volverBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.primario} />
            <Text style={styles.volverText}>Volver</Text>
          </TouchableOpacity>

          <Text style={styles.titulo}>¿Olvidaste tu contraseña?</Text>
          <Text style={styles.descripcion}>
            Ingresa el correo de tu cuenta y te enviaremos un enlace para restablecerla.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color={Colors.textoSecundario} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, cargando && styles.btnDisabled]}
            onPress={handleEnviar}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Enviar enlace</Text>
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
  subtitulo: { fontSize: FontSize.md, color: Colors.textoSecundario, marginTop: 8 },
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
    lineHeight: 20,
  },
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
  input: { flex: 1, paddingVertical: 14, fontSize: FontSize.md, color: Colors.texto },
  btn: {
    backgroundColor: Colors.primario,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  exitoIcono: { alignItems: 'center', marginBottom: 16 },
  exitoTexto: {
    fontSize: FontSize.sm,
    color: Colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});
