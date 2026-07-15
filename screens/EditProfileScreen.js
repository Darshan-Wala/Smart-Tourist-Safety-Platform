import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Keep verification status check (UI moved to Profile)
import { getVerificationStatus } from '../services/verificationStorage';

const FIELD_ORDER = [
  'fullName',
  'phoneNumber',
  'nationality',
  // 'passportNumber', // removed from form; handled via verification flow
  'emergencyContact',
  'emergencyPhone'
];

export default function EditProfileScreen({ navigation }) {
  const { profile, user, updateProfile, actionLoading } = useAuth();

  // Local form state (passportNumber removed)
  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    phoneNumber: profile?.phoneNumber || '',
    nationality: profile?.nationality || '',
    emergencyContact: profile?.emergencyContact || '',
    emergencyPhone: profile?.emergencyPhone || ''
  });

  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  // Track original to detect changes
  const original = useMemo(() => ({
    fullName: profile?.fullName || '',
    phoneNumber: profile?.phoneNumber || '',
    nationality: profile?.nationality || '',
    emergencyContact: profile?.emergencyContact || '',
    emergencyPhone: profile?.emergencyPhone || ''
  }), [profile]);

  const onChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setTouched(t => ({ ...t, [key]: true }));
  };

  // Validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.fullName || form.fullName.trim().length < 2) {
      e.fullName = 'Name must be at least 2 characters';
    }
    if (form.phoneNumber && !/^[\d+\-\s()]{6,20}$/.test(form.phoneNumber.trim())) {
      e.phoneNumber = 'Invalid phone format';
    }
    if (form.emergencyPhone && !/^[\d+\-\s()]{6,20}$/.test(form.emergencyPhone.trim())) {
      e.emergencyPhone = 'Invalid emergency phone';
    }
    return e;
  }, [form]);

  const hasChanges = useMemo(() => {
    return FIELD_ORDER.some(k => (original[k] || '') !== (form[k] || ''));
  }, [original, form]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = useCallback(async () => {
    if (hasErrors) {
      Alert.alert('Fix Issues', 'Please correct highlighted fields.');
      return;
    }
    if (!hasChanges) {
      Alert.alert('No Changes', 'You have not modified anything.');
      return;
    }

    // Enforce verification requirement before saving profile changes
    try {
      const v = await getVerificationStatus();
      const hasSelection = (v.selectedMethods || []).length > 0;
      const anyVerified = !!(v.passport?.verified || v.aadhaar?.verified);
      if (!hasSelection || !anyVerified) {
        Alert.alert(
          'Verification Required',
          'Select at least one verification method (Passport or Aadhaar) and complete verification for at least one before saving.'
        );
        return;
      }
    } catch (e) {
      Alert.alert(
        'Verification Check Failed',
        'Unable to verify identity status. Please try again.'
      );
      return;
    }

    try {
      setSaving(true);
      // Build minimal payload with only changed fields (allow clearing by sending empty string)
      const payload = {};
      FIELD_ORDER.forEach(k => {
        if ((original[k] || '') !== (form[k] || '')) {
          payload[k] = form[k].trim() === '' ? '' : form[k].trim();
        }
      });
      await updateProfile(payload);
      Alert.alert('Saved', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }, [hasErrors, hasChanges, original, form, updateProfile, navigation]);

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert('Discard Changes?', 'Unsaved changes will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
      ]);
    } else {
      navigation.goBack();
    }
  };

  // Individual field renderer
  const renderField = (key, label, placeholder, keyboardType = 'default', secure = false) => {
    const value = form[key];
    const error = touched[key] && errors[key];
    return (
      <View style={styles.fieldBlock} key={key}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.35)"
          onChangeText={(v) => onChange(key, v)}
          keyboardType={keyboardType}
          autoCapitalize="none"
          secureTextEntry={secure}
          returnKeyType="next"
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#0f2027', '#203a43', '#2c5364']}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Edit Profile</Text>

          <View style={styles.metaCard}>
            <Ionicons name="person" size={22} color="#4ECDC4" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.metaLine} numberOfLines={1}>
                {user?.email}
              </Text>
              <Text style={styles.metaSub}>Email (read-only)</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            {renderField('fullName', 'Full Name *', 'Name')}
            {renderField('phoneNumber', 'Phone', '+91 55512 34567', 'phone-pad')}
            {renderField('nationality', 'Nationality', 'Country')}
            {/* Passport Number field removed */}
            <View style={styles.divider}/>
            <Text style={styles.sectionSmallHeading}>Emergency Contact</Text>
            {renderField('emergencyContact', 'Contact Name', 'Person to notify')}
            {renderField('emergencyPhone', 'Contact Phone', '+91 55512 34567', 'phone-pad')}
          </View>

          <View style={{ height: 16 }} />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, (saving || actionLoading) && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={saving || actionLoading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || actionLoading) && { opacity: 0.5 }
              ]}
              disabled={saving || actionLoading}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save" color="#fff" size={18} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Make changes and press Save. Fields marked * are required.
          </Text>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  heading: {
    color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 18, letterSpacing: 0.5
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  metaLine: { color: '#fff', fontSize: 14, fontWeight: '600' },
  metaSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16
  },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
    fontWeight: '600'
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  inputError: { borderColor: '#ff6b6b' },
  errorText: { color: '#ff8a8a', fontSize: 11, marginTop: 4 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 14
  },
  sectionSmallHeading: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#29b18d'
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  helperText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center'
  },
});