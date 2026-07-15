import React, { useCallback, useState } from 'react';
import { Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, View, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { isValidAadhaar } from '../utils/verificationValidation';
import {
  setAadhaarVerification,
  clearAadhaarVerification,
  getVerificationStatus,
} from '../services/verificationStorage';

export default function AadhaarVerificationScreen() {
  const navigation = useNavigation();
  const [aadhaar, setAadhaar] = useState('');
  const [hasStored, setHasStored] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const normalize = (t) => String(t || '').replace(/\D/g, '');

  const load = async () => {
    try {
      const v = await getVerificationStatus();
      const value = v?.aadhaar?.number || '';
      const digits = normalize(value).slice(0, 12);
      const grouped = digits.replace(/(\d{4})(\d{0,4})?(\d{0,4})?/, (_, a, b = '', c = '') =>
        [a, b, c].filter(Boolean).join(' ')
      );
      setAadhaar(grouped);
      setHasStored(!!(value || v?.aadhaar?.verified));
    } catch (e) {
      // Non-fatal; user can still enter new data
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const submit = async () => {
    const digits = normalize(aadhaar);
    if (!isValidAadhaar(digits)) {
      Alert.alert('Invalid Aadhaar Number', 'Aadhaar must be 12 digits and pass checksum. Please recheck.');
      return;
    }
    try {
      setSubmitting(true);
      await setAadhaarVerification(digits, true);
      Alert.alert('Aadhaar Saved', 'Aadhaar verification completed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const code = e?.code || e?.message || 'Unknown error';
      Alert.alert('Could not save Aadhaar', String(code));
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (t) => {
    const digits = normalize(t).slice(0, 12);
    const grouped = digits.replace(/(\d{4})(\d{0,4})?(\d{0,4})?/, (_, a, b = '', c = '') =>
      [a, b, c].filter(Boolean).join(' ')
    );
    setAadhaar(grouped);
  };

  const removeCreds = async () => {
    Alert.alert(
      'Remove credentials',
      'This will clear your saved Aadhaar number and set status to Pending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await clearAadhaarVerification();
              setAadhaar('');
              setHasStored(false);
              Alert.alert('Removed', 'Aadhaar credentials removed.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              const code = e?.code || e?.message || 'Unknown error';
              Alert.alert('Could not remove', String(code));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.container}>
      <Text style={styles.title}>Aadhaar Verification</Text>
      <Text style={styles.subtitle}>
        Enter your 12-digit Aadhaar number. We validate format and checksum locally.
      </Text>

      <Text style={styles.label}>Aadhaar number</Text>
      <TextInput
        style={styles.input}
        placeholder="1234 5678 9012"
        placeholderTextColor="#999"
        keyboardType="number-pad"
        value={aadhaar}
        onChangeText={onChange}
        maxLength={14}
      />

      <TouchableOpacity style={[styles.saveBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save & Verify</Text>}
      </TouchableOpacity>

      <View style={{ height: 8 }} />
      <TouchableOpacity onPress={removeCreds} disabled={!hasStored || submitting}>
        <Text style={[styles.removeText, (!hasStored || submitting) && { opacity: 0.5 }]}>Remove credentials</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={submitting}>
        <Text style={[styles.cancelText, submitting && { opacity: 0.5 }]}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0f2027' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 13, color: '#fff', marginBottom: 6, fontWeight: '700' },
  input: {
    height: 48, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, fontSize: 16, letterSpacing: 1, color: '#fff', marginBottom: 16,
  },
  saveBtn: { backgroundColor: '#29b18d', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900' },
  removeText: { color: '#ff8a8a', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  cancelBtn: { marginTop: 18, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
});