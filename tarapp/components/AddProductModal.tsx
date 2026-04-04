import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';
import { sendChannelMessage } from '@/src/api/client';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ParsedProduct {
  title: string;
  price?: number;
  currency?: string;
  brand?: string;
  sku?: string;
  sizes?: string[];
  colors?: string[];
}

export function AddProductModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { createState, activeScope } = useAgentState();
  const scrollRef = useRef<ScrollView>(null);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [parsed, setParsed] = useState<ParsedProduct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setInput('');
      setSending(false);
      setParsed(null);
      setConfirming(false);
      setError(null);
    }
  }, [visible]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setParsed(null);
    setSending(true);

    try {
      const response = await sendChannelMessage({
        channel: 'app_agent',
        userId: 'mobile_user_01',
        scope: activeScope || 'shop:main',
        text: text,
        action: 'PARSE_PRODUCT',
      });

      const product = response?.result?.product;
      if (product && product.title) {
        setParsed(product);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        setError('Could not parse product from AI response. Please try again with more details.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to process your request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleEdit = () => {
    setParsed(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!parsed || confirming) return;

    const slug = parsed.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ucode = `product:${slug}`;

    const payload: Record<string, any> = { type: 'product' };
    if (parsed.price) payload.price = parsed.price;
    if (parsed.currency) payload.currency = parsed.currency;
    if (parsed.brand) payload.brand = parsed.brand;
    if (parsed.sku) payload.sku = parsed.sku;
    if (parsed.sizes?.length) payload.sizes = parsed.sizes;
    if (parsed.colors?.length) payload.colors = parsed.colors;

    setConfirming(true);
    try {
      await createState(ucode, parsed.title.trim(), payload);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create product');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.inner, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="close" size={22} color="#1C1C1E" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Add Product</Text>
            </View>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Input area */}
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder={"Describe your product\u2026 e.g. 'Red Nike shoes, \u20B92500, sizes S M L'"}
              placeholderTextColor="#C7C7CC"
              multiline
              maxLength={500}
              editable={!sending && !parsed}
              autoFocus
            />

            {/* Send button */}
            {!parsed && (
              <View style={styles.sendRow}>
                <TouchableOpacity
                  style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                  activeOpacity={0.7}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Loading state */}
            {sending && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#8E8E93" size="small" />
                <Text style={styles.loadingText}>AI is parsing your product...</Text>
              </View>
            )}

            {/* Error state */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Preview card */}
            {parsed && (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>PRODUCT PREVIEW</Text>

                <View style={styles.previewField}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <Text style={styles.fieldValue}>{parsed.title}</Text>
                </View>

                {(parsed.price != null) && (
                  <View style={styles.previewField}>
                    <Text style={styles.fieldLabel}>Price</Text>
                    <Text style={styles.fieldValue}>
                      {parsed.currency || 'INR'} {parsed.price}
                    </Text>
                  </View>
                )}

                {parsed.brand && (
                  <View style={styles.previewField}>
                    <Text style={styles.fieldLabel}>Brand</Text>
                    <Text style={styles.fieldValue}>{parsed.brand}</Text>
                  </View>
                )}

                {parsed.sku && (
                  <View style={styles.previewField}>
                    <Text style={styles.fieldLabel}>SKU</Text>
                    <Text style={styles.fieldValue}>{parsed.sku}</Text>
                  </View>
                )}

                {parsed.sizes && parsed.sizes.length > 0 && (
                  <View style={styles.previewField}>
                    <Text style={styles.fieldLabel}>Sizes</Text>
                    <View style={styles.tagRow}>
                      {parsed.sizes.map((s, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {parsed.colors && parsed.colors.length > 0 && (
                  <View style={styles.previewField}>
                    <Text style={styles.fieldLabel}>Colors</Text>
                    <View style={styles.tagRow}>
                      {parsed.colors.map((c, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={handleEdit} activeOpacity={0.7}>
                    <Ionicons name="pencil" size={16} color="#1C1C1E" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
                    onPress={handleConfirm}
                    disabled={confirming}
                    activeOpacity={0.7}
                  >
                    {confirming ? (
                      <ActivityIndicator color="#1C1C1E" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#1C1C1E" />
                        <Text style={styles.confirmBtnText}>Confirm</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, backgroundColor: '#FFFFFF' },
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 40 },

  // Input
  textInput: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
    minHeight: 80,
    maxHeight: 160,
    padding: 0,
  },

  // Send
  sendRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  sendBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#000',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7C7CC' },

  // Loading
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 15, color: '#8E8E93', fontWeight: '500' },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorText: { fontSize: 14, color: '#FF3B30', flex: 1, fontWeight: '500' },

  // Preview card
  previewCard: {
    marginTop: 24,
    backgroundColor: '#F9F9FB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 16,
  },
  previewField: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  editBtnText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
  },
  confirmBtnDisabled: { backgroundColor: '#E5E5EA80' },
  confirmBtnText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
});
