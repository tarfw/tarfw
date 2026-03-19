import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATE_TYPES, StateTypeDef } from '../src/config/stateSchemas';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: StateTypeDef) => void;
}

export function StateTypePickerModal({ visible, onClose, onSelect }: Props) {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>New State</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={STATE_TYPES}
          keyExtractor={(item) => item.type}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.5}
              onPress={() => onSelect(item)}
            >
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.label}>{item.label}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </SafeAreaView>
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
    paddingTop: 16,
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
