import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import polyline from 'polyline';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  View as RNView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const GOOGLE_KEY = 'AIzaSyDW3PK263uMcGH2Lhr9SU2Gmekf9sYaDkY';

function GradientButton({ title, colors, onPress, disabled }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && { opacity: 0.6 }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionButtonBg}>
        <Text style={styles.actionButtonText}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function PlacesAutocompleteInput({ placeholder, onPlaceSelected, zIndexValue = 1, clearSignal }) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery('');
    setPredictions([]);
  }, [clearSignal]);

  async function fetchPredictions(text) {
    if (!text || text.length < 2) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      setPredictions(data?.predictions ?? []);
    } catch (e) {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  async function selectPrediction(pred) {
    setQuery(pred.description);
    setPredictions([]);
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const loc = data?.result?.geometry?.location;
    if (loc) {
      onPlaceSelected({ lat: loc.lat, lng: loc.lng, description: pred.description });
    }
  }

  return (
    <RNView style={{ zIndex: zIndexValue, position: 'relative', elevation: zIndexValue }}>
      <TextInput
        placeholder={placeholder}
        value={query}
        onChangeText={(t) => { setQuery(t); fetchPredictions(t); }}
        style={autocompleteStyles.textInput}
        placeholderTextColor="#64748b"
      />
      {loading ? <RNView style={{ paddingVertical: 6 }}><ActivityIndicator color="#1cc88a" /></RNView> : null}
      {predictions.length > 0 && (
        <RNView style={autocompleteStyles.dropdown}>
          {predictions.map((item) => (
            <TouchableOpacity key={item.place_id} onPress={() => selectPrediction(item)} style={autocompleteStyles.itemRow}>
              <RNText style={autocompleteStyles.itemText}>{item.description}</RNText>
            </TouchableOpacity>
          ))}
        </RNView>
      )}
    </RNView>
  );
}

