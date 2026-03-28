import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllInstances, updateInstance, Instance } from '../src/db/turso';
import { pushCloudEventApi } from '../src/api/client';
import { triggerLiveEventsRefresh } from '../hooks/useLiveEvents';

// Simple UUID generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface LineItem {
  instance: Instance;
  qty: number;
}

interface Props {
  onClose: () => void;
  onCancel: () => void;
}

export function OrderScreen({ onClose, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [placing, setPlacing] = useState(false);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const all = await getAllInstances('shop:main');
      setInstances(all);
    } catch (e) {
      setInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const addItem = (inst: Instance) => {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.instance.id === inst.id);
      if (existing) {
        return prev.map((li) =>
          li.instance.id === inst.id ? { ...li, qty: li.qty + 1 } : li
        );
      }
      return [...prev, { instance: inst, qty: 1 }];
    });
    setShowPicker(false);
  };

  const updateQty = (instanceId: string, delta: number) => {
    setLineItems((prev) =>
      prev
        .map((li) =>
          li.instance.id === instanceId
            ? { ...li, qty: Math.max(0, li.qty + delta) }
            : li
        )
        .filter((li) => li.qty > 0)
    );
  };

  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.qty * (li.instance.value || 0),
    0
  );
  const tax = subtotal * 0.18; // 18% GST
  const total = subtotal + tax;

  const placeOrder = async () => {
    if (lineItems.length === 0) return;
    setPlacing(true);

    try {
      const streamid = `order-${generateUUID()}`;
      const now = new Date().toISOString();

      // 1. Push ORDERCREATE (501) to DO
      await pushCloudEventApi({
        opcode: 501,
        streamid,
        delta: lineItems.length,
        payload: {
          items: lineItems.map((li) => ({
            stateid: li.instance.stateid,
            instanceId: li.instance.id,
            qty: li.qty,
            unitPrice: li.instance.value || 0,
            lineTotal: li.qty * (li.instance.value || 0),
          })),
          subtotal,
          tax,
          total,
        },
        scope: 'shop:main',
      });

      // 2. For each line item: push STOCKADJUST (104) with same streamid
      for (const li of lineItems) {
        await pushCloudEventApi({
          opcode: 104,
          streamid,
          delta: -li.qty,
          payload: {
            stateid: li.instance.stateid,
            instanceId: li.instance.id,
            reason: 'order',
          },
          scope: 'shop:main',
        });

        // 3. Decrement qty in instances.db
        const currentQty = li.instance.qty || 0;
        await updateInstance(li.instance.id, {
          qty: currentQty - li.qty,
        });
      }

      // 4. Trigger instant workspace refresh
      triggerLiveEventsRefresh();

      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  // Item picker modal
  if (showPicker) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#999" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Item</Text>
          <View style={{ width: 22 }} />
        </View>

        {loadingInstances ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#8E8E93" />
          </View>
        ) : (
          <FlatList
            data={instances}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerRow}
                activeOpacity={0.5}
                onPress={() => addItem(item)}
              >
                <View style={styles.pickerInfo}>
                  <Text style={styles.pickerName}>{item.stateid}</Text>
                  <Text style={styles.pickerMeta}>
                    Qty: {item.qty ?? 0} · {item.currency || 'INR'}{' '}
                    {item.value ?? 0}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No inventory items</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Order</Text>
        <TouchableOpacity
          onPress={placeOrder}
          disabled={lineItems.length === 0 || placing}
          hitSlop={8}
        >
          <Text
            style={[
              styles.placeText,
              (lineItems.length === 0 || placing) && styles.placeTextDisabled,
            ]}
          >
            {placing ? 'Placing...' : 'Place Order'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Line Items */}
      <FlatList
        data={lineItems}
        keyExtractor={(item) => item.instance.id}
        contentContainerStyle={styles.lineList}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              loadInstances();
              setShowPicker(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <View style={styles.lineRow}>
            <View style={styles.lineInfo}>
              <Text style={styles.lineName}>{item.instance.stateid}</Text>
              <Text style={styles.linePrice}>
                {item.instance.currency || 'INR'} {item.instance.value ?? 0}
              </Text>
            </View>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                onPress={() => updateQty(item.instance.id, -1)}
                style={styles.qtyBtn}
              >
                <Ionicons name="remove-circle" size={28} color="#FF3B30" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.qty}</Text>
              <TouchableOpacity
                onPress={() => updateQty(item.instance.id, 1)}
                style={styles.qtyBtn}
              >
                <Ionicons name="add-circle" size={28} color="#34C759" />
              </TouchableOpacity>
            </View>
            <Text style={styles.lineTotal}>
              {item.instance.currency || 'INR'}{' '}
              {(item.qty * (item.instance.value || 0)).toFixed(2)}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.emptyOrder}>
            <Ionicons name="cart-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyOrderText}>No items added yet</Text>
          </View>
        }
      />

      {/* Summary */}
      {lineItems.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>INR {subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (18%)</Text>
            <Text style={styles.summaryValue}>INR {tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>INR {total.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  cancelText: { fontSize: 17, color: '#FF3B30' },
  placeText: { fontSize: 17, fontWeight: '600', color: '#007AFF' },
  placeTextDisabled: { color: '#C7C7CC' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 8,
  },

  lineList: { paddingHorizontal: 20, paddingBottom: 20 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  linePrice: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 18, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  lineTotal: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', minWidth: 80, textAlign: 'right' },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0' },

  emptyOrder: { alignItems: 'center', paddingTop: 60 },
  emptyOrderText: { fontSize: 15, color: '#AEAEB2', marginTop: 8 },

  summary: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: { fontSize: 15, color: '#8E8E93' },
  summaryValue: { fontSize: 15, color: '#1C1C1E' },
  totalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#007AFF' },

  // Picker
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerList: { paddingHorizontal: 20, paddingBottom: 40 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  pickerMeta: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  emptyText: { fontSize: 15, color: '#AEAEB2' },
});
