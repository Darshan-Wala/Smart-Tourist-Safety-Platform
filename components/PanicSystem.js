// Updated PanicSystem.js
// - Keeps the original layout, labels, and behavior.
// - Adds defensive guards, better cleanup, and optional-safe defaults so it never crashes if props are missing.
// - Prevents multiple concurrent timers/recordings and only starts features when allowed.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PanicSystem = ({
  visible,
  onClose,
  // Optional external lists (kept for future extension). If provided, we render them safely.
  actions,   // [{ key, label, icon, onPress }]
  contacts,  // [{ name, phone }]
}) => {
  const [isActivated, setIsActivated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);

  const [locationTracking, setLocationTracking] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);

  const [permissions, setPermissions] = useState({
    location: false,
    audio: false,
  });

  const recordingRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const stopRecordingTimeoutRef = useRef(null); // NEW: to clear 30s timeout if stopping early

  const modalScale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 90,
        friction: 10,
      }).start();
      requestPermissions();
    } else {
      modalScale.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    if (visible && !isActivated) loop.start(); else loop.stop();
    return () => loop.stop();
  }, [visible, isActivated]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopLocationTracking();
      stopAudioRecording();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (stopRecordingTimeoutRef.current) clearTimeout(stopRecordingTimeoutRef.current);
    };
  }, []);

  const requestPermissions = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Requesting permissions...');
      const loc = await Location.requestForegroundPermissionsAsync();
      // Some SDKs return {granted:boolean, status:string}; support both
      const locGranted = loc?.granted || loc?.status === 'granted';

      const aud = await Audio.requestPermissionsAsync();
      const audGranted = aud?.granted || aud?.status === 'granted';

      setPermissions({ location: !!locGranted, audio: !!audGranted });
    } catch (e) {
      console.error('[PanicSystem] permission error', e);
      Alert.alert('Permission Error', 'Could not request permissions.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const ensureDir = async () => {
    const dir = `${FileSystem.documentDirectory}panic_files/`;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      return dir;
    } catch (e) {
      console.warn('ensureDir error', e);
      return FileSystem.documentDirectory || '';
    }
  };

  const getLocation = async () => {
    if (!permissions.location) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        latitude: 19.0760,
        longitude: 72.8777,
        timestamp: new Date().toISOString(),
        error: 'Fallback location',
      };
    }
  };

  const persistLocations = async (arr) => {
    try {
      const dir = await ensureDir();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await FileSystem.writeAsStringAsync(
        `${dir}location_${ts}.json`,
        JSON.stringify(arr, null, 2)
      );
    } catch (e) {
      console.warn('persistLocations error', e);
    }
  };

  const startLocationTracking = async () => {
    if (!permissions.location || locationIntervalRef.current) return;
    setLocationTracking(true);
    const store = [];
    const first = await getLocation();
    if (first) store.push(first);
    await persistLocations(store);
    locationIntervalRef.current = setInterval(async () => {
      const cur = await getLocation();
      if (cur) {
        store.push(cur);
        await persistLocations(store);
      }
    }, 10000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
    setLocationTracking(false);
  };

  const startAudioRecording = async () => {
    if (!permissions.audio || recordingRef.current) return;
    try {
      setAudioRecording(true);

      // iOS requires mode set for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      const dir = await ensureDir();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = `${dir}panic_audio_${ts}.m4a`;

      // Use a high-quality preset for reliability across devices
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;

      // Stop automatically after 30s and persist file
      stopRecordingTimeoutRef.current = setTimeout(async () => {
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            if (uri) {
              // Move to our directory with stable name
              await FileSystem.moveAsync({ from: uri, to: filePath });
            }
            recordingRef.current = null;
          }
        } catch (e) {
          console.warn('autoStop recording error', e);
        } finally {
          setAudioRecording(false);
          stopRecordingTimeoutRef.current = null;
        }
      }, 30000);
    } catch (e) {
      console.warn('startAudioRecording error', e);
      setAudioRecording(false);
    }
  };

  const stopAudioRecording = async () => {
    try {
      if (stopRecordingTimeoutRef.current) {
        clearTimeout(stopRecordingTimeoutRef.current);
        stopRecordingTimeoutRef.current = null;
      }
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch (e) {
      // ignore
    } finally {
      setAudioRecording(false);
    }
  };

  const startCountdown = () => {
    if (countdownIntervalRef.current || isActivated) return;
    setShowCountdown(true);
    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          activate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const activate = async () => {
    if (isActivated) return;
    setIsLoading(true);
    setLoadingMessage('Activating panic mode...');
    setShowCountdown(false);
    setIsActivated(true);

    await Promise.allSettled([
      startLocationTracking(),
      startAudioRecording(),
    ]);

    const session = {
      sessionId: Date.now().toString(),
      startTime: new Date().toISOString(),
      features: {
        locationTracking: true,
        audioRecording: true,
      },
      platform: Platform.OS,
    };
    try {
      await AsyncStorage.setItem('currentPanicSession', JSON.stringify(session));
    } catch (e) {
      console.warn('AsyncStorage set error', e);
    }

    setIsLoading(false);
    setLoadingMessage('');
    Alert.alert(
      'Panic Mode Activated',
      'Features active:\n• Location tracking\n• Audio recording (30s)\nData stored locally.',
      [{ text: 'OK' }]
    );
  };

  const cancelPanicMode = async () => {
    setIsLoading(true);
    setLoadingMessage('Stopping panic mode...');
    stopLocationTracking();
    await stopAudioRecording();
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    try {
      await AsyncStorage.removeItem('currentPanicSession');
    } catch (e) {
      console.warn('AsyncStorage remove error', e);
    }
    setIsLoading(false);
    setLoadingMessage('');
    setIsActivated(false);
    setShowCountdown(false);
    setCountdown(5);
    Alert.alert('Panic Mode Stopped', 'Emergency features disabled.');
    onClose && onClose();
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShowCountdown(false);
    setCountdown(5);
  };

  // Safe optional external content (won’t crash if undefined)
  const safeActions = Array.isArray(actions) ? actions : null;
  const safeContacts = Array.isArray(contacts) ? contacts : null;

  const renderPermissionStatus = () => {
    const items = [
      { key: 'location', name: 'Location', icon: 'location' },
      { key: 'audio', name: 'Microphone', icon: 'mic' },
    ];
    return (
      <View style={styles.permissionsContainer}>
        <Text style={styles.permissionsTitle}>Required Permissions:</Text>
        {items.map(i => (
          <View key={i.key} style={styles.permissionItem}>
            <Ionicons
              name={i.icon}
              size={16}
              color={permissions[i.key] ? '#4CAF50' : '#FF6B6B'}
            />
            <Text style={styles.permissionText}>{i.name}</Text>
            <Ionicons
              name={permissions[i.key] ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={permissions[i.key] ? '#4CAF50' : '#FF6B6B'}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderStatus = () => {
    const items = [
      { key: 'location', name: 'Location Tracking', active: locationTracking, icon: 'location' },
      { key: 'audio', name: 'Audio Recording', active: audioRecording, icon: 'mic' },
    ];
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Active Features:</Text>
        {items.map(i => (
          <View key={i.key} style={styles.statusItem}>
            <Ionicons
              name={i.icon}
              size={16}
              color={i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)'}
            />
            <Text
              style={[
                styles.statusText,
                { color: i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)' },
              ]}
            >
              {i.name}
            </Text>
            <Ionicons
              name={i.active ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)'}
            />
          </View>
        ))}

        {/* Optional external lists rendered safely if provided */}
        {safeActions && safeActions.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.statusTitle}>Quick Actions</Text>
            {safeActions.map(a => (
              <TouchableOpacity key={a.key} onPress={a.onPress} style={styles.statusItem}>
                <Ionicons name={a.icon || 'flash'} size={16} color="#fff" />
                <Text style={[styles.statusText, { color: '#fff' }]}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {safeContacts && safeContacts.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.statusTitle}>Emergency Contacts</Text>
            {safeContacts.map((c, idx) => (
              <View key={`${c?.name || 'contact'}-${idx}`} style={styles.statusItem}>
                <Ionicons name="person" size={16} color="#fff" />
                <Text style={[styles.statusText, { color: '#fff' }]}>
                  {(c?.name || 'Contact')}{c?.phone ? ` • ${c.phone}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isActivated && !showCountdown) onClose && onClose();
        else Alert.alert('Active', 'Stop panic mode first.');
      }}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: modalScale }] },
          ]}
        >
          <LinearGradient
            colors={isActivated ? ['#4CAF50', '#45A049'] : ['#FF6B35', '#F7931E']}
            style={styles.modalGradient}
          >
            <View style={styles.modalContent}>
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="white" />
                  <Text style={styles.loadingText}>{loadingMessage}</Text>
                </View>
              )}

              {showCountdown && !isLoading && (
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownTitle}>Activating in</Text>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                  <Text style={styles.countdownSubtext}>Press cancel to abort</Text>
                  <TouchableOpacity
                    style={styles.cancelCountdownButton}
                    onPress={cancelCountdown}
                  >
                    <Text style={styles.cancelCountdownText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isLoading && !showCountdown && !isActivated && (
                <>
                  <View style={styles.iconContainer}>
                    <Ionicons name="warning" size={60} color="white" />
                  </View>
                  <Text style={styles.modalTitle}>Emergency Panic Mode</Text>
                  <Text style={styles.modalMessage}>
                    Activate emergency features to protect yourself
                  </Text>
                  {renderPermissionStatus()}
                  <Text style={styles.featuresTitle}>This will activate:</Text>
                  <View style={styles.featuresList}>
                    <Text style={styles.featureItem}>📍 Continuous location tracking</Text>
                    <Text style={styles.featureItem}>🎙️ 30-second voice recording</Text>
                    <Text style={styles.featureItem}>💾 Local data storage</Text>
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => onClose && onClose()}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: pulse }] }}>
                      <TouchableOpacity
                        style={styles.activateButton}
                        onPress={startCountdown}
                      >
                        <Text style={styles.activateButtonText}>ACTIVATE</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </>
              )}

              {!isLoading && !showCountdown && isActivated && (
                <>
                  <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={60} color="white" />
                  </View>
                  <Text style={styles.modalTitle}>Panic Mode Active</Text>
                  <Text style={styles.modalMessage}>
                    Emergency features are running in background
                  </Text>
                  {renderStatus()}
                  <Text style={styles.activeInfo}>
                    All data saved locally for safety.
                  </Text>
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={cancelPanicMode}
                  >
                    <Text style={styles.stopButtonText}>STOP PANIC MODE</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: { padding: 0 },
  modalContent: { padding: 30, alignItems: 'center' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 16, color: 'white', marginTop: 15, textAlign: 'center' },
  countdownContainer: { alignItems: 'center', padding: 40 },
  countdownTitle: { fontSize: 18, color: 'white', marginBottom: 10 },
  countdownNumber: { fontSize: 72, fontWeight: 'bold', color: 'white', marginVertical: 20 },
  countdownSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 30 },
  cancelCountdownButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  cancelCountdownText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  iconContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10, textAlign: 'center' },
  modalMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  permissionsContainer: {
    width: '100%',
    marginBottom: 18,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
  },
  permissionsTitle: { fontSize: 14, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  permissionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  permissionText: { fontSize: 14, color: 'white', marginLeft: 8, flex: 1 },
  statusContainer: {
    width: '100%',
    marginBottom: 20,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
  },
  statusTitle: { fontSize: 14, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  statusItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 14, marginLeft: 8, flex: 1 },
  featuresTitle: { fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 8, alignSelf: 'flex-start' },
  featuresList: { width: '100%', marginBottom: 28 },
  featureItem: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 6, paddingLeft: 6 },
  buttonRow: { flexDirection: 'row', width: '100%', gap: 14 },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  activateButton: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  activateButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  activeInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  stopButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  stopButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
});

export default PanicSystem;