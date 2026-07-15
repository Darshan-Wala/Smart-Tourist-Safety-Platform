import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import DigitalIDCard from '../components/DigitalIDCard';

/**
 * Screen to display the Digital ID with QR code.
 * Future ideas:
 *  - Add "Refresh / Regenerate ID" (when near expiry)
 *  - Add "Share as PDF / Image"
 *  - Add verification status fetched from server
 */
export default function DigitalIDScreen({ navigation }) {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Digital ID</Text>
        <View style={{ width: 40 }} />
      </View>

      <DigitalIDCard profile={profile} />

      {!profile?.digitalTouristID && (
        <Text style={styles.placeholderText}>
          Your Digital Tourist ID is not available yet. Please re-login or complete registration.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    paddingTop: 56,
    backgroundColor: '#f2f4f9'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222'
  },
  placeholderText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    color: '#666'
  }
});