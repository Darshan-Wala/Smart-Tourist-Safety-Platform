import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SecureDigitalIDCard from '../components/SecureDigitalIDCard';

import { useFocusEffect } from '@react-navigation/native';
import { getVerificationStatus } from '../services/verificationStorage';
import VerificationSection from '../components/VerificationSection';

export default function ProfileScreen({ navigation }) {
  const { user, profile, logout, actionLoading } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);

  const [daysToExpiry, setDaysToExpiry] = useState(null);

  // Single source of truth for verification on this screen
  const [verification, setVerification] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const s = await getVerificationStatus();
          if (mounted) setVerification(s);
        } catch {
          if (mounted) setVerification(null);
        }
      })();
      return () => { mounted = false; };
    }, [])
  );

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setLocalLoading(true);
              await logout();
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to logout.');
            } finally {
              setLocalLoading(false);
            }
          }
        }
      ]
    );
  }, [logout]);

  const loading = actionLoading || localLoading;

  const handleDigitalIDUnlock = (secureData) => {
    if (secureData?.digitalIDValidUntil) {
      const diffMs = new Date(secureData.digitalIDValidUntil).getTime() - Date.now();
      const d = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      setDaysToExpiry(d);
    }
  };

  const hasEmergencyContact =
    !!(profile?.emergencyContact || profile?.emergencyPhone);

  const anyVerified = !!(verification?.passport?.verified || verification?.aadhaar?.verified);

  let expiryBanner = null;
  if (daysToExpiry !== null) {
    if (daysToExpiry <= 0) {
      expiryBanner = (
        <LinearGradient
          colors={['#8B0000', '#B22222']}
          style={styles.expiryBanner}
        >
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <View style={styles.expiryTextWrap}>
            <Text style={styles.expiryTitle}>Digital ID Expired</Text>
            <Text style={styles.expirySubtitle}>
              Please renew your Digital Tourist ID soon.
            </Text>
          </View>
        </LinearGradient>
      );
    } else if (daysToExpiry <= 30) {
      expiryBanner = (
        <LinearGradient
          colors={['#FF9800', '#F57C00']}
          style={styles.expiryBanner}
        >
          <Ionicons name="time" size={20} color="#fff" />
          <View style={styles.expiryTextWrap}>
            <Text style={styles.expiryTitle}>Expiring Soon</Text>
            <Text style={styles.expirySubtitle}>
              {daysToExpiry} day{daysToExpiry === 1 ? '' : 's'} left on your Digital ID.
            </Text>
          </View>
        </LinearGradient>
      );
    }
  }

  const ActionButton = ({ icon, label, onPress, colors }) => (
    <TouchableOpacity
      onPress={onPress}
      style={styles.actionButton}
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={colors || ['#314755', '#26a0da']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.actionButtonGradient}
      >
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.actionButtonText}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={['#0f2027', '#203a43', '#2c5364']}
      style={styles.screen}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.value}>{profile?.fullName || '—'}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '—'}</Text>

          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{profile?.phoneNumber || '—'}</Text>

          <Text style={styles.label}>Nationality</Text>
          <Text style={styles.value}>{profile?.nationality || '—'}</Text>

          <Text style={styles.label}>Account Status</Text>
          <Text style={styles.valueActive}>Active</Text>

          {/* Identity Verification status */}
          <Text style={styles.label}>Identity Verification</Text>
          <View style={styles.flagRow}>
            <Ionicons
              name={anyVerified ? 'shield-checkmark' : 'shield-outline'}
              size={16}
              color={anyVerified ? '#4ECDC4' : '#FFB347'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.flagText,
                { color: anyVerified ? '#4ECDC4' : '#FFB347' }
              ]}
            >
              {anyVerified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>

          <Text style={styles.label}>Emergency Contact</Text>
          <View style={styles.flagRow}>
            <Ionicons
              name={hasEmergencyContact ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={hasEmergencyContact ? '#4ECDC4' : '#FFB347'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.flagText,
                { color: hasEmergencyContact ? '#4ECDC4' : '#FFB347' }
              ]}
            >
              {hasEmergencyContact ? 'Set' : 'Not Set'}
            </Text>
          </View>
        </View>

        {expiryBanner}

        {/* Verification Section on Profile; notify this screen on any change */}
        <VerificationSection onStatusChange={setVerification} />

        {/* Actions */}
        <View style={styles.actionsSection}>
          <ActionButton
            icon="create"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
            colors={['#4568dc', '#b06ab3']}
          />
          <ActionButton
            icon="key"
            label="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
            colors={['#134E5E', '#71B280']}
          />
        </View>

        {/* Secure Digital ID Card */}
        <SecureDigitalIDCard onUnlock={handleDigitalIDUnlock} />

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutWrapper, loading && { opacity: 0.65 }]}
          onPress={handleLogout}
          disabled={loading}
          accessibilityLabel="Log out of your account"
        >
          <LinearGradient
            colors={['#ff5f6d', '#d34053']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-out" size={20} color="#fff" />
                <Text style={styles.logoutText}>Logout</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  heading: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 22,
    letterSpacing: 0.5
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 10,
    textTransform: 'uppercase'
  },
  value: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2
  },
  valueActive: {
    color: '#9ee6c4',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  flagText: {
    fontSize: 14,
    fontWeight: '600'
  },
  actionsSection: {
    marginTop: 16,
    marginBottom: 8
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14
  },
  actionButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  expiryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    gap: 12
  },
  expiryTextWrap: { flex: 1 },
  expiryTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  expirySubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2
  },
  logoutWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});