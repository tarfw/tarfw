import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAgentState } from "@/hooks/useAgentState";
import { STATE_TYPES, getStateType, StateTypeDef } from "../config/stateSchemas";

interface StateItem {
  id: string;
  ucode: string;
  type: string;
  title: string;
  payload?: string;
  scope?: string;
  ts?: string;
}

interface Props {
  onSelectState?: (state: { ucode: string; title: string; type: string }) => void;
  onClose?: () => void;
}

export default function StatesScreen({ onSelectState, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { fetchStatesFromRemote } = useAgentState();
  
  const [states, setStates] = useState<StateItem[]>([]);
  const [filteredStates, setFilteredStates] = useState<StateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStates, setLoadingStates] = useState(true);

  // Get filter options - all state types + "all"
  const filterOptions = useMemo(() => {
    return [
      { type: "all", label: "All", color: "#007AFF" },
      ...STATE_TYPES
    ];
  }, []);

  // Filter states by filter and search
  useEffect(() => {
    let result = [...states];
    
    // Filter by type
    if (activeFilter !== "all") {
      result = result.filter(s => s.type === activeFilter);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.title?.toLowerCase().includes(query) ||
        s.ucode?.toLowerCase().includes(query) ||
        s.type?.toLowerCase().includes(query)
      );
    }
    
    setFilteredStates(result);
  }, [states, activeFilter, searchQuery]);

  const loadStates = async () => {
    setLoadingStates(true);
    try {
      const data = await fetchStatesFromRemote();
      setStates(data);
    } catch (e) {
      console.error('Failed to load states:', e);
    } finally {
      setLoadingStates(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStates();
    setRefreshing(false);
  }, []);

  const handleStateSelect = (state: StateItem) => {
    if (onSelectState) {
      onSelectState({ 
        ucode: state.ucode, 
        title: state.title || state.ucode,
        type: state.type 
      });
    }
  };

  const renderStateItem = ({ item }: { item: StateItem }) => {
    const typeInfo = getStateType(item.type) || { 
      type: item.type, 
      label: item.type, 
      icon: 'pricetag-outline',
      color: '#8E8E93'
    };
    
    return (
      <TouchableOpacity 
        style={styles.stateRow}
        onPress={() => handleStateSelect(item)}
        activeOpacity={0.6}
      >
        {/* Icon */}
        <View style={[styles.iconWrapper, { backgroundColor: typeInfo.color + '15' }]}>
          <Ionicons name={typeInfo.icon as any} size={18} color={typeInfo.color} />
        </View>
        
        {/* Content */}
        <View style={styles.stateContent}>
          <Text style={styles.stateTitle} numberOfLines={1}>
            {item.title || item.ucode.split(':')[1] || item.ucode}
          </Text>
          <Text style={styles.stateMeta}>
            {item.ucode} · {typeInfo.label}
          </Text>
        </View>
        
        {/* Arrow */}
        <Ionicons name="chevron-forward" size={16} color="#AEAEB2" />
      </TouchableOpacity>
    );
  };

  // Count for active filter
  const getCount = (type: string) => {
    if (type === "all") return states.length;
    return states.filter(s => s.type === type).length;
  };

  const renderFilterTab = (item: StateTypeDef | { type: string; label: string; color: string }, index: number) => {
    const isActive = activeFilter === item.type;
    const count = getCount(item.type);
    
    return (
      <TouchableOpacity
        key={item.type}
        style={[
          styles.filterTab,
          isActive && { backgroundColor: item.color + '15', borderColor: item.color + '40' }
        ]}
        onPress={() => setActiveFilter(item.type)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          isActive && { color: item.color }
        ]}>
          {item.label}
        </Text>
        {count > 0 && (
          <View style={[
            styles.filterCount,
            isActive && { backgroundColor: item.color }
          ]}>
            <Text style={[
              styles.filterCountText,
              isActive && { color: '#FFF' }
            ]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="search" size={28} color="#AEAEB2" />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No results' : 'No states yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery 
          ? `No states match "${searchQuery}"` 
          : 'Create states to add inventory'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeBtn} 
          onPress={onClose}
        >
          <Ionicons name="close" size={20} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select State</Text>
        <View style={styles.closeBtn} />
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search states..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filterOptions}
          renderItem={({ item, index }) => renderFilterTab(item, index)}
          keyExtractor={(item) => item.type}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* States List */}
      {loadingStates && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredStates}
          renderItem={renderStateItem}
          keyExtractor={(item) => item.id || item.ucode}
          contentContainerStyle={[
            styles.listContent,
            filteredStates.length === 0 && styles.listContentEmpty
          ]}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },

  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    marginLeft: 8,
    paddingVertical: 0,
  },

  filterContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',
  },
  filterCount: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#636366',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateContent: {
    flex: 1,
    marginLeft: 12,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  stateMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  separator: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginLeft: 44,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});