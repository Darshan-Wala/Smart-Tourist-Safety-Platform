import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, View as RNView, StyleSheet } from 'react-native';
import { Text } from '../../components/Themed';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDW3PK263uMcGH2Lhr9SU2Gmekf9sYaDkY';

export default function TripsScreen() {
  const [trips, setTrips] = useState([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const str = await AsyncStorage.getItem('trips');
        setTrips(str ? JSON.parse(str) : []);
      })();
      return undefined;
    }, [])
  );

  const renderTripItem = ({ item }) => {
    const fromAddress = item.from?.description || item.waypoints?.find(w => w.type === 'from')?.address || 'Unknown';
    const toAddress = item.to?.description || item.waypoints?.find(w => w.type === 'to')?.address || 'Unknown';
    const tripName = (toAddress.split(',')[0] || 'Trip').trim();
    const tripDate = new Date(item.createdAt).toLocaleDateString();

    return (
      <RNView style={styles.tripCard}>
        <RNView style={styles.tripInfo}>
          <Text style={styles.tripName}>{tripName}</Text>
          <Text style={styles.tripDate}>{tripDate}</Text>
          <Text style={styles.tripRoute}>
            {fromAddress.split(',')[0]} → {toAddress.split(',')[0]}
          </Text>
          <Text style={styles.tripDetails}>
            {item.distance ? `${item.distance.toFixed(1)} km` : 'N/A'} • {item.duration ? `${Math.round(item.duration)} min` : 'N/A'}
          </Text>
        </RNView>
        <RNView style={styles.tripMap}>
          {item.encodedPolyline ? (
            <Image 
              style={StyleSheet.absoluteFill} 
              source={{ 
                uri: `https://maps.googleapis.com/maps/api/staticmap?size=120x80&path=weight:3%7Ccolor:0x2a7dd6ff%7Cenc:${encodeURIComponent(item.encodedPolyline)}&key=${GOOGLE_MAPS_API_KEY}` 
              }} 
            />
          ) : (
            <Text style={styles.noMapText}>No map</Text>
          )}
        </RNView>
      </RNView>
    );
  };

  return (
    <RNView style={styles.screen}>
      <RNView style={styles.headerRow}>
        <Pressable onPress={() => router.push('/(tabs)/index')} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>← Home</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Trips</Text>
        <Pressable onPress={() => router.push('/add-trip')} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add Trip</Text>
        </Pressable>
      </RNView>
      
      <RNView style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trip History</Text>
      </RNView>
      
      <FlatList
        data={trips}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderTripItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <RNView style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySubtitle}>Tap the + button to plan your first trip</Text>
          </RNView>
        }
      />
    </RNView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  homeButton: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  homeButtonText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  pageTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0f172a' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  addButton: { backgroundColor: '#1cc88a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  addButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  listContainer: { padding: 16, backgroundColor: '#0f172a' },
  tripCard: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  tripInfo: { flex: 1, marginRight: 12 },
  tripName: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  tripDate: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  tripRoute: { fontSize: 14, color: '#cbd5e1', marginBottom: 4 },
  tripDetails: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  tripMap: { width: 120, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#334155' },
  noMapText: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 30 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
});