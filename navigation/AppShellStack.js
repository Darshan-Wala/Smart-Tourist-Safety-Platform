import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen'; // NEW

// Add these imports for verification screens
import PassportVerificationScreen from '../screens/PassportVerificationScreen';
import AadhaarVerificationScreen from '../screens/AadhaarVerificationScreen';

// Optional placeholders
const DigitalIDModal = () => null;
const SettingsScreen = () => null;

const Stack = createNativeStackNavigator();

export default function AppShellStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />

      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          title: 'Edit Profile',
          animation: 'slide_from_right'
        }}
      />

      {/* New verification routes (post-auth) */}
      <Stack.Screen
        name="PassportVerification"
        component={PassportVerificationScreen}
        options={{
          headerShown: true,
          title: 'Passport Verification',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="AadhaarVerification"
        component={AadhaarVerificationScreen}
        options={{
          headerShown: true,
          title: 'Aadhaar Verification',
          animation: 'slide_from_right'
        }}
      />

      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: true,
          title: 'Change Password',
          animation: 'slide_from_right'
        }}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'Settings',
          animation: 'slide_from_right'
        }}
      />

      <Stack.Screen
        name="DigitalIDModal"
        component={DigitalIDModal}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Digital ID',
          animation: 'slide_from_bottom'
        }}
      />
    </Stack.Navigator>
  );
}