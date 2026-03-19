import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLiveEvents } from '@/hooks/useLiveEvents';

// ─── Full TAR Opcode map for Trace screen ─────────────────────────────────

const OPCODE_META: Record<number, { name: string; color: string; icon: string }> = {
  101: { name: 'STOCKIN',        color: '#34C759', icon: 'arrow-down-circle' },
  102: { name: 'SALEOUT',        color: '#FF3B30', icon: 'arrow-up-circle' },
  103: { name: 'SALERETURN',     color: '#FF9500', icon: 'return-down-back' },
  104: { name: 'STOCKADJUST',    color: '#5856D6', icon: 'git-compare' },
  105: { name: 'TRANSFEROUT',    color: '#AF52DE', icon: 'arrow-forward-circle' },
  106: { name: 'TRANSFERIN',     color: '#007AFF', icon: 'arrow-back-circle' },
  107: { name: 'STOCKVOID',      color: '#8E8E93', icon: 'close-circle' },
  201: { name: 'INVOICECREATE',  color: '#007AFF', icon: 'document-text' },
  202: { name: 'ITEMADD',        color: '#007AFF', icon: 'add-circle' },
  203: { name: 'INVOICEPAYMENT', color: '#34C759', icon: 'cash' },
  204: { name: 'PAYMENTFAIL',    color: '#FF3B30', icon: 'close-circle' },
  205: { name: 'INVOICEVOID',    color: '#8E8E93', icon: 'trash' },
  206: { name: 'ITEMDEFINE',     color: '#007AFF', icon: 'list-circle' },
  207: { name: 'INVOICEREFUND',  color: '#FF9500', icon: 'refresh-circle' },
  301: { name: 'TASKCREATE',     color: '#5856D6', icon: 'checkbox' },
  302: { name: 'TASKASSIGN',     color: '#5856D6', icon: 'person' },
  303: { name: 'TASKSTART',      color: '#007AFF', icon: 'play-circle' },
  304: { name: 'TASKPROGRESS',   color: '#FF9500', icon: 'time' },
  305: { name: 'TASKDONE',       color: '#34C759', icon: 'checkmark-circle' },
  306: { name: 'TASKFAIL',       color: '#FF3B30', icon: 'close-circle' },
  307: { name: 'TASKBLOCK',      color: '#FF9500', icon: 'pause-circle' },
  308: { name: 'TASKRESUME',     color: '#007AFF', icon: 'play-skip-forward' },
  309: { name: 'TASKVOID',       color: '#8E8E93', icon: 'close' },
  310: { name: 'TASKLINK',       color: '#5856D6', icon: 'link' },
  311: { name: 'TASKCOMMENT',    color: '#007AFF', icon: 'chatbubble' },
  401: { name: 'PAYIN',          color: '#34C759', icon: 'trending-up' },
  402: { name: 'PAYOUT',         color: '#FF3B30', icon: 'trending-down' },
  403: { name: 'ACCOUNTREFUND',  color: '#FF9500', icon: 'refresh' },
  404: { name: 'ACCOUNTADJUST',  color: '#5856D6', icon: 'calculator' },
  501: { name: 'ORDERCREATE',    color: '#007AFF', icon: 'cart' },
  502: { name: 'ORDERSHIP',      color: '#5856D6', icon: 'airplane' },
  503: { name: 'ORDERDELIVER',   color: '#34C759', icon: 'checkmark-done' },
  504: { name: 'ORDERCANCEL',    color: '#FF3B30', icon: 'close-circle' },
  601: { name: 'RIDECREATE',     color: '#007AFF', icon: 'car' },
  602: { name: 'RIDESTART',      color: '#34C759', icon: 'car-sport' },
  603: { name: 'RIDEDONE',       color: '#34C759', icon: 'flag' },
  604: { name: 'RIDECANCEL',     color: '#FF3B30', icon: 'close-circle' },
  605: { name: 'MOTION',         color: '#FF9500', icon: 'location' },
  611: { name: 'BOOKINGCREATE',  color: '#5856D6', icon: 'calendar' },
  612: { name: 'BOOKINGDONE',    color: '#34C759', icon: 'calendar-outline' },
  621: { name: 'RENTALSTART',    color: '#007AFF', icon: 'key' },
  622: { name: 'RENTALEND',      color: '#8E8E93', icon: 'lock-closed' },
  701: { name: 'GSTACCRUE',      color: '#FF9500', icon: 'receipt' },
  702: { name: 'GSTPAY',         color: '#FF3B30', icon: 'business' },
  703: { name: 'GSTREFUND',      color: '#34C759', icon: 'cash-outline' },
  801: { name: 'MEMORYDEFINE',   color: '#5856D6', icon: 'library' },
  802: { name: 'MEMORYWRITE',    color: '#5856D6', icon: 'save' },
  901: { name: 'USERCREATE',     color: '#007AFF', icon: 'person-add' },
  902: { name: 'ROLEGRANT',      color: '#5856D6', icon: 'shield-checkmark' },
};

function getMeta(opcode: number) {
  return OPCODE_META[opcode] ?? { name: `OPCODE_${opcode}`, color: '#8E8E93', icon: 'flash' };
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function LiveTracking() {
  const { events, status } = useLiveEvents();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Trace</Text>
          <View style={styles.statusBadge}>
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: status === 'Connected' ? '#34C759' : '#FF3B30',
                  opacity: status === 'Connected' ? pulseAnim : 1,
                },
              ]}
            />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Real-time TAR event stream</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Waiting for events…</Text>
            <Text style={styles.emptySubText}>
              Commerce, orders and tasks will appear here live.
            </Text>
          </View>
        ) : (
          events.map((ev, index) => {
            const meta = getMeta(ev.opcode);
            return (
              <View key={index} style={styles.flatRow}>
                <View style={styles.flatCol}>
                  <Text style={[styles.flatOpName, { color: meta.color }]}>{meta.name}</Text>
                  <Text style={styles.flatStreamId}>{ev.streamid}</Text>
                </View>
                <View style={styles.flatRight}>
                  <Text style={styles.flatTime}>{ev.timestamp}</Text>
                  <Text
                    style={[
                      styles.flatDelta,
                      { color: ev.delta < 0 ? '#FF3B30' : ev.delta > 0 ? '#34C759' : '#8E8E93' },
                    ]}
                  >
                    {ev.delta > 0 ? '+' : ''}
                    {ev.delta !== 0 ? `${ev.delta}` : '—'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#8E8E93' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#3A3A3C' },
  list: { paddingHorizontal: 20, paddingVertical: 10, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  emptySubText: { fontSize: 13, color: '#8E8E93', marginTop: 4, textAlign: 'center' },
  
  // Flat Row Styles
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  flatCol: { flex: 1 },
  flatOpName: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  flatStreamId: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 2 },
  flatRight: { alignItems: 'flex-end' },
  flatTime: { fontSize: 11, color: '#AEAEB2', marginBottom: 2 },
  flatDelta: { fontSize: 15, fontWeight: '800' },
});
