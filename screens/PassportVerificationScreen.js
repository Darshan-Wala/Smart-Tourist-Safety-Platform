import React, { useCallback, useState } from 'react';
import { Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, View, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { isValidPassport } from '../utils/verificationValidation';
import {
  setPassportVerification,
  clearPassportVerification,
  getVerificationStatus,
} from '../services/verificationStorage';

export default function PassportVerificationScreen() {
  const navigation = useNavigation();
  const [passport, setPassport] = useState('');
  const [hasStored, setHasStored] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const v = await getVerificationStatus();
      const value = v?.passport?.number || '';
      setPassport(String(value || '').toUpperCase());
      setHasStored(!!(value || v?.passport?.verified));
    } catch (e) {
      // Non-fatal
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const submit = async () => {
    const value = String(passport).trim().toUpperCase();
    if (!isValidPassport(value)) {
      Alert.alert('Invalid Passport Number', 'Please enter a valid passport number (6–9 alphanumeric, no spaces).');
      return;
    }
    try {
      setSubmitting(true);
      await setPassportVerification(value, true);
      Alert.alert('Passport Saved', 'Passport verification completed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const code = e?.code || e?.message || 'Unknown error';
      Alert.alert('Could not save Passport', String(code));
    } finally {
      setSubmitting(false);
    }
  };

  const removeCreds = async () => {
    Alert.alert(
      'Remove credentials',
      'This will clear your saved Passport number and set status to Pending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await clearPassportVerification();
              setPassport('');
              setHasStored(false);
              Alert.alert('Removed', 'Passport credentials removed.', [
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
      <Text style={styles.title}>Passport Verification</Text>
      <Text style={styles.subtitle}>
        Enter your passport number exactly as printed. This helps authorities confirm your identity if required.
      </Text>

      <Text style={styles.label}>Passport number</Text>
      <TextInput
        style={styles.input}
        placeholder="E.g. M1234567"
        placeholderTextColor="#999"
        autoCapitalize="characters"
        autoCorrect={false}
        value={passport}
        onChangeText={setPassport}
        maxLength={12}
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
    paddingHorizontal: 12, fontSize: 14, color: '#fff', marginBottom: 16,
  },
  saveBtn: { backgroundColor: '#29b18d', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900' },
  removeText: { color: '#ff8a8a', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  cancelBtn: { marginTop: 18, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
});