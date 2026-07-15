import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Modal,
  TextInput,
  ScrollView,
  Share,
  KeyboardAvoidingView,
  Switch,
  Pressable
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import { auth, db, firebase, rtdb } from '../firebase';
import {
  createLiveSession,
  updateLiveSession,
  endLiveSession,
  writeLiveLocation,
  throttle
} from '../services/realtimeService';

const { height } = Dimensions.get('window');

const API_URL = 'http://192.168.27.205:5000';
const DEV_TOOLS = (__DEV__ && (Constants.expoConfig?.extra?.DEV_TOOLS !== false));

const BG_TASK_NAME = 'smarttourist-background-location-task';
if (!TaskManager.isTaskDefined(BG_TASK_NAME)) {
  TaskManager.defineTask(BG_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.log('[BG TASK] error', error);
      return;
    }
    const loc = data?.locations?.[0];
    const user = auth.currentUser;
    if (!loc?.coords || !user) return;
    try {
      await rtdb.ref(`liveLocations/${user.uid}`).update({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        updatedAt: Date.now(),
        tracking: true,
        bg: true
      });
      global.__BG_LAST_UPDATE__ = new Date().toISOString();
    } catch (e) {
      console.log('[BG TASK] RTDB write failed', e?.message);
    }
  });
}

/* Zones data (unchanged) */
const RESTRICTED_ZONES = [ /* ... truncated for brevity in this explanation (keep same as previous file) ... */ 
  { id: 'jammu_1', name: 'Janiur Area', district: 'Jammu', coordinates: [
    { latitude: 32.7266, longitude: 74.8570 },
    { latitude: 32.7280, longitude: 74.8590 },
    { latitude: 32.7250, longitude: 74.8610 },
    { latitude: 32.7235, longitude: 74.8585 },
  ]},
  { id: 'jammu_2', name: 'Peer Mitha (Gujjar Nagar)', district: 'Jammu', coordinates: [
    { latitude: 32.7180, longitude: 74.8520 },
    { latitude: 32.7195, longitude: 74.8540 },
    { latitude: 32.7165, longitude: 74.8560 },
    { latitude: 32.7150, longitude: 74.8535 },
  ]},
  { id: 'jammu_3', name: 'Bhatindi and Sunjwan', district: 'Jammu', coordinates: [
    { latitude: 32.6980, longitude: 74.8420 },
    { latitude: 32.6995, longitude: 74.8440 },
    { latitude: 32.6965, longitude: 74.8460 },
    { latitude: 32.6950, longitude: 74.8435 },
  ]},
  { id: 'jammu_4', name: 'Bahu Fort area (Kalka Colony)', district: 'Jammu', coordinates: [
    { latitude: 32.7320, longitude: 74.8680 },
    { latitude: 32.7335, longitude: 74.8700 },
    { latitude: 32.7305, longitude: 74.8720 },
    { latitude: 32.7290, longitude: 74.8695 },
  ]},
  { id: 'rajouri_1', name: 'Sarola', district: 'Rajouri', coordinates: [
    { latitude: 33.3827, longitude: 74.3110 },
    { latitude: 33.3842, longitude: 74.3130 },
    { latitude: 33.3812, longitude: 74.3150 },
    { latitude: 33.3797, longitude: 74.3125 },
  ]},
  { id: 'srinagar_1', name: 'Ahmed Nagar', district: 'Srinagar', coordinates: [
    { latitude: 34.0837, longitude: 74.7973 },
    { latitude: 34.0852, longitude: 74.7993 },
    { latitude: 34.0822, longitude: 74.8013 },
    { latitude: 34.0807, longitude: 74.7988 },
  ]},
  { id: 'srinagar_2', name: 'Lal Bazar', district: 'Srinagar', coordinates: [
    { latitude: 34.0896, longitude: 74.8060 },
    { latitude: 34.0911, longitude: 74.8080 },
    { latitude: 34.0881, longitude: 74.8100 },
    { latitude: 34.0866, longitude: 74.8075 },
  ]},
  { id: 'bandipora_1', name: 'Parray Mohalla', district: 'Bandipora', coordinates: [
    { latitude: 34.4196, longitude: 74.6450 },
    { latitude: 34.4211, longitude: 74.6470 },
    { latitude: 34.4181, longitude: 74.6490 },
    { latitude: 34.4166, longitude: 74.6465 },
  ]},
];
const SAFE_ZONES = [
  { id: 'safe_1', name: 'Jammu Police Station', coordinates: { latitude: 32.7300, longitude: 74.8650 } },
  { id: 'safe_2', name: 'Srinagar Hospital', coordinates: { latitude: 34.0860, longitude: 74.7995 } },
  { id: 'safe_3', name: 'Rajouri Army Base', coordinates: { latitude: 33.3850, longitude: 74.3140 } },
];

