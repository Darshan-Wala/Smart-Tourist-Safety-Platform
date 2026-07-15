import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const ExplorePlaceholder = () => null;

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#4ECDC4',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          backgroundColor: '#142F40',
          borderTopWidth: 0
        },
        tabBarIcon: ({ color, size }) => {
          let icon = 'ellipse';
          switch (route.name) {
            case 'Home': icon = 'home'; break;
            case 'Trips': icon = 'map'; break;
            case 'Explore': icon = 'compass'; break;
            case 'Profile': icon = 'person-circle'; break;
            default: icon = 'ellipse';
          }
          return <Ionicons name={icon} size={size} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trips" component={TripsScreen} />
      <Tab.Screen name="Explore" component={ExplorePlaceholder} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}