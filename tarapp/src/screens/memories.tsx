import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAgentState } from "@/hooks/useAgentState";
import { InstanceFormModal } from "@/components/InstanceFormModal";
import { Instance } from "@/src/db/turso";
import StatesScreen from "./states";

export default function MemoriesScreen() {
  const {
    loading,
    loadInstances,
    addInstance,
    editInstance,
    removeInstance,
    fetchStatesFromRemote,
  } = useAgentState();

  // Show states selection screen
  const [showStatesScreen, setShowStatesScreen] = useState(false);
  const [selectedStateForInstance, setSelectedStateForInstance] = useState<{ ucode: string; title: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [allInstances, setAllInstances] = useState<Instance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);

  // Instance modal state
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  // Load all instances on mount
  useEffect(() => {
    loadAllInstances();
  }, []);

  const loadAllInstances = async () => {
    console.log('[memories.tsx loadAllInstances] START');
    setInstancesLoading(true);
    try {
      // First get all states, then load instances for each
      console.log('[memories.tsx loadAllInstances] Fetching states from remote...');
      const states = await fetchStatesFromRemote();
      console.log('[memories.tsx loadAllInstances] Got states:', states.length, 'states');
      
      const allInst: Instance[] = [];
      
      for (const state of states) {
        console.log('[memories.tsx loadAllInstances] Loading instances for state:', state.ucode);
        try {
          const instances = await loadInstances(state.ucode);
          console.log('[memories.tsx loadAllInstances] Got', instances.length, 'instances for', state.ucode);
          allInst.push(...instances.map(inst => ({
            ...inst,
            _stateTitle: state.title || state.ucode
          })));
        } catch (e: any) {
          console.error('[memories.tsx loadAllInstances] Error loading instances for', state.ucode, ':', e.message);
        }
      }
      console.log('[memories.tsx loadAllInstances] Total instances collected:', allInst.length);
      setAllInstances(allInst);
    } catch (e: any) {
      console.error('[memories.tsx loadAllInstances] Failed to load instances:', e.message, e.stack);
    } finally {
      setInstancesLoading(false);
      console.log('[memories.tsx loadAllInstances] DONE');
    }
  };

  const handleAddInstance = () => {
    // First show states selection screen
    setSelectedStateForInstance(null);
    setShowStatesScreen(true);
  };

  // Handle state selection from StatesScreen
  const handleStateSelected = (state: { ucode: string; title: string }) => {
    setSelectedStateForInstance({ ucode: state.ucode, title: state.title });
    setShowStatesScreen(false);
    setEditingInstance(null);
    setShowInstanceModal(true);
  };

  // Close states screen without selection
  const handleCloseStatesScreen = () => {
    setShowStatesScreen(false);
  };

  const handleEditInstance = (instance: Instance) => {
    setEditingInstance(instance);
    setSelectedStateForInstance({ ucode: instance.stateid, title: (instance as any)._stateTitle || '' });
    setShowInstanceModal(true);
  };

  const handleInstanceSubmit = async (data: any) => {
    console.log('[memories.tsx handleInstanceSubmit] START - editingInstance:', !!editingInstance);
    console.log('[memories.tsx handleInstanceSubmit] data:', JSON.stringify(data));
    console.log('[memories.tsx handleInstanceSubmit] selectedStateForInstance:', selectedStateForInstance);
    
    if (editingInstance) {
      console.log('[memories.tsx handleInstanceSubmit] Editing existing instance, calling editInstance...');
      await editInstance(editingInstance.id, data);
    } else if (data.stateid) {
      // Use stateid from data (passed from InstanceFormModal where state is selected)
      console.log('[memories.tsx handleInstanceSubmit] Creating new instance for state:', data.stateid);
      await addInstance(data);
    } else {
      console.log('[memories.tsx handleInstanceSubmit] WARNING: No stateid in data!');
    }
    
    // Refresh all instances
    console.log('[memories.tsx handleInstanceSubmit] Refreshing all instances...');
    await loadAllInstances();
    console.log('[memories.tsx handleInstanceSubmit] DONE');
  };

  const handleInstanceDelete = async () => {
    if (editingInstance) {
      await removeInstance(editingInstance.id);
      await loadAllInstances();
    }
  };

  // --- CRUD Handlers ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllInstances();
    setRefreshing(false);
  }, []);

  // Filter instances by search
  const filteredInstances = allInstances.filter(inst => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return 
      inst.stateid?.toLowerCase().includes(searchLower) ||
      (inst as any)._stateTitle?.toLowerCase().includes(searchLower) ||
      inst.id?.toLowerCase().includes(searchLower);
  });

  // --- Render ---
  const renderEmpty = (isSearchResult: boolean) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyText}>{isSearchResult ? 'No matching instances' : 'No instances yet'}</Text>
      <Text style={styles.emptySubText}>
        {isSearchResult 
          ? `No instances found for "${searchQuery}"`
          : 'Tap + to create your first instance — select a state and add inventory.'}
      </Text>
      {!isSearchResult && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleAddInstance}>
          <Ionicons
            name="add"
            size={18}
            color="#FFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.emptyButtonText}>Add Instance</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // No type filters needed for instances view

  // Render instance card (flat list - no more state hierarchy)
  const renderInstanceCard = (instance: Instance, i: number) => {
    const stateTitle = (instance as any)._stateTitle || instance.stateid;
    
    return (
      <TouchableOpacity 
        key={i} 
        style={styles.card}
        onPress={() => handleEditInstance(instance)}
        activeOpacity={0.7}
      >
        {/* Instance icon */}
        <View style={styles.instanceIcon}>
          <Ionicons name="cube" size={20} color="#007AFF" />
        </View>
        
        {/* Instance details */}
        <View style={styles.instanceDetails}>
          <Text style={styles.cardTitle}>{stateTitle}</Text>
          <Text style={styles.cardUcode}>{instance.stateid}</Text>
          <View style={styles.instanceRow}>
            {instance.qty !== undefined && instance.qty !== null && (
              <Text style={styles.instanceQty}>Qty: {instance.qty}</Text>
            )}
            {instance.value !== undefined && instance.value !== null && (
              <Text style={styles.instanceValue}>
                {instance.currency || 'INR'} {instance.value}
              </Text>
            )}
          </View>
        </View>
        
        {/* Status indicator */}
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: instance.available ? '#34C759' : '#FF3B30' }
          ]} />
          <Text style={styles.statusText}>
            {instance.available ? 'Available' : 'Unavailable'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Instances</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity style={styles.addBtn} onPress={onRefresh}>
            <Ionicons name="sync" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddInstance}>
            <Ionicons name="add" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={18}
            color="#8E8E93"
            style={{ marginLeft: 12 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search instances..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ padding: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          filteredInstances.length === 0 && { flex: 1 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {(loading || instancesLoading || refreshing) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>Loading instances...</Text>
          </View>
        )}

        {!loading && !instancesLoading && !refreshing &&
          filteredInstances.length === 0 &&
          renderEmpty(!!searchQuery)}

        {filteredInstances.length > 0 && (
          <View style={styles.list}>
            {filteredInstances.map((instance, i) => renderInstanceCard(instance, i))}
          </View>
        )}
      </ScrollView>

      {/* States Selection Screen - Full Screen Overlay */}
      {showStatesScreen && (
        <View style={styles.overlayContainer}>
          <StatesScreen
            onSelectState={handleStateSelected}
            onClose={handleCloseStatesScreen}
          />
        </View>
      )}

      {/* Instance Modal */}
      <InstanceFormModal
        visible={showInstanceModal}
        stateUcode={selectedStateForInstance?.ucode || ''}
        stateTitle={selectedStateForInstance?.title || ''}
        existingInstance={editingInstance ? {
          ...editingInstance,
          stateid: editingInstance.stateid,
          qty: editingInstance.qty,
          value: editingInstance.value,
          currency: editingInstance.currency,
          available: editingInstance.available === 1,
          lat: editingInstance.lat,
          lng: editingInstance.lng,
        } : undefined}
        onClose={() => {
          setShowInstanceModal(false);
          setEditingInstance(null);
          setSelectedStateForInstance(null);
        }}
        onSubmit={handleInstanceSubmit}
        onDelete={editingInstance ? handleInstanceDelete : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },

  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
    paddingHorizontal: 8,
  },
  aiToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#007AFF10",
    borderWidth: 1,
    borderColor: "#007AFF30",
    minWidth: 50,
  },
  aiToggleActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  aiToggleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
  },
  aiToggleTextActive: {
    color: "#FFF",
  },

  tabBarContainer: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
    backgroundColor: "#FFF",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    height: '100%',
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: '100%',
    position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  tabTextActive: {
    color: "#1C1C1E",
    fontWeight: "700",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1C1C1E",
  },

  scrollContent: { padding: 20, paddingBottom: 160 },

  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: { fontSize: 14, color: "#8E8E93" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8E8E93",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  list: { gap: 12 },

  card: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5EA",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#EDEDF0",
  },
  typeTagText: { fontSize: 12, fontWeight: "600", color: "#636366" },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  cardUcode: { fontSize: 12, color: "#AEAEB2", marginBottom: 10 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF20'
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: 'monospace'
  },

  payloadRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  payloadChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDEDF0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    maxWidth: 160,
  },
  payloadChipKey: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  payloadChipVal: {
    fontSize: 12,
    color: "#1C1C1E",
    fontWeight: "500",
    flexShrink: 1,
  },

  // Instance UI
  addInstanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#007AFF15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF30',
  },
  addInstanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },

  instancesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  instancesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  instancesSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  instancesCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#007AFF15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  noInstances: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  noInstancesText: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  addInstanceSmallBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF10',
    borderRadius: 16,
  },
  addInstanceSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },

  instanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  instanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instanceDetails: {
    flex: 1,
  },
  instanceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  instanceQty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  instanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  instanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  // Overlay for states screen
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
});
