import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function SocialButton({
  iconName,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  gradientColors = ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']
}) {
  return (
    <TouchableOpacity
      style={styles.socialButton}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || iconName}
    >
      <LinearGradient
        colors={gradientColors}
        style={[styles.socialButtonGradient, (disabled || loading) && { opacity: 0.6 }]}
      >
        {loading
          ? <ActivityIndicator size="small" color="white" />
          : <Ionicons name={iconName} size={20} color="white" />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden'
  },
  socialButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  }
});