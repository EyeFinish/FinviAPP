import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, BackHandler, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  obtenerIngresos, crearIngreso, eliminarIngreso,
  obtenerCostosFijos, crearCostoFijo, eliminarCostoFijo,
  obtenerDeudas, crearDeuda, eliminarDeuda,
} from '../services/api';
import { formatearMoneda } from '../utils/formateadores';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import ProgressDots from '../components/onboarding/ProgressDots';
import SlideWrapper from '../components/onboarding/SlideWrapper';
import ItemCard from '../components/onboarding/ItemCard';
import FormModal from '../components/onboarding/FormModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDES = [
  { id: 'bienvenida' },
  { id: 'ingresos' },
  { id: 'costos' },
  { id: 'deudas' },
  { id: 'completado' },
];

// ── slide configs ─────────────────────────────────────────────────────────────
const SLIDE_CONFIG = {
  ingresos: {
    iconName: 'cash-outline',
    iconColor: Colors.exito,
    iconBg: '#d1fae5',
    titulo: 'Tus ingresos',
    subtitulo: '¿De dónde viene tu dinero? Agrega tus fuentes de ingreso mensuales.',
    addLabel: '+ Agregar ingreso',
    tipo: 'ingreso',
  },
  costos: {
    iconName: 'trending-down-outline',
    iconColor: Colors.advertencia,
    iconBg: '#fef3c7',
    titulo: 'Gastos fijos',
    subtitulo: '¿Cuánto gastas cada mes? Registra tus compromisos recurrentes.',
    addLabel: '+ Agregar gasto fijo',
    tipo: 'costo',
  },
  deudas: {
    iconName: 'card-outline',
    iconColor: Colors.error,
    iconBg: '#fee2e2',
    titulo: 'Deudas y créditos',
    subtitulo: '¿Tienes préstamos o créditos activos? Puedes omitirlos si no tienes.',
    addLabel: '+ Agregar deuda',
    tipo: 'deuda',
  },
};

// ── sub-components ────────────────────────────────────────────────────────────

function SlideIcono({ iconName, iconBg, iconColor, emoji }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : (
        <Ionicons name={iconName} size={52} color={iconColor} />
      )}
    </View>
  );
}

