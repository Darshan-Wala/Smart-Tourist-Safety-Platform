import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
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

const { width, height } = Dimensions.get('window');

/* ---------- Validation Schema (stable) ---------- */
const useRegisterSchema = () =>
  useMemo(
    () =>
      yup.object({
        fullName: yup.string().min(2, 'Too short').required('Full name required'),
        nationality: yup.string().min(2, 'Too short').required('Nationality required'),
        email: yup.string().email('Invalid email').required('Email required'),
        phoneNumber: yup
          .string()
          .min(8, 'Too short')
          .required('Phone required'),
        password: yup.string().min(6, 'Min 6 chars').required('Password required'),
        confirmPassword: yup
          .string()
          .oneOf([yup.ref('password')], 'Passwords must match')
          .required('Confirm password required'),
        agreeToTerms: yup.bool().oneOf([true], 'You must accept Terms')
      }),
    []
  );

/* ---------- Memoized Form Input Component ---------- */
const FormInput = memo(function FormInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  icon,
  error,
  inputRef,
  returnKeyType = 'next',
  onSubmitEditing,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  showToggle,
  toggleSecure
}) {
  return (
    <View style={styles.inputWrapper}>
      <View style={[styles.inputContainer, error && styles.inputErrorBorder]}>
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
        />
        {showToggle && (
          <TouchableOpacity
            onPress={toggleSecure}
            style={styles.eyeIcon}
            accessibilityLabel={secureTextEntry ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={secureTextEntry ? 'eye' : 'eye-off'}
              size={20}
              color="rgba(255,255,255,0.7)"
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

export default function RegisterScreen({ navigation }) {
  const { register, actionLoading, initializing } = useAuth();

  // Core form state
  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Local state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Refs for focus chaining
  const fullNameRef = useRef(null);
  const nationalityRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-80)).current;
  const formSlide = useRef(new Animated.Value(80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Schema
  const schema = useRegisterSchema();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 750,
        useNativeDriver: true
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 650,
        delay: 120,
        useNativeDriver: true
      }),
      Animated.timing(formSlide, {
        toValue: 0,
        duration: 650,
        delay: 240,
        useNativeDriver: true
      })
    ]).start();

    // Pulse decoration
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1900,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1900,
          useNativeDriver: true
        })
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, []);

  // Spinner loop
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
    return () => {
      loop && loop.stop();
    };
  }, [submitting, actionLoading]);

  const validateForm = useCallback(async () => {
    try {
      await schema.validate(
        {
          fullName,
          nationality,
          email,
          phoneNumber,
          password,
          confirmPassword,
          agreeToTerms
        },
        { abortEarly: false }
      );
      setErrors({});
      return true;
    } catch (e) {
      if (e.inner) {
        const map = {};
        e.inner.forEach(err => {
          if (!map[err.path]) map[err.path] = err.message;
        });
        setErrors(map);
      } else {
        Alert.alert('Validation Error', e.message);
      }
      return false;
    }
  }, [
    schema,
    fullName,
    nationality,
    email,
    phoneNumber,
    password,
    confirmPassword,
    agreeToTerms
  ]);

  const handleSubmit = useCallback(async () => {
    if (submitting || actionLoading || initializing) return;
    const ok = await validateForm();
    if (!ok) return;

    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        nationality: nationality.trim(),
        passportNumber: '',
        emergencyContact: '',
        emergencyPhone: ''
      });
      // AuthContext will redirect automatically
    } catch (e) {
      Alert.alert('Registration Failed', e.message || 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    actionLoading,
    initializing,
    validateForm,
    register,
    fullName,
    email,
    password,
    phoneNumber,
    nationality
  ]);

  const disabled = submitting || actionLoading || initializing;
  const spinnerRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <ImageBackground
      source={require('../assets/login-background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)']}
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
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back to login"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
              style={styles.backButtonGradient}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Header */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: headerSlide }]
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#4ECDC4', '#44A08D', '#096066']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="compass" size={38} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.mainTitle}>Join the Journey</Text>
            <Text style={styles.subtitle}>Create your travel account today</Text>

            {/* Decorative animated icons */}
            <View style={styles.decorationLayer}>
              <Animated.View
                style={[
                  styles.floatingIcon,
                  { top: 20, right: 18, transform: [{ scale: pulseAnim }] }
                ]}
              >
                <Ionicons name="map" size={18} color="rgba(255,255,255,0.6)" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.floatingIcon,
                  { top: 70, left: 22, transform: [{ scale: pulseAnim }] }
                ]}
              >
                <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.5)" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.floatingIcon,
                  { top: 50, right: 60, transform: [{ scale: pulseAnim }] }
                ]}
              >
                <Ionicons name="star" size={14} color="rgba(255,255,255,0.45)" />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View
            style={[
              styles.formWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlide }]
              }
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
              style={styles.formBackground}
            >
              <Text style={styles.formTitle}>Create Account</Text>
              <Text style={styles.formSubtitle}>
                Fill in your details to get started
              </Text>

              <View style={styles.inputsContainer}>
                <FormInput
                  placeholder="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  icon="person"
                  inputRef={fullNameRef}
                  onSubmitEditing={() => nationalityRef.current?.focus()}
                  textContentType="name"
                  autoComplete="name"
                  autoCapitalize="words"
                  error={errors.fullName}
                />
                <FormInput
                  placeholder="Nationality"
                  value={nationality}
                  onChangeText={setNationality}
                  icon="flag"
                  inputRef={nationalityRef}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  autoComplete="off"
                  textContentType="none"
                  autoCapitalize="words"
                  error={errors.nationality}
                />
                <FormInput
                  placeholder="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  icon="mail"
                  keyboardType="email-address"
                  inputRef={emailRef}
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  error={errors.email}
                />
                <FormInput
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  icon="call"
                  keyboardType="phone-pad"
                  inputRef={phoneRef}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  error={errors.phoneNumber}
                />
                <FormInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  icon="lock-closed"
                  secureTextEntry={!showPassword}
                  inputRef={passwordRef}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  showToggle
                  toggleSecure={() => setShowPassword(s => !s)}
                  error={errors.password}
                />
                <FormInput
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  icon="lock-closed"
                  secureTextEntry={!showConfirm}
                  inputRef={confirmPasswordRef}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  showToggle
                  toggleSecure={() => setShowConfirm(s => !s)}
                  error={errors.confirmPassword}
                />
              </View>

              {/* Terms */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreeToTerms(t => !t)}
                activeOpacity={0.8}
                accessibilityLabel="Agree to terms"
              >
                <View
                  style={[
                    styles.checkbox,
                    errors.agreeToTerms && { borderColor: '#FF6B6B' }
                  ]}
                >
                  {agreeToTerms && (
                    <LinearGradient
                      colors={['#4ECDC4', '#44A08D']}
                      style={styles.checkboxFill}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                    </LinearGradient>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.termsLink}>Terms & Conditions</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
                  <View style={{ minHeight: 14 }}>
                    {errors.agreeToTerms ? (
                      <Text style={styles.errorText}>{errors.agreeToTerms}</Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  (!agreeToTerms || disabled) && styles.disabledButton
                ]}
                onPress={handleSubmit}
                disabled={disabled || !agreeToTerms}
                accessibilityLabel="Create account"
              >
                <LinearGradient
                  colors={
                    !agreeToTerms
                      ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']
                      : ['#4ECDC4', '#44A08D']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.registerButtonGradient}
                >
                  {disabled ? (
                    <View style={styles.loadingRow}>
                      <Animated.View
                        style={[
                          styles.loadingSpinner,
                          { transform: [{ rotate: spinnerRotate }] }
                        ]}
                      >
                        <Ionicons name="refresh" size={20} color="white" />
                      </Animated.View>
                      <Text style={styles.registerButtonText}>
                        {initializing
                          ? 'Preparing...'
                          : actionLoading || submitting
                          ? 'Creating...'
                          : 'Please Wait'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.registerButtonText}>Create Account</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social buttons (placeholders) */}
              <View style={styles.socialRow}>
                {['logo-google', 'logo-facebook', 'logo-apple'].map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={styles.socialButton}
                    onPress={() =>
                      Alert.alert('Coming Soon', 'Social sign-up not enabled yet.')
                    }
                    accessibilityLabel={`Sign up with ${icon.split('-')[1]}`}
                  >
                    <LinearGradient
                      colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                      style={styles.socialButtonGradient}
                    >
                      <Ionicons name={icon} size={22} color="white" />
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Navigation to Login */}
              <View style={styles.switchAuthRow}>
                <Text style={styles.switchAuthText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.switchAuthLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  flex: { flex: 1 },
  backgroundImage: { flex: 1, width, height },
  overlay: { ...StyleSheet.absoluteFillObject },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: (StatusBar.currentHeight || 0) + 34,
    paddingBottom: 60
  },
  backButton: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 0) + 24,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    zIndex: 50
  },
  backButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 42,
    marginTop: 40
  },
  logoContainer: { marginBottom: 18 },
  logoGradient: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.33,
    shadowRadius: 18,
    elevation: 12
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  decorationLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%'
  },
  floatingIcon: {
    position: 'absolute'
  },
  formWrapper: { width: '100%' },
  formBackground: {
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24
  },
  inputsContainer: { marginBottom: 10 },
  inputWrapper: { marginBottom: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    minHeight: 56,
    paddingRight: 4
  },
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
  errorText: { color: '#FF6B6B', fontSize: 12 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 28
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 5,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center'
  },
  termsText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20
  },
  termsLink: { color: '#4ECDC4', fontWeight: '700' },
  registerButton: {
    marginBottom: 28,
    borderRadius: 16,
    overflow: 'hidden'
  },
  disabledButton: { opacity: 0.65 },
  registerButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  loadingSpinner: { marginRight: 10 },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)'
  },
  dividerText: {
    color: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 14,
    fontSize: 11
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 28
  },
  socialButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden'
  },
  socialButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  switchAuthText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14
  },
  switchAuthLink: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '700'
  }
});