export default function AddTripScreen({ navigation }) {
  const mapRef = useRef(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [halts, setHalts] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [encodedRoute, setEncodedRoute] = useState(null);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [distanceNum, setDistanceNum] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [clearCounter, setClearCounter] = useState(0);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  useEffect(() => {
    if (from && to && !encodedRoute) {
      fetchDirections();
    }
  }, [from, to]);

  const region = useMemo(() => ({
    latitude: (from?.lat) || (userLocation?.lat) || 19.076, // default Mumbai
    longitude: (from?.lng) || (userLocation?.lng) || 72.8777,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  }), [from, userLocation]);

  async function fetchDirections() {
    if (!from || !to) return;

    setLoadingRoute(true);

    const waypoints = halts.length ? `&waypoints=${halts.filter(Boolean).map(h => `${h.lat},${h.lng}`).join('|')}` : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}${waypoints}&key=${GOOGLE_KEY}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const first = data.routes?.[0];
      if (!first) {
        setRoutePoints([]);
        setDistanceText('');
        setDurationText('');
        setLoadingRoute(false);
        return;
      }

      const encoded = first.overview_polyline.points;
      const points = polyline.decode(encoded).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
      setRoutePoints(points);

      const totalMeters = first.legs.reduce((acc, l) => acc + (l.distance?.value || 0), 0);
      const totalSeconds = first.legs.reduce((acc, l) => acc + (l.duration?.value || 0), 0);
      const km = totalMeters / 1000;
      const mins = Math.round(totalSeconds / 60);
      setDistanceText(`${km.toFixed(1)} km`);
      setDurationText(`${mins} min`);
      setDistanceNum(km);
      setDurationMin(mins);
      setEncodedRoute(encoded);

      setTimeout(() => {
        if (mapRef.current && points.length > 1) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 80, right: 40, bottom: 180, left: 40 },
            animated: true,
          });
        }
      }, 100);
    } finally {
      setLoadingRoute(false);
    }
  }

  async function saveTrip() {
    if (!from || !to) return;

    if (!encodedRoute) {
      await fetchDirections();
    }

    const existingStr = await AsyncStorage.getItem('trips');
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const payload = {
      id: Date.now(),
      from,
      halts,
      to,
      distanceText,
      durationText,
      distance: distanceNum,
      duration: durationMin,
      encodedPolyline: encodedRoute,
      createdAt: new Date().toISOString(),
      waypoints: [
        from ? { address: from.description, type: 'from' } : null,
        ...halts.filter(Boolean).map(h => ({ address: h.description, type: 'halt' })),
        to ? { address: to.description, type: 'to' } : null,
      ].filter(Boolean),
    };
    await AsyncStorage.setItem('trips', JSON.stringify([payload, ...existing]));
    navigation.navigate('Trips');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RNView style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add Your Trip</Text>
          <RNView style={{ width: 40 }} />
        </RNView>

        <RNView style={styles.inputSection}>
          <Text style={styles.inputLabel}>From</Text>
          <PlacesAutocompleteInput placeholder="Enter starting location" onPlaceSelected={(p) => setFrom(p)} zIndexValue={30} clearSignal={clearCounter} />
        </RNView>

        <RNView style={styles.inputSection}>
          <Text style={styles.inputLabel}>To</Text>
          <PlacesAutocompleteInput placeholder="Enter destination" onPlaceSelected={(p) => setTo(p)} zIndexValue={5} clearSignal={clearCounter} />
        </RNView>

        {halts.map((h, idx) => (
          <RNView key={idx} style={[styles.haltRow, { zIndex: 30 - idx, elevation: 30 - idx }]}>
            <RNView style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Halt {idx + 1}</Text>
              <PlacesAutocompleteInput placeholder={`Enter halt ${idx + 1} location`} zIndexValue={25 - idx} clearSignal={clearCounter} onPlaceSelected={(p) => {
                const copy = [...halts];
                copy[idx] = p;
                setHalts(copy);
              }} />
            </RNView>
            <Pressable onPress={() => setHalts(halts.filter((_, i) => i !== idx))} style={styles.removeHalt}>
              <Text style={styles.removeHaltText}>-</Text>
            </Pressable>
          </RNView>
        ))}

        <Pressable onPress={() => setHalts([...halts, null])} style={styles.addHaltButton}>
          <Text style={styles.addHaltText}>+ Add Halt</Text>
        </Pressable>

        <RNView style={styles.mapContainer}>
          <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={region} showsUserLocation showsMyLocationButton>
            {from ? <Marker coordinate={{ latitude: from.lat, longitude: from.lng }} /> : null}
            {halts.map((h, i) => h ? <Marker key={`h-${i}`} coordinate={{ latitude: h.lat, longitude: h.lng }} pinColor="#6c5ce7" /> : null)}
            {to ? <Marker coordinate={{ latitude: to.lat, longitude: to.lng }} /> : null}
            {userLocation ? <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }} pinColor="#34d399" /> : null}
            {routePoints.length ? (
              <Polyline coordinates={routePoints} strokeWidth={5} strokeColor="#1e90ff" />
            ) : null}
          </MapView>
          {loadingRoute ? (
            <RNView style={styles.loadingOverlay}><ActivityIndicator color="#1e90ff" /></RNView>
          ) : null}
        </RNView>

        {(distanceText || durationText) ? (
          <RNView style={styles.infoRow}>
            <Text style={styles.infoPill}>Distance: {distanceText}</Text>
            <Text style={styles.infoPill}>Time: {durationText}</Text>
          </RNView>
        ) : null}

        <RNView style={styles.saveButtonContainer}>
          <GradientButton
            title="SAVE TRIP"
            colors={from && to ? ['#1cc88a', '#17a2b8'] : ['#d1d5db', '#9ca3af']}
            onPress={saveTrip}
            disabled={!from || !to}
          />
        </RNView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const autocompleteStyles = {
  textInput: {
    height: 50,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f1f5f9',
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    maxHeight: 200,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  itemRow: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  itemText: { color: '#f1f5f9' },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#334155',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backButtonText: { fontSize: 18, fontWeight: '600', color: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  inputSection: { marginBottom: 8 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#e2e8f0', marginBottom: 8 },
  haltRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 8 },
  removeHalt: { backgroundColor: '#7f1d1d', height: 50, width: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  removeHaltText: { color: '#fca5a5', fontWeight: '700', fontSize: 18 },
  addHaltButton: { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#1e3a8a', marginBottom: 8 },
  addHaltText: { color: '#93c5fd', fontWeight: '600', fontSize: 14 },
  mapContainer: { height: 280, borderRadius: 16, overflow: 'hidden', marginTop: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)' },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  infoPill: { backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, fontWeight: '600', color: '#e2e8f0', fontSize: 14 },
  saveButtonContainer: { marginTop: 20, paddingHorizontal: 0 },
  actionButton: { borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
  actionButtonBg: { paddingVertical: 18, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});