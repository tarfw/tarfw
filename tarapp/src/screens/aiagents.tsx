import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';
import { getStateType } from '../config/stateSchemas';
import { useLiveEvents } from '@/hooks/useLiveEvents';

// ─── TAR Opcode Metadata ───────────────────────────────────────────────────

const OPCODE_META: Record<number, { name: string; color: string; icon: string; family: string }> = {
  // 1xx Stock
  101: { name: 'STOCKIN',          color: '#34C759', icon: 'arrow-down-circle',   family: 'Stock' },
  102: { name: 'SALEOUT',          color: '#FF3B30', icon: 'arrow-up-circle',     family: 'Stock' },
  103: { name: 'SALERETURN',       color: '#FF9500', icon: 'return-down-back',    family: 'Stock' },
  104: { name: 'STOCKADJUST',      color: '#5856D6', icon: 'git-compare',         family: 'Stock' },
  105: { name: 'TRANSFEROUT',      color: '#AF52DE', icon: 'arrow-forward-circle',family: 'Stock' },
  106: { name: 'TRANSFERIN',       color: '#007AFF', icon: 'arrow-back-circle',   family: 'Stock' },
  107: { name: 'STOCKVOID',        color: '#8E8E93', icon: 'close-circle',        family: 'Stock' },
  // 2xx Billing
  201: { name: 'INVOICECREATE',    color: '#007AFF', icon: 'document-text',       family: 'Invoice' },
  202: { name: 'INVOICEITEMADD',   color: '#007AFF', icon: 'add-circle',          family: 'Invoice' },
  203: { name: 'INVOICEPAYMENT',   color: '#34C759', icon: 'cash',                family: 'Invoice' },
  204: { name: 'PAYMENTFAIL',      color: '#FF3B30', icon: 'close-circle',        family: 'Invoice' },
  205: { name: 'INVOICEVOID',      color: '#8E8E93', icon: 'trash',               family: 'Invoice' },
  206: { name: 'ITEMDEFINE',       color: '#007AFF', icon: 'list-circle',         family: 'Invoice' },
  207: { name: 'INVOICEREFUND',    color: '#FF9500', icon: 'refresh-circle',      family: 'Invoice' },
  // 3xx Tasks
  301: { name: 'TASKCREATE',       color: '#5856D6', icon: 'checkbox',            family: 'Task' },
  302: { name: 'TASKASSIGN',       color: '#5856D6', icon: 'person',              family: 'Task' },
  303: { name: 'TASKSTART',        color: '#007AFF', icon: 'play-circle',         family: 'Task' },
  304: { name: 'TASKPROGRESS',     color: '#FF9500', icon: 'time',                family: 'Task' },
  305: { name: 'TASKDONE',         color: '#34C759', icon: 'checkmark-circle',    family: 'Task' },
  306: { name: 'TASKFAIL',         color: '#FF3B30', icon: 'close-circle',        family: 'Task' },
  307: { name: 'TASKBLOCK',        color: '#FF9500', icon: 'pause-circle',        family: 'Task' },
  308: { name: 'TASKRESUME',       color: '#007AFF', icon: 'play-skip-forward',   family: 'Task' },
  309: { name: 'TASKVOID',         color: '#8E8E93', icon: 'close',               family: 'Task' },
  310: { name: 'TASKLINK',         color: '#5856D6', icon: 'link',                family: 'Task' },
  311: { name: 'TASKCOMMENT',      color: '#007AFF', icon: 'chatbubble',          family: 'Task' },
  // 4xx Accounts
  401: { name: 'ACCOUNTPAYIN',     color: '#34C759', icon: 'trending-up',         family: 'Accounts' },
  402: { name: 'ACCOUNTPAYOUT',    color: '#FF3B30', icon: 'trending-down',       family: 'Accounts' },
  403: { name: 'ACCOUNTREFUND',    color: '#FF9500', icon: 'refresh',             family: 'Accounts' },
  404: { name: 'ACCOUNTADJUST',    color: '#5856D6', icon: 'calculator',          family: 'Accounts' },
  // 5xx Orders
  501: { name: 'ORDERCREATE',      color: '#007AFF', icon: 'cart',                family: 'Orders' },
  502: { name: 'ORDERSHIP',        color: '#5856D6', icon: 'airplane',            family: 'Orders' },
  503: { name: 'ORDERDELIVER',     color: '#34C759', icon: 'checkmark-done',      family: 'Orders' },
  504: { name: 'ORDERCANCEL',      color: '#FF3B30', icon: 'close-circle',        family: 'Orders' },
  // 6xx Transport
  601: { name: 'RIDECREATE',       color: '#007AFF', icon: 'car',                 family: 'Transport' },
  602: { name: 'RIDESTART',        color: '#34C759', icon: 'car-sport',           family: 'Transport' },
  603: { name: 'RIDEDONE',         color: '#34C759', icon: 'flag',                family: 'Transport' },
  604: { name: 'RIDECANCEL',       color: '#FF3B30', icon: 'close-circle',        family: 'Transport' },
  605: { name: 'MOTION',           color: '#FF9500', icon: 'location',            family: 'Transport' },
  611: { name: 'BOOKINGCREATE',    color: '#5856D6', icon: 'calendar',            family: 'Transport' },
  612: { name: 'BOOKINGDONE',      color: '#34C759', icon: 'calendar-outline',    family: 'Transport' },
  621: { name: 'RENTALSTART',      color: '#007AFF', icon: 'key',                 family: 'Transport' },
  622: { name: 'RENTALEND',        color: '#8E8E93', icon: 'lock-closed',         family: 'Transport' },
  // 7xx Tax
  701: { name: 'GSTVATACCRUE',     color: '#FF9500', icon: 'receipt',             family: 'Tax' },
  702: { name: 'GSTVATPAY',        color: '#FF3B30', icon: 'business',            family: 'Tax' },
  703: { name: 'GSTVATREFUND',     color: '#34C759', icon: 'cash-outline',        family: 'Tax' },
  // 8xx Memory
  801: { name: 'MEMORYDEFINE',     color: '#5856D6', icon: 'library',             family: 'AI/Memory' },
  802: { name: 'MEMORYWRITE',      color: '#5856D6', icon: 'save',                family: 'AI/Memory' },
  803: { name: 'MEMORYUPDATE',     color: '#5856D6', icon: 'refresh-circle',      family: 'AI/Memory' },
  804: { name: 'MEMORYSNAPSHOT',   color: '#5856D6', icon: 'camera',              family: 'AI/Memory' },
  // 9xx Identity
  901: { name: 'USERCREATE',       color: '#007AFF', icon: 'person-add',          family: 'Identity' },
  902: { name: 'USERROLEGRANT',    color: '#5856D6', icon: 'shield-checkmark',    family: 'Identity' },
  903: { name: 'USERAUTH',         color: '#34C759', icon: 'finger-print',        family: 'Identity' },
  904: { name: 'USERDISABLE',      color: '#FF3B30', icon: 'person-remove',       family: 'Identity' },
};

