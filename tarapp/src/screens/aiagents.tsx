import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';
import { getStateType } from '../config/stateSchemas';
import { listScopesApi } from '../api/client';

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

// ─── Inline Store Pill (replaces title in header when store mode is on) ──────

function StorePill({ activeScope, onChangeScope, onExit }: {
  activeScope: string | null;
  onChangeScope: (scope: string) => void;
  onExit: () => void;
}) {
  const [scopes, setScopes] = useState<{ scope: string; role: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const slug = activeScope ? activeScope.replace('shop:', '') : null;
  const storeScopes = scopes.filter((s) => s && s.scope && s.scope !== 'shop:main');

  useEffect(() => {
    listScopesApi()
      .then((res) => setScopes(res.scopes || []))
      .catch(() => {});
  }, [activeScope]);

  return (
    <View>
      {/* Pill in the header */}
      <View style={selectorStyles.pillRow}>
        {slug ? (
          <TouchableOpacity
            style={selectorStyles.scopePill}
            onPress={() => setShowPicker(!showPicker)}
            activeOpacity={0.7}
          >
            <Ionicons name="storefront-outline" size={14} color="#FF2D55" />
            <Text style={selectorStyles.scopeText}>{slug}</Text>
            <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={12} color="#8E8E93" />
          </TouchableOpacity>
        ) : (
          <View style={selectorStyles.scopePillMuted}>
            <Ionicons name="storefront-outline" size={14} color="#8E8E93" />
            <Text style={selectorStyles.scopeTextMuted}>No store</Text>
          </View>
        )}

        {slug && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://${slug}.tarai.space/`)}
            hitSlop={8}
            style={{ marginLeft: 8 }}
          >
            <Ionicons name="open-outline" size={18} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Scope picker dropdown */}
      {showPicker && storeScopes.length > 0 && (
        <View style={selectorStyles.picker}>
          {storeScopes.map((s) => {
            const sSlug = s.scope.replace('shop:', '');
            const isActive = s.scope === activeScope;
            return (
              <TouchableOpacity
                key={s.scope}
                style={[selectorStyles.pickerItem, isActive && { backgroundColor: '#FFF0F3' }]}
                onPress={() => { onChangeScope(s.scope); setShowPicker(false); }}
              >
                <Text style={[selectorStyles.pickerText, isActive && { color: '#FF2D55' }]}>
                  {sSlug}
                </Text>
                <Text style={selectorStyles.pickerRole}>{s.role}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scopePillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scopeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF2D55',
  },
  scopeTextMuted: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
  },
  picker: {
    marginTop: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  pickerRole: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────

export default function AgentsScreen() {
  const { loading, result, storeMode, setStoreMode, activeScope, setActiveScope } = useAgentState();
  console.log('[AGENTS SCREEN] render — loading:', loading, 'storeMode:', storeMode, 'activeScope:', activeScope, 'result:', !!result);

  const renderResults = () => {
    console.log('[AGENTS SCREEN] renderResults called, result:', JSON.stringify(result));
    if (!result) { console.log('[AGENTS SCREEN] result is null, returning null'); return null; }

    // ── 1. Design Result ──
    if (result.result?.action === 'DESIGN' || result.result?.action === 'DESIGN_UPDATE') {
      const design = result.result;
      const slug = (activeScope || '').replace('shop:', '');
      return (
        <View style={styles.designResult}>
          <View style={styles.designHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.designTitle}>
              {design.action === 'DESIGN' ? 'Store designed' : 'Design updated'}
            </Text>
          </View>
          {design.storeName && (
            <Text style={styles.designStoreName}>{design.storeName}</Text>
          )}
          <TouchableOpacity
            style={styles.visitButton}
            onPress={() => Linking.openURL(`https://${slug}.tarai.space/`)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={16} color="#FFF" />
            <Text style={styles.visitButtonText}>{slug}.tarai.space</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── 2. Semantic Search Results ──
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

    // ── 3. NL Operation Flat List ──
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
          {storeMode ? (
            <StorePill
              activeScope={activeScope}
              onChangeScope={setActiveScope}
              onExit={() => { setStoreMode(false); setActiveScope(null); }}
            />
          ) : (
            <Text style={styles.headerTitle}>Agents</Text>
          )}
        </View>

        {!result && !loading && !storeMode && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Ask anything</Text>
            <Text style={styles.emptySub}>sell 2 shoes · create order · search products · start task…</Text>
          </View>
        )}

        {!result && !loading && storeMode && (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={40} color="#FF2D55" />
            <Text style={styles.emptyText}>Design your store</Text>
            <Text style={styles.emptySub}>Describe your store and AI will generate the storefront design</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>
              {storeMode ? 'Designing…' : 'Thinking…'}
            </Text>
          </View>
        )}

        {renderResults()}
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

  // Design result
  designResult: { alignItems: 'center', gap: 12, marginTop: 40 },
  designHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  designTitle: { fontSize: 17, fontWeight: '700', color: '#34C759' },
  designStoreName: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF2D55',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  visitButtonText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

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

  // Search Result Cards
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
});
