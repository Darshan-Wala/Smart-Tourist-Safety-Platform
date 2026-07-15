// Only social buttons section & imports changed from your last version.
// Replace entire file for clarity (keep your assets / other utils as-is).

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  StatusBar,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as yup from 'yup';
import {
  getPasswordForEmail,
  savePasswordForEmail,
  deletePasswordForEmail,
  hasSavedPassword
} from '../utils/securePasswordStore';
import { getBiometricCapability, biometricPrompt } from '../utils/biometricAuth';
import LinkText from '../components/LinkText';
import SocialButton from '../components/SocialButton';

const { width, height } = Dimensions.get('window');

const loginSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email required'),
  password: yup.string().min(6, 'Min 6 chars').required('Password required')
});

const FormInput = memo(function FormInput(props) {
  const {
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    keyboardType,
    icon,
    error,
    onSubmitEditing,
    returnKeyType = 'next',
    autoCapitalize = 'none',
    autoComplete,
    textContentType,
    inputRef,
    toggleSecure,
    showToggle,
    editable = true
  } = props;

  return (
    <View style={styles.inputWrapper}>
      <View style={[
        styles.inputContainer,
        error && styles.inputErrorBorder,
        !editable && styles.inputDisabled
      ]}>
        <Ionicons
          name={icon}
          size={20}
          color="rgba(255,255,255,0.7)"
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          importantForAutofill="yes"
          accessibilityLabel={placeholder}
          editable={editable}
        />
        {showToggle && (
          <TouchableOpacity onPress={toggleSecure} style={styles.eyeIcon}>
            <Ionicons
              name={secureTextEntry ? 'eye' : 'eye-off'}
              size={20}
              color="rgba(255,255,255,0.7)"
              accessibilityLabel={secureTextEntry ? 'Show password' : 'Hide password'}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ minHeight: 14 }}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
});

export default function LoginScreen({ navigation }) {
  const {
    login,
    actionLoading,
    initializing,
    signInWithGoogle
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [hasSavedForEmail, setHasSavedForEmail] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [maskedAutoFill, setMaskedAutoFill] = useState(false);
  const [pendingFill, setPendingFill] = useState(false);

  const [biometricInfo, setBiometricInfo] = useState({
    hasHardware: false,
    isEnrolled: false,
    types: [],
    canAttempt: false
  });
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  const passwordManuallyEdited = useRef(false);
  const passwordRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-80)).current;
  const formSlide = useRef(new Animated.Value(80)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 700, useNativeDriver: true
      }),
      Animated.timing(headerSlide, {
        toValue: 0, duration: 650, delay: 150, useNativeDriver: true
      }),
      Animated.timing(formSlide, {
        toValue: 0, duration: 650, delay: 250, useNativeDriver: true
      })
    ]).start();
  }, []);

  useEffect(() => {
    let loop;
    if (submitting || actionLoading) {
      spinAnim.setValue(0);
      loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true
        })
      );
      loop.start();
    }
    return () => { loop && loop.stop(); };
  }, [submitting, actionLoading]);

  useEffect(() => {
    (async () => {
      const cap = await getBiometricCapability();
      setBiometricInfo(cap);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const normalized = email.trim().toLowerCase();
      passwordManuallyEdited.current = false;
      setAutoFilled(false);
      setMaskedAutoFill(false);
      setHasSavedForEmail(false);
      setSavedPassword('');
      setPendingFill(false);
      setBiometricAttempted(false);

      if (!normalized) {
        setPassword('');
        setRememberMe(false);
        return;
      }

      const hasSaved = await hasSavedPassword(normalized);
      if (cancelled) return;
      setHasSavedForEmail(hasSaved);

      if (hasSaved) {
        if (biometricInfo.canAttempt) {
          setBiometricAttempted(true);
          const ok = await biometricPrompt('Authenticate to fill saved password');
          if (cancelled) return;
          if (ok) {
            const pwd = await getPasswordForEmail(normalized);
            if (!cancelled && pwd) {
              setSavedPassword(pwd);
              setPassword(pwd);
              setAutoFilled(true);
              setMaskedAutoFill(true);
              setRememberMe(true);
            }
          } else {
            setPendingFill(true);
          }
        } else {
          setPendingFill(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [email, biometricInfo.canAttempt]);

  const handleManualFill = useCallback(async () => {
    const normalized = email.trim().toLowerCase();
    const pwd = await getPasswordForEmail(normalized);
    if (pwd) {
      setSavedPassword(pwd);
      setPassword(pwd);
      setAutoFilled(true);
      setMaskedAutoFill(true);
      setRememberMe(true);
      setPendingFill(false);
    } else {
      Alert.alert('Info', 'No saved password found for this email.');
    }
  }, [email]);

  const handlePasswordChange = useCallback((val) => {
    if (maskedAutoFill) {
      setMaskedAutoFill(false);
      setAutoFilled(false);
      setSavedPassword('');
      setPassword(val);
      passwordManuallyEdited.current = true;
      return;
    }
    passwordManuallyEdited.current = true;
    setPassword(val);
  }, [maskedAutoFill]);

  const validate = useCallback(async () => {
    try {
      await loginSchema.validate({ email, password }, { abortEarly: false });
      setFieldErrors({});
      return true;
    } catch (e) {
      if (e.inner) {
        const errs = {};
        e.inner.forEach(err => {
          if (!errs[err.path]) errs[err.path] = err.message;
        });
        setFieldErrors(errs);
      } else {
        Alert.alert('Validation Error', e.message);
      }
      return false;
    }
  }, [email, password]);

  const handleSubmit = useCallback(async () => {
    if (submitting || actionLoading) return;
    const ok = await validate();
    if (!ok) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const normalized = email.trim().toLowerCase();
      if (rememberMe) {
        await savePasswordForEmail(normalized, password);
      } else {
        await deletePasswordForEmail(normalized);
      }
    } catch (e) {
      Alert.alert('Login Failed', e.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, actionLoading, validate, login, email, password, rememberMe]);

  const disabled = submitting || actionLoading || initializing;

  const spinnerRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const toggleRememberMe = useCallback(async () => {
    const next = !rememberMe;
    setRememberMe(next);
    const normalized = email.trim().toLowerCase();
    if (!next && normalized) {
      const exists = await hasSavedPassword(normalized);
      if (exists) {
        await deletePasswordForEmail(normalized);
      }
    }
  }, [rememberMe, email]);

  const handleToggleShowPassword = useCallback(() => {
    if (maskedAutoFill) {
      setMaskedAutoFill(false);
      setShowPassword(false);
    } else {
      setShowPassword(s => !s);
    }
  }, [maskedAutoFill]);

  const passwordDisplayValue = maskedAutoFill ? '• • • • saved' : password;
  const passwordSecure = maskedAutoFill ? false : !showPassword;

  return (
    <ImageBackground
      source={require('../assets/login-background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)']}
        style={styles.overlay}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.headerSection,
              { opacity: fadeAnim, transform: [{ translateY: headerSlide }] }
            ]}
          >
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#FF6B6B', '#4ECDC4', '#45B7D1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="airplane" size={40} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.mainTitle}>Tour & Travel</Text>
            <Text style={styles.subtitle}>Discover the world with us</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.formWrapper,
              { opacity: fadeAnim, transform: [{ translateY: formSlide }] }
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              style={styles.formBackground}
            >
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue your journey</Text>

              <View style={styles.inputsContainer}>
                <FormInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  secureTextEntry={false}
                  keyboardType="email-address"
                  icon="mail"
                  error={fieldErrors.email}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current && passwordRef.current.focus()}
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />

                <View style={styles.inputWrapper}>
                  <View style={[
                    styles.inputContainer,
                    fieldErrors.password && styles.inputErrorBorder
                  ]}>
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color="rgba(255,255,255,0.7)"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder={maskedAutoFill ? '' : 'Password'}
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={passwordDisplayValue}
                      secureTextEntry={passwordSecure}
                      onChangeText={handlePasswordChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      importantForAutofill="yes"
                      accessibilityLabel="Password"
                    />
                    <TouchableOpacity onPress={handleToggleShowPassword} style={styles.eyeIcon}>
                      <Ionicons
                        name={maskedAutoFill ? 'eye' : (passwordSecure ? 'eye' : 'eye-off')}
                        size={20}
                        color="rgba(255,255,255,0.7)"
                        accessibilityLabel={
                          maskedAutoFill
                            ? 'Reveal saved password'
                            : passwordSecure ? 'Show password' : 'Hide password'
                        }
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={{ minHeight: 14 }}>
                    {fieldErrors.password
                      ? <Text style={styles.errorText}>{fieldErrors.password}</Text>
                      : null}
                  </View>
                </View>
              </View>

              {pendingFill && hasSavedForEmail && (
                <TouchableOpacity
                  onPress={handleManualFill}
                  style={styles.fillSavedPill}
                  accessibilityLabel="Fill saved password"
                >
                  <Ionicons name="key" size={14} color="#0f2027" />
                  <Text style={styles.fillSavedPillText}>Fill saved password</Text>
                </TouchableOpacity>
              )}

              <View style={styles.rowBetween}>
                <TouchableOpacity
                  style={styles.rememberWrap}
                  onPress={toggleRememberMe}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.checkboxBase,
                    rememberMe && styles.checkboxChecked
                  ]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color="#0f2027" />
                    )}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>

                <View style={styles.forgotPasswordInline}>
                  <LinkText
                    onPress={() => navigation.navigate('ForgotPassword')}
                    variant="accent"
                    accessibilityLabel="Forgot Password"
                  >
                    Forgot Password?
                  </LinkText>
                </View>
              </View>

              {autoFilled && maskedAutoFill && (
                <Text style={styles.autoFillInfo}>
                  Saved password masked. Tap the eye to reveal or start typing to replace it.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.loginButton, disabled && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={disabled}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#4ECDC4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButtonGradient}
                >
                  {disabled ? (
                    <View style={styles.loadingContainer}>
                      <Animated.View
                        style={[
                          styles.loadingSpinner,
                          { transform: [{ rotate: spinnerRotate }] }
                        ]}
                      >
                        <Ionicons name="refresh" size={20} color="white" />
                      </Animated.View>
                      <Text style={styles.loginButtonText}>
                        {initializing ? 'Preparing...' : 'Signing In...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialContainer}>
                <SocialButton
                  iconName="logo-google"
                  onPress={signInWithGoogle}
                  loading={actionLoading}
                  disabled={actionLoading}
                  accessibilityLabel="Sign in with Google"
                />
                <SocialButton
                  iconName="ellipsis-horizontal"
                  disabled
                  accessibilityLabel="Coming soon"
                  gradientColors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.07)']}
                />
                <SocialButton
                  iconName="ellipsis-horizontal"
                  disabled
                  accessibilityLabel="Coming soon"
                  gradientColors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.07)']}
                />
              </View>

              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <LinkText
                  onPress={() => navigation.navigate('Register')}
                  variant="accent"
                  accessibilityLabel="Sign Up"
                >
                  Sign Up
                </LinkText>
              </View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backgroundImage: { flex: 1, width, height },
  overlay: { ...StyleSheet.absoluteFillObject },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: (StatusBar.currentHeight || 0) + 30,
    paddingBottom: 60
  },
  headerSection: { alignItems: 'center', marginBottom: 42 },
  logoContainer: { marginBottom: 18 },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 6,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  formWrapper: { width: '100%' },
  formBackground: {
    borderRadius: 26,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)'
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 6
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 26
  },
  inputsContainer: { marginBottom: 10 },
  inputWrapper: { marginBottom: 2 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minHeight: 56,
    paddingRight: 4
  },
  inputDisabled: { opacity: 0.6 },
  inputErrorBorder: { borderColor: '#FF6B6B' },
  inputIcon: { marginLeft: 15, marginRight: 10 },
  input: {
    flex: 1,
    height: 56,
    color: 'white',
    fontSize: 16,
    paddingRight: 12
  },
  eyeIcon: { padding: 14 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkboxBase: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'transparent'
  },
  checkboxChecked: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4'
  },
  rememberText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600'
  },
  forgotPasswordInline: { padding: 4 },
  autoFillInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 12
  },
  fillSavedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: '#4ECDC4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 12
  },
  fillSavedPillText: {
    color: '#0f2027',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  loginButton: { marginTop: 4, marginBottom: 26, borderRadius: 16, overflow: 'hidden' },
  loginButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  loadingSpinner: { marginRight: 10 },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.34)'
  },
  dividerText: {
    color: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 14,
    fontSize: 12
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 26
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  signupText: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  errorText: { color: '#FF6B6B', fontSize: 12 }
});