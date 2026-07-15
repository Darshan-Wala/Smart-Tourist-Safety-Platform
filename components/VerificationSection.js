// Tourist Profile Verification section shown on Profile screen.
// "Remove credentials" option has been moved into the individual Update screens.
// This component loads verification state on focus and can notify parent via onStatusChange.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import VerificationDropdown from './VerificationDropdown';
import {
  getVerificationStatus,
  setSelectedMethods,
} from '../services/verificationStorage';

export default function VerificationSection({ onStatusChange }) {
  const navigation = useNavigation();
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState({
    selectedMethods: [],
    passport: { number: '', verified: false },
    aadhaar: { number: '', verified: false },
    lastUpdated: null,
  });

  const notifyParent = (s) => {
    if (typeof onStatusChange === 'function') onStatusChange(s);
  };

  const load = async () => {
    const s = await getVerificationStatus();
    setStatus(s);
    setSelected(s.selectedMethods || []);
    notifyParent(s);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onChangeSelected = async (methods) => {
    setSelected(methods);
    const next = await setSelectedMethods(methods);
    setStatus(next);
    notifyParent(next);
  };

  const anyVerified = status.passport.verified || status.aadhaar.verified;
  const mustSelectAtLeastOne = selected.length > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>
        <Ionicons name="shield-checkmark" size={18} color="#4ECDC4" /> Tourist Profile Verification
      </Text>
      <Text style={styles.subtitle}>Select at least one method and complete verification.</Text>

      <View style={{ height: 12 }} />

      <VerificationDropdown value={selected} onChange={onChangeSelected} requireOne />

      <View style={{ height: 16 }} />

      {selected.includes('passport') && (
        <Row
          icon="document-text"
          title="Passport verification"
          verified={status.passport.verified}
          onPress={() => navigation.navigate('PassportVerification')}
          detail={status.passport.number ? maskPassport(status.passport.number) : 'Not submitted'}
        />
      )}

      {selected.includes('aadhaar') && (
        <Row
          icon="card"
          title="Aadhaar verification"
          verified={status.aadhaar.verified}
          onPress={() => navigation.navigate('AadhaarVerification')}
          detail={status.aadhaar.number ? maskAadhaar(status.aadhaar.number) : 'Not submitted'}
        />
      )}

      <View style={{ height: 12 }} />

      {!mustSelectAtLeastOne && (
        <Banner type="error" text="Select at least one verification method." />
      )}
      {mustSelectAtLeastOne && !anyVerified && (
        <Banner type="warning" text="Verify at least one selected method to proceed." />
      )}
      {anyVerified && <Banner type="success" text="At least one method verified." />}
    </View>
  );
}

function maskPassport(v) {
  const s = String(v).toUpperCase();
  if (s.length <= 2) return s;
  return s.slice(0, 2) + '*'.repeat(Math.max(0, s.length - 4)) + s.slice(-2);
}
function maskAadhaar(v) {
  const s = String(v).replace(/\s+/g, '');
  if (s.length !== 12) return s.replace(/\d(?=\d{4})/g, '*');
  return `${s.slice(0,4)} **** ${s.slice(-4)}`;
}

function Row({ icon, title, verified, onPress, detail }) {
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <Ionicons name={icon} size={18} color="rgba(255,255,255,0.92)" />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDetail}>{detail}</Text>
        </View>
      </View>

      <View style={styles.actionsCol}>
        <TouchableOpacity style={styles.action} onPress={onPress}>
          <Text style={styles.actionText}>{verified ? 'Update' : 'Verify'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.badge, { backgroundColor: verified ? '#29b18d' : 'rgba(255,255,255,0.25)' }]}>
        <Text style={styles.badgeText}>{verified ? 'Verified' : 'Pending'}</Text>
      </View>
    </View>
  );
}

function Banner({ type, text }) {
  const colors = {
    error: { bg: 'rgba(139,0,0,0.25)', fg: '#ff8a8a', br: 'rgba(255,255,255,0.15)' },
    warning: { bg: 'rgba(255,152,0,0.18)', fg: '#ffcc80', br: 'rgba(255,255,255,0.15)' },
    success: { bg: 'rgba(46,205,196,0.18)', fg: '#9ee6c4', br: 'rgba(255,255,255,0.15)' },
  }[type] || { bg: 'rgba(255,255,255,0.1)', fg: '#fff', br: 'rgba(255,255,255,0.15)' };
  return (
    <View style={[styles.banner, { backgroundColor: colors.bg, borderColor: colors.br }]}>
      <Text style={[styles.bannerText, { color: colors.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 16,
  },
  header: { color: '#fff', fontSize: 14, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  rowDetail: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  actionsCol: { alignItems: 'flex-end', justifyContent: 'center' },
  action: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 96,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  badge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#0b1a21', fontSize: 10, fontWeight: '900' },

  banner: { marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  bannerText: { fontSize: 12, fontWeight: '700' },
});