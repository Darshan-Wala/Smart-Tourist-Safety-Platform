import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Platform,
  Button,
  Share,
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { encode as btoa } from 'base-64';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';

// Polyfill for btoa
if (typeof global.btoa === 'undefined') {
  global.btoa = btoa;
}

const { width, height } = Dimensions.get('window');

// Configuration
const API_URL = 'http://192.168.27.205:5000';

// Background task name
const ML_TASK_NAME = 'ml-background-task';

// Restricted zones data for Jammu & Kashmir
const RESTRICTED_ZONES = [
  // JAMMU DIVISION
  {
    id: 'jammu_1',
    name: 'Janiur Area',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7266, longitude: 74.8570 },
      { latitude: 32.7280, longitude: 74.8590 },
      { latitude: 32.7250, longitude: 74.8610 },
      { latitude: 32.7235, longitude: 74.8585 },
    ]
  },
  {
    id: 'jammu_2',
    name: 'Peer Mitha (Gujjar Nagar)',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7180, longitude: 74.8520 },
      { latitude: 32.7195, longitude: 74.8540 },
      { latitude: 32.7165, longitude: 74.8560 },
      { latitude: 32.7150, longitude: 74.8535 },
    ]
  },
  {
    id: 'jammu_3',
    name: 'Bhatindi and Sunjwan',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.6980, longitude: 74.8420 },
      { latitude: 32.6995, longitude: 74.8440 },
      { latitude: 32.6965, longitude: 74.8460 },
      { latitude: 32.6950, longitude: 74.8435 },
    ]
  },
  {
    id: 'jammu_4',
    name: 'Bahu Fort area (Kalka Colony)',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7320, longitude: 74.8680 },
      { latitude: 32.7335, longitude: 74.8700 },
      { latitude: 32.7305, longitude: 74.8720 },
      { latitude: 32.7290, longitude: 74.8695 },
    ]
  },
  // RAJOURI
  {
    id: 'rajouri_1',
    name: 'Sarola',
    district: 'Rajouri',
    coordinates: [
      { latitude: 33.3827, longitude: 74.3110 },
      { latitude: 33.3842, longitude: 74.3130 },
      { latitude: 33.3812, longitude: 74.3150 },
      { latitude: 33.3797, longitude: 74.3125 },
    ]
  },
  // KASHMIR DIVISION - Key areas
  {
    id: 'srinagar_1',
    name: 'Ahmed Nagar',
    district: 'Srinagar',
    coordinates: [
      { latitude: 34.0837, longitude: 74.7973 },
      { latitude: 34.0852, longitude: 74.7993 },
      { latitude: 34.0822, longitude: 74.8013 },
      { latitude: 34.0807, longitude: 74.7988 },
    ]
  },
  {
    id: 'srinagar_2',
    name: 'Lal Bazar',
    district: 'Srinagar',
    coordinates: [
      { latitude: 34.0896, longitude: 74.8060 },
      { latitude: 34.0911, longitude: 74.8080 },
      { latitude: 34.0881, longitude: 74.8100 },
      { latitude: 34.0866, longitude: 74.8075 },
    ]
  },
  {
    id: 'bandipora_1',
    name: 'Parray Mohalla',
    district: 'Bandipora',
    coordinates: [
      { latitude: 34.4196, longitude: 74.6450 },
      { latitude: 34.4211, longitude: 74.6470 },
      { latitude: 34.4181, longitude: 74.6490 },
      { latitude: 34.4166, longitude: 74.6465 },
    ]
  },
];

// Safe zones array
const SAFE_ZONES = [
  {
    id: 'safe_1',
    name: 'Jammu Police Station',
    coordinates: { latitude: 32.7300, longitude: 74.8650 },
  },
  {
    id: 'safe_2',
    name: 'Srinagar Hospital',
    coordinates: { latitude: 34.0860, longitude: 74.7995 },
  },
  {
    id: 'safe_3',
    name: 'Rajouri Army Base',
    coordinates: { latitude: 33.3850, longitude: 74.3140 },
  },
];

// Define background task before component
TaskManager.defineTask(ML_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Background Task] Error:', error);
    return;
  }
  
  const location = data?.locations?.[0];
  if (location) {
    console.log('[BG] location', new Date().toISOString(), location.coords);
    global.__LAST_BG_TS__ = new Date().toISOString();
    
    // Optional: Send location data to backend for ML processing
    try {
      const district = getDistrictFromCoords(location.coords);
      await axios.post(`${API_URL}/predict_weather`, {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });
      await axios.post(`${API_URL}/predict_calamity`, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        district
      });
    } catch (error) {
      console.error('[Background] ML API error:', error);
    }
  }
});

