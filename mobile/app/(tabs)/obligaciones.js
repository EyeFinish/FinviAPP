import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Modal as RNModal, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  obtenerResumenObligaciones, obtenerIngresos, crearIngreso, actualizarIngreso, eliminarIngreso,
  obtenerCostosFijos, crearCostoFijo, actualizarCostoFijo, eliminarCostoFijo,
  obtenerDeudas, crearDeuda, actualizarDeuda, eliminarDeuda, obtenerTablaAmortizacion,
} from '../../services/api';
import { formatearMoneda } from '../../utils/formateadores';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const CATEGORIAS_COSTO = {
  arriendo: 'Arriendo', servicios: 'Servicios', alimentacion: 'Alimentación',
  educacion: 'Educación', salud: 'Salud', seguros: 'Seguros', transporte: 'Transporte', otro: 'Otro',
};
const CATEGORIAS_INGRESO = { sueldo: 'Sueldo', renta: 'Renta', beneficio: 'Beneficio', otro: 'Otro' };
const SISTEMAS = { frances: 'Francés', aleman: 'Alemán', simple: 'Simple' };
const CATS_ARRAY = Object.keys(CATEGORIAS_COSTO);
const CATS_ING_ARRAY = Object.keys(CATEGORIAS_INGRESO);
const TIPO_COMPROMISO = ['permanente', 'temporal'];

function colorNivel(nivel) {
  if (nivel === 'Bajo') return Colors.exito;
  if (nivel === 'Moderado') return Colors.advertencia;
  return Colors.error;
}

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

// ==================== FORMULARIOS ====================

