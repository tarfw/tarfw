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
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAgentState } from "@/hooks/useAgentState";
import { STATE_TYPES, getStateType, StateTypeDef, FieldDef } from "../config/stateSchemas";

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
  const { fetchStatesFromRemote, createState } = useAgentState();
  
  const [states, setStates] = useState<StateItem[]>([]);
  const [filteredStates, setFilteredStates] = useState<StateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStates, setLoadingStates] = useState(true);
  
  // Create state modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingState, setCreatingState] = useState(false);
  const [newStateType, setNewStateType] = useState("product");
  const [newStateName, setNewStateName] = useState("");
  const [newStateId, setNewStateId] = useState("");
  
  // Payload form fields based on state type
  const [payloadFields, setPayloadFields] = useState<Record<string, any>>({});

  // Get fields for current type
  const currentTypeFields = useMemo(() => {
    const typeDef = getStateType(newStateType);
    return typeDef?.fields || [];
  }, [newStateType]);

  // Reset payload when type changes
  useEffect(() => {
    setPayloadFields({});
  }, [newStateType]);

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

  // Reset create form
  const resetCreateForm = () => {
    setNewStateType("product");
    setNewStateId("");
    setNewStateName("");
    setPayloadFields({});
  };

  // Update a payload field
  const updatePayloadField = (key: string, value: any) => {
    setPayloadFields(prev => ({ ...prev, [key]: value }));
  };

  // Validate required payload fields
  const validatePayload = (): boolean => {
    const typeDef = getStateType(newStateType);
    if (!typeDef) return true;
    
    const requiredFields = typeDef.fields.filter(f => f.required);
    for (const field of requiredFields) {
      const value = payloadFields[field.key];
      if (!value || (typeof value === 'string' && !value.trim())) {
        Alert.alert('Required', `${field.label} is required`);
        return false;
      }
    }
    return true;
  };

  // Create new state
  const handleCreateState = async () => {
    if (!newStateId.trim()) {
      Alert.alert('Required', 'Please enter a state ID');
      return;
    }
    if (!newStateName.trim()) {
      Alert.alert('Required', 'Please enter a display name');
      return;
    }
    
    if (!validatePayload()) {
      return;
    }
    
    const ucode = `${newStateType}:${newStateId.trim().toLowerCase().replace(/\s+/g, '-')}`;
    const title = newStateName.trim();
    
    setCreatingState(true);
    try {
      await createState(ucode, title, payloadFields);
      // Refresh states
      await loadStates();
      // Close modal and reset form
      setShowCreateModal(false);
      resetCreateForm();
      // Auto-select the newly created state
      onSelectState?.({ ucode, title, type: newStateType });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create state');
    } finally {
      setCreatingState(false);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  // Render payload field input based on field type
  const renderPayloadField = (field: FieldDef, index: number) => {
    const value = payloadFields[field.key] || '';
    const isRequired = field.required;
    
    return (
      <View key={field.key} style={styles.payloadField}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {isRequired && <Text style={styles.requiredStar}> *</Text>}
        </Text>
        
        {field.type === 'textarea' ? (
          <TextInput
            style={[styles.fieldInput, styles.fieldTextarea]}
            value={value}
            onChangeText={(text) => updatePayloadField(field.key, text)}
            placeholder={field.placeholder}
            placeholderTextColor="#C7C7CC"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        ) : field.type === 'number' ? (
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={(text) => updatePayloadField(field.key, text)}
            placeholder={field.placeholder}
            placeholderTextColor="#C7C7CC"
            keyboardType="decimal-pad"
          />
        ) : field.type === 'boolean' ? (
          <TouchableOpacity
            style={[styles.toggleField, value && styles.toggleFieldActive]}
            onPress={() => updatePayloadField(field.key, !value)}
          >
            <Text style={[styles.toggleText, value && styles.toggleTextActive]}>
              {value ? 'Yes' : 'No'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={(text) => updatePayloadField(field.key, text)}
            placeholder={field.placeholder}
            placeholderTextColor="#C7C7CC"
          />
        )}
      </View>
    );
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
          : 'Tap + to create a new state'}
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
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={22} color="#007AFF" />
        </TouchableOpacity>
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

      {/* Create State Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={handleCloseModal} style={styles.headerAction}>
                <Text style={styles.headerActionText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New State</Text>
              <TouchableOpacity 
                onPress={handleCreateState}
                disabled={creatingState || !newStateId.trim() || !newStateName.trim()}
                style={styles.headerAction}
              >
                <Text style={[
                  styles.headerActionText, 
                  styles.createActionText,
                  (creatingState || !newStateId.trim() || !newStateName.trim()) && styles.createActionDisabled
                ]}>
                  {creatingState ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalBody}
          >
            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Preview Card */}
              <View style={styles.previewCard}>
                {(() => {
                  const typeInfo = getStateType(newStateType);
                  return (
                    <>
                      <View style={[styles.previewIcon, { backgroundColor: (typeInfo?.color || '#007AFF') + '15' }]}>
                        <Ionicons name={(typeInfo?.icon || 'pricetag-outline') as any} size={24} color={typeInfo?.color || '#007AFF'} />
                      </View>
                      <View style={styles.previewInfo}>
                        <Text style={styles.previewLabel}>Preview</Text>
                        <Text style={styles.previewUcode}>{newStateType}:{newStateId || 'your-id'}</Text>
                      </View>
                    </>
                  );
                })()}
              </View>

              {/* Type Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Type</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeGrid}
                >
                  {STATE_TYPES.map((item) => {
                    const isSelected = newStateType === item.type;
                    return (
                      <TouchableOpacity
                        key={item.type}
                        style={[
                          styles.typeChip,
                          isSelected && { backgroundColor: item.color + '15', borderColor: item.color }
                        ]}
                        onPress={() => setNewStateType(item.type)}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name={item.icon as any} 
                          size={14} 
                          color={isSelected ? item.color : '#8E8E93'} 
                        />
                        <Text style={[
                          styles.typeChipText,
                          isSelected && { color: item.color }
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* State ID */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>State ID</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>{newStateType}:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newStateId}
                    onChangeText={setNewStateId}
                    placeholder="coffee-mug"
                    placeholderTextColor="#C7C7CC"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Display Name */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Display Name <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.formInput}
                  value={newStateName}
                  onChangeText={setNewStateName}
                  placeholder="Coffee Mug"
                  placeholderTextColor="#C7C7CC"
                />
              </View>

              {/* Payload Fields based on Type */}
              {currentTypeFields.length > 0 && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Details</Text>
                  <View style={styles.payloadFieldsContainer}>
                    {currentTypeFields.map((field, index) => renderPayloadField(field, index))}
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>

        </View>
      </Modal>
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
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF15',
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

  // Modal styles - Linear-inspired
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    paddingTop: 8,
    paddingBottom: 12,
  },
  modalDragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerAction: {
    width: 60,
  },
  headerActionText: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalBody: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  
  // Preview Card
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 2,
  },
  previewUcode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'monospace',
  },
  
  // Form sections
  formSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: '#FF3B30',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  inputPrefix: {
    fontSize: 16,
    color: '#8E8E93',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F8F8F8',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5EA',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  
  // Payload fields
  payloadFieldsContainer: {
    gap: 16,
  },
  payloadField: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  fieldTextarea: {
    minHeight: 80,
    paddingTop: 12,
  },
  toggleField: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  toggleFieldActive: {
    backgroundColor: '#007AFF15',
    borderColor: '#007AFF',
  },
  toggleText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  toggleTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  
  createActionText: {
    fontWeight: '600',
  },
  createActionDisabled: {
    color: '#C7C7CC',
  },
});