// Utility functions
const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon || polygon.length < 3) return false;
  
  const x = point.latitude;
  const y = point.longitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

const haversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2) return Infinity;
  
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3; // Earth's radius in meters
  const lat1 = toRad(coords1.latitude);
  const lon1 = toRad(coords1.longitude);
  const lat2 = toRad(coords2.latitude);
  const lon2 = toRad(coords2.longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const checkRestrictedZones = (currentLocation) => {
  if (!currentLocation?.coords) return null;
  
  for (let zone of RESTRICTED_ZONES) {
    if (isPointInPolygon(currentLocation.coords, zone.coordinates)) {
      return zone;
    }
  }
  return null;
};

const checkProximityToRestrictedZones = (userLocation) => {
  if (!userLocation?.coords) return null;
  
  const PROXIMITY_THRESHOLD_METERS = 10000; // 10km

  for (let zone of RESTRICTED_ZONES) {
    const zoneCenter = zone.coordinates.reduce(
      (acc, coord) => ({
        latitude: acc.latitude + coord.latitude,
        longitude: acc.longitude + coord.longitude,
      }),
      { latitude: 0, longitude: 0 }
    );
    zoneCenter.latitude /= zone.coordinates.length;
    zoneCenter.longitude /= zone.coordinates.length;

    const distance = haversineDistance(userLocation.coords, zoneCenter);
    if (distance <= PROXIMITY_THRESHOLD_METERS) {
      return zone;
    }
  }
  return null;
};

const findNearestSafeZone = (userLocation) => {
  if (!userLocation?.coords) return null;
  
  let nearestZone = null;
  let minDistance = Infinity;

  for (let zone of SAFE_ZONES) {
    const distance = haversineDistance(userLocation.coords, zone.coordinates);
    if (distance < minDistance) {
      minDistance = distance;
      nearestZone = zone;
    }
  }
  return nearestZone;
};

// Helper function to get district from coordinates
const getDistrictFromCoords = (coords) => {
  // Simple logic based on coordinates - you can enhance this
  if (coords.latitude > 34.4) return 'Bandipora';
  if (coords.latitude > 34.0) return 'Srinagar';
  if (coords.latitude > 33.0) return 'Rajouri';
  return 'Jammu';
};

// Main component
const TravelTrackingScreen = () => {
  // State variables
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [riskLevel, setRiskLevel] = useState('low');
  const [violatedZone, setViolatedZone] = useState(null);
  const [mlWeatherRisk, setMlWeatherRisk] = useState('low');
  const [mlCalamityRisk, setMlCalamityRisk] = useState('low');
  
  // Background task state
  const [isRunning, setIsRunning] = useState(false);
  const [lastBgUpdate, setLastBgUpdate] = useState(null);
  
  // Refs
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  // Background status refresh
  const refreshStatus = useCallback(async () => {
    try {
      const reg = await TaskManager.isTaskRegisteredAsync(ML_TASK_NAME);
      setIsRunning(reg);
      setLastBgUpdate(global.__LAST_BG_TS__ || null);
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  }, []);

  // Share location function
  const shareLocation = useCallback(async () => {
    if (!location?.coords) {
      Alert.alert('No Location', 'Location not available to share');
      return;
    }

    try {
      const { latitude, longitude } = location.coords;
      const district = getDistrictFromCoords(location.coords);
      const nearestSafeZone = findNearestSafeZone(location);
      const currentTime = new Date().toLocaleString();
      
      const message = `📍 My Current Location:
Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
District: ${district}
Nearest Safe Zone: ${nearestSafeZone?.name || 'Unknown'}
Time: ${currentTime}
Risk Level: ${riskLevel.toUpperCase()}

Google Maps: https://maps.google.com/?q=${latitude},${longitude}

Sent from Kashmir Travel Safety App`;

      const result = await Share.share({
        message: message,
        title: 'My Location - Kashmir Travel Safety',
      });

      if (result.action === Share.sharedAction) {
        console.log('Location shared successfully');
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Share Failed', 'Could not share location. Please try again.');
    }
  }, [location, riskLevel]);

  // ML predictions function with proper error handling
  const handleMlPredictions = useCallback(async (newLocation) => {
    if (!newLocation?.coords) return;
    
    const district = getDistrictFromCoords(newLocation.coords);
    
    try {
      // Weather prediction
      const weatherRes = await axios.post(`${API_URL}/predict_weather`, {
        lat: newLocation.coords.latitude,
        lng: newLocation.coords.longitude
      }, { timeout: 10000 });
      
      if (weatherRes.data) {
        const { 
          risk_level: weatherRisk, 
          rain_mm, 
          high_temp, 
          prob: weatherProb, 
          high_confidence: weatherConf 
        } = weatherRes.data;
        
        setMlWeatherRisk(weatherRisk || 'low');
        
        if (weatherRisk && weatherRisk !== 'low') {
          Alert.alert(
            'Weather Alert Tomorrow',
            `${weatherRisk.toUpperCase()}: ${Number(rain_mm || 0).toFixed(1)}mm rain, ${Number(high_temp || 0).toFixed(1)}°C. Confidence: ${weatherConf ? 'High' : 'Low'} (${Number(weatherProb || 0).toFixed(2)}). Avoid floods!`
          );
        }
      }

      // Calamity prediction
      const calamityRes = await axios.post(`${API_URL}/predict_calamity`, {
        lat: newLocation.coords.latitude,
        lng: newLocation.coords.longitude,
        district
      }, { timeout: 10000 });
      
      if (calamityRes.data) {
        const { 
          risk_level: calamityRisk, 
          prob: calProb, 
          high_confidence: calConf 
        } = calamityRes.data;
        
        setMlCalamityRisk(calamityRisk || 'low');
        
        if (calamityRisk && calamityRisk !== 'low') {
          Alert.alert(
            'Calamity Alert Tomorrow',
            `${calamityRisk.toUpperCase()}. Confidence: ${calConf ? 'High' : 'Low'} (${Number(calProb || 0).toFixed(2)}). Reroute and avoid congestions!`
          );
        }
      }
      
    } catch (error) {
      console.error('ML API error:', error?.message || error);
    }
  }, []);

  // SMS notification function
  const sendSMSNotification = useCallback(async (zone, userLocation) => {
    try {
      const TWILIO_ACCOUNT_SID = Constants.expoConfig?.extra?.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
      const TWILIO_AUTH_TOKEN = Constants.expoConfig?.extra?.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
      const TWILIO_PHONE_NUMBER = Constants.expoConfig?.extra?.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
      const ALERT_PHONE_NUMBER = Constants.expoConfig?.extra?.EXPO_PUBLIC_ALERT_PHONE_NUMBER;

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.warn('Twilio credentials missing; skipping SMS');
        return;
      }

      const message = `ALERT: User has entered restricted zone "${zone.name}" in ${zone.district} district. Location: ${userLocation.coords.latitude}, ${userLocation.coords.longitude}. Time: ${new Date().toLocaleString()}`;

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `From=${TWILIO_PHONE_NUMBER}&To=${ALERT_PHONE_NUMBER}&Body=${encodeURIComponent(message)}`,
      });

      if (response.ok) {
        console.log('SMS notification sent successfully');
      } else {
        console.error('Failed to send SMS notification');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  }, []);

  // Location update handler
  const handleLocationUpdate = useCallback((newLocation) => {
    if (!newLocation?.coords) return;
    
    setLocation(newLocation);

    const restrictedZone = checkRestrictedZones(newLocation);
    const nearbyRestrictedZone = checkProximityToRestrictedZones(newLocation);
    const nearestSafeZone = findNearestSafeZone(newLocation);

    if (restrictedZone && restrictedZone.id !== violatedZone?.id) {
      // HIGH ALERT: Inside a restricted zone
      setRiskLevel('high');
      setViolatedZone(restrictedZone);
      Alert.alert(
        '⚠️ HIGH ALERT: Restricted Area',
        `You have entered a restricted zone: ${restrictedZone.name} in ${restrictedZone.district} district. Please exit immediately and go to the nearest safe zone: ${nearestSafeZone?.name || 'Contact authorities'}.`,
        [{ text: 'OK' }]
      );
      sendSMSNotification(restrictedZone, newLocation);
    } else if (nearbyRestrictedZone && nearbyRestrictedZone.id !== violatedZone?.id) {
      // MODERATE ALERT: Near a restricted zone
      setRiskLevel('moderate');
      setViolatedZone(nearbyRestrictedZone);
      Alert.alert(
        '⚠️ WARNING: High Risk Area',
        `You are approaching a restricted zone: ${nearbyRestrictedZone.name}. Proceed with caution and consider a different route. Nearest safe zone: ${nearestSafeZone?.name || 'Contact authorities'}.`,
        [{ text: 'OK' }]
      );
    } else if (!restrictedZone && !nearbyRestrictedZone) {
      // LOW ALERT: Safe area
      setRiskLevel('low');
      setViolatedZone(null);
    }

    // Trigger ML predictions
    handleMlPredictions(newLocation);
  }, [violatedZone, handleMlPredictions, sendSMSNotification]);

  // Initialize location and permissions
  useEffect(() => {
    const setupLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({});
        handleLocationUpdate(currentLocation);
      } catch (error) {
        console.error('Location setup error:', error);
        setErrorMsg('Failed to get location');
      }
    };

    setupLocation();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [handleLocationUpdate]);

  // Background status monitoring
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Tracking controls
  const startTracking = async () => {
    if (!isTracking) {
      setIsTracking(true);
      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 10,
          },
          handleLocationUpdate
        );
      } catch (error) {
        console.error('Error starting tracking:', error);
        setIsTracking(false);
      }
    }
  };

  const stopTracking = () => {
    if (isTracking && locationSubscription.current) {
      locationSubscription.current.remove();
      setIsTracking(false);
    }
  };

  // Background task controls
  const startBackgroundTask = async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        alert('Foreground location permission denied');
        return;
      }
      
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        alert('Background location permission denied');
        return;
      }

      await Location.startLocationUpdatesAsync(ML_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 50,
        foregroundService: {
          notificationTitle: 'Tracking active',
          notificationBody: 'Monitoring your location for safety alerts.',
        },
        pausesUpdatesAutomatically: false,
      });
      refreshStatus();
    } catch (error) {
      console.error('Error starting background task:', error);
    }
  };

  const stopBackgroundTask = async () => {
    try {
      const reg = await TaskManager.isTaskRegisteredAsync(ML_TASK_NAME);
      if (reg) await TaskManager.unregisterAllTasksAsync();
      refreshStatus();
    } catch (error) {
      console.error('Error stopping background task:', error);
    }
  };

  // Center map on user location
  const centerMapOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Display text
  let coordinatesText = 'Waiting...';
  if (errorMsg) {
    coordinatesText = errorMsg;
  } else if (location) {
    coordinatesText = `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80' }}
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
          style={styles.overlay}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Live Location Tracker</Text>
            <Text style={styles.headerSubtitle}>Kashmir Travel Safety</Text>
          </View>

          {/* Map Container */}
          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
                followsUserLocation={isTracking}
              >
                {/* User location marker */}
                <Marker
                  coordinate={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  }}
                  title="Your Location"
                  description={`Lat: ${location.coords.latitude.toFixed(4)}, Lng: ${location.coords.longitude.toFixed(4)}`}
                >
                  <View style={styles.userMarker}>
                    <Ionicons name="person" size={20} color="white" />
                  </View>
                </Marker>

                {/* Safe zone markers */}
                {SAFE_ZONES.map((zone) => (
                  <Marker
                    key={zone.id}
                    coordinate={zone.coordinates}
                    title={zone.name}
                    pinColor="#4CAF50"
                  />
                ))}

                {/* Restricted zones polygons */}
                {RESTRICTED_ZONES.map((zone) => (
                  <Polygon
                    key={zone.id}
                    coordinates={zone.coordinates}
                    fillColor="rgba(255, 0, 0, 0.3)"
                    strokeColor="rgba(255, 0, 0, 0.8)"
                    strokeWidth={2}
                  />
                ))}
              </MapView>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading Map...</Text>
              </View>
            )}
          </View>

          {/* Status Panel */}
          <View style={styles.statusPanel}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Tracking Status</Text>
              <View style={[styles.statusIndicator, { backgroundColor: isTracking ? '#4CAF50' : '#FF5722' }]} />
            </View>

            <Text style={styles.coordinatesText}>📍 {coordinatesText}</Text>

            {/* Background task status */}
            <Text style={styles.backgroundStatusText}>
              Background tracking:{' '}
              <Text style={{ color: isRunning ? 'lightgreen' : '#ffbeb4', fontWeight: '700' }}>
                {isRunning ? 'ON' : 'OFF'}
              </Text>
              {'  '}Last update:{' '}
              <Text style={{ fontWeight: '700', color: 'white' }}>
                {lastBgUpdate ?? '—'}
              </Text>
            </Text>

            {/* Risk level alerts */}
            {riskLevel === 'high' && violatedZone && (
              <View style={[styles.alertContainer, styles.highAlert]}>
                <Ionicons name="warning" size={20} color="#FF5722" />
                <Text style={styles.alertText}>
                  HIGH ALERT: In Restricted Zone: {violatedZone.name}
                </Text>
              </View>
            )}

            {riskLevel === 'moderate' && violatedZone && (
              <View style={[styles.alertContainer, styles.moderateAlert]}>
                <Ionicons name="warning" size={20} color="#FFD700" />
                <Text style={styles.alertText}>
                  MODERATE ALERT: Near Restricted Zone: {violatedZone.name}
                </Text>
              </View>
            )}

            {/* Safe zone info */}
            {location && (
              <View style={styles.safeZoneContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#4CAF50" />
                <Text style={styles.safeZoneText}>
                  Nearest Safe Zone: {findNearestSafeZone(location)?.name || '—'}
                </Text>
              </View>
            )}

            {/* ML Risk indicators */}
            <View style={styles.mlRiskContainer}>
              <Text style={styles.mlRiskText}>
                Weather Risk: <Text style={{ 
                  color: mlWeatherRisk === 'low' ? '#4CAF50' : 
                        mlWeatherRisk === 'moderate' ? '#FFD700' : '#FF5722' 
                }}>
                  {mlWeatherRisk.toUpperCase()}
                </Text>
              </Text>
              <Text style={styles.mlRiskText}>
                Calamity Risk: <Text style={{ 
                  color: mlCalamityRisk === 'low' ? '#4CAF50' : 
                        mlCalamityRisk === 'moderate' ? '#FFD700' : '#FF5722' 
                }}>
                  {mlCalamityRisk.toUpperCase()}
                </Text>
              </Text>
            </View>
          </View>

          {/* Control Buttons - Start Tracking and Center Map */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: isTracking ? '#FF5722' : '#4CAF50' }]}
              onPress={isTracking ? stopTracking : startTracking}
            >
              <Ionicons
                name={isTracking ? "stop" : "play"}
                size={24}
                color="white"
              />
              <Text style={styles.buttonText}>
                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: '#2196F3' }]}
              onPress={centerMapOnUser}
            >
              <Ionicons name="locate" size={24} color="white" />
              <Text style={styles.buttonText}>Center Map</Text>
            </TouchableOpacity>
          </View>

          {/* Share Location Button */}
          <View style={styles.shareLocationContainer}>
            <TouchableOpacity
              style={[styles.shareLocationButton, { backgroundColor: location ? '#9C27B0' : '#666666' }]}
              onPress={shareLocation}
              disabled={!location}
            >
              <Ionicons name="share-outline" size={24} color="white" />
              <Text style={styles.shareButtonText}>Share Location</Text>
            </TouchableOpacity>
          </View>

          {/* Background Task Controls */}
          <View style={styles.backgroundControlsContainer}>
            <Button title="Start BG" onPress={startBackgroundTask} />
            <Button title="Stop BG" onPress={stopBackgroundTask} />
            <Button title="Refresh" onPress={refreshStatus} />
          </View>

          {/* Info Panel */}
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>🛡️ Safety Information</Text>
            <Text style={styles.infoPanelText}>
              {RESTRICTED_ZONES.length} restricted zones are being monitored.
              Emergency contacts will be notified if you enter any restricted area.
              ML predictions provide weather and calamity alerts.
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapContainer: {
    height: height * 0.4,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    opacity: 0.8,
  },
  userMarker: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  statusPanel: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 15,
    padding: 15,
    marginTop: 15,
    backdropFilter: 'blur(10px)',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    opacity: 0.9,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  coordinatesText: {
    fontSize: 14,
    color: 'white',
    opacity: 0.85,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  backgroundStatusText: {
    marginTop: 8,
    color: 'white',
    fontSize: 14,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
  },
  highAlert: {
    backgroundColor: 'rgba(255, 87, 34, 0.2)',
    borderLeftColor: '#FF5722',
  },
  moderateAlert: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderLeftColor: '#FFD700',
  },
  alertText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.95,
  },
  safeZoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  safeZoneText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.95,
  },
  mlRiskContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mlRiskText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    flex: 0.48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  shareLocationContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  shareLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  shareButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  backgroundControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  infoPanel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    opacity: 0.9,
  },
  infoPanelText: {
    fontSize: 13,
    color: 'white',
    opacity: 0.8,
    lineHeight: 18,
  },
});

export default TravelTrackingScreen;