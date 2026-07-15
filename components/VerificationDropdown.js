// Dark-theme multi-select dropdown (Passport, Aadhaar) with a modal.
// Enforces at least one selection before closing when requireOne = true.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { key: 'passport', label: 'Passport number' },
  { key: 'aadhaar', label: 'Aadhaar card number' },
];

export default function VerificationDropdown({
  value = [],
  onChange,
  requireOne = true,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const canClose = !requireOne || (value && value.length > 0);

  const label = value.length === 0
    ? 'Select verification method(s)'
    : OPTIONS.filter(o => selected.has(o.key)).map(o => o.label).join(', ');

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, disabled && { opacity: 0.6 }]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <Ionicons name="chevron-down" size={18} color="#fff" />
        <Text style={styles.buttonText} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => { if (canClose) setOpen(false); }} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose verification methods</Text>
          {OPTIONS.map(opt => {
            const checked = selected.has(opt.key);
            return (
              <TouchableOpacity key={opt.key} style={styles.option} onPress={() => toggle(opt.key)}>
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? '#4ECDC4' : 'rgba(255,255,255,0.8)'}
                />
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneBtn, !canClose && { opacity: 0.5 }]}
              onPress={() => { if (canClose) setOpen(false); }}
              disabled={!canClose}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  buttonText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '25%',
    backgroundColor: 'rgba(12,18,24,0.98)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: '#fff' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  optionText: { fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  footer: { alignItems: 'flex-end', marginTop: 12 },
  doneBtn: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneText: { color: '#0b1a21', fontWeight: '900' },
});