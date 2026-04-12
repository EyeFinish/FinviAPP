import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

function Dot({ active }) {
  const width = useSharedValue(active ? 24 : 8);

  useEffect(() => {
    width.value = withSpring(active ? 24 : 8, { damping: 14, stiffness: 120 });
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[styles.dot, active ? styles.dotActivo : styles.dotInactivo, animStyle]}
    />
  );
}

export default function ProgressDots({ current, total }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} active={i === current} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActivo: {
    backgroundColor: Colors.primario,
  },
  dotInactivo: {
    backgroundColor: Colors.borde,
    width: 8,
  },
});