function BotonesNavegacion({ onContinuar, onOmitir, labelContinuar = 'Continuar', mostrarOmitir = true }) {
  return (
    <View style={styles.botonesContainer}>
      <TouchableOpacity style={styles.btnPrimario} onPress={onContinuar}>
        <Text style={styles.btnPrimarioText}>{labelContinuar}</Text>
      </TouchableOpacity>
      {mostrarOmitir && (
        <TouchableOpacity style={styles.btnOmitir} onPress={onOmitir}>
          <Text style={styles.btnOmitirText}>Omitir</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── slide bienvenida ──────────────────────────────────────────────────────────

function SlideBienvenida({ onSiguiente }) {
  return (
    <SlideWrapper>
      <View style={styles.slideContent}>
        <SlideIcono emoji="💰" iconBg="#ece8ff" />
        <Text style={styles.titulo}>¡Bienvenido a Finvi!</Text>
        <Text style={styles.subtitulo}>
          Configura tus finanzas en 3 pasos y empieza a tomar el control de tu dinero.
        </Text>
        <View style={styles.pasosList}>
          {[
            { icon: 'cash-outline', color: Colors.exito, bg: '#d1fae5', label: 'Registra tus ingresos' },
            { icon: 'trending-down-outline', color: Colors.advertencia, bg: '#fef3c7', label: 'Agrega tus gastos fijos' },
            { icon: 'card-outline', color: Colors.error, bg: '#fee2e2', label: 'Declara tus deudas' },
          ].map((p, i) => (
            <View key={i} style={styles.pasoItem}>
              <View style={[styles.pasoIcono, { backgroundColor: p.bg }]}>
                <Ionicons name={p.icon} size={20} color={p.color} />
              </View>
              <Text style={styles.pasoLabel}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <BotonesNavegacion onContinuar={onSiguiente} labelContinuar="Comenzar" mostrarOmitir={false} />
    </SlideWrapper>
  );
}

// ── slide financiero (ingresos / costos / deudas) ─────────────────────────────

function SlideFinanciero({ tipo, items, onAgregar, onEliminar, onSiguiente, cargando }) {
  const cfg = SLIDE_CONFIG[tipo];

  const getMonto = (item) => {
    if (tipo === 'ingresos') return item.monto;
    if (tipo === 'costos') return item.monto;
    if (tipo === 'deudas') return item.montoTotal;
    return null;
  };

  const getSubtitulo = (item) => {
    if (tipo === 'costos') return item.tipoCompromiso === 'temporal' ? `Temporal · ${item.duracion} meses` : 'Permanente';
    if (tipo === 'deudas') return `${item.sistemaAmortizacion ? item.sistemaAmortizacion.charAt(0).toUpperCase() + item.sistemaAmortizacion.slice(1) : ''} · ${(item.plazoAnios || 0) * 12 + (item.plazoMeses || 0)} cuotas`;
    return null;
  };

  return (
    <SlideWrapper>
      <View style={styles.slideContent}>
        <SlideIcono iconName={cfg.iconName} iconColor={cfg.iconColor} iconBg={cfg.iconBg} />
        <Text style={styles.titulo}>{cfg.titulo}</Text>
        <Text style={styles.subtitulo}>{cfg.subtitulo}</Text>

        {cargando ? (
          <ActivityIndicator color={Colors.primario} style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.itemsContainer}>
            {items.map((item) => (
              <ItemCard
                key={item._id}
                nombre={item.nombre}
                monto={getMonto(item)}
                subtitulo={getSubtitulo(item)}
                onEliminar={() => onEliminar(item._id)}
              />
            ))}
            <TouchableOpacity style={styles.btnAgregar} onPress={onAgregar}>
              <Text style={styles.btnAgregarText}>{cfg.addLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <BotonesNavegacion onContinuar={onSiguiente} onOmitir={onSiguiente} />
    </SlideWrapper>
  );
}

// ── slide completado ──────────────────────────────────────────────────────────

function SlideCompletado({ ingresos, costos, deudas, onFinalizar, guardando }) {
  const totalIngresos = ingresos.reduce((s, i) => s + (i.monto || 0), 0);
  const totalCostos = costos.reduce((s, c) => s + (c.monto || 0), 0);
  const totalDeudas = deudas.reduce((s, d) => s + (d.montoTotal || 0), 0);
  const flujoCaja = totalIngresos - totalCostos;
  const hayDatos = ingresos.length > 0 || costos.length > 0 || deudas.length > 0;

  return (
    <SlideWrapper>
      <View style={styles.slideContent}>
        <View style={[styles.iconCircle, { backgroundColor: '#d1fae5' }]}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.exito} />
        </View>
        <Text style={styles.titulo}>¡Todo listo!</Text>
        <Text style={styles.subtitulo}>
          Tu perfil financiero está configurado. Ya puedes usar Finvi.
        </Text>

        {hayDatos ? (
          <>
            <View style={styles.resumenCard}>
              <ResumenFila
                iconName="cash"
                iconColor={Colors.exito}
                iconBg="#d1fae5"
                label="Ingresos"
                count={ingresos.length}
                singular="fuente"
                plural="fuentes"
                total={totalIngresos}
              />
              <View style={styles.separador} />
              <ResumenFila
                iconName="trending-down"
                iconColor={Colors.advertencia}
                iconBg="#fef3c7"
                label="Gastos fijos"
                count={costos.length}
                singular="compromiso"
                plural="compromisos"
                total={totalCostos}
              />
              <View style={styles.separador} />
              <ResumenFila
                iconName="card"
                iconColor={Colors.error}
                iconBg="#fee2e2"
                label="Deudas"
                count={deudas.length}
                singular="crédito"
                plural="créditos"
                total={totalDeudas}
              />
            </View>

            {ingresos.length > 0 && (
              <Text style={[styles.flujoCaja, { color: flujoCaja >= 0 ? Colors.exito : Colors.error }]}>
                Flujo mensual libre: {formatearMoneda(flujoCaja)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.sinDatos}>
            No agregaste datos todavía. Puedes hacerlo desde Obligaciones.
          </Text>
        )}
      </View>

      <View style={styles.botonesContainer}>
        <TouchableOpacity
          style={[styles.btnPrimario, guardando && styles.btnDisabled]}
          onPress={onFinalizar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimarioText}>Ir a Finvi</Text>
          )}
        </TouchableOpacity>
      </View>
    </SlideWrapper>
  );
}

function ResumenFila({ iconName, iconColor, iconBg, label, count, singular, plural, total }) {
  const unidad = count === 1 ? singular : plural;
  return (
    <View style={styles.resumenFila}>
      <View style={[styles.resumenIcono, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.resumenInfo}>
        <Text style={styles.resumenLabel}>{label}</Text>
        <Text style={styles.resumenCount}>{count} {unidad}</Text>
      </View>
      <Text style={styles.resumenTotal}>{formatearMoneda(total)}</Text>
    </View>
  );
}

// ── pantalla principal ────────────────────────────────────────────────────────

export default function Onboarding() {
  const { marcarOnboardingCompleto } = useAuth();
  const flatListRef = useRef(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [ingresos, setIngresos] = useState([]);
  const [costos, setCostos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [modalTipo, setModalTipo] = useState(null);
  const [modalError, setModalError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Seed datos existentes si el usuario regresó mid-onboarding
  useEffect(() => {
    const seedDatos = async () => {
      try {
        const [resIng, resCos, resDeu] = await Promise.all([
          obtenerIngresos(),
          obtenerCostosFijos(),
          obtenerDeudas(),
        ]);
        setIngresos(resIng.data || []);
        setCostos(resCos.data || []);
        setDeudas(resDeu.data || []);
      } catch {
        // Si falla el fetch inicial, el usuario puede agregar desde cero
      } finally {
        setCargandoInicial(false);
      }
    };
    seedDatos();
  }, []);

  // Android back handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (slideIndex > 0) {
        flatListRef.current?.scrollToIndex({ index: slideIndex - 1, animated: true });
      }
      return true; // siempre consumir: no salir del onboarding
    });
    return () => sub.remove();
  }, [slideIndex]);

  const irASiguiente = useCallback(() => {
    if (slideIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: slideIndex + 1, animated: true });
    }
  }, [slideIndex]);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setSlideIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  // ── handlers agregar ────────────────────────────────────────────────────────
  const handleGuardar = async (datos) => {
    setModalError('');
    try {
      if (modalTipo === 'ingreso') {
        const res = await crearIngreso(datos);
        setIngresos((prev) => [...prev, res.data]);
      } else if (modalTipo === 'costo') {
        const res = await crearCostoFijo(datos);
        setCostos((prev) => [...prev, res.data]);
      } else if (modalTipo === 'deuda') {
        const res = await crearDeuda(datos);
        setDeudas((prev) => [...prev, res.data]);
      }
      setModalTipo(null);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error al guardar. Intenta de nuevo.');
    }
  };

  // ── handlers eliminar ───────────────────────────────────────────────────────
  const handleEliminarIngreso = async (id) => {
    try {
      await eliminarIngreso(id);
      setIngresos((prev) => prev.filter((i) => i._id !== id));
    } catch { /* silencioso */ }
  };

  const handleEliminarCosto = async (id) => {
    try {
      await eliminarCostoFijo(id);
      setCostos((prev) => prev.filter((c) => c._id !== id));
    } catch { /* silencioso */ }
  };

  const handleEliminarDeuda = async (id) => {
    try {
      await eliminarDeuda(id);
      setDeudas((prev) => prev.filter((d) => d._id !== id));
    } catch { /* silencioso */ }
  };

  // ── finalizar ───────────────────────────────────────────────────────────────
  const handleFinalizar = async () => {
    setGuardando(true);
    try {
      await marcarOnboardingCompleto();
      router.replace('/(tabs)');
    } catch {
      setGuardando(false);
    }
  };

  // ── render slides ───────────────────────────────────────────────────────────
  const renderSlide = ({ item }) => {
    if (item.id === 'bienvenida') {
      return <SlideBienvenida onSiguiente={irASiguiente} />;
    }
    if (item.id === 'ingresos') {
      return (
        <SlideFinanciero
          tipo="ingresos"
          items={ingresos}
          onAgregar={() => { setModalError(''); setModalTipo('ingreso'); }}
          onEliminar={handleEliminarIngreso}
          onSiguiente={irASiguiente}
          cargando={cargandoInicial}
        />
      );
    }
    if (item.id === 'costos') {
      return (
        <SlideFinanciero
          tipo="costos"
          items={costos}
          onAgregar={() => { setModalError(''); setModalTipo('costo'); }}
          onEliminar={handleEliminarCosto}
          onSiguiente={irASiguiente}
          cargando={cargandoInicial}
        />
      );
    }
    if (item.id === 'deudas') {
      return (
        <SlideFinanciero
          tipo="deudas"
          items={deudas}
          onAgregar={() => { setModalError(''); setModalTipo('deuda'); }}
          onEliminar={handleEliminarDeuda}
          onSiguiente={irASiguiente}
          cargando={cargandoInicial}
        />
      );
    }
    if (item.id === 'completado') {
      return (
        <SlideCompletado
          ingresos={ingresos}
          costos={costos}
          deudas={deudas}
          onFinalizar={handleFinalizar}
          guardando={guardando}
        />
      );
    }
    return null;
  };

  // ── render ──────────────────────────────────────────────────────────────────
  const tipoModal = modalTipo === 'ingreso' ? 'ingreso' : modalTipo === 'costo' ? 'costo' : modalTipo === 'deuda' ? 'deuda' : null;

  return (
    <View style={styles.container}>
      <ProgressDots current={slideIndex} total={SLIDES.length} />

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <FormModal
        visible={!!tipoModal}
        tipo={tipoModal}
        onGuardar={handleGuardar}
        onCerrar={() => { setModalTipo(null); setModalError(''); }}
        error={modalError}
      />
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flatList: {
    flex: 1,
  },

  // ── slide layout ──
  slideContent: {
    flex: 1,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

  // ── icon circle ──
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emoji: {
    fontSize: 48,
  },

  // ── texts ──
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.texto,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitulo: {
    fontSize: FontSize.md,
    color: Colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  // ── bienvenida pasos ──
  pasosList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  pasoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#fafbff',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borde,
  },
  pasoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.texto,
  },

  // ── items lista ──
  itemsContainer: {
    marginBottom: Spacing.md,
  },

  // ── botón agregar (ghost dashed) ──
  btnAgregar: {
    borderWidth: 1.5,
    borderColor: Colors.primario,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnAgregarText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primario,
  },

  // ── botones navegación ──
  botonesContainer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  btnPrimario: {
    backgroundColor: Colors.primario,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimarioText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnOmitir: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  btnOmitirText: {
    fontSize: FontSize.sm,
    color: Colors.textoSecundario,
  },

  // ── resumen card (slide completado) ──
  resumenCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  resumenFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  resumenIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumenInfo: {
    flex: 1,
  },
  resumenLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.texto,
  },
  resumenCount: {
    fontSize: FontSize.xs,
    color: Colors.textoSecundario,
    marginTop: 2,
  },
  resumenTotal: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primario,
  },
  separador: {
    height: 1,
    backgroundColor: Colors.borde,
  },
  flujoCaja: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: Spacing.xl,
  },
  sinDatos: {
    fontSize: FontSize.sm,
    color: Colors.textoSecundario,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
});
