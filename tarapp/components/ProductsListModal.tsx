import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgentState } from '@/hooks/useAgentState';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ProductState {
  ucode: string;
  title?: string;
  type?: string;
  payload?: any;
}

export function ProductsListModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { fetchStatesFromRemote } = useAgentState();
  const [products, setProducts] = useState<ProductState[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadProducts();
    }
  }, [visible]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const states = await fetchStatesFromRemote('product');
      setProducts(states);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPayload = (item: ProductState) => {
    try {
      if (!item.payload) return {};
      return typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
    } catch {
      return {};
    }
  };

  const renderItem = ({ item }: { item: ProductState }) => {
    const payload = getPayload(item);
    const displayTitle = item.title || item.ucode.split(':').pop() || 'Untitled';

    return (
      <View style={styles.itemRow}>
        <View style={styles.thumbnailContainer}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.initials}>
              {displayTitle.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{displayTitle}</Text>
          <Text style={styles.itemSub} numberOfLines={1}>
            {payload.brand ? `${payload.brand} · ` : ''}{item.ucode}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          {payload.price ? (
            <Text style={styles.itemPrice}>
              {payload.currency || '₹'} {payload.price}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Products</Text>
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
            data={products}
            keyExtractor={item => item.ucode}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="pricetag-outline" size={28} color="#AEAEB2" />
                </View>
                <Text style={styles.emptyText}>No products yet</Text>
                <Text style={styles.emptySubText}>
                  Use "Add Product" to create your first product
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { paddingBottom: 40, flexGrow: 1 },
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
  placeholderIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  itemContent: { flex: 1, justifyContent: 'center' },
  itemTitle: { fontSize: 17, fontWeight: '700', color: '#000', marginBottom: 2 },
  itemSub: { fontSize: 13, color: '#8E8E93' },
  priceContainer: { marginLeft: 12, alignItems: 'flex-end' },
  itemPrice: { fontSize: 16, fontWeight: '600', color: '#000' },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#8E8E93' },
  emptySubText: {
    fontSize: 14,
    color: '#AEAEB2',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
