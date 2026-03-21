import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface InstanceData {
  stateid: string;
  type?: string;
  qty?: number;
  value?: number;
  currency?: string;
  available?: boolean;
  lat?: number;
  lng?: number;
}

interface Props {
  visible: boolean;
  stateUcode: string;
  stateTitle: string;
  existingInstance?: InstanceData & { id: string };
  onClose: () => void;
  onSubmit: (data: InstanceData) => Promise<void>;
  onDelete?: () => void;
}

export function InstanceFormModal({ 
  visible, 
  stateUcode, 
  stateTitle, 
  existingInstance, 
  onClose, 
  onSubmit,
  onDelete 
}: Props) {
  const isEditing = !!existingInstance;
  const insets = useSafeAreaInsets();
  
  // Instance fields
  const [qty, setQty] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [available, setAvailable] = useState(true);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens for new instance
  useEffect(() => {
    if (visible) {
      if (existingInstance) {
        setQty(existingInstance.qty?.toString() || '');
        setValue(existingInstance.value?.toString() || '');
        setCurrency(existingInstance.currency || 'INR');
        setAvailable(existingInstance.available ?? true);
        setLat(existingInstance.lat?.toString() || '');
        setLng(existingInstance.lng?.toString() || '');
      } else {
        // Reset for new instance
        setQty('');
        setValue('');
        setCurrency('INR');
        setAvailable(true);
        setLat('');
        setLng('');
      }
    }
  }, [existingInstance, visible]);

  const handleSubmit = async () => {
    // Validate - at least one of qty or value should be provided
    if (!qty && !value) {
      Alert.alert('Required', 'Please enter Quantity or Value');
      return;
    }

    const data: InstanceData = {
      stateid: stateUcode,
      type: 'inventory',
      qty: qty ? parseFloat(qty) : undefined,
      value: value ? parseFloat(value) : undefined,
      currency,
      available,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(data);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Instance',
      'Are you sure you want to delete this instance?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            onDelete?.();
            onClose();
          }
        },
      ]
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color="#1C1C1E" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Edit Inventory' : 'Add Inventory'}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* State Info Card */}
          <View style={styles.stateCard}>
            <View style={styles.stateIcon}>
              <Ionicons name="cube" size={20} color="#007AFF" />
            </View>
            <View style={styles.stateInfo}>
              <Text style={styles.stateTitleText}>{stateTitle || stateUcode}</Text>
              <Text style={styles.stateUcodeText}>{stateUcode}</Text>
            </View>
          </View>

          {/* Inventory Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                placeholder="0"
                placeholderTextColor="#C7C7CC"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>Unit Price</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setValue}
                  placeholder="0.00"
                  placeholderTextColor="#C7C7CC"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Currency</Text>
                <TextInput
                  style={styles.input}
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="INR"
                  placeholderTextColor="#C7C7CC"
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          {/* Availability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            
            <View style={styles.toggleCard}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Available for Sale</Text>
                <Text style={styles.toggleDesc}>Show this item in your store</Text>
              </View>
              <Switch
                value={available}
                onValueChange={setAvailable}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Location Section (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location <Text style={styles.optionalBadge}>Optional</Text></Text>
            
            <View style={styles.locationRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  value={lat}
                  onChangeText={setLat}
                  placeholder="19.0760"
                  placeholderTextColor="#C7C7CC"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  value={lng}
                  onChangeText={setLng}
                  placeholder="72.8777"
                  placeholderTextColor="#C7C7CC"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Delete Button (only for editing) */}
          {isEditing && onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={styles.deleteText}>Delete Inventory Item</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditing ? 'Save Changes' : 'Add to Inventory'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
  },

  // State Card
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stateInfo: {
    flex: 1,
  },
  stateTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  stateUcodeText: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: 'monospace',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: '400',
    color: '#C7C7CC',
    textTransform: 'none',
  },

  // Inputs
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },

  // Toggle Card
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Delete
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  deleteText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#007AFF80',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});