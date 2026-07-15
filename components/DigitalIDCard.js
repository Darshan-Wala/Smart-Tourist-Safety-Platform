/**
 * Secure Digital ID Card (replaces previous public display).
 * - Initially LOCKED: no ID / hash / QR exposed.
 * - User must re-enter password (reauthenticate) to unlock.
 * - After unlock: fetches secure fields directly from Firestore (not from cached profile).
 * - Auto-lock after UNLOCK_WINDOW_MS.
 *
 * Usage:
 *   <DigitalIDCard />
 * Place ONLY inside a protected Profile screen, not on Home.
 *
 * Dependencies:
 *  - react-native-paper (for Card, Text)
 *  - react-native-qrcode-svg
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import { isDigitalIDValid } from '../utils/digitalID';
import { Ionicons } from '@expo/vector-icons';

const UNLOCK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export default function DigitalIDCard() {
  const {
    user,
    reauthenticate,
    fetchSecureDigitalID,
    isDigitalIDValid: checkValid
  } = useAuth();

  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [secureData, setSecureData] = useState(null);
  const [unlockTime, setUnlockTime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  // Auto-lock after window
  useEffect(() => {
    if (!locked && unlockTime) {
      const interval = setInterval(() => {
        if (Date.now() - unlockTime > UNLOCK_WINDOW_MS) {
            doLock();
        }
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [locked, unlockTime]);

  const doLock = useCallback(() => {
    setLocked(true);
    setSecureData(null);
    setUnlockTime(null);
    setPassword('');
    setModalVisible(false);
  }, []);

  const unlock = useCallback(async () => {
    if (!user) return;
    if (!password) return;
    setBusy(true);
    try {
      // Reauthenticate
      await reauthenticate(password);
      // Fetch secure digital ID fields
      const data = await fetchSecureDigitalID(user.uid);
      setSecureData(data);
      setLocked(false);
      setUnlockTime(Date.now());
      setModalVisible(false);
      setPassword('');
    } catch (e) {
      Alert.alert('Unlock Failed', e.message || 'Unable to unlock.');
    } finally {
      setBusy(false);
    }
  }, [password, user, reauthenticate, fetchSecureDigitalID]);

  // Compose the QR payload only when unlocked & data present
  const qrPayload = secureData
    ? JSON.stringify({
        v: 1,
        id: secureData.digitalTouristID,
        uid: user.uid,
        validUntil: secureData.digitalIDValidUntil
      })
    : '';

  const stillValid = secureData?.digitalIDValidUntil
    ? checkValid(secureData.digitalIDValidUntil)
    : false;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title="Digital Tourist ID"
        subtitle={locked ? 'Locked' : 'Secure View'}
        titleStyle={styles.title}
        subtitleStyle={styles.subtitle}
        right={(props) =>
          !locked ? (
            <TouchableOpacity onPress={doLock} style={styles.iconBtn}>
              <Ionicons name="lock-open" size={20} color="#444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconBtn}>
              <Ionicons name="lock-closed" size={20} color="#444" />
            </TouchableOpacity>
          )
        }
      />
      <Card.Content>
        {locked && (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedText}>
              Secure ID is hidden. Re-enter password to view.
            </Text>
            <TouchableOpacity
              style={styles.unlockButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="key" size={16} color="#fff" />
              <Text style={styles.unlockButtonText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        )}

        {!locked && secureData && (
          <View>
            <View style={styles.qrWrap}>
              <QRCode
                value={qrPayload}
                size={150}
                backgroundColor="transparent"
                color="#222"
              />
            </View>

            <Text style={styles.label}>ID:</Text>
            <Text style={styles.id}>{secureData.digitalTouristID}</Text>

            <Text
              style={[
                styles.status,
                { color: stillValid ? '#43A047' : '#E53935' }
              ]}
            >
              {stillValid ? 'VALID' : 'EXPIRED'}
            </Text>

            <Text style={styles.metaSmall}>
              Valid Until:{' '}
              {new Date(secureData.digitalIDValidUntil).toLocaleDateString()}
            </Text>

            <Text style={styles.hashLabel}>Hash (SHA-256)</Text>
            <Text
              style={[
                styles.hashValue,
                Platform.select({ android: { fontFamily: 'monospace' } })
              ]}
            >
              {secureData.digitalIDHash}
            </Text>

            <Text style={styles.unlockWindow}>
              Auto-lock in{' '}
              {Math.max(
                0,
                Math.ceil(
                  (UNLOCK_WINDOW_MS - (Date.now() - unlockTime)) / 60000
                )
              )}{' '}
              min
            </Text>
          </View>
        )}
      </Card.Content>

      {/* Password Modal */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => !busy && setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unlock Digital ID</Text>
            <Text style={styles.modalDesc}>
              Re-enter your password to access your secure Digital Tourist ID.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor="rgba(0,0,0,0.4)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, busy && { opacity: 0.5 }]}
                onPress={() => !busy && setModalVisible(false)}
                disabled={busy}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  (!password || busy) && { opacity: 0.5 }
                ]}
                disabled={!password || busy}
                onPress={unlock}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Unlock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    marginBottom: 20
  },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  lockedContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  lockedText: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10
  },
  unlockButton: {
    flexDirection: 'row',
    backgroundColor: '#1565C0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6
  },
  unlockButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  qrWrap: { alignItems: 'center', marginVertical: 12 },
  label: { fontWeight: '600', marginTop: 4, fontSize: 13 },
  id: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  status: { marginTop: 10, fontWeight: '600' },
  metaSmall: { marginTop: 6, color: '#777', fontSize: 12 },
  hashLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 14,
    color: '#444',
    letterSpacing: 0.5
  },
  hashValue: {
    fontSize: 11,
    marginTop: 4,
    color: '#333'
  },
  unlockWindow: {
    marginTop: 12,
    fontSize: 11,
    color: '#1565C0',
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222'
  },
  modalDesc: {
    fontSize: 13,
    color: '#555',
    marginTop: 8,
    lineHeight: 18
  },
  modalInput: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eee'
  },
  modalBtnText: {
    color: '#444',
    fontWeight: '600'
  },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1565C0'
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontWeight: '700'
  }
});