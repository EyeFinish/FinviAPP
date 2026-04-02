import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing } from '../constants/theme';

export default function ConfirmModal({
  visible,
  titulo,
  mensaje,
  textoCancelar = 'Cancelar',
  textoConfirmar = 'Confirmar',
  icono,
  onCancelar,
  onConfirmar,
  peligroso = false,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancelar}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onCancelar}>
        <TouchableOpacity style={st.contenedor} activeOpacity={1} onPress={() => {}}>
          {icono && (
            <View style={[st.iconoWrap, peligroso ? st.iconoWrapPeligro : st.iconoWrapPrimario]}>
              <Ionicons
                name={icono}
                size={28}
                color={peligroso ? Colors.error : Colors.primario}
              />
            </View>
          )}
          <Text style={st.titulo}>{titulo}</Text>
          {mensaje ? <Text style={st.mensaje}>{mensaje}</Text> : null}
          <View style={st.botones}>
            <TouchableOpacity style={st.btnCancelar} onPress={onCancelar}>
              <Text style={st.btnCancelarTexto}>{textoCancelar}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btnConfirmar, peligroso ? st.btnPeligro : st.btnPrimario]}
              onPress={onConfirmar}
            >
              <Text style={st.btnConfirmarTexto}>{textoConfirmar}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contenedor: {
    backgroundColor: '#fff',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 12,
  },
  iconoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconoWrapPeligro: {
    backgroundColor: '#fef2f2',
  },
  iconoWrapPrimario: {
    backgroundColor: '#ece8ff',
  },
  titulo: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.texto,
    textAlign: 'center',
  },
  mensaje: {
    fontSize: FontSize.sm,
    color: Colors.textoSecundario,
    textAlign: 'center',
    lineHeight: 20,
  },
  botones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: BorderRadius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnCancelarTexto: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.texto,
  },
  btnConfirmar: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPeligro: {
    backgroundColor: Colors.error,
  },
  btnPrimario: {
    backgroundColor: Colors.primario,
  },
  btnConfirmarTexto: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});
