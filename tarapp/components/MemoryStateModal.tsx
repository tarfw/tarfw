import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

export const MEMORY_STATE_TYPES = [
  { type: 'sites', label: 'Sites', icon: 'globe-outline', color: '#007AFF' },
  { type: 'inventory', label: 'Inventory', icon: 'cube-outline', color: '#34C759' },
  { type: 'products', label: 'Products', icon: 'pricetag-outline', color: '#FF9500' }
];

export function MemoryStateModal({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  const handleSelect = (item: { type: string }) => {
    console.log('[memorystate] handleSelect called with:', item.type);
    onSelect(item.type);
    onClose();
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.title}>Memory State</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={MEMORY_STATE_TYPES}
          keyExtractor={(item) => item.type}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 40) }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.5}
              onPress={() => handleSelect(item)}
            >
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.label}>{item.label}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1C1E',
    marginLeft: 14,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0F0F0',
  },
});
