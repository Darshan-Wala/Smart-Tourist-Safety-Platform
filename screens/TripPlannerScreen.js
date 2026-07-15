/**
 * TripPlannerScreen (Themed Dark Version)
 *
 * Changes in this update (theme fixes):
 *  - Unified dark theme (removed light grey background that broke app styling).
 *  - Added color design tokens (COLORS) for easier future adjustments.
 *  - Applied sceneContainerStyle + contentContainerStyle for top-tab navigator to enforce dark bg.
 *  - Consistent surface cards (#14242c) and base background (#0b151b).
 *  - Adjusted checklist, chips, buttons, tab indicator & fallback tab bar colors.
 *  - Improved contrast for labels & subtle text (#94a3b8).
 *  - Harmonized map container + search panel + inputs to dark palette.
 *  - Fallback tab bar now matches theme if material-top-tabs package is missing.
 *
 * NOTE:
 *  - Functionality unchanged.
 *  - Dynamic import for @react-navigation/material-top-tabs preserved.
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import polyline from 'polyline';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebase } from '../firebase';
import { useAuth } from '../context/AuthContext';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

/* ---------- Color Tokens (Dark Theme) ---------- */
const COLORS = {
  bg: '#0b151b',
  card: '#0f1c24',
  surface: '#14242c',
  surfaceAlt: '#1b2d35',
  chip: '#1d3039',
  chipActive: '#29b18d',
  chipText: '#bbb',
  text: '#ffffff',
  textDim: '#94a3b8',
  textFaint: '#7c8a92',
  accent: '#29b18d',
  accentAlt: '#1e90ff',
  danger: '#e53935',
  warning: '#f39c12',
  border: 'rgba(255,255,255,0.15)',
  borderSoft: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(0,0,0,0.45)'
};

let createMaterialTopTabNavigator = null;
try {
  // eslint-disable-next-line global-require
  createMaterialTopTabNavigator = require('@react-navigation/material-top-tabs').createMaterialTopTabNavigator;
} catch {
  console.warn('[TripPlanner] material-top-tabs not installed, using fallback tab bar.');
}

