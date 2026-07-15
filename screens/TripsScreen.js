import React, { useEffect, useState } from 'react';
import { View as RNView, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firebase } from '../firebase';
import { useAuth } from '../context/AuthContext';

function deriveAutoStatus(trip) {
  if (!trip.startDate || !trip.endDate) return trip.status || 'planned';
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const s = new Date(trip.startDate); s.setHours(0,0,0,0);
    const e = new Date(trip.endDate); e.setHours(0,0,0,0);
    if (today < s) return 'planned';
    if (today > e) return trip.status === 'cancelled' ? 'cancelled' : 'finished';
    return trip.status === 'cancelled' ? 'cancelled' : 'active';
  } catch { return trip.status || 'planned'; }
}

export default function TripsScreen({ navigation }) {
  const { user, profile, updateProfile } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const ref = firebase.firestore()
      .collection('tourists').doc(uid)
      .collection('trips')
      .orderBy('createdAt','desc');

    const unsub = ref.onSnapshot(snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id:d.id, ...d.data() }));
      setTrips(arr);
      setLoading(false);
    }, e => {
      console.log('[TripsScreen] error', e?.message);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const statusColor = (st) => ({
    planned:'#f39c12',
    active:'#29b18d',
    finished:'#546e7a',
    cancelled:'#e53935'
  }[st] || '#555');

  const setAsCurrent = async (tripId) => {
    try {
      await updateProfile({ currentTripId: tripId, updatedAt: Date.now() });
    } catch (e) {
      console.log('[TripsScreen] set current failed', e?.message);
    }
  };

  const renderItem = ({ item }) => {
    const st = deriveAutoStatus(item);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('TripDetails',{ tripId: item.id })}
        onLongPress={() => setAsCurrent(item.id)}
      >
        <RNView style={{ flex:1 }}>
          <Text style={styles.tripName} numberOfLines={1}>{item.tripName}</Text>
          <Text style={styles.dates}>{(item.startDate || '—')} → {(item.endDate || '—')}</Text>
          <Text style={styles.meta}>
            {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : '—'} • {item.durationMinutes != null ? `${item.durationMinutes} min` : '—'}
          </Text>
          <Text style={styles.meta}>Purpose: {item.purpose}</Text>
        </RNView>
        <RNView style={[styles.statusBadge,{ backgroundColor: statusColor(st) }]}>
          <Text style={styles.statusText}>{st.toUpperCase()}</Text>
          {profile?.currentTripId === item.id && <Ionicons name="star" size={14} color="#fff" style={{ marginLeft:4 }} />}
        </RNView>
      </TouchableOpacity>
    );
  };

  return (
    <RNView style={styles.screen}>
      <RNView style={styles.headerRow}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trips</Text>
        <TouchableOpacity onPress={()=>navigation.navigate('TripPlanner')} style={styles.planBtn}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.planText}>Plan</Text>
        </TouchableOpacity>
      </RNView>

      {loading ? (
        <RNView style={styles.loaderWrap}>
          <ActivityIndicator color="#29b18d" size="large" />
        </RNView>
      ) : trips.length === 0 ? (
        <RNView style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySub}>Tap Plan to create your first trip</Text>
        </RNView>
      ) : (
        <FlatList
          data={trips}
            keyExtractor={i=>i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding:16, paddingBottom:32 }}
        />
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:'#0b151b' },
  headerRow:{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingTop:50, paddingBottom:14, backgroundColor:'#0f1c24' },
  backBtn:{ width:40, height:40, borderRadius:12, backgroundColor:'#14242c', alignItems:'center', justifyContent:'center' },
  headerTitle:{ flex:1, textAlign:'center', color:'#fff', fontSize:16, fontWeight:'700' },
  planBtn:{ flexDirection:'row', alignItems:'center', backgroundColor:'#29b18d', paddingHorizontal:12, paddingVertical:8, borderRadius:12, gap:4 },
  planText:{ color:'#fff', fontSize:12, fontWeight:'700' },
  loaderWrap:{ flex:1, alignItems:'center', justifyContent:'center' },
  emptyWrap:{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:40 },
  emptyTitle:{ color:'#fff', fontSize:18, fontWeight:'700', marginBottom:8 },
  emptySub:{ color:'#94a3b8', fontSize:13, textAlign:'center', lineHeight:18 },
  card:{ flexDirection:'row', backgroundColor:'#14242c', borderRadius:16, padding:14, marginBottom:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', alignItems:'center' },
  tripName:{ color:'#fff', fontSize:16, fontWeight:'700' },
  dates:{ color:'#94a3b8', fontSize:12, marginTop:4 },
  meta:{ color:'#cfd8dc', fontSize:11, marginTop:4 },
  statusBadge:{ flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:6, borderRadius:18, marginLeft:10 },
  statusText:{ color:'#fff', fontSize:11, fontWeight:'700' }
});