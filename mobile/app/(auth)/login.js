import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loginUsuario } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Completa todos los campos');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const res = await loginUsuario({ email: email.trim().toLowerCase(), password });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.request) {
        setError('No se pudo conectar al servidor. Revisa tu conexión a internet.');
      } else {
        setError('Error al iniciar sesión');
      }
    } finally {
      setCargando(false);
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
            <Image source={require('../../Imagenes/logografica.png')} style={styles.logoImg} resizeMode="cover" />
          </View>
          <Text style={styles.subtitulo}>Tu salud financiera en un solo lugar</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.titulo}>Iniciar Sesión</Text>

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
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textoSecundario} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!verPassword}
            />
            <TouchableOpacity onPress={() => setVerPassword(!verPassword)} style={styles.eyeBtn}>
              <Ionicons name={verPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textoSecundario} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, cargando && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.recuperarBtn}>
            <Text style={styles.recuperarText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No tienes cuenta? </Text>
            <Link href="/(auth)/registro" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Regístrate</Text>
              </TouchableOpacity>
            </Link>
          </View>
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
  logoImg: {
    width: '100%',
    height: '100%',
  },
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
  titulo: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.texto, textAlign: 'center', marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm, padding: 12, marginBottom: 16,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa',
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.borde, marginBottom: 14, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: FontSize.md, color: Colors.texto },
  eyeBtn: { padding: 4 },
  btn: {
    backgroundColor: Colors.primario, borderRadius: BorderRadius.sm, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  recuperarBtn: { alignItems: 'center', marginTop: 14 },
  recuperarText: { color: Colors.primario, fontSize: FontSize.sm, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borde },
  dividerText: { marginHorizontal: 12, color: Colors.textoSecundario, fontSize: FontSize.sm },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textoSecundario, fontSize: FontSize.sm },
  footerLink: { color: Colors.primario, fontSize: FontSize.sm, fontWeight: '700' },
});
