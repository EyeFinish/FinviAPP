import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatearMoneda } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtMiles = (val) => val ? val.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
const soloDigitos = (text) => text.replace(/\./g, '').replace(/[^0-9]/g, '');

const CATEGORIAS_COSTO = {
  arriendo: 'Arriendo', servicios: 'Servicios', alimentacion: 'Alimentación',
  educacion: 'Educación', salud: 'Salud', seguros: 'Seguros', transporte: 'Transporte', otro: 'Otro',
};
const CATEGORIAS_INGRESO = { sueldo: 'Sueldo', renta: 'Renta', beneficio: 'Beneficio', otro: 'Otro' };
const SISTEMAS = { frances: 'Francés', aleman: 'Alemán', simple: 'Simple' };
const CATS_ARRAY = Object.keys(CATEGORIAS_COSTO);
const CATS_ING_ARRAY = Object.keys(CATEGORIAS_INGRESO);
const TIPO_COMPROMISO = ['permanente', 'temporal'];

function calcularPreview({ montoTotal, tasaInteres, plazoAnios, plazoMeses, sistemaAmortizacion }) {
  const P = Number(montoTotal) || 0;
  const tasa = Number(tasaInteres) || 0;
  const n = (Number(plazoAnios) || 0) * 12 + (Number(plazoMeses) || 0);
  if (P <= 0 || n <= 0) return null;
  const r = tasa / 100 / 12;
  let cuotaMensual, interesTotal;
  if (sistemaAmortizacion === 'frances') {
    cuotaMensual = r > 0 ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
    interesTotal = cuotaMensual * n - P;
  } else if (sistemaAmortizacion === 'aleman') {
    const amort = P / n; let totInt = 0; let saldo = P;
    for (let i = 0; i < n; i++) { totInt += saldo * r; saldo -= amort; }
    interesTotal = totInt; cuotaMensual = amort + P * r;
  } else {
    interesTotal = P * (tasa / 100) * ((Number(plazoAnios) || 0) + (Number(plazoMeses) || 0) / 12);
    cuotaMensual = (P + interesTotal) / n;
  }
  return { cuotaMensual: Math.round(cuotaMensual), cuotasTotales: n, interesTotal: Math.round(interesTotal) };
}

// ── sub-forms ─────────────────────────────────────────────────────────────────