function FormIngreso({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [monto, setMonto] = useState(inicial?.monto?.toString() || '');
  const [categoria, setCategoria] = useState(inicial?.categoria || 'otro');

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del ingreso</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Sueldo, Pensión" />
      <Text style={st.formLabel}>Monto mensual</Text>
      <TextInput style={st.formInput} value={monto} onChangeText={setMonto} keyboardType="numeric" placeholder="0" />
      <Text style={st.formLabel}>Categoría</Text>
      <View style={st.formToggleRow}>
        {CATS_ING_ARRAY.map((c) => (
          <TouchableOpacity key={c} style={[st.formToggle, categoria === c && st.formToggleActivo]} onPress={() => setCategoria(c)}>
            <Text style={[st.formToggleText, categoria === c && st.formToggleTextActivo]}>{CATEGORIAS_INGRESO[c]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}><Text style={st.btnSecundarioText}>Cancelar</Text></TouchableOpacity>
        <TouchableOpacity style={st.btnPrimario} onPress={() => onGuardar({ nombre, monto: Number(monto), categoria })}>
          <Text style={st.btnPrimarioText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormCosto({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [monto, setMonto] = useState(inicial?.monto?.toString() || '');
  const [categoria, setCategoria] = useState(inicial?.categoria || 'arriendo');
  const [tipoCompromiso, setTipoCompromiso] = useState(inicial?.tipoCompromiso || 'permanente');
  const [duracion, setDuracion] = useState(inicial?.duracion?.toString() || '');

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del costo</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Arriendo, Luz" />
      <Text style={st.formLabel}>Monto mensual</Text>
      <TextInput style={st.formInput} value={monto} onChangeText={setMonto} keyboardType="numeric" placeholder="0" />
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
          <TextInput style={st.formInput} value={duracion} onChangeText={setDuracion} keyboardType="numeric" placeholder="Ej: 12" />
        </>
      )}
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}><Text style={st.btnSecundarioText}>Cancelar</Text></TouchableOpacity>
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

function FormDeuda({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [montoTotal, setMontoTotal] = useState(inicial?.montoTotal?.toString() || '');
  const [tasaInteres, setTasaInteres] = useState(inicial?.tasaInteres?.toString() || '');
  const [plazoAnios, setPlazoAnios] = useState(inicial?.plazoAnios?.toString() || '0');
  const [plazoMeses, setPlazoMeses] = useState(inicial?.plazoMeses?.toString() || '0');
  const [sistemaAmortizacion, setSistemaAmortizacion] = useState(inicial?.sistemaAmortizacion || 'frances');
  const [cuotasPagadas, setCuotasPagadas] = useState(inicial?.cuotasPagadas?.toString() || '0');

  const preview = calcularPreview({ montoTotal, tasaInteres, plazoAnios, plazoMeses, sistemaAmortizacion });

  return (
    <View style={st.formContainer}>
      <Text style={st.formLabel}>Nombre del crédito o institución</Text>
      <TextInput style={st.formInput} value={nombre} onChangeText={setNombre} placeholder="Ej: Banco Estado" />
      <Text style={st.formLabel}>Monto total del crédito</Text>
      <TextInput style={st.formInput} value={montoTotal} onChangeText={setMontoTotal} keyboardType="numeric" placeholder="0" />
      <Text style={st.formLabel}>Tasa de interés anual (%)</Text>
      <TextInput style={st.formInput} value={tasaInteres} onChangeText={setTasaInteres} keyboardType="numeric" placeholder="0" />
      <View style={st.formRow}>
        <View style={st.formCol}><Text style={st.formLabel}>Plazo - Años</Text><TextInput style={st.formInput} value={plazoAnios} onChangeText={setPlazoAnios} keyboardType="numeric" /></View>
        <View style={st.formCol}><Text style={st.formLabel}>Plazo - Meses</Text><TextInput style={st.formInput} value={plazoMeses} onChangeText={setPlazoMeses} keyboardType="numeric" /></View>
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
      <TextInput style={st.formInput} value={cuotasPagadas} onChangeText={setCuotasPagadas} keyboardType="numeric" placeholder="0" />
      {preview && (
        <View style={st.previewBox}>
          <Text style={st.previewTitle}>Cálculo automático</Text>
          <View style={st.previewRow}>
            <View style={st.previewItem}><Text style={st.previewLabel}>Cuota mensual</Text><Text style={st.previewValue}>{formatearMoneda(preview.cuotaMensual)}</Text></View>
            <View style={st.previewItem}><Text style={st.previewLabel}>Total cuotas</Text><Text style={st.previewValue}>{preview.cuotasTotales}</Text></View>
            <View style={st.previewItem}><Text style={st.previewLabel}>Interés total</Text><Text style={st.previewValue}>{formatearMoneda(preview.interesTotal)}</Text></View>
          </View>
        </View>
      )}
      <View style={st.formBtns}>
        <TouchableOpacity style={st.btnSecundario} onPress={onCancelar}><Text style={st.btnSecundarioText}>Cancelar</Text></TouchableOpacity>
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

// ==================== PANTALLA PRINCIPAL ====================

export default function Obligaciones() {
  const [resumen, setResumen] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [costos, setCostos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [tab, setTab] = useState('resumen');
  const [modal, setModal] = useState(null);
  const [proyOpen, setProyOpen] = useState(null);
  const [tablaAmort, setTablaAmort] = useState(null);

  const cargar = async () => {
    try {
      const [res, ing, cos, deu] = await Promise.all([
        obtenerResumenObligaciones(), obtenerIngresos(), obtenerCostosFijos(), obtenerDeudas(),
      ]);
      setResumen(res.data); setIngresos(ing.data); setCostos(cos.data); setDeudas(deu.data);
    } catch (err) { console.error('Error cargando obligaciones:', err); }
    finally { setCargando(false); setRefrescando(false); }
  };

  useFocusEffect(useCallback(() => { cargar(); }, []));

  const handleGuardarIngreso = async (datos) => {
    try { if (modal.editando) await actualizarIngreso(modal.editando._id, datos); else await crearIngreso(datos); setModal(null); cargar(); } catch (err) { console.error(err); }
  };
  const handleEliminarIngreso = (id) => {
    Alert.alert('Eliminar', '¿Eliminar este ingreso?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await eliminarIngreso(id); cargar(); } }]);
  };
  const handleGuardarCosto = async (datos) => {
    try { if (modal.editando) await actualizarCostoFijo(modal.editando._id, datos); else await crearCostoFijo(datos); setModal(null); cargar(); } catch (err) { console.error(err); }
  };
  const handleEliminarCosto = (id) => {
    Alert.alert('Eliminar', '¿Eliminar este costo fijo?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await eliminarCostoFijo(id); cargar(); } }]);
  };
  const handleGuardarDeuda = async (datos) => {
    try { if (modal.editando) await actualizarDeuda(modal.editando._id, datos); else await crearDeuda(datos); setModal(null); cargar(); } catch (err) { console.error(err); }
  };
  const handleEliminarDeuda = (id) => {
    Alert.alert('Eliminar', '¿Eliminar esta deuda?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await eliminarDeuda(id); cargar(); } }]);
  };
  const handleVerTabla = async (deudaId) => {
    if (tablaAmort?.deudaId === deudaId) { setTablaAmort(null); return; }
    try { const res = await obtenerTablaAmortizacion(deudaId); setTablaAmort({ deudaId, ...res.data }); } catch (err) { console.error(err); }
  };

  if (cargando) return <View style={st.center}><ActivityIndicator size="large" color={Colors.primario} /></View>;

  const TABS = [
    { id: 'resumen', label: 'Resumen', icon: 'pie-chart' },
    { id: 'ingresos', label: 'Ingresos', icon: 'cash' },
    { id: 'costos', label: 'Costos', icon: 'trending-down' },
    { id: 'deudas', label: 'Deudas', icon: 'card' },
    { id: 'proyeccion', label: 'Proyección', icon: 'bar-chart' },
  ];

  return (
    <View style={st.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabsScroll} contentContainerStyle={st.tabsContent}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[st.tabBtn, tab === t.id && st.tabBtnActivo]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={16} color={tab === t.id ? Colors.primario : Colors.textoSecundario} />
            <Text style={[st.tabBtnText, tab === t.id && st.tabBtnTextActivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={st.scroll} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} colors={[Colors.primario]} />}>

        {/* ===== RESUMEN ===== */}
        {tab === 'resumen' && resumen && (
          <>
            <View style={st.metricasRow}>
              <View style={[st.metricaCard, { borderLeftColor: Colors.exito }]}>
                <Ionicons name="cash" size={20} color={Colors.exito} />
                <Text style={st.metricaLabel}>Ingresos</Text>
                <Text style={[st.metricaValor, { color: Colors.exito }]}>{formatearMoneda(resumen.totalIngresos)}</Text>
              </View>
              <View style={{ width: 10 }} />
              <View style={[st.metricaCard, { borderLeftColor: Colors.error }]}>
                <Ionicons name="trending-down" size={20} color={Colors.error} />
                <Text style={st.metricaLabel}>Costos fijos</Text>
                <Text style={[st.metricaValor, { color: Colors.error }]}>{formatearMoneda(resumen.totalCostos)}</Text>
              </View>
            </View>
            <View style={st.metricasRow}>
              <View style={[st.metricaCard, { borderLeftColor: Colors.advertencia }]}>
                <Ionicons name="card" size={20} color={Colors.advertencia} />
                <Text style={st.metricaLabel}>Pago deudas</Text>
                <Text style={[st.metricaValor, { color: Colors.advertencia }]}>{formatearMoneda(resumen.totalDeudas)}</Text>
              </View>
              <View style={{ width: 10 }} />
              <View style={[st.metricaCard, { borderLeftColor: resumen.flujoCaja >= 0 ? Colors.exito : Colors.error }]}>
                <Ionicons name="pie-chart" size={20} color={resumen.flujoCaja >= 0 ? Colors.exito : Colors.error} />
                <Text style={st.metricaLabel}>Flujo de caja</Text>
                <Text style={[st.metricaValor, { color: resumen.flujoCaja >= 0 ? Colors.exito : Colors.error }]}>{formatearMoneda(resumen.flujoCaja)}</Text>
              </View>
            </View>
            <View style={st.riesgoCard}>
              <Text style={st.riesgoTitulo}>Ingresos comprometidos</Text>
              <View style={st.riesgoBarra}><View style={[st.riesgoBarraFill, { width: `${Math.min(resumen.porcentajeComprometido, 100)}%`, backgroundColor: colorNivel(resumen.nivelCarga) }]} /></View>
              <Text style={[st.riesgoValor, { color: colorNivel(resumen.nivelCarga) }]}>{resumen.porcentajeComprometido}%</Text>
            </View>
            <View style={st.riesgoRow}>
              <View style={st.riesgoBadgeCard}>
                <Text style={st.riesgoBadgeLabel}>Carga financiera</Text>
                <View style={[st.riesgoBadge, { backgroundColor: colorNivel(resumen.nivelCarga) + '20' }]}>
                  <Text style={[st.riesgoBadgeText, { color: colorNivel(resumen.nivelCarga) }]}>{resumen.nivelCarga}</Text>
                </View>
              </View>
              <View style={{ width: 10 }} />
              <View style={st.riesgoBadgeCard}>
                <Text style={st.riesgoBadgeLabel}>Riesgo</Text>
                <View style={[st.riesgoBadge, { backgroundColor: colorNivel(resumen.nivelCarga) + '20' }]}>
                  <Ionicons name="warning" size={12} color={colorNivel(resumen.nivelCarga)} />
                  <Text style={[st.riesgoBadgeText, { color: colorNivel(resumen.nivelCarga) }]}>{resumen.riesgoSobreendeudamiento}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ===== INGRESOS ===== */}
        {tab === 'ingresos' && (
          <>
            <TouchableOpacity style={st.addBtn} onPress={() => setModal({ tipo: 'ingreso', editando: null })}>
              <Ionicons name="add-circle" size={20} color="#fff" /><Text style={st.addBtnText}>Agregar ingreso</Text>
            </TouchableOpacity>
            {ingresos.length === 0 ? (
              <View style={st.empty}><Ionicons name="cash-outline" size={48} color={Colors.borde} /><Text style={st.emptyText}>Sin ingresos registrados</Text></View>
            ) : (
              <View style={st.listaCard}>
                {ingresos.map((ing) => (
                  <View key={ing._id} style={st.listaItem}>
                    <View style={st.listaItemInfo}>
                      <Text style={st.listaItemNombre}>{ing.nombre}</Text>
                      <Text style={st.listaItemDetalle}>{CATEGORIAS_INGRESO[ing.categoria] || 'Otro'}</Text>
                    </View>
                    <Text style={[st.listaItemMonto, { color: Colors.exito }]}>{formatearMoneda(ing.monto)}</Text>
                    <TouchableOpacity onPress={() => setModal({ tipo: 'ingreso', editando: ing })} style={st.iconBtn}><Ionicons name="create-outline" size={18} color={Colors.textoSecundario} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminarIngreso(ing._id)} style={st.iconBtn}><Ionicons name="trash-outline" size={18} color={Colors.error} /></TouchableOpacity>
                  </View>
                ))}
                <View style={st.listaTotal}>
                  <Text style={st.listaTotalLabel}>Total mensual</Text>
                  <Text style={[st.listaTotalValor, { color: Colors.exito }]}>{formatearMoneda(ingresos.reduce((s2, i) => s2 + i.monto, 0))}</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ===== COSTOS FIJOS ===== */}
        {tab === 'costos' && (
          <>
            <TouchableOpacity style={st.addBtn} onPress={() => setModal({ tipo: 'costo', editando: null })}>
              <Ionicons name="add-circle" size={20} color="#fff" /><Text style={st.addBtnText}>Agregar costo</Text>
            </TouchableOpacity>
            {costos.length === 0 ? (
              <View style={st.empty}><Ionicons name="trending-down-outline" size={48} color={Colors.borde} /><Text style={st.emptyText}>Sin costos fijos registrados</Text></View>
            ) : (
              <View style={st.listaCard}>
                {costos.map((c) => (
                  <View key={c._id} style={st.listaItem}>
                    <View style={st.listaItemInfo}>
                      <Text style={st.listaItemNombre}>{c.nombre}</Text>
                      <Text style={st.listaItemDetalle}>{CATEGORIAS_COSTO[c.categoria]} · {c.tipoCompromiso === 'permanente' ? 'Permanente' : `Temporal (${c.duracion}m)`}</Text>
                    </View>
                    <Text style={[st.listaItemMonto, { color: Colors.error }]}>{formatearMoneda(c.monto)}</Text>
                    <TouchableOpacity onPress={() => setModal({ tipo: 'costo', editando: c })} style={st.iconBtn}><Ionicons name="create-outline" size={18} color={Colors.textoSecundario} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminarCosto(c._id)} style={st.iconBtn}><Ionicons name="trash-outline" size={18} color={Colors.error} /></TouchableOpacity>
                  </View>
                ))}
                <View style={st.listaTotal}>
                  <Text style={st.listaTotalLabel}>Total mensual</Text>
                  <Text style={[st.listaTotalValor, { color: Colors.error }]}>{formatearMoneda(costos.reduce((s2, c) => s2 + c.monto, 0))}</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ===== DEUDAS ===== */}
        {tab === 'deudas' && (
          <>
            <TouchableOpacity style={st.addBtn} onPress={() => setModal({ tipo: 'deuda', editando: null })}>
              <Ionicons name="add-circle" size={20} color="#fff" /><Text style={st.addBtnText}>Agregar deuda</Text>
            </TouchableOpacity>
            {deudas.length === 0 ? (
              <View style={st.empty}><Ionicons name="card-outline" size={48} color={Colors.borde} /><Text style={st.emptyText}>Sin deudas registradas</Text></View>
            ) : (
              deudas.map((d) => {
                const prog = d.cuotasTotales > 0 ? Math.round(((d.cuotasPagadas || 0) / d.cuotasTotales) * 100) : 0;
                const isTableOpen = tablaAmort?.deudaId === d._id;
                return (
                  <View key={d._id} style={st.deudaCard}>
                    <View style={st.deudaHeader}>
                      <Text style={st.deudaNombre}>{d.nombre}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity onPress={() => setModal({ tipo: 'deuda', editando: d })} style={st.iconBtn}><Ionicons name="create-outline" size={16} color={Colors.textoSecundario} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleEliminarDeuda(d._id)} style={st.iconBtn}><Ionicons name="trash-outline" size={16} color={Colors.error} /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Monto total</Text><Text style={st.deudaFilaVal}>{formatearMoneda(d.montoTotal)}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Saldo pendiente</Text><Text style={[st.deudaFilaVal, { color: Colors.error }]}>{formatearMoneda(d.saldoPendiente)}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Cuota mensual</Text><Text style={st.deudaFilaVal}>{formatearMoneda(d.cuotaMensual)}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Interés total</Text><Text style={st.deudaFilaVal}>{formatearMoneda(d.interesTotal)}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Cuotas pagadas</Text><Text style={st.deudaFilaVal}>{d.cuotasPagadas || 0} de {d.cuotasTotales}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Cuotas restantes</Text><Text style={st.deudaFilaVal}>{d.cuotasRestantes || 0}</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Tasa anual</Text><Text style={st.deudaFilaVal}>{d.tasaInteres}%</Text></View>
                    <View style={st.deudaFila}><Text style={st.deudaFilaLabel}>Sistema</Text><Text style={st.deudaFilaVal}>{SISTEMAS[d.sistemaAmortizacion] || d.sistemaAmortizacion}</Text></View>
                    <View style={st.deudaProgreso}>
                      <View style={st.deudaProgresoLabel}><Text style={st.deudaProgresoText}>Progreso</Text><Text style={st.deudaProgresoText}>{prog}%</Text></View>
                      <View style={st.deudaProgresoBarra}><View style={[st.deudaProgresoFill, { width: `${prog}%` }]} /></View>
                    </View>
                    <TouchableOpacity style={st.tablaBtn} onPress={() => handleVerTabla(d._id)}>
                      <Ionicons name="grid-outline" size={14} color={Colors.primario} />
                      <Text style={st.tablaBtnText}>{isTableOpen ? 'Ocultar tabla' : 'Ver tabla de amortización'}</Text>
                    </TouchableOpacity>
                    {isTableOpen && tablaAmort.tabla && (
                      <ScrollView horizontal style={st.tablaScroll}>
                        <View>
                          <View style={st.tablaHeaderRow}>
                            <Text style={[st.tablaHeaderCell, { width: 40 }]}>#</Text>
                            <Text style={[st.tablaHeaderCell, { width: 90 }]}>Cuota</Text>
                            <Text style={[st.tablaHeaderCell, { width: 80 }]}>Interés</Text>
                            <Text style={[st.tablaHeaderCell, { width: 90 }]}>Amort.</Text>
                            <Text style={[st.tablaHeaderCell, { width: 100 }]}>Saldo</Text>
                          </View>
                          {tablaAmort.tabla.map((row) => (
                            <View key={row.cuota} style={[st.tablaRow, row.cuota <= (d.cuotasPagadas || 0) && st.tablaRowPagada]}>
                              <Text style={[st.tablaCell, { width: 40 }]}>{row.cuota}</Text>
                              <Text style={[st.tablaCell, { width: 90 }]}>{formatearMoneda(row.montoCuota)}</Text>
                              <Text style={[st.tablaCell, { width: 80 }]}>{formatearMoneda(row.interes)}</Text>
                              <Text style={[st.tablaCell, { width: 90 }]}>{formatearMoneda(row.amortizacion)}</Text>
                              <Text style={[st.tablaCell, { width: 100 }]}>{formatearMoneda(row.saldo)}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                );
              })
            )}
            {deudas.length > 0 && (
              <View style={st.listaTotal}>
                <Text style={st.listaTotalLabel}>Total cuotas mensuales</Text>
                <Text style={[st.listaTotalValor, { color: Colors.error }]}>{formatearMoneda(deudas.reduce((s2, d) => s2 + d.cuotaMensual, 0))}</Text>
              </View>
            )}
          </>
        )}

        {/* ===== PROYECCIÓN ===== */}
        {tab === 'proyeccion' && resumen?.proyeccion && (
          <>
            <Text style={st.proyTitulo}>Proyección 12 meses</Text>
            {resumen.proyeccion.map((m, i) => {
              const abierto = proyOpen === i;
              return (
                <View key={m.mes}>
                  <TouchableOpacity style={st.proyCard} onPress={() => setProyOpen(abierto ? null : i)} activeOpacity={0.7}>
                    <Text style={st.proyMes}>{m.mesLabel}</Text>
                    <Text style={[st.proyFlujo, { color: m.flujo >= 0 ? Colors.exito : Colors.error }]}>{formatearMoneda(m.flujo)}</Text>
                    <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textoSecundario} />
                  </TouchableOpacity>
                  {abierto && (
                    <View style={st.proyDetalle}>
                      <View style={st.proyFila}><Text style={st.proyFilaLabel}>Ingresos</Text><Text style={[st.proyFilaVal, { color: Colors.exito }]}>{formatearMoneda(m.ingresos)}</Text></View>
                      <View style={st.proyFila}><Text style={st.proyFilaLabel}>Costos fijos</Text><Text style={[st.proyFilaVal, { color: Colors.error }]}>-{formatearMoneda(m.costos)}</Text></View>
                      <View style={st.proyFila}><Text style={st.proyFilaLabel}>Deudas</Text><Text style={[st.proyFilaVal, { color: Colors.error }]}>-{formatearMoneda(m.deudas)}</Text></View>
                      {m.items && m.items.length > 0 && (
                        <>
                          <View style={st.proySep} />
                          <Text style={st.proyVencTitulo}>Detalle</Text>
                          {m.items.map((v, j) => (
                            <View key={j} style={st.proyVenc}>
                              <Text style={st.proyVencText}>{v.nombre}{v.detalle ? ` (${v.detalle})` : ''}</Text>
                              <Text style={[st.proyVencMonto, { color: v.tipo === 'ingreso' ? Colors.exito : Colors.error }]}>
                                {v.tipo === 'ingreso' ? '+' : '-'}{formatearMoneda(v.monto)}
                              </Text>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ===== MODALES ===== */}
      <RNModal visible={!!modal} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitulo}>
                {modal?.tipo === 'ingreso' ? (modal.editando ? 'Editar ingreso' : 'Nuevo ingreso seguro') :
                 modal?.tipo === 'costo' ? (modal.editando ? 'Editar costo' : 'Nuevo costo fijo') :
                 modal?.tipo === 'deuda' ? (modal.editando ? 'Editar deuda' : 'Nueva deuda') : ''}
              </Text>
              <TouchableOpacity onPress={() => setModal(null)}><Ionicons name="close" size={24} color={Colors.texto} /></TouchableOpacity>
            </View>
            <ScrollView>
              {modal?.tipo === 'ingreso' && <FormIngreso inicial={modal.editando} onGuardar={handleGuardarIngreso} onCancelar={() => setModal(null)} />}
              {modal?.tipo === 'costo' && <FormCosto inicial={modal.editando} onGuardar={handleGuardarCosto} onCancelar={() => setModal(null)} />}
              {modal?.tipo === 'deuda' && <FormDeuda inicial={modal.editando} onGuardar={handleGuardarDeuda} onCancelar={() => setModal(null)} />}
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

// ==================== ESTILOS ====================

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fondo },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fondo },
  scroll: { flex: 1, paddingHorizontal: Spacing.lg },

  tabsScroll: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.borde },
  tabsContent: { paddingHorizontal: Spacing.md, gap: 4, alignItems: 'center' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  tabBtnActivo: { borderBottomWidth: 2, borderBottomColor: Colors.primario },
  tabBtnText: { fontSize: FontSize.sm, color: Colors.textoSecundario, fontWeight: '600' },
  tabBtnTextActivo: { color: Colors.primario },

  metricasRow: { flexDirection: 'row', marginTop: Spacing.md },
  metricaCard: { flex: 1, backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  metricaLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 6 },
  metricaValor: { fontSize: FontSize.lg, fontWeight: '800', marginTop: 4 },

  riesgoCard: { backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  riesgoTitulo: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textoSecundario, marginBottom: 10 },
  riesgoBarra: { height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  riesgoBarraFill: { height: '100%', borderRadius: 5 },
  riesgoValor: { fontSize: FontSize.xxl, fontWeight: '800' },
  riesgoRow: { flexDirection: 'row', marginTop: Spacing.md },
  riesgoBadgeCard: { flex: 1, backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  riesgoBadgeLabel: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginBottom: 8 },
  riesgoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start' },
  riesgoBadgeText: { fontSize: FontSize.md, fontWeight: '700' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primario, borderRadius: BorderRadius.md, paddingVertical: 12, marginTop: Spacing.md },
  addBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: FontSize.md, color: Colors.textoSecundario },

  listaCard: { backgroundColor: '#fff', borderRadius: BorderRadius.md, marginTop: Spacing.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  listaItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  listaItemInfo: { flex: 1 },
  listaItemNombre: { fontSize: FontSize.md, fontWeight: '600', color: Colors.texto },
  listaItemDetalle: { fontSize: FontSize.xs, color: Colors.textoSecundario, marginTop: 2 },
  listaItemMonto: { fontSize: FontSize.md, fontWeight: '700', marginRight: 8 },
  iconBtn: { padding: 6 },
  listaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#f9fafb', borderTopWidth: 2, borderTopColor: '#e5e7eb', marginTop: Spacing.sm, borderRadius: BorderRadius.md },
  listaTotalLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto },
  listaTotalValor: { fontSize: FontSize.md, fontWeight: '800' },

  deudaCard: { backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  deudaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  deudaNombre: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto },
  deudaFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#fafafa' },
  deudaFilaLabel: { fontSize: FontSize.sm, color: Colors.textoSecundario },
  deudaFilaVal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto },
  deudaProgreso: { marginTop: 10 },
  deudaProgresoLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  deudaProgresoText: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  deudaProgresoBarra: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  deudaProgresoFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primario },

  tablaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#f9fafb' },
  tablaBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primario },
  tablaScroll: { marginTop: 10, maxHeight: 300 },
  tablaHeaderRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 8 },
  tablaHeaderCell: { fontWeight: '700', fontSize: 11, color: '#374151', textAlign: 'right', paddingHorizontal: 4 },
  tablaRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tablaRowPagada: { backgroundColor: '#f0fdf4' },
  tablaCell: { fontSize: 11, color: '#374151', textAlign: 'right', paddingHorizontal: 4 },

  previewBox: { backgroundColor: '#f0f4ff', borderWidth: 1, borderColor: '#dbe4ff', borderRadius: 12, padding: 14, marginTop: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewItem: { alignItems: 'center' },
  previewLabel: { fontSize: 11, color: '#6b7280' },
  previewValue: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 },

  proyTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto, marginTop: Spacing.md, marginBottom: Spacing.sm },
  proyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  proyMes: { fontSize: FontSize.md, fontWeight: '700', color: Colors.texto, textTransform: 'capitalize', flex: 1 },
  proyFlujo: { fontSize: FontSize.md, fontWeight: '800', marginRight: 8 },
  proyDetalle: { backgroundColor: '#fff', borderRadius: BorderRadius.md, padding: 16, marginBottom: 8, marginTop: -4 },
  proyFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  proyFilaLabel: { fontSize: FontSize.sm, color: Colors.textoSecundario },
  proyFilaVal: { fontSize: FontSize.sm, fontWeight: '600' },
  proySep: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 8 },
  proyVencTitulo: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textoSecundario, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  proyVenc: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  proyVencText: { fontSize: FontSize.xs, color: Colors.textoSecundario },
  proyVencMonto: { fontSize: FontSize.xs, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitulo: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.texto },

  formContainer: { padding: 20 },
  formLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.texto, marginTop: 12, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: Colors.borde, borderRadius: BorderRadius.sm, paddingHorizontal: 14, paddingVertical: 10, fontSize: FontSize.md, color: Colors.texto, backgroundColor: '#fff' },
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  formToggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  formScrollRow: { marginBottom: 4 },
  formToggle: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 6 },
  formToggleActivo: { backgroundColor: Colors.primario },
  formToggleText: { fontSize: FontSize.sm, color: Colors.textoSecundario, fontWeight: '600' },
  formToggleTextActivo: { color: '#fff' },
  formBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btnPrimario: { backgroundColor: Colors.primario, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.sm },
  btnPrimarioText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  btnSecundario: { backgroundColor: '#f3f4f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.sm },
  btnSecundarioText: { color: Colors.texto, fontSize: FontSize.md, fontWeight: '600' },
});
