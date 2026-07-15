import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen'; // assuming already exists
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

/**
 * Authentication stack (pre-auth).
 * Add other pre-auth screens here (verification, onboarding, etc.)
 */
export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade'
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: 'Create Account',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: 'Reset Password',
          animation: 'slide_from_right'
        }}
      />
    </Stack.Navigator>
  );
}