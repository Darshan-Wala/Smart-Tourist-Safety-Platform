import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Tabs
import MainTabs from './MainTabs';

// Auth flow screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Core feature screens (stacked over tabs)
import TripPlannerScreen from '../screens/TripPlannerScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import TravelTrackingScreen from '../screens/TravelTrackingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PassportVerificationScreen from '../screens/PassportVerificationScreen';
import AadhaarVerificationScreen from '../screens/AadhaarVerificationScreen';
import ChangePassword from '../screens/ChangePassword';

// Splash
import SplashScreen from '../screens/SplashScreen';

// (Legacy alias – optional: AddTrip points to TripPlanner)
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, initializing } = useAuth();

  useEffect(() => {
    if (user) {
      // Run trip migration once after login
      import('../utils/tripMigration')
        .then(mod => mod.runTripMigrationIfNeeded(user.uid, null))
        .catch(() => {});
    }
  }, [user]);

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
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
          </>
        ) : (
          <>
            {/* Tabbed application root */}
            <Stack.Screen name="Tabs" component={MainTabs} />

            {/* Trip planning / details */}
            <Stack.Screen
              name="TripPlanner"
              component={TripPlannerScreen}
              options={{ animation: 'slide_from_bottom', headerShown: false }}
            />
            <Stack.Screen
              name="TripDetails"
              component={TripDetailsScreen}
              options={{ animation: 'slide_from_right', headerShown: false }}
            />

            {/* Legacy alias (safe to remove later) */}
            <Stack.Screen
              name="AddTrip"
              component={TripPlannerScreen}
              options={{ animation: 'slide_from_bottom', headerShown: false }}
            />

            {/* Tracking */}
            <Stack.Screen
              name="TravelTracking"
              component={TravelTrackingScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Profile / account management */}
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerShown: true,
                title: 'Edit Profile',
                animation: 'slide_from_right'
              }}
            />
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
              component={ChangePassword}
              options={{
                headerShown: true,
                title: 'Change Password',
                animation: 'slide_from_right'
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}