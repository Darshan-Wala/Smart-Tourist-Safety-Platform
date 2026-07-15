import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AuthService from '../services/authService';
import * as LocalAuthentication from 'expo-local-authentication';
import QRCode from 'react-native-qrcode-svg';

const UNLOCK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Props:
 *  - onUnlock?(secureData) : optional callback fired AFTER successful unlock
 */
export default function SecureDigitalIDCard({ onUnlock }) {
  const { user, reauthenticate, isDigitalIDValid } = useAuth();
  const [secureData, setSecureData] = useState(null);
  const [unlockedAt, setUnlockedAt] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const locked = !unlockedAt || (Date.now() - unlockedAt) > UNLOCK_WINDOW_MS;

  // Check biometric availability
  useEffect(() => {
    (async () => {
      try {
        const hasHW = await LocalAuthentication.hasHardwareAsync();
        if (!hasHW) return;
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(enrolled);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Auto re-lock interval
  useEffect(() => {
    if (locked) return;
    const interval = setInterval(() => {
      if ((Date.now() - unlockedAt) > UNLOCK_WINDOW_MS) {
        handleLock();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [locked, unlockedAt]);

  const fetchSecure = useCallback(async () => {
    if (!user) throw new Error('No user');
    return await AuthService.fetchSecureDigitalID(user.uid);
  }, [user]);

  const handleLock = () => {
    setSecureData(null);
    setUnlockedAt(null);
    setPwd('');
    setModalVisible(false);
  };

  const afterUnlock = (data) => {
    setSecureData(data);
    setUnlockedAt(Date.now());
    if (typeof onUnlock === 'function') {
      try {
        onUnlock(data);
      } catch (e) {
        // swallow to avoid breaking unlock
      }
    }
  };

  const unlockWithPassword = async () => {
    if (!pwd) return;
    setLoading(true);
    try {
      await reauthenticate(pwd);
      const data = await fetchSecure();
      afterUnlock(data);
      setModalVisible(false);
      setPwd('');
    } catch (e) {
      Alert.alert('Unlock Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const unlockWithBiometric = async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view Digital ID'
      });
      if (!res.success) return;
      const data = await fetchSecure();
      afterUnlock(data);
    } catch (e) {
      Alert.alert('Biometric Failed', e.message);
    }
  };

  const expired = secureData?.digitalIDValidUntil
    ? !isDigitalIDValid(secureData.digitalIDValidUntil)
    : false;

  const qrPayload = secureData
    ? JSON.stringify({
        v: 1,
        id: secureData.digitalTouristID,
        uid: user.uid,
        validUntil: secureData.digitalIDValidUntil
      })
    : '';

  const minutesRemaining = unlockedAt
    ? Math.max(0, Math.ceil((UNLOCK_WINDOW_MS - (Date.now() - unlockedAt)) / 60000))
    : 0;

  return (
    <LinearGradient
      colors={['#0f2027', '#203a43', '#2c5364']}
      style={[styles.card, locked && styles.cardLocked]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Digital Tourist ID</Text>
        {locked ? (
          <Ionicons name="lock-closed" size={18} color="#fff" />
        ) : (
          <TouchableOpacity onPress={handleLock} accessibilityLabel="Lock ID">
            <Ionicons name="lock-open" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {locked && (
        <View style={styles.lockedBody}>
          <Text style={styles.lockedText}>
            Secure information is locked. Re-authenticate to view.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="key" size={18} color="white" />
              <Text style={styles.actionBtnText}>Password</Text>
            </TouchableOpacity>
            {biometricAvailable && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={unlockWithBiometric}
              >
                <Ionicons name="finger-print" size={20} color="white" />
                <Text style={styles.actionBtnText}>Biometric</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {!locked && secureData && (
        <View style={styles.dataBody}>
          <View style={styles.qrWrap}>
            <QRCode
              value={qrPayload}
              size={140}
              backgroundColor="transparent"
              color="#fff"
            />
          </View>

          <Text style={styles.label}>ID</Text>
          <Text style={styles.value}>{secureData.digitalTouristID}</Text>

          <Text style={[
            styles.status,
            expired ? styles.statusExpired : styles.statusValid
          ]}>
            {expired ? 'EXPIRED' : 'ACTIVE'}
          </Text>

          <Text style={styles.meta}>
            Valid Until: {new Date(secureData.digitalIDValidUntil).toDateString()}
          </Text>

          <Text style={styles.hashLabel}>Hash (SHA-256)</Text>
          <Text style={styles.hashValue}>
            {secureData.digitalIDHash}
          </Text>

          <Text style={styles.relockNote}>
            Auto-lock in {minutesRemaining} min
          </Text>
        </View>
      )}

      {/* Password Modal */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => !loading && setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unlock Digital ID</Text>
            <Text style={styles.modalDesc}>
              Enter your password to access your secure Digital Tourist ID.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry
              value={pwd}
              onChangeText={setPwd}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, loading && { opacity: 0.5 }]}
                disabled={loading}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, (!pwd || loading) && { opacity: 0.5 }]}
                disabled={!pwd || loading}
                onPress={unlockWithPassword}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {loading ? 'Verifying...' : 'Unlock'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginVertical: 16
  },
  cardLocked: { opacity: 0.97 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  lockedBody: {
    alignItems: 'center',
    paddingVertical: 22
  },
  lockedText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8
  },
  actionRow: {
    flexDirection: 'row',
    gap: 14
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  dataBody: { marginTop: 12 },
  qrWrap: { alignItems: 'center', marginBottom: 16 },
  label: { color: '#7fc8ff', fontSize: 11, letterSpacing: 0.5 },
  value: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  status: { marginTop: 10, fontWeight: '600', fontSize: 12 },
  statusValid: { color: '#9ee6c4' },
  statusExpired: { color: '#ff9c9c' },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 10 },
  hashLabel: {
    color: '#7fc8ff', fontSize: 11, marginTop: 16, letterSpacing: 0.5, fontWeight: '600'
  },
  hashValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' })
  },
  relockNote: {
    color: '#9ee6c4',
    marginTop: 14,
    fontSize: 11
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#15232d',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8
  },
  modalInput: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '600'
  },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#29b18d'
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontWeight: '700'
  }
});