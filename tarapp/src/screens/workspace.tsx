import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Animated } from 'react-native';
import { useLiveEvents, LiveEvent } from '@/hooks/useLiveEvents';
import { useAgentState } from '@/hooks/useAgentState';

// ─── Full TAR Opcode map for Workspace screen ─────────────────────────────

const OPCODE_META: Record<number, { name: string; color: string; icon: string }> = {
  // 1xx Stock
  101: { name: 'STOCKIN',          color: '#34C759', icon: 'arrow-down-circle' },
  102: { name: 'SALEOUT',          color: '#FF3B30', icon: 'arrow-up-circle' },
  103: { name: 'SALERETURN',       color: '#FF9500', icon: 'return-down-back' },
  104: { name: 'STOCKADJUST',      color: '#5856D6', icon: 'git-compare' },
  105: { name: 'TRANSFEROUT',      color: '#AF52DE', icon: 'arrow-forward-circle' },
  106: { name: 'TRANSFERIN',       color: '#007AFF', icon: 'arrow-back-circle' },
  107: { name: 'STOCKVOID',        color: '#8E8E93', icon: 'close-circle' },
  // 2xx Billing
  201: { name: 'INVOICECREATE',    color: '#007AFF', icon: 'document-text' },
  202: { name: 'INVOICEITEMADD',   color: '#007AFF', icon: 'add-circle' },
  203: { name: 'INVOICEPAYMENT',   color: '#34C759', icon: 'cash' },
  204: { name: 'PAYMENTFAIL',      color: '#FF3B30', icon: 'close-circle' },
  205: { name: 'INVOICEVOID',      color: '#8E8E93', icon: 'trash' },
  206: { name: 'ITEMDEFINE',       color: '#007AFF', icon: 'list-circle' },
  207: { name: 'INVOICEREFUND',    color: '#FF9500', icon: 'refresh-circle' },
  // 3xx Tasks
  301: { name: 'TASKCREATE',       color: '#5856D6', icon: 'checkbox' },
  302: { name: 'TASKASSIGN',       color: '#5856D6', icon: 'person' },
  303: { name: 'TASKSTART',        color: '#007AFF', icon: 'play-circle' },
  304: { name: 'TASKPROGRESS',     color: '#FF9500', icon: 'time' },
  305: { name: 'TASKDONE',         color: '#34C759', icon: 'checkmark-circle' },
  306: { name: 'TASKFAIL',         color: '#FF3B30', icon: 'close-circle' },
  307: { name: 'TASKBLOCK',        color: '#FF9500', icon: 'pause-circle' },
  308: { name: 'TASKRESUME',       color: '#007AFF', icon: 'play-skip-forward' },
  309: { name: 'TASKVOID',         color: '#8E8E93', icon: 'close' },
  310: { name: 'TASKLINK',         color: '#5856D6', icon: 'link' },
  311: { name: 'TASKCOMMENT',      color: '#007AFF', icon: 'chatbubble' },
  // 4xx Accounts
  401: { name: 'ACCOUNTPAYIN',     color: '#34C759', icon: 'trending-up' },
  402: { name: 'ACCOUNTPAYOUT',    color: '#FF3B30', icon: 'trending-down' },
  403: { name: 'ACCOUNTREFUND',    color: '#FF9500', icon: 'refresh' },
  404: { name: 'ACCOUNTADJUST',    color: '#5856D6', icon: 'calculator' },
  // 5xx Orders
  501: { name: 'ORDERCREATE',      color: '#007AFF', icon: 'cart' },
  502: { name: 'ORDERSHIP',        color: '#5856D6', icon: 'airplane' },
  503: { name: 'ORDERDELIVER',     color: '#34C759', icon: 'checkmark-done' },
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
  701: { name: 'GSTVATACCRUE',   color: '#FF9500', icon: 'receipt' },
  702: { name: 'GSTVATPAY',      color: '#FF3B30', icon: 'business' },
  703: { name: 'GSTVATREFUND',   color: '#34C759', icon: 'cash-outline' },
  801: { name: 'MEMORYDEFINE',   color: '#5856D6', icon: 'library' },
  802: { name: 'MEMORYWRITE',    color: '#5856D6', icon: 'save' },
  803: { name: 'MEMORYUPDATE',   color: '#5856D6', icon: 'refresh-circle' },
  804: { name: 'MEMORYSNAPSHOT', color: '#5856D6', icon: 'camera' },
  901: { name: 'USERCREATE',     color: '#007AFF', icon: 'person-add' },
  902: { name: 'USERROLEGRANT',  color: '#5856D6', icon: 'shield-checkmark' },
  903: { name: 'USERAUTH',       color: '#34C759', icon: 'finger-print' },
  904: { name: 'USERDISABLE',    color: '#FF3B30', icon: 'person-remove' },
};

