import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { firebase } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from 'react-native-maps';

export default function TripDetailsScreen({ route, navigation }) {
  const { user, updateProfile, profile } = useAuth();
  const uid = user?.uid;
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!uid || !tripId) return;
    const ref = firebase.firestore().collection('tourists').doc(uid).collection('trips').doc(tripId);
    const unsub = ref.onSnapshot(snap => {
      if (!snap.exists) {
        Alert.alert('Deleted', 'Trip was removed.');
        navigation.goBack();
        return;
      }
      setTrip({ id: snap.id, ...snap.data() });
      setLoading(false);
    }, e => {
      Alert.alert('Error', e.message || 'Failed to load trip.');
      setLoading(false);
    });
    return () => unsub();
  }, [uid, tripId]);

  const deriveAutoStatus = useCallback((t) => {
    if (!t.startDate || !t.endDate) return t.status;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const s = new Date(t.startDate); s.setHours(0,0,0,0);
      const e = new Date(t.endDate); e.setHours(0,0,0,0);
      if (today < s) return 'planned';
      if (today > e) return t.status === 'cancelled' ? 'cancelled' : 'finished';
      return 'active';
    } catch {
      return t.status;
    }
  }, []);

  const updateStatus = async (newStatus) => {
    if (!uid || !trip) return;
    setChanging(true);
    try {
      const ref = firebase.firestore()
        .collection('tourists').doc(uid)
        .collection('trips').doc(trip.id);
      await ref.set({
        status: newStatus,
        autoStatus: deriveAutoStatus({ ...trip, status: newStatus }),
        updatedAt: firebase.firestore.Timestamp.now()
      }, { merge: true });
      Alert.alert('Status Updated', `Trip marked as ${newStatus}.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setChanging(false);
    }
  };

  const setAsCurrent = async () => {
    if (!uid || !trip) return;
    try {
      await updateProfile({ currentTripId: trip.id, updatedAt: Date.now() });
      Alert.alert('Current Trip', 'This trip is now set as current.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#29b18d" size="large" />
      </View>
    );
  }
  if (!trip) return null;

  const statusColor = {
    planned: '#f39c12',
    active: '#29b18d',
    finished: '#7f8c8d',
    cancelled: '#e53935'
  }[trip.status] || '#555';

  const halts = (trip.halts || []).filter(Boolean);
  const decodePolyline = (enc) => {
    if (!enc) return [];
    try {
      const polyline = require('polyline');
      return polyline.decode(enc).map(([lat,lng]) => ({ latitude: lat, longitude: lng }));
    } catch { return []; }
  };
  const path = decodePolyline(trip.encodedPolyline);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.tripName}>{trip.tripName}</Text>
        <Text style={styles.tripDates}>{trip.startDate || '—'} → {trip.endDate || '—'}</Text>
        <View style={[styles.statusBadge,{ backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>{trip.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.line}><Text style={styles.label}>Purpose:</Text> {trip.purpose}</Text>
        <Text style={styles.line}><Text style={styles.label}>Mode:</Text> {trip.travelMode}</Text>
        <Text style={styles.line}><Text style={styles.label}>Distance:</Text> {trip.distanceKm != null ? `${trip.distanceKm.toFixed(1)} km` : '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>Duration:</Text> {trip.durationMinutes != null ? `${trip.durationMinutes} min` : '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>Live Share:</Text> {trip.shareLiveLocation ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Route Overview</Text>
        <View style={styles.mapHolder}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: trip.from?.lat || 20.5,
              longitude: trip.from?.lng || 78.9,
              latitudeDelta: 5,
              longitudeDelta: 5
            }}
          >
            {trip.from && <Marker coordinate={{ latitude: trip.from.lat, longitude: trip.from.lng }} title="From" />}
            {trip.to && <Marker coordinate={{ latitude: trip.to.lat, longitude: trip.to.lng }} title="To" pinColor="#f44336" />}
            {halts.map((h,i)=><Marker key={i} coordinate={{ latitude:h.lat, longitude:h.lng }} pinColor="#6c5ce7" />)}
            {path.length > 1 && (
              <Polyline coordinates={path} strokeWidth={5} strokeColor="#1e90ff" />
            )}
          </MapView>
        </View>
        <Text style={styles.line}><Text style={styles.label}>From:</Text> {trip.from?.address || '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>To:</Text> {trip.to?.address || '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>Halts:</Text> {halts.length}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Notes</Text>
        <Text style={styles.notesText}>{trip.notes || '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Checklist</Text>
        {Object.entries(trip.checklist || {}).length === 0 && <Text style={styles.dim}>No items.</Text>}
        {Object.entries(trip.checklist || {}).map(([k,v])=>(
          <Text key={k} style={styles.line}>
            <Text style={styles.label}>{k}:</Text> {v ? 'Yes' : 'No'}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Budget</Text>
        <Text style={styles.line}><Text style={styles.label}>Estimated:</Text> {trip.budget?.estimated ?? '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>Spent:</Text> {trip.budget?.spent ?? '—'}</Text>
        <Text style={styles.line}><Text style={styles.label}>Currency:</Text> {trip.budget?.currency || '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Emergency Contacts</Text>
        {(trip.emergencyContacts || []).length === 0 && <Text style={styles.dim}>None stored.</Text>}
        {(trip.emergencyContacts || []).map((c,i)=>(
          <Text key={i} style={styles.line}>{c.phone}{c.label ? ` (${c.label})` : ''}</Text>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={setAsCurrent} disabled={profile?.currentTripId === trip.id}>
          <Text style={styles.primaryBtnText}>{profile?.currentTripId === trip.id ? 'Current Trip' : 'Set Current'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusActions}>
        {trip.status !== 'active' && (
          <TouchableOpacity style={[styles.statusBtn,{backgroundColor:'#29b18d'}]} onPress={()=>updateStatus('active')} disabled={changing}>
            <Text style={styles.statusBtnText}>Mark Active</Text>
          </TouchableOpacity>
        )}
        {trip.status !== 'finished' && (
          <TouchableOpacity style={[styles.statusBtn,{backgroundColor:'#546e7a'}]} onPress={()=>updateStatus('finished')} disabled={changing}>
            <Text style={styles.statusBtnText}>Mark Finished</Text>
          </TouchableOpacity>
        )}
        {trip.status !== 'cancelled' && (
          <TouchableOpacity style={[styles.statusBtn,{backgroundColor:'#e53935'}]} onPress={()=>updateStatus('cancelled')} disabled={changing}>
            <Text style={styles.statusBtnText}>Cancel Trip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{ padding:16, backgroundColor:'#0b151b' },
  center:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#0b151b' },
  header:{ flexDirection:'row', alignItems:'center', marginBottom:16 },
  backBtn:{ width:40, height:40, borderRadius:12, backgroundColor:'#14242c', alignItems:'center', justifyContent:'center' },
  headerTitle:{ flex:1, textAlign:'center', color:'#fff', fontSize:16, fontWeight:'700' },
  card:{ backgroundColor:'#14242c', borderRadius:16, padding:14, marginBottom:16, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  tripName:{ color:'#fff', fontSize:18, fontWeight:'800' },
  tripDates:{ color:'#94a3b8', fontSize:13, marginTop:4 },
  statusBadge:{ alignSelf:'flex-start', marginTop:10, paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  statusBadgeText:{ color:'#fff', fontSize:11, fontWeight:'700' },
  line:{ color:'#fff', fontSize:13, marginTop:6 },
  label:{ color:'#94a3b8', fontWeight:'600' },
  subTitle:{ color:'#fff', fontWeight:'700', fontSize:15, marginBottom:8 },
  mapHolder:{ height:200, borderRadius:14, overflow:'hidden', marginBottom:10 },
  map:{ flex:1 },
  notesText:{ color:'#fff', fontSize:13, lineHeight:18 },
  dim:{ color:'#607d8b', fontSize:12 },
  actionRow:{ flexDirection:'row', justifyContent:'center', marginTop:4 },
  primaryBtn:{ backgroundColor:'#1e90ff', paddingHorizontal:20, paddingVertical:12, borderRadius:12 },
  primaryBtnText:{ color:'#fff', fontWeight:'700' },
  statusActions:{ flexDirection:'row', justifyContent:'space-between', marginTop:12 },
  statusBtn:{ flex:1, marginHorizontal:4, paddingVertical:12, borderRadius:12, alignItems:'center' },
  statusBtnText:{ color:'#fff', fontWeight:'700', fontSize:12 }
});