function getOpcodeMeta(opcode: number) {
  return OPCODE_META[opcode] ?? { name: `OPCODE_${opcode}`, color: '#8E8E93', icon: 'flash', family: 'Unknown' };
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function AgentsScreen() {
  const { loading, result } = useAgentState();
  const { events: traces } = useLiveEvents();

  const renderResults = () => {
    if (!result) return null;

    // ── 1. Semantic Search Results ──
    if (result.result?.action === 'SEARCH') {
      const items: any[] = Array.isArray(result.result.results) ? result.result.results : [];
      if (items.length === 0) {
        return (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color="#C7C7CC" />
            <Text style={styles.emptyText}>No results found</Text>
          </View>
        );
      }
      return (
        <View style={styles.list}>
          {items.map((item: any, i: number) => {
            const ucode = item.ucode || item.streamid;
            const typeKey = ucode?.split(':')[0];
            const typeDef = getStateType(typeKey);
            return (
              <View key={i} style={styles.card}>
                <View style={styles.cardTop}>
                  {typeDef && (
                    <View style={[styles.typeTag, { backgroundColor: typeDef.color + '18' }]}>
                      <Ionicons name={typeDef.icon as any} size={13} color={typeDef.color} />
                      <Text style={[styles.typeTagText, { color: typeDef.color }]}>{typeDef.label}</Text>
                    </View>
                  )}
                  {item.distance != null && (
                    <Text style={styles.distanceBadge}>{(item.distance * 100).toFixed(0)}% match</Text>
                  )}
                </View>
                <Text style={styles.cardTitle}>{item.title || '—'}</Text>
                <Text style={styles.cardUcode}>{ucode}</Text>
                {item.payload && (
                  <Text style={styles.cardPayload} numberOfLines={2}>
                    {JSON.stringify(typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    // ── 2. NL Operation Flat List ──
    const op = result.result;
    if (op && typeof op.opcode === 'number') {
      const meta = getOpcodeMeta(op.opcode);
      return (
        <View style={styles.flatRow}>
          <View style={styles.flatCol}>
            <Text style={[styles.flatOpName, { color: meta.color }]}>{meta.name}</Text>
            <Text style={styles.flatStreamId}>{op.streamid}</Text>
          </View>
          <View style={styles.flatRight}>
            <Text style={styles.flatStatus}>{op.status}</Text>
            {op.delta !== 0 && (
              <Text style={[styles.flatDelta, { color: op.delta > 0 ? '#34C759' : '#FF3B30' }]}>
                {op.delta > 0 ? `+${op.delta}` : op.delta}
              </Text>
            )}
          </View>
        </View>
      );
    }
 
    return null;
  };
 
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Agents</Text>
        </View>
 
        {!result && !loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Ask anything</Text>
            <Text style={styles.emptySub}>sell 2 shoes · create order · search products · start task…</Text>
          </View>
        )}
 
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        )}
 
        {renderResults()}
 
        {traces.length > 0 && (
          <View style={styles.traceSection}>
            <Text style={styles.traceSectionTitle}>Recent Activity</Text>
            {traces.slice(0, 10).map((trace, i) => {
              const meta = getOpcodeMeta(trace.opcode);
              return (
                <View key={i} style={styles.traceRowFlat}>
                  <Text style={[styles.traceOpFlat, { color: meta.color }]}>{meta.name}</Text>
                  <Text style={styles.traceTargetFlat}>{trace.streamid}</Text>
                  <Text style={styles.traceTimeFlat}>{trace.timestamp}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingBottom: 160, flexGrow: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },

  // Empty
  empty: { marginTop: '25%', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#8E8E93' },
  emptySub: { fontSize: 14, color: '#C7C7CC', textAlign: 'center', lineHeight: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 60 },
  loadingText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },

  // Flat UI Styles
  flatRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  flatCol: { flex: 1 },
  flatOpName: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  flatStreamId: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 2 },
  flatRight: { alignItems: 'flex-end' },
  flatStatus: { fontSize: 11, color: '#8E8E93', textTransform: 'uppercase', fontWeight: '600' },
  flatDelta: { fontSize: 16, fontWeight: '800' },

  // Search Result Cards (Keeping simplified but consistent)
  list: { gap: 12 },
  card: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeTagText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  distanceBadge: { fontSize: 11, color: '#8E8E93' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  cardUcode: { fontSize: 12, color: '#AEAEB2' },
  cardPayload: { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  // Recent Activity (Flat List)
  traceSection: { marginTop: 40 },
  traceSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  traceRowFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  traceOpFlat: { fontSize: 11, fontWeight: '800', width: 90 },
  traceTargetFlat: { fontSize: 13, fontWeight: '600', color: '#3A3A3C', flex: 1 },
  traceTimeFlat: { fontSize: 11, color: '#AEAEB2' },
});
