import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { registrarUsuario } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function Registro() {
  const { login } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleRegistro = async () => {
    if (!nombre.trim() || !email.trim() || !password || !confirmar) {
      setError('Completa todos los campos');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const res = await registrarUsuario({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrarse');
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
          <View style={styles.logoIcon}>
            <Ionicons name="bar-chart" size={32} color="#fff" />
          </View>
          <Text style={styles.logoText}>FinviApp</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.titulo}>Crear Cuenta</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Ionicons name="person-outline" size={20} color={Colors.textoSecundario} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor="#999"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
            />
          </View>

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

          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textoSecundario} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirmar contraseña"
              placeholderTextColor="#999"
              value={confirmar}
              onChangeText={setConfirmar}
              secureTextEntry={!verPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, cargando && styles.btnDisabled]}
            onPress={handleRegistro}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Crear Cuenta</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Inicia Sesión</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primario },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoIcon: {
    width: 64, height: 64, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logoText: { fontSize: FontSize.title, fontWeight: '800', color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, padding: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  titulo: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.texto, textAlign: 'center', marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm, padding: 12, marginBottom: 16,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.fondo,
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: Colors.textoSecundario, fontSize: FontSize.sm },
  footerLink: { color: Colors.primario, fontSize: FontSize.sm, fontWeight: '700' },
});
