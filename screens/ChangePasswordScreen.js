import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const MIN_LEN = 8;

// Basic strength scoring
function scorePassword(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= MIN_LEN) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  if (pwd.length >= 12) score += 1;
  return Math.min(score, 5); // cap
}

function strengthLabel(score) {
  switch (score) {
    case 0:
    case 1: return 'Very Weak';
    case 2: return 'Weak';
    case 3: return 'Fair';
    case 4: return 'Good';
    case 5: return 'Strong';
    default: return 'Weak';
  }
}

function strengthColor(score) {
  switch (score) {
    case 0:
    case 1: return '#ff5f5f';
    case 2: return '#ff9f43';
    case 3: return '#f1c40f';
    case 4: return '#29b18d';
    case 5: return '#2ecc71';
    default: return '#ff9f43';
  }
}

export default function ChangePasswordScreen({ navigation }) {
  const { changePassword, actionLoading } = useAuth();

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);

  // visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const newScore = useMemo(() => scorePassword(newPwd), [newPwd]);

  const validationError = useMemo(() => {
    if (!currentPwd) return 'Enter current password.';
    if (!newPwd) return 'Enter new password.';
    if (newPwd.length < MIN_LEN) return `New password must be at least ${MIN_LEN} characters.`;
    if (newPwd === currentPwd) return 'New password must be different.';
    if (confirmPwd !== newPwd) return 'Passwords do not match.';
    if (newScore < 3) return 'Password too weak. Add numbers, mixed case, or symbols.';
    return null;
  }, [currentPwd, newPwd, confirmPwd, newScore]);

  const handleSave = useCallback(async () => {
    if (validationError) {
      Alert.alert('Cannot Change Password', validationError);
      return;
    }
    try {
      setSaving(true);
      await changePassword(currentPwd, newPwd);
      Alert.alert('Success', 'Password updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }, [validationError, currentPwd, newPwd, changePassword, navigation]);

  const PasswordField = ({
    label,
    value,
    onChange,
    placeholder,
    show,
    setShow,
    testID
  }) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={value}
          secureTextEntry={!show}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="oneTimeCode" // prevents iOS from auto-filling old pwd
          testID={testID}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShow(s => !s)}
          accessibilityLabel={show ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={show ? 'eye-off' : 'eye'}
            size={20}
            color="rgba(255,255,255,0.85)"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Change Password</Text>

          <View style={styles.formCard}>
            <PasswordField
              label="Current Password"
              value={currentPwd}
              onChange={setCurrentPwd}
              placeholder="Current password"
              show={showCurrent}
              setShow={setShowCurrent}
              testID="currentPasswordInput"
            />

            <View style={{ marginBottom: 4 }}>
              <PasswordField
                label="New Password"
                value={newPwd}
                onChange={setNewPwd}
                placeholder="New password"
                show={showNew}
                setShow={setShowNew}
                testID="newPasswordInput"
              />
              {newPwd.length > 0 && (
                <>
                  <View style={styles.strengthRow}>
                    <View
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor: strengthColor(newScore),
                          width: `${(newScore / 5) * 100}%`
                        }
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.strengthLabel,
                      { color: strengthColor(newScore) }
                    ]}
                  >
                    {strengthLabel(newScore)}
                  </Text>
                </>
              )}
            </View>

            <PasswordField
              label="Confirm New Password"
              value={confirmPwd}
              onChange={setConfirmPwd}
              placeholder="Re-enter new password"
              show={showConfirm}
              setShow={setShowConfirm}
              testID="confirmPasswordInput"
            />

            {validationError && (
              <Text style={styles.errorText}>{validationError}</Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, (saving || actionLoading) && { opacity: 0.6 }]}
                disabled={saving || actionLoading}
                onPress={() => {
                  if (currentPwd || newPwd || confirmPwd) {
                    Alert.alert('Discard changes?', 'Entered values will be cleared.', [
                      { text: 'Stay', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => navigation.goBack()
                      }
                    ]);
                  } else {
                    navigation.goBack();
                  }
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (validationError || saving || actionLoading) && { opacity: 0.5 }
                ]}
                disabled={!!validationError || saving || actionLoading}
                onPress={handleSave}
              >
                {saving || actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="key" size={18} color="#fff" />
                    <Text style={styles.saveText}>Update</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.helper}>
              Use at least {MIN_LEN} chars. Mix upper & lower case, numbers, and symbols for a stronger password.
            </Text>
          </View>

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
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 18,
    letterSpacing: 0.5
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  fieldBlock: { marginBottom: 18 },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
    fontWeight: '600'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingRight: 6
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14
  },
  eyeButton: {
    padding: 8
  },
  strengthRow: {
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    overflow: 'hidden'
  },
  strengthBar: {
    height: '100%'
  },
  strengthLabel: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  errorText: {
    color: '#ff8080',
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600'
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#29b18d'
  },
  saveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  helper: {
    marginTop: 20,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
    textAlign: 'center'
  }
});