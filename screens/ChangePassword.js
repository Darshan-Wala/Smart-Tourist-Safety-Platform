import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';

export default function ChangePassword({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>Change Password</Text>
      <Text style={styles.subtitle}>
        Placeholder screen to keep navigation stable. Replace with your actual change-password UI later.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f2027', padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, color: '#fff', fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 10, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  button: { marginTop: 20, backgroundColor: '#29b18d', paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '800' },
});