import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HeaderBar({ name = 'Traveler', onProfilePress }) {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
      </View>
      <Pressable onPress={onProfilePress} hitSlop={12}>
        <Ionicons name="person-circle-outline" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 14 },
  welcome: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
});