function getMeta(opcode: number) {
  return OPCODE_META[opcode] ?? { name: `OPCODE_${opcode}`, color: '#8E8E93', icon: 'flash' };
}

// ─── Group events by streamid into cards ──────────────────────────────────

interface EventCard {
  key: string;
  streamid: string;
  events: LiveEvent[];
  latestTimestamp: string;
  latestRaw: string;
}

function groupByStreamId(events: LiveEvent[]): EventCard[] {
  const map = new Map<string, LiveEvent[]>();
  const ungrouped: LiveEvent[] = [];

  for (const ev of events) {
    if (!ev.streamid) {
      ungrouped.push(ev);
    } else {
      if (!map.has(ev.streamid)) map.set(ev.streamid, []);
      map.get(ev.streamid)!.push(ev);
    }
  }

  const cards: EventCard[] = [];

  for (const [streamid, evts] of map) {
    evts.sort((a, b) => (b.rawTimestamp || '').localeCompare(a.rawTimestamp || ''));
    cards.push({
      key: streamid,
      streamid,
      events: evts,
      latestTimestamp: evts[0].timestamp,
      latestRaw: evts[0].rawTimestamp || '',
    });
  }

  for (let i = 0; i < ungrouped.length; i++) {
    const ev = ungrouped[i];
    cards.push({
      key: ev.id || `ungrouped-${i}`,
      streamid: '',
      events: [ev],
      latestTimestamp: ev.timestamp,
      latestRaw: ev.rawTimestamp || '',
    });
  }

  cards.sort((a, b) => b.latestRaw.localeCompare(a.latestRaw));
  return cards;
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function Workspace() {
  const { activeScope } = useAgentState();
  const { events: cloudEvents, status } = useLiveEvents(activeScope);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cards = useMemo(
    () => groupByStreamId(cloudEvents),
    [cloudEvents],
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const keyExtractor = useCallback((item: EventCard) => item.key, []);

  const renderCard = useCallback(({ item: card }: { item: EventCard }) => {
    const leadEvent = card.events[0];
    const leadMeta = getMeta(leadEvent.opcode);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardStreamId} numberOfLines={1}>
            {card.streamid || leadMeta.name}
          </Text>
          <Text style={styles.cardTime}>{card.latestTimestamp}</Text>
        </View>

        {card.events.map((ev, idx) => {
          const meta = getMeta(ev.opcode);
          const displayText = ev.title || '';
          const deltaStr = ev.delta !== 0 ? `${ev.delta > 0 ? '+' : ''}${ev.delta}` : '—';

          return (
            <View key={ev.id || idx} style={styles.cardEvent}>
              <Text style={[styles.eventOpcode, { color: meta.color }]}>
                {meta.name}
              </Text>
              {ev.stateid ? (
                <Text style={styles.eventStateId} numberOfLines={1}>
                  {ev.stateid}
                </Text>
              ) : null}
              {displayText ? (
                <Text style={styles.eventDetail} numberOfLines={1}>
                  {displayText}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.eventDelta,
                  {
                    color:
                      ev.delta < 0
                        ? '#FF3B30'
                        : ev.delta > 0
                        ? '#34C759'
                        : '#8E8E93',
                  },
                ]}
              >
                {deltaStr}
              </Text>
              <Text style={styles.eventTime}>{ev.timestamp}</Text>
            </View>
          );
        })}
      </View>
    );
  }, []);

  const ListEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Waiting for events…</Text>
      <Text style={styles.emptySubText}>
        Commerce, orders and tasks will appear here live.
      </Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Workspace</Text>
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
      </View>

      <FlatList
        data={cards}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
      />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
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
  list: { padding: 10, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  emptySubText: { fontSize: 13, color: '#8E8E93', marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cardHeader: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  cardStreamId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 1,
  },
  cardTime: {
    fontSize: 11,
    color: '#8E8E93',
  },
  cardEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  eventOpcode: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 100,
  },
  eventStateId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    marginLeft: 6,
    maxWidth: 100,
  },
  eventDetail: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
    marginLeft: 6,
  },
  eventDelta: { fontSize: 14, fontWeight: '800', marginLeft: 'auto', minWidth: 36, textAlign: 'right' },
  eventTime: { fontSize: 10, color: '#AEAEB2', marginLeft: 6, minWidth: 50, textAlign: 'right' },
});
