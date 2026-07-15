import React from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color="#4ECDC4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2027', justifyContent: 'center', alignItems: 'center' },
});