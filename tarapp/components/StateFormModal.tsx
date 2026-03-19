import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StateTypeDef, FieldDef } from '../src/config/stateSchemas';

interface Props {
  visible: boolean;
  stateType: StateTypeDef | null;
  existingState?: any;
  onClose: () => void;
  onSubmit: (ucode: string, title: string, payload: Record<string, any>) => Promise<void>;
}

export function StateFormModal({ visible, stateType, existingState, onClose, onSubmit }: Props) {
  const isEditing = !!existingState;
  const [idPart, setIdPart] = useState('');
  const [title, setTitle] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existingState) {
      const ucodeId = existingState.ucode?.split(':').slice(1).join(':') || '';
      setIdPart(ucodeId);
      setTitle(existingState.title || '');
      const raw = existingState.payload || {};
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      setFieldValues(parsed);
    } else {
      setIdPart('');
      setTitle('');
      setFieldValues({});
    }
  }, [existingState, stateType]);

  if (!stateType) return null;

  const ucode = `${stateType.type}:${idPart.trim().toLowerCase().replace(/\s+/g, '-')}`;

  const setField = (key: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!idPart.trim()) {
      Alert.alert('Required', 'Please enter an ID for this state.');
      return;
    }

    const payload: Record<string, any> = {};
    stateType.fields.forEach((f) => {
      const val = fieldValues[f.key];
      if (val === undefined || val === null || val === '') return;
      if (f.type === 'number') {
        payload[f.key] = parseFloat(val) || 0;
      } else if (f.type === 'tags') {
        payload[f.key] = typeof val === 'string'
          ? val.split(',').map((s: string) => s.trim()).filter(Boolean)
          : val;
      } else if (f.type === 'boolean') {
        payload[f.key] = Boolean(val);
      } else {
        payload[f.key] = val;
      }
    });

    setSubmitting(true);
    try {
      await onSubmit(ucode, title, payload);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FieldDef) => {
    const value = fieldValues[field.key] ?? '';

    if (field.type === 'boolean') {
      return (
        <View key={field.key} style={styles.boolRow}>
          <Text style={styles.boolLabel}>{field.label}</Text>
          <Switch
            value={Boolean(value)}
            onValueChange={(v) => setField(field.key, v)}
            trackColor={{ false: '#E5E5EA', true: '#000' }}
          />
        </View>
      );
    }

    const isTextarea = field.type === 'textarea';
    const isTags = field.type === 'tags';

    return (
      <View key={field.key} style={styles.group}>
        <Text style={styles.label}>
          {field.label}
          {field.required && <Text style={styles.req}> *</Text>}
        </Text>
        {isTags && <Text style={styles.hint}>Comma-separated</Text>}
        <TextInput
          style={[styles.input, isTextarea && styles.textarea]}
          value={isTags && Array.isArray(value) ? value.join(', ') : String(value)}
          onChangeText={(t) => setField(field.key, t)}
          placeholder={field.placeholder}
          placeholderTextColor="#C7C7CC"
          multiline={isTextarea}
          textAlignVertical={isTextarea ? 'top' : 'center'}
          keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
          autoCapitalize="none"
        />
      </View>
    );
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Ionicons name={stateType.icon as any} size={16} color={stateType.color} />
              <Text style={styles.headerTitle}>
                {isEditing ? `Edit ${stateType.label}` : `New ${stateType.label}`}
              </Text>
            </View>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ID */}
            <View style={styles.group}>
              <Text style={styles.label}>ID <Text style={styles.req}>*</Text></Text>
              <View style={styles.idRow}>
                <Text style={styles.idPrefix}>{stateType.type}:</Text>
                <TextInput
                  style={styles.idInput}
                  value={idPart}
                  onChangeText={setIdPart}
                  placeholder="my-item"
                  autoCapitalize="none"
                  editable={!isEditing}
                  placeholderTextColor="#C7C7CC"
                />
              </View>
            </View>

            {/* Title */}
            <View style={styles.group}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={`${stateType.label} display name`}
                placeholderTextColor="#C7C7CC"
              />
            </View>

            {/* Section */}
            <Text style={styles.section}>Payload</Text>

            {stateType.fields.map(renderField)}
          </ScrollView>

          {/* Submit */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>
                {submitting ? '...' : isEditing ? 'Update' : `Create ${stateType.label}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0F0F0',
  },
  cancel: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  group: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
    marginBottom: 8,
  },
  req: {
    color: '#FF3B30',
  },
  hint: {
    fontSize: 12,
    color: '#C7C7CC',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#000',
  },
  textarea: {
    height: 88,
    textAlignVertical: 'top',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
  },
  idPrefix: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
    paddingLeft: 14,
  },
  idInput: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 13,
    fontSize: 16,
    color: '#000',
  },
  boolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 20,
  },
  boolLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  section: {
    fontSize: 13,
    fontWeight: '500',
    color: '#C7C7CC',
    marginBottom: 16,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0F0F0',
  },
  btn: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#D1D1D6',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