function FormIngreso({ onGuardar, onCancelar, error }) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('otro');

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del ingreso</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Sueldo, Pensión" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Monto mensual</Text>
      <TextInput style={st.formInput} value={fmtMiles(monto)} onChangeText={(t) => setMonto(soloDigitos(t))} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Categoría</Text>
      <View style={st.formToggleRow}>
        {CATS_ING_ARRAY.map((c) => (
          <TouchableOpacity key={c} style={[st.formToggle, categoria === c && st.formToggleActivo]} onPress={() => setCategoria(c)}>
            <Text style={[st.formToggleText, categoria === c && st.formToggleTextActivo]}>{CATEGORIAS_INGRESO[c]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}>
          <Text style={st.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.btnPrimario} onPress={() => onGuardar({ nombre, monto: Number(monto), categoria })}>
          <Text style={st.btnPrimarioText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormCosto({ onGuardar, onCancelar, error }) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('arriendo');
  const [tipoCompromiso, setTipoCompromiso] = useState('permanente');
  const [duracion, setDuracion] = useState('');

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del costo</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Arriendo, Luz" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Monto mensual</Text>
      <TextInput style={st.formInput} value={fmtMiles(monto)} onChangeText={(t) => setMonto(soloDigitos(t))} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.formScrollRow}>
        {CATS_ARRAY.map((c) => (
          <TouchableOpacity key={c} style={[st.formToggle, categoria === c && st.formToggleActivo]} onPress={() => setCategoria(c)}>
            <Text style={[st.formToggleText, categoria === c && st.formToggleTextActivo]}>{CATEGORIAS_COSTO[c]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={st.formLabel}>Tipo de compromiso</Text>
      <View style={st.formToggleRow}>
        {TIPO_COMPROMISO.map((t) => (
          <TouchableOpacity key={t} style={[st.formToggle, tipoCompromiso === t && st.formToggleActivo]} onPress={() => setTipoCompromiso(t)}>
            <Text style={[st.formToggleText, tipoCompromiso === t && st.formToggleTextActivo]}>{t === 'permanente' ? 'Permanente' : 'Temporal'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tipoCompromiso === 'temporal' && (
        <>
          <Text style={st.formLabel}>Duración (meses)</Text>
          <TextInput style={st.formInput} value={duracion} onChangeText={setDuracion} keyboardType="numeric" placeholder="Ej: 12" placeholderTextColor="#aaa" />
        </>
      )}
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}>
          <Text style={st.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.btnPrimario} onPress={() => {
          const datos = { nombre, monto: Number(monto), categoria, tipoCompromiso };
          if (tipoCompromiso === 'temporal') datos.duracion = Number(duracion);
          onGuardar(datos);
        }}>
          <Text style={st.btnPrimarioText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormDeuda({ onGuardar, onCancelar, error }) {
  const [nombre, setNombre] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [tasaInteres, setTasaInteres] = useState('');
  const [plazoAnios, setPlazoAnios] = useState('0');
  const [plazoMeses, setPlazoMeses] = useState('0');
  const [sistemaAmortizacion, setSistemaAmortizacion] = useState('frances');
  const [cuotasPagadas, setCuotasPagadas] = useState('0');

  const preview = calcularPreview({ montoTotal, tasaInteres, plazoAnios, plazoMeses, sistemaAmortizacion });

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del crédito o institución</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Banco Estado" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Monto total del crédito</Text>
      <TextInput style={st.formInput} value={fmtMiles(montoTotal)} onChangeText={(t) => setMontoTotal(soloDigitos(t))} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
      <Text style={st.formLabel}>Tasa de interés anual (%)</Text>
      <TextInput style={st.formInput} value={tasaInteres} onChangeText={setTasaInteres} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
      <View style={st.formRow}>
        <View style={st.formCol}>
          <Text style={st.formLabel}>Plazo - Años</Text>
          <TextInput style={st.formInput} value={plazoAnios} onChangeText={setPlazoAnios} keyboardType="numeric" />
        </View>
        <View style={st.formCol}>
          <Text style={st.formLabel}>Plazo - Meses</Text>
          <TextInput style={st.formInput} value={plazoMeses} onChangeText={setPlazoMeses} keyboardType="numeric" />
        </View>
      </View>
      <Text style={st.formLabel}>Sistema de amortización</Text>
      <View style={st.formToggleRow}>
        {Object.entries(SISTEMAS).map(([k, v]) => (
          <TouchableOpacity key={k} style={[st.formToggle, sistemaAmortizacion === k && st.formToggleActivo]} onPress={() => setSistemaAmortizacion(k)}>
            <Text style={[st.formToggleText, sistemaAmortizacion === k && st.formToggleTextActivo]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={st.formLabel}>Cuotas ya pagadas</Text>
      <TextInput style={st.formInput} value={cuotasPagadas} onChangeText={setCuotasPagadas} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
      {preview && (
        <View style={st.previewBox}>
          <Text style={st.previewTitle}>Cálculo automático</Text>
          <View style={st.previewRow}>
            <View style={st.previewItem}>
              <Text style={st.previewLabel}>Cuota mensual</Text>
              <Text style={st.previewValue}>{formatearMoneda(preview.cuotaMensual)}</Text>
            </View>
            <View style={st.previewItem}>
              <Text style={st.previewLabel}>Total cuotas</Text>
              <Text style={st.previewValue}>{preview.cuotasTotales}</Text>
            </View>
            <View style={st.previewItem}>
              <Text style={st.previewLabel}>Interés total</Text>
              <Text style={st.previewValue}>{formatearMoneda(preview.interesTotal)}</Text>
            </View>
          </View>
        </View>
      )}
      {error ? <Text style={st.errorText}>{error}</Text> : null}
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}>
          <Text style={st.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.btnPrimario} onPress={() => onGuardar({
          nombre, montoTotal: Number(montoTotal), tasaInteres: Number(tasaInteres),
          plazoAnios: Number(plazoAnios), plazoMeses: Number(plazoMeses), sistemaAmortizacion,
          cuotasPagadas: Number(cuotasPagadas),
        })}>
          <Text style={st.btnPrimarioText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export default function FormModal({ visible, tipo, onGuardar, onCerrar, error }) {
  const titulos = {
    ingreso: 'Agregar ingreso',
    costo: 'Agregar gasto fijo',
    deuda: 'Agregar deuda',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={st.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={st.sheet}
        >
          {/* handle bar */}
          <View style={st.handle} />

          {/* header */}
          <View style={st.header}>
            <Text style={st.headerTitle}>{titulos[tipo] || ''}</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {tipo === 'ingreso' && <FormIngreso onGuardar={onGuardar} onCancelar={onCerrar} error={error} />}
            {tipo === 'costo' && <FormCosto onGuardar={onGuardar} onCancelar={onCerrar} error={error} />}
            {tipo === 'deuda' && <FormDeuda onGuardar={onGuardar} onCancelar={onCerrar} error={error} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borde,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borde,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.texto,
  },
  // ── form shared ──
  formContainer: { padding: Spacing.lg },
  formLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto, marginTop: 12, marginBottom: 6 },
  formInput: {
    borderWidth: 1, borderColor: Colors.borde, borderRadius: BorderRadius.sm,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: FontSize.md, color: Colors.texto, backgroundColor: '#fff',
  },
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  formToggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formScrollRow: { marginBottom: 4 },
  formToggle: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 6 },
  formToggleActivo: { backgroundColor: Colors.primario },
  formToggleText: { fontSize: FontSize.sm, color: Colors.textoSecundario, fontWeight: '600' },
  formToggleTextActivo: { color: '#fff' },
  formBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 8 },
  btnPrimario: { backgroundColor: Colors.primario, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.sm },
  btnPrimarioText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  btnSecundario: { backgroundColor: '#f3f4f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.sm },
  btnSecundarioText: { color: Colors.texto, fontSize: FontSize.md, fontWeight: '600' },
  // ── preview ──
  previewBox: { backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dbe4ff', borderRadius: 12, padding: 14, marginTop: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewItem: { alignItems: 'center', flex: 1 },
  previewLabel: { fontSize: 11, color: Colors.textoSecundario, marginBottom: 4 },
  previewValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.texto },
  // ── error ──
  errorText: { color: Colors.error, fontSize: FontSize.sm, marginTop: 8 },
});
