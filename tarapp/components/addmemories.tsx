import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { STATE_TYPES, StateTypeDef, getStateType } from '../src/config/stateSchemas';
import { createTask } from '../src/db/eventsDb';
import { OrderScreen } from './OrderScreen';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: StateTypeDef) => void;
  onSelectStateForInstance: (state: { ucode: string; title: string }) => void;
}

import { router } from 'expo-router';

// Add Tasks, Order, and Inventory as special type options
export const MEMORY_TYPES: (StateTypeDef | { type: string; label: string; icon: string; color: string })[] = [
  { type: 'tasks', label: 'Tasks', icon: 'checkbox-outline', color: '#5856D6' },
  { type: 'order', label: 'Order', icon: 'cart-outline', color: '#007AFF' },
  { type: 'inventory', label: 'Inventory Item', icon: 'cube-outline', color: '#34C759' },
  { type: 'tokens', label: 'Tokens', icon: 'server-outline', color: '#FF9500' },
  { type: 'channels', label: 'Channels', icon: 'paper-plane-outline', color: '#0088cc' },
  { type: 'profile', label: 'Profile', icon: 'person-outline', color: '#8E8E93' },
  ...STATE_TYPES,
];

export function AddMemories({ visible, onClose, onSelect, onSelectStateForInstance }: Props) {
  const insets = useSafeAreaInsets();
  // View state: 'main' | 'statePicker' | 'taskForm' | 'order'
  const [view, setView] = useState<'main' | 'statePicker' | 'taskForm' | 'order'>('main');
  const [states, setStates] = useState<any[]>([]);
  const [filteredStates, setFilteredStates] = useState<any[]>([]);
  const [stateSearch, setStateSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setView('main');
      setStates([]);
      setFilteredStates([]);
      setStateSearch('');
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('normal');
      setTaskDueDate('');
    }
  }, [visible]);

  // Load states when state picker view opens
  useEffect(() => {
    if (view === 'statePicker' && visible) {
      loadStates();
    }
  }, [view, visible]);

  // Filter states by search query
  useEffect(() => {
    if (!stateSearch) {
      setFilteredStates(states);
    } else {
      const q = stateSearch.toLowerCase();
      setFilteredStates(states.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.ucode?.toLowerCase().includes(q) ||
        s.type?.toLowerCase().includes(q)
      ));
    }
  }, [states, stateSearch]);

  const handleSelect = (item: StateTypeDef | { type: string }) => {
    if (item.type === 'inventory') {
      setView('statePicker');
    } else if (item.type === 'order') {
      setView('order');
    } else if (item.type === 'tasks') {
      setView('taskForm');
    } else if (item.type === 'tokens') {
      router.push('/tokens');
      onClose();
    } else if (item.type === 'channels') {
      router.push('/channels');
      onClose();
    } else if (item.type === 'profile') {
      router.push('/profile');
      onClose();
    } else {
      onSelect(item as StateTypeDef);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    
    setSavingTask(true);
    try {
      const result = await createTask({
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        due_date: taskDueDate || undefined,
      });
      
      if (result.success) {
        setView('main');
        setTaskTitle('');
        setTaskDescription('');
        setTaskPriority('normal');
        setTaskDueDate('');
        onClose();
      }
    } catch (e: any) {
      console.error('Task creation error:', e.message);
    } finally {
      setSavingTask(false);
    }
  };

  const loadStates = async () => {
    console.log('[addmemories] loadStates START');
    setLoading(true);
    
    try {
      // Use public states API directly (same as discover.tsx which works)
      const { listPublicStatesApi } = await import('../src/api/client');
      const result = await listPublicStatesApi(undefined, undefined, 50);
      console.log('[addmemories] API result:', JSON.stringify(result).substring(0, 400));
      
      const statesData = result?.result || [];
      console.log('[addmemories] statesData:', statesData.length, 'items');
      
      // Force update both states
      setStates([...statesData]);
      setFilteredStates([...statesData]);
      console.log('[addmemories] States set, count:', statesData.length);
    } catch (e: any) {
      console.error('[addmemories] loadStates error:', e?.message);
      setStates([]);
      setFilteredStates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelect = (state: any) => {
    setView('main');
    onSelectStateForInstance({ ucode: state.ucode, title: state.title });
  };

  // Priority color helper
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'normal': return '#007AFF';
      case 'low': return '#8E8E93';
      default: return '#007AFF';
    }
  };

  if (view === 'order') {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <OrderScreen
          onClose={() => { setView('main'); onClose(); }}
          onCancel={() => setView('main')}
        />
      </Modal>
    );
  }

  if (view === 'statePicker') {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.safe}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => setView('main')} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#999" />
            </TouchableOpacity>
            <Text style={styles.title}>Select State</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Search */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products, services..."
                placeholderTextColor="#8E8E93"
                value={stateSearch}
                onChangeText={setStateSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {stateSearch ? (
                <TouchableOpacity onPress={() => setStateSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#C7C7CC" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          ) : (
            <FlatList
              data={filteredStates}
              keyExtractor={(item) => item.ucode}
              contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 40) }]}
              renderItem={({ item }) => {
                const typeInfo = getStateType(item.type) || { icon: 'pricetag-outline', color: '#8E8E93', label: item.type };
                const payload = (() => { try { return typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {}); } catch { return {}; } })();
                return (
                  <TouchableOpacity
                    style={styles.stateRow}
                    activeOpacity={0.5}
                    onPress={() => handleStateSelect(item)}
                  >
                    <View style={[styles.stateIcon, { backgroundColor: typeInfo.color + '15' }]}>
                      <Ionicons name={typeInfo.icon as any} size={18} color={typeInfo.color} />
                    </View>
                    <View style={styles.stateInfo}>
                      <Text style={styles.stateTitle} numberOfLines={1}>{item.title || item.ucode}</Text>
                      <Text style={styles.stateUcode} numberOfLines={1}>
                        {item.ucode} · {typeInfo.label}
                        {payload.price ? ` · ₹${payload.price}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#AEAEB2" />
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="cube-outline" size={28} color="#AEAEB2" />
                  </View>
                  <Text style={styles.emptyText}>
                    {stateSearch ? 'No matching states' : 'No states yet'}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {stateSearch
                      ? `Nothing matches "${stateSearch}"`
                      : 'Create a Product or Service first, then add inventory'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    );
  }

  // Task creation form modal
  if (view === 'taskForm') {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <KeyboardAvoidingView 
          style={styles.taskSafe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => setView('main')} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#999" />
            </TouchableOpacity>
            <Text style={styles.title}>New Task</Text>
            <TouchableOpacity 
              onPress={handleCreateTask} 
              disabled={!taskTitle.trim() || savingTask}
              hitSlop={8}
            >
              <Text style={[
                styles.saveButton, 
                (!taskTitle.trim() || savingTask) && styles.saveButtonDisabled
              ]}>
                {savingTask ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.taskForm} contentContainerStyle={[styles.taskFormContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter task title"
                placeholderTextColor="#AEAEB2"
                value={taskTitle}
                onChangeText={setTaskTitle}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter task description"
                placeholderTextColor="#AEAEB2"
                value={taskDescription}
                onChangeText={setTaskDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityButton,
                      taskPriority === p && styles.priorityButtonActive,
                      taskPriority === p && { backgroundColor: getPriorityColor(p) },
                    ]}
                    onPress={() => setTaskPriority(p)}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      taskPriority === p && styles.priorityButtonTextActive,
                    ]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor="#AEAEB2"
                value={taskDueDate}
                onChangeText={setTaskDueDate}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.title}>New Memory</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={MEMORY_TYPES}
          keyExtractor={(item) => item.type}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 40) }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.5}
              onPress={() => handleSelect(item)}
            >
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={styles.label}>{item.label}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1C1E',
    marginLeft: 14,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0F0F0',
  },
  // Search
  searchWrapper: {
    paddingHorizontal: 20,
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
  // State picker styles
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stateIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  stateUcode: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
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
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // Task form styles
  taskSafe: { flex: 1, backgroundColor: '#FFF' },
  taskForm: { flex: 1 },
  taskFormContent: { padding: 20 },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonDisabled: {
    color: '#C7C7CC',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    color: '#1C1C1E',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  priorityRow: {
    flexDirection: 'row',
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    marginRight: 8,
  },
  priorityButtonActive: {
    backgroundColor: '#007AFF',
  },
  priorityButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  priorityButtonTextActive: {
    color: '#FFF',
  },
});