/* Helpers */
const toRad = d => d * Math.PI / 180;
function haversine(a, b) { const R=6371e3; const dLat=toRad(b.latitude-a.latitude); const dLon=toRad(b.longitude-a.longitude); const la1=toRad(a.latitude); const la2=toRad(b.latitude); const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function pointInPolygon(p, poly){const x=p.latitude,y=p.longitude;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i].latitude,yi=poly[i].longitude,xj=poly[j].latitude,yj=poly[j].longitude;if(((yi>y)!==(yj>y))&&(x < (xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function nearestSafeZone(c){if(!c)return null;let best=null,dist=Infinity;for(const z of SAFE_ZONES){const d=haversine(c,z.coordinates);if(d<dist){dist=d;best=z;}}return best;}
function riskColor(l){return l==='high'?'#FF5722':l==='moderate'?'#FFD700':'#4CAF50';}
function estimateDistrict(lat){if(lat>34.4)return'Bandipora';if(lat>34.0)return'Srinagar';if(lat>33.0)return'Rajouri';return'Jammu';}

const TravelTrackingScreen = () => {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const userName = profile?.fullName || 'Traveler';

  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [liveEnabled, setLiveEnabled] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionEndsAt, setSessionEndsAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState(userName);
  const [duration, setDuration] = useState(60);
  const durationOptions = [15,30,60,120];

  const [contacts, setContacts] = useState([]);
  const contactsLoadedRef = useRef(false);

  const [zoneRiskLevel, setZoneRiskLevel] = useState('low');
  const [violatedZone, setViolatedZone] = useState(null);
  const [weatherRisk, setWeatherRisk] = useState('low');
  const [calamityRisk, setCalamityRisk] = useState('low');

  const lastMlFetchRef = useRef(0);
  const firstLocationSetRef = useRef(false); // NEW: we only attach lastLocation after first coordinate for a session

  const [bgState, setBgState] = useState({ running:false, last:'—' });

  const watchRef = useRef(null);
  const countdownRef = useRef(null);
  const mapRef = useRef(null);

  /* Load contacts */
  useEffect(()=>{
    if(!uid || contactsLoadedRef.current) return;
    db.collection('tourists').doc(uid).collection('emergencyContacts').get()
      .then(snap=>{
        const arr=[];
        snap.forEach(d=>arr.push({id:d.id,phone:d.data().phone,createdAt:d.data().createdAt}));
        setContacts(arr.slice(0,5));
        contactsLoadedRef.current=true;
      }).catch(e=>console.log('[contacts load]',e?.message));
  },[uid]);

  const addContact=()=>{
    if(contacts.length>=5) return;
    setContacts(p=>[...p,{id:`tmp_${Date.now()}`,phone:''}]);
  };
  const updateContact=(id,val)=>{
    setContacts(p=>p.map(c=>c.id===id?{...c,phone:val}:c));
  };
  const removeContact=id=>{
    setContacts(p=>p.filter(c=>c.id!==id));
  };

  // Persist contacts with createdAt compliance
  const persistContacts = async (list)=>{
    if(!uid) throw new Error('auth-required');
    const norm=list
      .map(c=>({phone:(c.phone||'').replace(/[^\d+]/g,'' )}))
      .filter(c=>c.phone && c.phone.replace(/\D/g,'').length>=7)
      .slice(0,5);
    if(!norm.length) return [];
    const coll=db.collection('tourists').doc(uid).collection('emergencyContacts');
    const existingSnap=await coll.get();
    const byPhone={};
    existingSnap.forEach(doc=>{
      const d=doc.data()||{};
      const ph=(d.phone||'').replace(/[^\d+]/g,'');
      if(ph) byPhone[ph]={id:doc.id,createdAt:d.createdAt};
    });
    const batch=db.batch();
    norm.forEach(c=>{
      const ex=byPhone[c.phone];
      const docId=ex?ex.id:coll.doc().id;
      const ref=coll.doc(docId);
      // Always include createdAt (for both create & update) with unchanged value when updating
      batch.set(ref,{
        phone:c.phone,
        createdAt: ex?.createdAt || firebase.firestore.Timestamp.now()
      },{merge:false});
    });
    try{
      await batch.commit();
    }catch(e){
      console.warn('[persistContacts] fail', e);
      throw new Error(e.code||'contacts-write-failed');
    }
    return norm;
  };

  const confirmAndRequestForeground=()=>new Promise(res=>{
    Alert.alert('Allow Location','Grant location access for tracking?',[
      {text:'Cancel',style:'cancel',onPress:()=>res(false)},
      {text:'Allow', onPress:async()=>{
        try{
          const r=await Location.requestForegroundPermissionsAsync();
          if(r.status!=='granted'){ Alert.alert('Denied','Location permission required.'); res(false); return;}
          res(true);
        }catch(e){ Alert.alert('Error','Permission request failed.'); res(false);}
      }}
    ]);
  });

  const startForegroundWatch=async()=>{
    stopForegroundWatch();
    watchRef.current=await Location.watchPositionAsync(
      {accuracy:Location.Accuracy.High,timeInterval:2000,distanceInterval:10},
      handleLocationUpdate
    );
    setIsTracking(true);
  };
  const stopForegroundWatch=()=>{
    if(watchRef.current){try{watchRef.current.remove();}catch{} watchRef.current=null;}
    setIsTracking(false);
  };

  const createSession=async(persistedContacts)=>{
    firstLocationSetRef.current=false;
    const {sessionId:sid, endsAt}=await createLiveSession({
      uid,
      durationMinutes:duration,
      contacts:persistedContacts,
      shareUrl:`https://safety.example/track/${uid}_${Date.now()}`
    });
    setSessionId(sid);
    setSessionEndsAt(endsAt);
    setIsLiveTracking(true);
    setRemainingSeconds(Math.max(0,Math.floor((endsAt.getTime()-Date.now())/1000)));
    if(countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current=setInterval(()=>{
      setRemainingSeconds(prev=>{
        const left=Math.max(0,Math.floor((endsAt.getTime()-Date.now())/1000));
        if(left<=0){ clearInterval(countdownRef.current); stopAllTracking(true); }
        return left;
      });
    },1000);
  };
  const closeSession=async()=>{
    if(sessionId) await endLiveSession(sessionId).catch(()=>{});
    setSessionId(null); setIsLiveTracking(false); setSessionEndsAt(null);
    if(countdownRef.current){clearInterval(countdownRef.current); countdownRef.current=null;}
  };

  const fetchMl=async(coords)=>{
    const now=Date.now();
    if(now-lastMlFetchRef.current<60000) return;
    lastMlFetchRef.current=now;
    try{
      const [w,c]=await Promise.allSettled([
        axios.post(`${API_URL}/predict_weather`,{lat:coords.latitude,lng:coords.longitude},{timeout:8000}),
        axios.post(`${API_URL}/predict_calamity`,{lat:coords.latitude,lng:coords.longitude,district:estimateDistrict(coords.latitude)},{timeout:8000})
      ]);
      if(w.status==='fulfilled'){ const rl=(w.value.data?.risk_level||'low').toLowerCase(); setWeatherRisk(rl); if(rl!=='low') Alert.alert('Weather Alert', rl.toUpperCase());}
      if(c.status==='fulfilled'){ const rl=(c.value.data?.risk_level||'low').toLowerCase(); setCalamityRisk(rl); if(rl!=='low') Alert.alert('Calamity Alert', rl.toUpperCase());}
    }catch(e){ console.log('[ML] error', e?.message); }
  };

  const throttledFirestoreUpdate=useMemo(()=>throttle(async(coords)=>{
    if(!sessionId) return;
    try{
      await updateLiveSession(sessionId,{
        lastLocation:{lat:coords.latitude,lng:coords.longitude,updatedAt:Date.now()},
        risk:{zone:zoneRiskLevel,weather:weatherRisk,calamity:calamityRisk}
      });
    }catch(e){ console.log('[session update fail]', e?.message); }
  },5000),[sessionId,zoneRiskLevel,weatherRisk,calamityRisk]);

  const detectZone=(coords)=>{
    for(const z of RESTRICTED_ZONES){ if(pointInPolygon(coords,z.coordinates)) return {zone:z,inside:true,near:false}; }
    const PROX=10000;
    for(const z of RESTRICTED_ZONES){
      const center=z.coordinates.reduce((a,c)=>({latitude:a.latitude+c.latitude,longitude:a.longitude+c.longitude}),{latitude:0,longitude:0});
      center.latitude/=z.coordinates.length; center.longitude/=z.coordinates.length;
      if(haversine(coords,center)<=PROX) return {zone:z,inside:false,near:true};
    }
    return {zone:null,inside:false,near:false};
  };

  const handleLocationUpdate=(loc)=>{
    if(!loc?.coords) return;
    setLocation(loc);
    const coords={latitude:loc.coords.latitude,longitude:loc.coords.longitude};

    const rz=detectZone(coords);
    if(rz.inside){
      if(!violatedZone||violatedZone.id!==rz.zone.id) Alert.alert('⚠️ HIGH ALERT',`Inside restricted zone: ${rz.zone.name}`);
      setZoneRiskLevel('high'); setViolatedZone(rz.zone);
    } else if(rz.near){
      if(!violatedZone||violatedZone.id!==rz.zone.id) Alert.alert('⚠️ WARNING',`Approaching restricted zone: ${rz.zone.name}`);
      setZoneRiskLevel('moderate'); setViolatedZone(rz.zone);
    } else { setZoneRiskLevel('low'); setViolatedZone(null); }

    fetchMl(coords);

    if(uid){
      writeLiveLocation(uid,{
        lat:coords.latitude,
        lng:coords.longitude,
        speed:loc.coords.speed ?? null,
        heading:loc.coords.heading ?? null,
        accuracy:loc.coords.accuracy ?? null,
        sessionId:sessionId||null,
        tracking:true,
        risk:{zone:zoneRiskLevel,weather:weatherRisk,calamity:calamityRisk}
      }).catch(()=>{});
    }

    // First location -> attach lastLocation & risk to session doc (was omitted on create)
    if(sessionId && !firstLocationSetRef.current){
      firstLocationSetRef.current=true;
      updateLiveSession(sessionId,{
        lastLocation:{lat:coords.latitude,lng:coords.longitude,updatedAt:Date.now()},
        risk:{zone:zoneRiskLevel,weather:weatherRisk,calamity:calamityRisk}
      }).catch(e=>console.log('[first location session update]',e?.code||e?.message));
    } else {
      throttledFirestoreUpdate(coords);
    }
  };

  const openStartModal=()=>{ setFormName(userName); setModalVisible(true); };

  const startTrackingFlow=async()=>{
    let persistedContacts=[];
    if(liveEnabled){
      const valids=contacts.filter(c=>c.phone.replace(/\D/g,'').length>=7);
      if(!valids.length){ Alert.alert('Missing Contacts','Add at least one valid contact.'); return; }
      try{
        persistedContacts=await persistContacts(valids);
      }catch(e){
        Alert.alert('Error',`Failed to save contacts (${e.message})`);
        return;
      }
    }
    const allowed=await confirmAndRequestForeground();
    if(!allowed) return;
    if(!isTracking) await startForegroundWatch();
    if(liveEnabled){
      try{
        await createSession(persistedContacts);
      }catch(e){
        Alert.alert('Session Error', e.message || 'Could not start session');
        return;
      }
    }
    setModalVisible(false);
  };

  const stopAllTracking=async(autoExpire=false)=>{
    stopForegroundWatch();
    if(isLiveTracking) await closeSession();
    if(autoExpire) Alert.alert('Session Ended','Live tracking duration finished.');
  };

  const centerMap=()=>{
    if(!location||!mapRef.current) return;
    const {latitude,longitude}=location.coords;
    mapRef.current.animateCamera({center:{latitude,longitude},zoom:16},{duration:700});
  };

  const shareLocation=async()=>{
    if(!location){ Alert.alert('No Location','Try again in a moment.'); return; }
    const {latitude,longitude}=location.coords;
    const nearest=nearestSafeZone({latitude,longitude});
    const msg=`📍 Location (${userName})
Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}
Nearest Safe: ${nearest?.name||'—'}
Zone Risk: ${zoneRiskLevel.toUpperCase()}
Weather: ${weatherRisk.toUpperCase()} | Calamity: ${calamityRisk.toUpperCase()}
${isLiveTracking?`Live Session Active (${sessionId})`:'Not in live session'}
Google Maps: https://maps.google.com/?q=${latitude},${longitude}`;
    try{ await Share.share({message:msg,title:'My Location'});}catch{}
  };

  const startBg=async()=>{
    try{
      const fg=await Location.requestForegroundPermissionsAsync();
      if(fg.status!=='granted'){Alert.alert('Need foreground permission first');return;}
      const bg=await Location.requestBackgroundPermissionsAsync();
      if(bg.status!=='granted'){Alert.alert('Background permission denied');return;}
      const running=await Location.hasStartedLocationUpdatesAsync(BG_TASK_NAME);
      if(!running){
        await Location.startLocationUpdatesAsync(BG_TASK_NAME,{
          accuracy:Location.Accuracy.Balanced,
          timeInterval:15000,
          distanceInterval:30,
          pausesUpdatesAutomatically:true,
          foregroundService:{notificationTitle:'Smart Tourist Safety',notificationBody:'Background location active',notificationColor:'#4CAF50'}
        });
      }
      setBgState({running:true,last:global.__BG_LAST_UPDATE__||'—'});
    }catch(e){Alert.alert('BG Error', e.message||'Failed to start background tracking');}
  };
  const stopBg=async()=>{
    try{
      const running=await Location.hasStartedLocationUpdatesAsync(BG_TASK_NAME);
      if(running) await Location.stopLocationUpdatesAsync(BG_TASK_NAME);
      setBgState({running:false,last:global.__BG_LAST_UPDATE__||'—'});
    }catch{}
  };
  const refreshBg=async()=>{
    const running=await Location.hasStartedLocationUpdatesAsync(BG_TASK_NAME);
    setBgState({running,last:global.__BG_LAST_UPDATE__||'—'});
  };

  useEffect(()=>()=>{ stopForegroundWatch(); if(countdownRef.current) clearInterval(countdownRef.current); },[]);

  const coordLabel=location?`${location.coords.latitude.toFixed(6)},  ${location.coords.longitude.toFixed(6)}`:(errorMsg||'Waiting...');
  const nearest=location?nearestSafeZone({latitude:location.coords.latitude,longitude:location.coords.longitude}):null;
  const timeLeftLabel=isLiveTracking&&remainingSeconds>0?(()=>{const m=Math.floor(remainingSeconds/60);const s=remainingSeconds%60;return `${m}m ${s.toString().padStart(2,'0')}s`;})():null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground source={require('../assets/login-background.png')} style={styles.bg}>
        <LinearGradient colors={['rgba(0,0,0,0.3)','rgba(0,0,0,0.5)']} style={styles.overlay}>

          <ScrollView contentContainerStyle={{paddingBottom:60}} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Live Location Tracker</Text>
              <Text style={styles.headerSubtitle}>Kashmir Travel Safety</Text>
            </View>

            <View style={styles.mapCard}>
              {location?(
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude:location.coords.latitude,
                    longitude:location.coords.longitude,
                    latitudeDelta:0.05,
                    longitudeDelta:0.05
                  }}
                >
                  <Marker coordinate={{latitude:location.coords.latitude,longitude:location.coords.longitude}}>
                    <View style={styles.userMarker}><Ionicons name="person" size={20} color="#fff" /></View>
                  </Marker>
                  {SAFE_ZONES.map(z=>(
                    <Marker key={z.id} coordinate={z.coordinates} title={z.name} pinColor="#4CAF50" />
                  ))}
                  {RESTRICTED_ZONES.map(z=>(
                    <Polygon key={z.id} coordinates={z.coordinates} fillColor="rgba(255,0,0,0.25)" strokeColor="rgba(255,0,0,0.9)" strokeWidth={2} />
                  ))}
                </MapView>
              ):(
                <View style={styles.loadingMap}><Text style={styles.loadingText}>Loading Map...</Text></View>
              )}
            </View>

            <View style={styles.statusCard}>
              <View style={styles.statusHeaderRow}>
                <Text style={styles.statusCardTitle}>Tracking Status</Text>
                <View style={[styles.dot,{backgroundColor:isTracking?'#4CAF50':'#FF5722'}]} />
              </View>
              <Text style={styles.coordLine}>
                <Ionicons name="pin" size={14} color="#FF6B6B" />{'  '}
                <Text style={styles.coordText}>{coordLabel}</Text>
              </Text>
              <Text style={styles.sessionText}>
                {isLiveTracking?`Live Session Active ${timeLeftLabel?`• ${timeLeftLabel}`:''}`:'Live Session: INACTIVE'}
              </Text>

              {nearest&&(
                <View style={styles.nearestSafePill}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#4CAF50" />
                  <Text style={styles.nearestSafeText}>Nearest Safe Zone: {nearest.name}</Text>
                </View>
              )}

              <View style={styles.riskRow}>
                <Text style={styles.riskItem}>Weather: <Text style={{color:riskColor(weatherRisk)}}>{weatherRisk.toUpperCase()}</Text></Text>
                <Text style={styles.riskItem}>Calamity: <Text style={{color:riskColor(calamityRisk)}}>{calamityRisk.toUpperCase()}</Text></Text>
                <Text style={styles.riskItem}>Zone: <Text style={{color:riskColor(zoneRiskLevel)}}>{zoneRiskLevel.toUpperCase()}</Text></Text>
              </View>

              {zoneRiskLevel!=='low'&&violatedZone&&(
                <View style={[styles.zoneAlert,zoneRiskLevel==='high'?styles.highAlertBg:styles.moderateAlertBg]}>
                  <Ionicons name="warning" size={18} color={zoneRiskLevel==='high'?'#FF5722':'#FFD700'} />
                  <Text style={styles.zoneAlertText}>{zoneRiskLevel.toUpperCase()} RISK: {violatedZone.name}</Text>
                </View>
              )}
            </View>

            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.primaryBtn,{backgroundColor:isTracking?'#FF5722':'#4CAF50'}]}
                onPress={isTracking?()=>stopAllTracking(false):openStartModal}
              >
                <Ionicons name={isTracking?'stop':'play'} size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>{isTracking?'Stop Tracking':'Start Tracking'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn,{backgroundColor:'#2196F3'}]} onPress={centerMap}>
                <Ionicons name="locate" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>Center Map</Text>
              </TouchableOpacity>
            </View>

            <View style={{marginTop:14}}>
              <TouchableOpacity style={[styles.fullWidthBtn,{backgroundColor:location?'#6A1B9A':'#666'}]} onPress={shareLocation} disabled={!location}>
                <Ionicons name="share-social-outline" size={20} color="#fff" />
                <Text style={styles.fullWidthBtnText}>Share Current Location</Text>
              </TouchableOpacity>
            </View>

            {DEV_TOOLS&&(
              <View style={styles.devRow}>
                <TouchableOpacity style={styles.devBtn} onPress={startBg}><Text style={styles.devBtnText}>START BG</Text></TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={stopBg}><Text style={styles.devBtnText}>STOP BG</Text></TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={refreshBg}><Text style={styles.devBtnText}>REFRESH</Text></TouchableOpacity>
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <Ionicons name="shield" size={18} color="#FF5252" />
                <Text style={styles.infoTitle}>  Safety Information</Text>
              </View>
              <Text style={styles.infoText}>
                {RESTRICTED_ZONES.length} restricted zones monitored. Emergency contact alerts (SMS) future integration.
              </Text>
              {bgState.running && <Text style={styles.infoSub}>Background tracking ON (last: {bgState.last})</Text>}
              {isLiveTracking && <Text style={styles.infoSub}>Session ID: {sessionId}</Text>}
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={()=>setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOuter} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.redDot}/>
              <Text style={styles.modalTitle}>Start Tracking</Text>
              <Pressable onPress={()=>setModalVisible(false)}><Ionicons name="close" size={22} color="#444" /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:height*0.65}}>
              <Text style={styles.modalSubtitle}>
                Enable Live Sharing for a timed session (with contacts) or keep it off for on‑device tracking only.
              </Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Live Sharing (Session)</Text>
                <Switch value={liveEnabled} onValueChange={setLiveEnabled} trackColor={{false:'#9e9e9e',true:'#C2185B'}} thumbColor="#fff" />
              </View>
              <Text style={styles.inputLabel}>Your Name</Text>
              <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Name" placeholderTextColor="#aaa" />
              {liveEnabled && (
                <>
                  <Text style={[styles.inputLabel,{marginTop:14}]}>Duration (minutes)</Text>
                  <View style={styles.durationRow}>
                    {durationOptions.map(opt=>{
                      const active=opt===duration;
                      return(
                        <TouchableOpacity key={opt} style={[styles.durationChip,active&&styles.durationChipActive]} onPress={()=>setDuration(opt)}>
                          <Text style={[styles.durationChipText,active&&styles.durationChipTextActive]}>{opt}m</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.inputLabel,{marginTop:14}]}>Emergency Contacts</Text>
                  {contacts.map(c=>(
                    <View key={c.id} style={styles.contactRow}>
                      <TextInput
                        style={styles.contactInput}
                        value={c.phone}
                        onChangeText={v=>updateContact(c.id,v)}
                        placeholder="Phone number"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                      />
                      <TouchableOpacity onPress={()=>removeContact(c.id)} style={styles.deleteContactBtn}>
                        <Ionicons name="trash" size={18} color="#C62828" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {contacts.length<5 && (
                    <TouchableOpacity style={styles.addContactRow} onPress={addContact}>
                      <Ionicons name="add-circle-outline" size={20} color="#29b18d" />
                      <Text style={styles.addContactText}>Add Contact</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.noticeBox}>
                    <Ionicons name="warning" size={18} color="#E65100" />
                    <Text style={styles.noticeText}>
                      Live sharing ends automatically after the selected duration or when stopped manually. Contacts are saved securely.
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.modalActionRow}>
                <TouchableOpacity style={[styles.modalActionBtn,styles.cancelBtn]} onPress={()=>setModalVisible(false)}>
                  <Text style={styles.modalActionTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalActionBtn,styles.startBtn]} onPress={startTrackingFlow}>
                  <Text style={styles.modalActionText}>Start</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

/* Styles (identical to previous except unchanged) */
const styles = StyleSheet.create({
  container:{flex:1},
  bg:{flex:1,width:'100%',height:'100%'},
  overlay:{flex:1,padding:18},
  header:{alignItems:'center',marginTop:Platform.OS==='ios'?46:24,marginBottom:18},
  headerTitle:{fontSize:28,fontWeight:'bold',color:'white',textShadowColor:'rgba(0,0,0,0.7)',textShadowOffset:{width:1,height:1},textShadowRadius:3},
  headerSubtitle:{fontSize:16,color:'white',opacity:0.85,textShadowColor:'rgba(0,0,0,0.7)',textShadowOffset:{width:1,height:1},textShadowRadius:3},
  mapCard:{height:height*0.33,borderRadius:26,overflow:'hidden',backgroundColor:'#1e293b',borderWidth:1,borderColor:'rgba(255,255,255,0.15)',marginBottom:18},
  map:{flex:1},
  loadingMap:{flex:1,justifyContent:'center',alignItems:'center'},
  loadingText:{color:'white',opacity:0.8},
  userMarker:{backgroundColor:'#4CAF50',width:44,height:44,borderRadius:24,justifyContent:'center',alignItems:'center',borderWidth:3,borderColor:'#fff'},
  statusCard:{backgroundColor:'rgba(255,255,255,0.15)',padding:18,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,0.2)',marginBottom:16},
  statusHeaderRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  statusCardTitle:{fontSize:18,fontWeight:'bold',color:'white'},
  dot:{width:14,height:14,borderRadius:7},
  coordLine:{color:'white',marginTop:4,fontSize:14},
  coordText:{color:'white',fontFamily:Platform.OS==='ios'?'Courier':'monospace'},
  sessionText:{marginTop:6,color:'white',fontSize:13,opacity:0.85},
  nearestSafePill:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(76,175,80,0.18)',paddingVertical:10,paddingHorizontal:12,borderRadius:10,marginTop:12,borderLeftWidth:4,borderLeftColor:'#4CAF50'},
  nearestSafeText:{color:'white',marginLeft:8,fontSize:14,fontWeight:'600'},
  riskRow:{flexDirection:'row',justifyContent:'space-between',marginTop:12},
  riskItem:{color:'white',fontSize:13,fontWeight:'500'},
  zoneAlert:{flexDirection:'row',alignItems:'center',paddingVertical:8,paddingHorizontal:10,borderRadius:10,marginTop:12},
  zoneAlertText:{marginLeft:8,color:'#fff',fontWeight:'700',fontSize:13},
  highAlertBg:{backgroundColor:'rgba(255,87,34,0.25)',borderLeftWidth:4,borderLeftColor:'#FF5722'},
  moderateAlertBg:{backgroundColor:'rgba(255,215,0,0.25)',borderLeftWidth:4,borderLeftColor:'#FFD700'},
  controlsRow:{flexDirection:'row',justifyContent:'space-between',marginTop:4},
  primaryBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',flex:0.48,paddingVertical:14,borderRadius:14,elevation:3,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.3,shadowRadius:4},
  primaryBtnText:{color:'#fff',fontSize:15,fontWeight:'600',marginLeft:8},
  fullWidthBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:14,borderRadius:14,elevation:3},
  fullWidthBtnText:{color:'#fff',fontSize:15,fontWeight:'600',marginLeft:8},
  infoCard:{backgroundColor:'rgba(255,255,255,0.15)',padding:16,borderRadius:14,marginTop:22,borderWidth:1,borderColor:'rgba(255,255,255,0.2)'},
  infoTitle:{fontSize:16,fontWeight:'700',color:'white'},
  infoText:{marginTop:10,color:'white',fontSize:13,lineHeight:18,opacity:0.85},
  infoSub:{marginTop:6,color:'#cfd8dc',fontSize:12,fontStyle:'italic'},
  modalOuter:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',paddingHorizontal:18,justifyContent:'center'},
  modalCard:{backgroundColor:'#fff',borderRadius:26,paddingHorizontal:20,paddingTop:18,paddingBottom:20},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  modalTitle:{fontSize:18,fontWeight:'700',color:'#222',flex:1,marginLeft:6},
  redDot:{width:14,height:14,borderRadius:7,backgroundColor:'#FF1744'},
  modalSubtitle:{fontSize:13,color:'#555',marginTop:12,lineHeight:18},
  toggleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:16,marginBottom:4},
  toggleLabel:{fontSize:14,fontWeight:'600',color:'#222'},
  inputLabel:{fontSize:13,fontWeight:'700',color:'#222',marginTop:8},
  input:{backgroundColor:'#f5f6f8',borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:'#222',marginTop:6},
  durationRow:{flexDirection:'row',marginTop:6,flexWrap:'wrap'},
  durationChip:{paddingVertical:8,paddingHorizontal:14,backgroundColor:'#e2e8f0',borderRadius:12,marginRight:10,marginTop:8},
  durationChipActive:{backgroundColor:'#C2185B'},
  durationChipText:{fontSize:13,fontWeight:'600',color:'#333'},
  durationChipTextActive:{color:'#fff'},
  contactRow:{flexDirection:'row',alignItems:'center',marginTop:10},
  contactInput:{flex:1,backgroundColor:'#f5f6f8',paddingHorizontal:14,paddingVertical:12,borderRadius:10,fontSize:14,color:'#222'},
  deleteContactBtn:{marginLeft:10,padding:6},
  addContactRow:{flexDirection:'row',alignItems:'center',marginTop:14},
  addContactText:{color:'#29b18d',marginLeft:6,fontWeight:'600',fontSize:13},
  noticeBox:{backgroundColor:'#FFF5E0',borderRadius:12,padding:12,marginTop:20,flexDirection:'row',gap:10},
  noticeText:{flex:1,fontSize:12,color:'#7a4d00',lineHeight:16},
  modalActionRow:{flexDirection:'row',justifyContent:'flex-end',marginTop:24,gap:12},
  modalActionBtn:{paddingVertical:13,paddingHorizontal:22,borderRadius:14,elevation:2},
  cancelBtn:{backgroundColor:'#ECEFF1'},
  startBtn:{backgroundColor:'#4CAF50'},
  modalActionText:{color:'#fff',fontWeight:'700',fontSize:14},
  modalActionTextCancel:{color:'#333',fontWeight:'700',fontSize:14},
  devRow:{flexDirection:'row',justifyContent:'space-between',marginTop:18},
  devBtn:{flex:1,marginHorizontal:4,backgroundColor:'#1565C0',paddingVertical:10,borderRadius:8,alignItems:'center'},
  devBtnText:{color:'#fff',fontSize:12,fontWeight:'600'}
});

export default TravelTrackingScreen;