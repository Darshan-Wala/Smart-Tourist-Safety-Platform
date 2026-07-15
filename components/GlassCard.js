import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function GlassCard({ style, children, rounded = 22 }) {
  return <View style={[styles.card, { borderRadius: rounded }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    // soft shadow (Android/iOS)
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
});