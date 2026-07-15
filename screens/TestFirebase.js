import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function TestFirebase() {
  const [status, setStatus] = useState('mounting...');

  useEffect(() => {
    setStatus('auth object: ' + (auth ? 'OK' : 'MISSING'));
    try {
      const unsub = onAuthStateChanged(auth, (u) => {
        setStatus('listener fired: ' + (u ? u.uid : 'no user'));
      });
      return () => unsub();
    } catch (e) {
      setStatus('onAuthStateChanged error: ' + e.message);
    }
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{status}</Text>
    </View>
  );
}