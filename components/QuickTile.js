import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function QuickTile({ label, icon, onPress, gradient = ['#21D4B4', '#1AAE92'], badge }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
    >
      <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.tile}>
        <View style={styles.row}>
          <Ionicons name={icon} size={22} color="#fff" />
          {badge ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: 92,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  badge: {
    minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});