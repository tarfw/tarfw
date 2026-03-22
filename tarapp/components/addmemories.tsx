import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { STATE_TYPES, StateTypeDef } from '../src/config/stateSchemas';
import { getAllStates } from '../src/db/turso';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: StateTypeDef) => void;
  onSelectStateForInstance: (state: { ucode: string; title: string }) => void;
}

// Add Inventory as a special type option
export const MEMORY_TYPES: (StateTypeDef | { type: 'inventory'; label: string; icon: string; color: string })[] = [
  { type: 'inventory', label: 'Inventory Item', icon: 'cube-outline', color: '#34C759' },
  ...STATE_TYPES,
];

export function AddMemories({ visible, onClose, onSelect, onSelectStateForInstance }: Props) {
  const insets = useSafeAreaInsets();
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state picker when modal closes
  useEffect(() => {
    if (!visible) {
      setShowStatePicker(false);
    }
  }, [visible]);

  const handleSelect = (item: StateTypeDef | { type: string }) => {
    if (item.type === 'inventory') {
      // Show state picker for inventory
      setShowStatePicker(true);
      loadStates();
    } else {
      onSelect(item as StateTypeDef);
    }
  };

  const loadStates = async () => {
    setLoading(true);
    try {
      const allStates = await getAllStates('shop:main');
      setStates(allStates);
    } catch (e) {
      setStates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelect = (state: any) => {
    setShowStatePicker(false);
    onSelectStateForInstance({ ucode: state.ucode, title: state.title });
  };

  if (showStatePicker) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.safe}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => setShowStatePicker(false)} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#999" />
            </TouchableOpacity>
            <Text style={styles.title}>Select State</Text>
            <View style={{ width: 22 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          ) : (
            <FlatList
              data={states}
              keyExtractor={(item) => item.ucode}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.5}
                  onPress={() => handleStateSelect(item)}
                >
                  <Ionicons name="cube-outline" size={22} color="#007AFF" />
                  <View style={styles.stateInfo}>
                    <Text style={styles.stateTitle}>{item.title || item.ucode}</Text>
                    <Text style={styles.stateUcode}>{item.ucode}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No states yet</Text>
                  <Text style={styles.emptySubText}>Create a state first (Product, Service, etc.)</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.title}>New Memory</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={MEMORY_TYPES}
          keyExtractor={(item) => item.type}
          contentContainerStyle={styles.list}
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
  // State picker styles
  stateInfo: {
    flex: 1,
    marginLeft: 14,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  stateUcode: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
  emptySubText: {
    fontSize: 14,
    color: '#AEAEB2',
    marginTop: 4,
    textAlign: 'center',
  },
});
