import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordScreen({ navigation }) {
  const { resetPassword, actionLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSend = useCallback(async () => {
    if (!validEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      setSubmitting(true);
      await resetPassword(email.trim());
      setSent(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
    }
  }, [email, resetPassword, validEmail]);

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
          <Text style={styles.heading}>Forgot Password</Text>
          <Text style={styles.subheading}>
            Enter the email associated with your account and we'll send you a reset link.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail" size={20} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
            </View>

            {!sent && (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  ((!validEmail) || submitting || actionLoading) && { opacity: 0.55 }
                ]}
                disabled={!validEmail || submitting || actionLoading}
                onPress={handleSend}
              >
                <LinearGradient
                  colors={['#4568dc', '#b06ab3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendBtnGradient}
                >
                  {submitting || actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.sendBtnText}>Send Reset Link</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {sent && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={28} color="#29b18d" />
                <Text style={styles.successTitle}>Email Sent</Text>
                <Text style={styles.successMsg}>
                  If an account exists for {email.trim()}, you will receive a reset link shortly.
                </Text>
                <TouchableOpacity
                  style={styles.backLoginBtn}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.backLoginText}>Return to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => navigation.goBack()}
            disabled={submitting || actionLoading}
          >
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  heading: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5
  },
  subheading: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 26
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15
  },
  sendBtn: {
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden'
  },
  sendBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5
  },
  successBox: {
    marginTop: 28,
    alignItems: 'center'
  },
  successTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10
  },
  successMsg: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8
  },
  backLoginBtn: {
    marginTop: 20,
    backgroundColor: '#29b18d',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12
  },
  backLoginText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5
  },
  cancelLink: {
    marginTop: 24,
    alignSelf: 'center'
  },
  cancelLinkText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5
  }
});