import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatearMoneda } from '../../utils/formateadores';
import { Colors, FontSize, BorderRadius, Spacing } from '../../constants/theme';

export default function ItemCard({ nombre, monto, subtitulo, onEliminar }) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {monto != null && (
          <Text style={styles.monto}>{formatearMoneda(monto)}</Text>
        )}
        <TouchableOpacity onPress={onEliminar} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={20} color={Colors.textoSecundario} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borde,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  info: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  nombre: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.texto,
  },
  subtitulo: {
    fontSize: FontSize.xs,
    color: Colors.textoSecundario,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  monto: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primario,
  },
  deleteBtn: {
    padding: 2,
  },
});
