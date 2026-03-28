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
import { STATE_TYPES, StateTypeDef } from '../src/config/stateSchemas';
import { getAllStates } from '../src/db/turso';
import { createTask } from '../src/db/eventsDb';
import { triggerLiveEventsRefresh } from '../hooks/useLiveEvents';
import { OrderScreen } from './OrderScreen';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: StateTypeDef) => void;
  onSelectStateForInstance: (state: { ucode: string; title: string }) => void;
}

// Add Tasks, Order, and Inventory as special type options
export const MEMORY_TYPES: (StateTypeDef | { type: string; label: string; icon: string; color: string })[] = [
  { type: 'tasks', label: 'Tasks', icon: 'checkbox-outline', color: '#5856D6' },
  { type: 'order', label: 'Order', icon: 'cart-outline', color: '#007AFF' },
  { type: 'inventory', label: 'Inventory Item', icon: 'cube-outline', color: '#34C759' },
  ...STATE_TYPES,
];

export function AddMemories({ visible, onClose, onSelect, onSelectStateForInstance }: Props) {
  const insets = useSafeAreaInsets();
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [showOrderScreen, setShowOrderScreen] = useState(false);

  // Reset state picker when modal closes
  useEffect(() => {
    if (!visible) {
      setShowStatePicker(false);
      setShowTaskForm(false);
      setShowOrderScreen(false);
      // Reset task form
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('normal');
      setTaskDueDate('');
    }
  }, [visible]);

  const handleSelect = (item: StateTypeDef | { type: string }) => {
    console.log('[addmemories] handleSelect called with:', item.type);
    
    if (item.type === 'inventory') {
      // Show state picker for inventory
      console.log('[addmemories] Opening state picker for inventory');
      setShowStatePicker(true);
      loadStates();
    } else if (item.type === 'order') {
      console.log('[addmemories] Opening order screen');
      setShowOrderScreen(true);
    } else if (item.type === 'tasks') {
      // Show task creation form
      console.log('[addmemories] Opening task creation form');
      setShowTaskForm(true);
    } else {
      console.log('[addmemories] Selecting memory type:', item.type);
      onSelect(item as StateTypeDef);
    }
  };

  const handleCreateTask = async () => {
    console.log('[addmemories] handleCreateTask called, title:', taskTitle.trim());
    
    if (!taskTitle.trim()) {
      console.log('[addmemories] Task title is empty, skipping');
      return;
    }
    
    setSavingTask(true);
    try {
      console.log('[addmemories] Calling createTask with:', {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        due_date: taskDueDate || undefined,
      });
      
      const result = await createTask({
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        due_date: taskDueDate || undefined,
      });
      
      console.log('[addmemories] createTask result:', result);
      
      if (result.success) {
        console.log('[addmemories] Task created successfully, triggering instant refresh');
        // Trigger instant refresh in workspace
        triggerLiveEventsRefresh();
        
        setShowTaskForm(false);
        setTaskTitle('');
        setTaskDescription('');
        setTaskPriority('normal');
        setTaskDueDate('');
        onClose();
      } else {
        console.error('[addmemories] Task creation failed:', result.error);
      }
    } catch (e: any) {
      console.error('[addmemories] Task creation error:', e.message);
    } finally {
      setSavingTask(false);
    }
  };

  const loadStates = async () => {
    setLoading(true);
    try {
      const allStates = await getAllStates('shop:main');
      setStates(allStates);
    } catch (e) {
      setStates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelect = (state: any) => {
    setShowStatePicker(false);
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

  if (showOrderScreen) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <OrderScreen
          onClose={() => { setShowOrderScreen(false); onClose(); }}
          onCancel={() => setShowOrderScreen(false)}
        />
      </Modal>
    );
  }

  if (showStatePicker) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.safe}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => setShowStatePicker(false)} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#999" />
            </TouchableOpacity>
            <Text style={styles.title}>Select State</Text>
            <View style={{ width: 22 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          ) : (
            <FlatList
              data={states}
              keyExtractor={(item) => item.ucode}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.5}
                  onPress={() => handleStateSelect(item)}
                >
                  <Ionicons name="cube-outline" size={22} color="#007AFF" />
                  <View style={styles.stateInfo}>
                    <Text style={styles.stateTitle}>{item.title || item.ucode}</Text>
                    <Text style={styles.stateUcode}>{item.ucode}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No states yet</Text>
                  <Text style={styles.emptySubText}>Create a state first (Product, Service, etc.)</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    );
  }

  // Task creation form modal
  if (showTaskForm) {
    return (
      <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
        <KeyboardAvoidingView 
          style={styles.taskSafe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => setShowTaskForm(false)} hitSlop={8}>
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

          <ScrollView style={styles.taskForm} contentContainerStyle={styles.taskFormContent}>
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
          contentContainerStyle={styles.list}
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
  // State picker styles
  stateInfo: {
    flex: 1,
    marginLeft: 14,
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
