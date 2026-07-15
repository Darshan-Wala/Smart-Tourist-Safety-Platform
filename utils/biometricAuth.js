import * as LocalAuthentication from 'expo-local-authentication';

export async function canUseBiometric() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function biometricPrompt(reason = 'Authenticate to fill your saved password') {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false
    });
    return result.success;
  } catch {
    return false;
  }
}