const TABS = ['Route', 'Details', 'Safety', 'Budget', 'Review'];
const PURPOSES = ['tourism', 'pilgrimage', 'business', 'trekking', 'family', 'emergency', 'other'];
const MODES = ['car', 'bike', 'bus', 'walk', 'train', 'flight', 'mixed'];

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ChipGroup({ items, value, onChange }) {
  return (
    <View style={styles.chipGroup}>
      {items.map(it => {
        const active = it === value;
        return (
          <TouchableOpacity
            key={it}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(it)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{it}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ChecklistItem({ label, value, onChange }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={value ? COLORS.accent : COLORS.textFaint} />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- ROUTE TAB ---------- */
function RouteTab({ draft, setDraft, loadingPoly, fetchRoute }) {
  const mapRef = useRef(null);
  const [searchMode, setSearchMode] = useState(null);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const runAutocomplete = async (text) => {
    setQuery(text);
    if (!text || text.length < 2) {
      setPredictions([]);
      return;
    }
    if (!GOOGLE_KEY) return;
    setSearchLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      setPredictions(data?.predictions || []);
    } catch {
      setPredictions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectPrediction = async (pred) => {
    if (!pred?.place_id) return;
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const loc = data?.result?.geometry?.location;
      if (!loc) return;
      if (searchMode === 'from') {
        setDraft(d => ({ ...d, from: { lat: loc.lat, lng: loc.lng, address: pred.description } }));
      } else if (searchMode === 'to') {
        setDraft(d => ({ ...d, to: { lat: loc.lat, lng: loc.lng, address: pred.description } }));
      } else if (typeof searchMode === 'number') {
        setDraft(d => {
          const halts = [...(d.halts || [])];
          halts[searchMode] = { lat: loc.lat, lng: loc.lng, address: pred.description };
          return { ...d, halts };
        });
      }
      setSearchMode(null);
      setQuery('');
      setPredictions([]);
      setTimeout(() => { fetchRoute(); }, 300);
    } catch {}
  };

  const addHalt = () => setDraft(d => ({ ...d, halts: [...(d.halts || []), null] }));
  const removeHalt = (i) => {
    setDraft(d => {
      const halts = (d.halts || []).filter((_, idx) => idx !== i);
      return { ...d, halts };
    });
    setTimeout(fetchRoute, 100);
  };

  const routePoints = draft.routePoints || [];

  return (
    <ScrollView contentContainerStyle={styles.tabScroll} keyboardShouldPersistTaps="handled" style={styles.tabScrollBg}>
      <SectionTitle>Route Points</SectionTitle>
      <View style={styles.routeRow}>
        <TouchableOpacity style={styles.routeBox} onPress={() => setSearchMode('from')}>
          <Text style={styles.routeLabel}>From</Text>
          <Text style={styles.routeValue}>{draft.from?.address || 'Select origin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.routeBox} onPress={() => setSearchMode('to')}>
          <Text style={styles.routeLabel}>To</Text>
          <Text style={styles.routeValue}>{draft.to?.address || 'Select destination'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.haltsHeader}>
        <Text style={styles.haltsTitle}>Halts</Text>
        <TouchableOpacity onPress={addHalt} style={styles.addMiniBtn}>
          <Ionicons name="add" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      {(draft.halts || []).map((h, i) => (
        <View key={i} style={styles.haltRow}>
          <TouchableOpacity
            style={[styles.haltSelect, !h && { opacity: 0.55 }]}
            onPress={() => setSearchMode(i)}
          >
            <Text style={styles.haltText}>{h?.address || `Set halt ${i + 1}`}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeHalt(i)} style={styles.removeHaltBtn}>
            <Ionicons name="trash" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      ))}

      {searchMode !== null && (
        <View style={styles.searchPanel}>
          <Text style={styles.searchTitle}>Search Location</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Type to search..."
            placeholderTextColor={COLORS.textFaint}
            value={query}
            onChangeText={runAutocomplete}
            autoFocus
          />
          {searchLoading && <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 8 }} />}
          {predictions.map(p => (
            <TouchableOpacity key={p.place_id} style={styles.predItem} onPress={() => selectPrediction(p)}>
              <Ionicons name="location-outline" size={16} color={COLORS.accent} />
              <Text style={styles.predText}>{p.description}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.closeSearchBtn}
            onPress={() => { setSearchMode(null); setPredictions([]); }}
          >
            <Text style={styles.closeSearchText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionTitle>Map Preview</SectionTitle>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: draft.from?.lat || 20.5937,
            longitude: draft.from?.lng || 78.9629,
            latitudeDelta: 6,
            longitudeDelta: 6
          }}
          onMapReady={() => {
            if (routePoints.length > 1) {
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(routePoints, {
                  edgePadding: { top: 60, bottom: 60, left: 60, right: 60 },
                  animated: true
                });
              }, 400);
            }
          }}
        >
          {draft.from && <Marker coordinate={{ latitude: draft.from.lat, longitude: draft.from.lng }} title="From" />}
          {draft.to && <Marker coordinate={{ latitude: draft.to.lat, longitude: draft.to.lng }} title="To" pinColor={COLORS.danger} />}
          {(draft.halts || []).filter(Boolean).map((h,i) => (
            <Marker key={`halt-${i}`} coordinate={{ latitude: h.lat, longitude: h.lng }} pinColor="#6c5ce7" />
          ))}
          {routePoints.length > 1 && <Polyline coordinates={routePoints} strokeColor={COLORS.accentAlt} strokeWidth={5} />}
        </MapView>
        {loadingPoly && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accentAlt} />
          </View>
        )}
      </View>

      <View style={styles.distanceRow}>
        <Text style={styles.distanceText}>
          Distance: {draft.distanceKm != null ? `${draft.distanceKm.toFixed(1)} km` : '--'}
        </Text>
        <Text style={styles.distanceText}>
          Duration: {draft.durationMinutes != null ? `${draft.durationMinutes} min` : '--'}
        </Text>
        <TouchableOpacity style={styles.fetchBtn} onPress={fetchRoute}>
          <Ionicons name="refresh" size={18} color={COLORS.text} />
          <Text style={styles.fetchBtnText}>Recalculate</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ---------- DETAILS TAB ---------- */
function DetailsTab({ draft, setDraft }) {
  return (
    <ScrollView contentContainerStyle={styles.tabScroll} style={styles.tabScrollBg}>
      <SectionTitle>Trip Basics</SectionTitle>
      <Text style={styles.label}>Trip Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Kashmir Adventure"
        placeholderTextColor={COLORS.textFaint}
        value={draft.tripName || ''}
        onChangeText={v => setDraft(d => ({ ...d, tripName: v }))}
      />
      <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2025-11-02"
        placeholderTextColor={COLORS.textFaint}
        value={draft.startDate || ''}
        onChangeText={v => setDraft(d => ({ ...d, startDate: v }))}
        autoCapitalize="none"
      />
      <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2025-11-07"
        placeholderTextColor={COLORS.textFaint}
        value={draft.endDate || ''}
        onChangeText={v => setDraft(d => ({ ...d, endDate: v }))}
        autoCapitalize="none"
      />
      <Text style={styles.label}>Purpose</Text>
      <ChipGroup
        items={PURPOSES}
        value={draft.purpose || 'tourism'}
        onChange={v => setDraft(d => ({ ...d, purpose: v }))}
      />
      <Text style={styles.label}>Travel Mode</Text>
      <ChipGroup
        items={MODES}
        value={draft.travelMode || 'car'}
        onChange={v => setDraft(d => ({ ...d, travelMode: v }))}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        multiline
        placeholder="Special instructions, day plan..."
        placeholderTextColor={COLORS.textFaint}
        value={draft.notes || ''}
        onChangeText={v => setDraft(d => ({ ...d, notes: v }))}
      />
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ---------- SAFETY TAB ---------- */
function SafetyTab({ draft, setDraft }) {
  const checklist = draft.checklist || {};
  const toggle = (k) =>
    setDraft(d => ({ ...d, checklist: { ...d.checklist, [k]: !d.checklist?.[k] } }));

  return (
    <ScrollView contentContainerStyle={styles.tabScroll} style={styles.tabScrollBg}>
      <SectionTitle>Safety Checklist</SectionTitle>
      <ChecklistItem label="Checked weather forecast" value={!!checklist.weatherChecked} onChange={() => toggle('weatherChecked')} />
      <ChecklistItem label="Saved emergency numbers" value={!!checklist.emergencyNumbersSaved} onChange={() => toggle('emergencyNumbersSaved')} />
      <ChecklistItem label="Offline maps downloaded" value={!!checklist.offlineMapsReady} onChange={() => toggle('offlineMapsReady')} />
      <ChecklistItem label="Medical kit packed" value={!!checklist.medKitPacked} onChange={() => toggle('medKitPacked')} />
      <ChecklistItem label="Power bank charged" value={!!checklist.powerBankCharged} onChange={() => toggle('powerBankCharged')} />

      <SectionTitle style={{ marginTop: 24 }}>Emergency Contacts Snapshot</SectionTitle>
      <Text style={styles.smallNote}>
        Trip stores snapshot of your emergency contacts at save time.
      </Text>

      <Text style={styles.label}>Share Live Location</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleHint}>Enable to integrate with live tracking sessions.</Text>
        <Switch
          value={!!draft.shareLiveLocation}
          onValueChange={v => setDraft(d => ({ ...d, shareLiveLocation: v }))}
          trackColor={{ false: COLORS.surfaceAlt, true: COLORS.accent }}
          thumbColor={COLORS.text}
        />
      </View>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ---------- BUDGET TAB ---------- */
function BudgetTab({ draft, setDraft }) {
  const budget = draft.budget || {};
  return (
    <ScrollView contentContainerStyle={styles.tabScroll} style={styles.tabScrollBg}>
      <SectionTitle>Budget</SectionTitle>
      <Text style={styles.label}>Estimated</Text>
      <TextInput
        style={styles.input}
        placeholder="12000"
        keyboardType="numeric"
        placeholderTextColor={COLORS.textFaint}
        value={budget.estimated != null ? String(budget.estimated) : ''}
        onChangeText={v => setDraft(d => ({ ...d, budget: { ...d.budget, estimated: parseFloat(v) || 0 } }))}
      />
      <Text style={styles.label}>Spent</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        placeholderTextColor={COLORS.textFaint}
        value={budget.spent != null ? String(budget.spent) : ''}
        onChangeText={v => setDraft(d => ({ ...d, budget: { ...d.budget, spent: parseFloat(v) || 0 } }))}
      />
      <Text style={styles.label}>Currency</Text>
      <TextInput
        style={styles.input}
        placeholder="INR"
        placeholderTextColor={COLORS.textFaint}
        autoCapitalize="characters"
        value={budget.currency || 'INR'}
        onChangeText={v => setDraft(d => ({ ...d, budget: { ...d.budget, currency: v || 'INR' } }))}
      />
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ---------- REVIEW TAB ---------- */
function ReviewTab({ draft, saving, onSave, onActivate, validationErrors, editing }) {
  const statusColor = {
    planned: COLORS.warning,
    active: COLORS.accent,
    finished: '#7f8c8d',
    cancelled: COLORS.danger
  }[draft.status || 'planned'] || COLORS.textFaint;

  return (
    <ScrollView contentContainerStyle={styles.tabScroll} style={styles.tabScrollBg}>
      <SectionTitle>Summary</SectionTitle>
      <View style={styles.reviewBox}>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Name:</Text> {draft.tripName || '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Dates:</Text> {draft.startDate || '—'} → {draft.endDate || '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Purpose:</Text> {draft.purpose || '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Mode:</Text> {draft.travelMode || '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Distance:</Text> {draft.distanceKm != null ? `${draft.distanceKm.toFixed(1)} km` : '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Duration:</Text> {draft.durationMinutes != null ? `${draft.durationMinutes} min` : '—'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Halts:</Text> {(draft.halts || []).filter(Boolean).length}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Live Share:</Text> {draft.shareLiveLocation ? 'Yes' : 'No'}</Text>
        <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Status:</Text> <Text style={{ color: statusColor }}>{draft.status}</Text></Text>
      </View>

      {validationErrors.length > 0 && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Please fix before saving:</Text>
          {validationErrors.map((e,i)=><Text key={i} style={styles.errorItem}>• {e}</Text>)}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, validationErrors.length>0 && { opacity:0.5 }]}
        disabled={validationErrors.length>0 || saving}
        onPress={onSave}
      >
        {saving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.saveBtnText}>{editing ? 'Update Trip' : 'Save Trip'}</Text>}
      </TouchableOpacity>

      {editing && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onActivate}>
          <Text style={styles.secondaryBtnText}>Set As Current Trip</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

/* ---------- MAIN SCREEN ---------- */
export default function TripPlannerScreen({ route, navigation }) {
  const { user, updateProfile } = useAuth();
  const uid = user?.uid;
  const editingTripId = route?.params?.tripId || null;

  const db = firebase.firestore();
  const tripRef = editingTripId
    ? db.collection('tourists').doc(uid).collection('trips').doc(editingTripId)
    : null;

  const [draft, setDraft] = useState({
    tripName: '',
    startDate: '',
    endDate: '',
    purpose: 'tourism',
    travelMode: 'car',
    status: 'planned',
    from: null,
    to: null,
    halts: [],
    routePoints: [],
    distanceKm: null,
    durationMinutes: null,
    notes: '',
    checklist: {},
    budget: { currency: 'INR' },
    shareLiveLocation: false
  });
  const [loadingPoly, setLoadingPoly] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fallbackTab, setFallbackTab] = useState('Route');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!uid) return;
      if (editingTripId && tripRef) {
        try {
          const snap = await tripRef.get();
          if (!snap.exists) {
            Alert.alert('Not Found','Trip no longer exists.');
            navigation.goBack();
            return;
          }
          if (isMounted) {
            setDraft(d => ({
              ...d,
              ...snap.data(),
              routePoints: []
            }));
          }
        } catch (e) {
          Alert.alert('Error', e.message || 'Failed to load trip.');
        }
      } else {
        const raw = await AsyncStorage.getItem(`tripDraft:${uid}:new`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (isMounted) setDraft(d => ({ ...d, ...parsed }));
          } catch {}
        }
      }
      setInitialLoading(false);
    })();
    return () => { isMounted = false; };
  }, [editingTripId, uid]);

  useEffect(() => {
    if (!uid || initialLoading) return;
    const toStore = { ...draft };
    delete toStore.routePoints;
    AsyncStorage.setItem(
      `tripDraft:${uid}:${editingTripId || 'new'}`,
      JSON.stringify(toStore)
    ).catch(()=>{});
  }, [draft, uid, initialLoading, editingTripId]);

  const fetchRoute = useCallback(async () => {
    if (!draft.from || !draft.to) return;
    setLoadingPoly(true);
    try {
      const waypoints = (draft.halts || []).filter(Boolean).map(h => `${h.lat},${h.lng}`).join('|');
      const wpParam = waypoints ? `&waypoints=${waypoints}` : '';
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${draft.from.lat},${draft.from.lng}&destination=${draft.to.lat},${draft.to.lng}${wpParam}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const first = json.routes?.[0];
      if (!first) {
        Alert.alert('Route Error','No route found.');
        return;
      }
      const encoded = first.overview_polyline?.points || '';
      const points = encoded
        ? polyline.decode(encoded).map(([lat,lng]) => ({ latitude: lat, longitude: lng }))
        : [];
      const totalMeters = first.legs.reduce((acc,l)=>acc+(l.distance?.value||0),0);
      const totalSecs = first.legs.reduce((acc,l)=>acc+(l.duration?.value||0),0);
      setDraft(d => ({
        ...d,
        encodedPolyline: encoded,
        routePoints: points,
        distanceKm: totalMeters / 1000,
        durationMinutes: Math.round(totalSecs / 60)
      }));
    } catch (e) {
      Alert.alert('Route Error', e.message || 'Failed to fetch route.');
    } finally {
      setLoadingPoly(false);
    }
  }, [draft.from, draft.to, draft.halts]);

  const validationErrors = useMemo(() => {
    const errs = [];
    if (!draft.tripName?.trim()) errs.push('Trip Name required');
    if (!draft.startDate?.match(/^\d{4}-\d{2}-\d{2}$/)) errs.push('Valid Start Date required');
    if (!draft.endDate?.match(/^\d{4}-\d{2}-\d{2}$/)) errs.push('Valid End Date required');
    if (draft.startDate && draft.endDate) {
      if (new Date(draft.endDate) < new Date(draft.startDate)) errs.push('End Date must be after Start Date');
    }
    if (!draft.from) errs.push('Origin (From) required');
    if (!draft.to) errs.push('Destination (To) required');
    return errs;
  }, [draft]);

  const deriveAutoStatus = (doc) => {
    if (!doc.startDate || !doc.endDate) return 'planned';
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const s = new Date(doc.startDate); s.setHours(0,0,0,0);
      const e = new Date(doc.endDate); e.setHours(0,0,0,0);
      if (today < s) return 'planned';
      if (today > e) return doc.status === 'cancelled' ? 'cancelled' : 'finished';
      return 'active';
    } catch { return 'planned'; }
  };

  const snapshotEmergencyContacts = async () => {
    try {
      const snap = await firebase.firestore()
        .collection('tourists')
        .doc(uid)
        .collection('emergencyContacts')
        .get();
      const arr = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.phone) arr.push({ phone: data.phone, label: data.label || '' });
      });
      return arr.slice(0,5);
    } catch {
      return [];
    }
  };

  const persistTrip = useCallback(async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const col = db.collection('tourists').doc(uid).collection('trips');
      const now = firebase.firestore.Timestamp.now();
      const emergencyContacts = await snapshotEmergencyContacts();
      const payload = {
        tripName: draft.tripName.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        purpose: draft.purpose,
        travelMode: draft.travelMode,
        status: draft.status || 'planned',
        autoStatus: deriveAutoStatus(draft),
        from: draft.from,
        to: draft.to,
        halts: (draft.halts || []).filter(Boolean),
        encodedPolyline: draft.encodedPolyline || '',
        distanceKm: draft.distanceKm ?? null,
        durationMinutes: draft.durationMinutes ?? null,
        notes: draft.notes || '',
        checklist: draft.checklist || {},
        budget: draft.budget || {},
        emergencyContacts,
        shareLiveLocation: !!draft.shareLiveLocation,
        createdAt: editingTripId ? draft.createdAt || now : now,
        updatedAt: now,
        archived: false
      };
      let newId = editingTripId;
      if (editingTripId) {
        await col.doc(editingTripId).set(payload, { merge: true });
      } else {
        const ref = await col.add(payload);
        newId = ref.id;
        await AsyncStorage.removeItem(`tripDraft:${uid}:new`);
      }
      Alert.alert('Success', editingTripId ? 'Trip updated.' : 'Trip saved.');
      navigation.replace('TripDetails', { tripId: newId });
    } catch (e) {
      Alert.alert('Save Error', e.message || 'Failed to save trip.');
    } finally {
      setSaving(false);
    }
  }, [draft, uid, editingTripId]);

  const setAsCurrent = useCallback(async () => {
    if (!uid || !editingTripId) return;
    try {
      await updateProfile({ currentTripId: editingTripId });
      Alert.alert('Current Trip', 'Trip set as current.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to set current trip.');
    }
  }, [editingTripId, uid]);

  if (initialLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (createMaterialTopTabNavigator) {
    const TabNav = createMaterialTopTabNavigator();
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBack}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editingTripId ? 'Edit Trip' : 'Plan Trip'}</Text>
          <View style={{ width:40 }} />
        </View>
        <TabNav.Navigator
          sceneContainerStyle={{ backgroundColor: COLORS.bg }}
          screenOptions={{
            tabBarStyle: { backgroundColor: COLORS.card },
            tabBarIndicatorStyle: { backgroundColor: COLORS.accent, height: 3, borderRadius: 2 },
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
            tabBarActiveTintColor: COLORS.accent,
            tabBarInactiveTintColor: COLORS.textFaint,
            swipeEnabled: true
          }}
        >
          <TabNav.Screen name="Route">
            {() => (
              <RouteTab
                draft={draft}
                setDraft={setDraft}
                loadingPoly={loadingPoly}
                fetchRoute={fetchRoute}
              />
            )}
          </TabNav.Screen>
          <TabNav.Screen name="Details">
            {() => <DetailsTab draft={draft} setDraft={setDraft} />}
          </TabNav.Screen>
          <TabNav.Screen name="Safety">
            {() => <SafetyTab draft={draft} setDraft={setDraft} />}
          </TabNav.Screen>
          <TabNav.Screen name="Budget">
            {() => <BudgetTab draft={draft} setDraft={setDraft} />}
          </TabNav.Screen>
          <TabNav.Screen name="Review">
            {() => (
              <ReviewTab
                draft={draft}
                saving={saving}
                onSave={persistTrip}
                onActivate={setAsCurrent}
                validationErrors={validationErrors}
                editing={!!editingTripId}
              />
            )}
          </TabNav.Screen>
        </TabNav.Navigator>
      </KeyboardAvoidingView>
    );
  }

  // Fallback custom tab bar
  const renderFallbackBody = () => {
    switch (fallbackTab) {
      case 'Route': return <RouteTab draft={draft} setDraft={setDraft} loadingPoly={loadingPoly} fetchRoute={fetchRoute} />;
      case 'Details': return <DetailsTab draft={draft} setDraft={setDraft} />;
      case 'Safety': return <SafetyTab draft={draft} setDraft={setDraft} />;
      case 'Budget': return <BudgetTab draft={draft} setDraft={setDraft} />;
      case 'Review':
      default: return (
        <ReviewTab
          draft={draft}
          saving={saving}
          onSave={persistTrip}
          onActivate={setAsCurrent}
          validationErrors={validationErrors}
          editing={!!editingTripId}
        />
      );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBack}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{editingTripId ? 'Edit Trip' : 'Plan Trip'}</Text>
        <View style={{ width:40 }} />
      </View>
      <View style={styles.fallbackTabBar}>
        {TABS.map(tab => {
          const active = tab === fallbackTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.fallbackTabBtn, active && styles.fallbackTabBtnActive]}
              onPress={() => setFallbackTab(tab)}
            >
              <Text style={[styles.fallbackTabText, active && styles.fallbackTabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flex:1 }}>
        {renderFallbackBody()}
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, backgroundColor: COLORS.card, borderBottomWidth:1, borderBottomColor: COLORS.borderSoft },
  navBack:{ width:40, height:40, alignItems:'center', justifyContent:'center', borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)' },
  topTitle:{ flex:1, textAlign:'center', color:COLORS.text, fontSize:16, fontWeight:'700' },

  tabScrollBg:{ backgroundColor: COLORS.bg },
  tabScroll:{ padding:16, paddingBottom:80 },
  sectionTitle:{ color:COLORS.text, fontWeight:'700', fontSize:16, marginBottom:12 },

  routeRow:{ flexDirection:'row', gap:12 },
  routeBox:{ flex:1, backgroundColor: COLORS.surface, padding:12, borderRadius:16, borderWidth:1, borderColor:COLORS.border },
  routeLabel:{ fontSize:11, color:COLORS.textDim, letterSpacing:0.5, marginBottom:4 },
  routeValue:{ color:COLORS.text, fontSize:13, fontWeight:'600' },

  haltsHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:18, marginBottom:6 },
  haltsTitle:{ color:COLORS.text, fontWeight:'700', fontSize:14 },
  addMiniBtn:{ backgroundColor:COLORS.accent, padding:8, borderRadius:12 },

  haltRow:{ flexDirection:'row', alignItems:'center', marginTop:10 },
  haltSelect:{ flex:1, backgroundColor: COLORS.surface, padding:12, borderRadius:14, borderWidth:1, borderColor:COLORS.border },
  haltText:{ color:COLORS.text, fontSize:13 },
  removeHaltBtn:{ marginLeft:10, padding:6 },

  searchPanel:{ marginTop:18, backgroundColor: COLORS.surfaceAlt, borderRadius:18, padding:16, borderWidth:1, borderColor:COLORS.border },
  searchTitle:{ color:COLORS.text, fontWeight:'700', fontSize:14, marginBottom:8 },
  searchInput:{ backgroundColor: COLORS.card, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color:COLORS.text, fontSize:14, marginBottom:10, borderWidth:1, borderColor:COLORS.border },
  predItem:{ flexDirection:'row', alignItems:'center', paddingVertical:10, gap:8, borderBottomWidth:1, borderBottomColor:COLORS.borderSoft },
  predText:{ color:COLORS.text, flex:1, fontSize:13 },
  closeSearchBtn:{ marginTop:12, backgroundColor:COLORS.danger, paddingVertical:12, borderRadius:14, alignItems:'center' },
  closeSearchText:{ color:COLORS.text, fontWeight:'700' },

  mapContainer:{ height:260, borderRadius:24, overflow:'hidden', backgroundColor:COLORS.surface, marginTop:14, borderWidth:1, borderColor:COLORS.border },
  map:{ flex:1 },
  mapLoadingOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:COLORS.overlay, alignItems:'center', justifyContent:'center' },

  distanceRow:{ flexDirection:'row', alignItems:'center', marginTop:18, flexWrap:'wrap', gap:14 },
  distanceText:{ color:COLORS.text, fontSize:13, fontWeight:'600' },
  fetchBtn:{ flexDirection:'row', alignItems:'center', backgroundColor:COLORS.accentAlt, paddingHorizontal:16, paddingVertical:12, borderRadius:14, gap:6, marginLeft:'auto' },
  fetchBtnText:{ color:COLORS.text, fontSize:12, fontWeight:'600' },

  label:{ color:COLORS.textDim, fontSize:12, fontWeight:'600', marginTop:14, marginBottom:6, letterSpacing:0.5 },
  input:{ backgroundColor:COLORS.surface, borderRadius:16, paddingHorizontal:16, paddingVertical:14, color:COLORS.text, fontSize:14, borderWidth:1, borderColor:COLORS.border },

  chipGroup:{ flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:6 },
  chip:{ paddingHorizontal:18, paddingVertical:10, backgroundColor:COLORS.chip, borderRadius:22, borderWidth:1, borderColor:COLORS.border },
  chipActive:{ backgroundColor:COLORS.chipActive, borderColor:COLORS.chipActive },
  chipText:{ color:COLORS.chipText, fontSize:12, fontWeight:'600' },
  chipTextActive:{ color:COLORS.text },

  checkRow:{ flexDirection:'row', alignItems:'center', gap:14, paddingVertical:10 },
  checkLabel:{ color:COLORS.text, fontSize:14, flex:1, fontWeight:'500' },

  smallNote:{ color:COLORS.textFaint, fontSize:12, lineHeight:18, marginBottom:10 },

  toggleRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8, gap:18 },
  toggleHint:{ color:COLORS.textFaint, fontSize:12, flex:1 },

  reviewBox:{ backgroundColor:COLORS.surfaceAlt, padding:16, borderRadius:18, borderWidth:1, borderColor:COLORS.border },
  reviewLine:{ color:COLORS.text, fontSize:13, marginBottom:4 },
  reviewLabel:{ color:COLORS.textDim, fontWeight:'600' },

  errorBox:{ backgroundColor:'rgba(229,57,53,0.15)', padding:14, borderRadius:16, marginTop:22, borderWidth:1, borderColor:COLORS.danger },
  errorTitle:{ color:COLORS.danger, fontWeight:'700', marginBottom:8, fontSize:13 },
  errorItem:{ color:'#ffb3b3', fontSize:12 },

  saveBtn:{ marginTop:28, backgroundColor:COLORS.accent, paddingVertical:16, borderRadius:18, alignItems:'center' },
  saveBtnText:{ color:COLORS.text, fontWeight:'800', letterSpacing:0.5 },
  secondaryBtn:{ marginTop:14, backgroundColor:COLORS.accentAlt, paddingVertical:16, borderRadius:18, alignItems:'center' },
  secondaryBtnText:{ color:COLORS.text, fontWeight:'700' },

  loadingScreen:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:COLORS.bg },

  fallbackTabBar:{ flexDirection:'row', backgroundColor:COLORS.card, paddingVertical:6, paddingHorizontal:6, borderBottomWidth:1, borderBottomColor:COLORS.borderSoft },
  fallbackTabBtn:{ flex:1, marginHorizontal:4, paddingVertical:10, borderRadius:12, backgroundColor:COLORS.surface, alignItems:'center', borderWidth:1, borderColor:COLORS.borderSoft },
  fallbackTabBtnActive:{ backgroundColor:COLORS.surfaceAlt, borderColor:COLORS.accent },
  fallbackTabText:{ fontSize:11, fontWeight:'600', color:COLORS.textFaint },
  fallbackTabTextActive:{ color:COLORS.accent }
});

export { TABS };