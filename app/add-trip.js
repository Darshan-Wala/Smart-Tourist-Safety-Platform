/* Your provided file, unchanged */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import polyline from 'polyline';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text as RNText, View as RNView, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Text } from '../components/Themed';

const GOOGLE_KEY = 'AIzaSyDW3PK263uMcGH2Lhr9SU2Gmekf9sYaDkY';

/* ... full content exactly as you shared ... */