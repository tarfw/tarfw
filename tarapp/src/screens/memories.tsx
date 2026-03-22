import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAgentState } from "@/hooks/useAgentState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InstanceFormModal } from "@/components/InstanceFormModal";
import { Instance } from "@/src/db/turso";

export default function MemoriesScreen() {
  const {
    addInstance,
    editInstance,
    removeInstance,
    setPickerVisible,
  } = useAgentState();
  const insets = useSafeAreaInsets();

  const [selectedStateForInstance, setSelectedStateForInstance] = useState<{ ucode: string; title: string } | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [allInstances, setAllInstances] = useState<Instance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(true);

  // Instance modal state - for editing existing instances
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  // Track if this is first load (for initial loading state)
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  // Prevent sync loop
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Load all instances on mount - local-first, don't block UI
  useEffect(() => {
    // Show local data immediately, sync in background
    loadAllInstances();
    
    // Sync on app foreground (proper Turso offline-first pattern)
    const { AppState } = require('react-native');
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App came to foreground - sync in background
        syncInBackground();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Background sync function - doesn't block UI
  const syncInBackground = async () => {
    if (isSyncing) return; // Prevent duplicate sync
    setIsSyncing(true);
    try {
      const { getAllInstances, pullData } = await import('@/src/db/turso');
      // Sync instances from remote
      await pullData();
      // After sync, reload ALL instances from local DB
      const allInst = await getAllInstances();
      setAllInstances(allInst);
    } catch (e) {
      // Silent fail for background sync
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAllInstances = async () => {
    try {
      // Get ALL instances directly from local DB (local-first)
      const { getAllInstances } = await import('@/src/db/turso');
      
      // Load all instances from local DB
      const allInst = await getAllInstances();
      
      // Update state with local data immediately (no delay)
      setAllInstances(allInst);
      
      // Always mark first load complete when we have data
      setIsFirstLoad(false);
      
      // Background sync after showing local data (non-blocking)
      syncInBackground();
      
    } catch (e: any) {
      // Silent fail - always clear loading state on error
      setInstancesLoading(false);
      setIsFirstLoad(false);
    }
  };

  const handleAddInstance = () => {
    // Use the global picker modal from _layout
    setPickerVisible(true);
  };

  const handleEditInstance = (instance: Instance) => {
    setEditingInstance(instance);
    setSelectedStateForInstance({ ucode: instance.stateid, title: (instance as any)._stateTitle || '' });
    setShowInstanceModal(true);
  };

  const handleInstanceSubmit = async (data: any) => {
    if (editingInstance) {
      await editInstance(editingInstance.id, data);
    } else if (data.stateid) {
      await addInstance(data);
    }
    
    // Refresh all instances
    await loadAllInstances();
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

  // All instances (no filtering needed)
  const filteredInstances = allInstances;

  // --- Render ---
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No items yet</Text>
      <Text style={styles.emptySubText}>Tap + to add your first item</Text>
    </View>
  );

  // No type filters needed for instances view

  // Render instance row - Flat minimal design
  const renderInstanceCard = (instance: Instance, i: number) => {
    const stateTitle = (instance as any)._stateTitle || instance.stateid;
    const isAvailable = instance.available;
    
    return (
      <TouchableOpacity 
        key={i} 
        style={styles.flatRow}
        onPress={() => handleEditInstance(instance)}
        activeOpacity={0.6}
      >
        <Text style={styles.flatTitle} numberOfLines={1}>{stateTitle}</Text>
        <View style={styles.flatRight}>
          {instance.qty !== undefined && instance.qty !== null && (
            <Text style={styles.flatQty}>{instance.qty}</Text>
          )}
          {instance.value !== undefined && instance.value !== null && (
            <Text style={styles.flatPrice}>{instance.currency || '₹'}{instance.value}</Text>
          )}
          <View style={[styles.flatDot, { backgroundColor: isAvailable ? '#34C759' : '#FF3B30' }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          filteredInstances.length === 0 && styles.scrollContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8E8E93" />
        }
      >
        {(instancesLoading || refreshing) && allInstances.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#8E8E93" />
          </View>
        )}

        {!instancesLoading && !refreshing &&
          filteredInstances.length === 0 &&
          renderEmpty()}

        {filteredInstances.length > 0 && (
          <View style={styles.flatList}>
            {filteredInstances.map((instance, i) => renderInstanceCard(instance, i))}
          </View>
        )}
      </ScrollView>

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
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 120,
  },
  scrollContentEmpty: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
  },

  // Flat list
  flatList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },

  // Flat row - minimal list item
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  flatTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
  },
  flatRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flatQty: {
    fontSize: 14,
    color: '#8E8E93',
  },
  flatPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  flatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
