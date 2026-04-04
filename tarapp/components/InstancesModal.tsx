import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllInstances, getAllStates, Instance } from '@/src/db/turso';

interface InstancesModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  activeScope: string;
}

export function InstancesModal({ visible, onClose, title, activeScope }: InstancesModalProps) {
  const insets = useSafeAreaInsets();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadInstances();
    }
  }, [visible, activeScope]);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const instData = await getAllInstances(activeScope);
      setInstances(instData);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Instance }) => {
    const displayTitle = item.stateid ? item.stateid.split(':').pop() : 'Unknown Item';

    return (
      <View style={styles.itemRow}>
        <View style={styles.thumbnailContainer}>
          <View style={styles.placeholderIcon}>
             {displayTitle ? (
               <Text style={styles.initials}>{displayTitle.substring(0, 2).toUpperCase()}</Text>
             ) : (
               <Ionicons name="cube-outline" size={24} color="#8E8E93" />
             )}
          </View>
        </View>

        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{displayTitle}</Text>
          <Text style={styles.itemSub} numberOfLines={1}>{item.stateid}</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.itemPrice}>
            {item.currency || '₹'} {item.value || '0.00'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : (
          <FlatList
            data={instances}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  list: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  itemRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#F2F2F7',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 13,
    color: '#8E8E93',
  },
  priceContainer: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000',
  },
});
