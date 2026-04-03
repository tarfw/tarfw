import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listScopesApi, createScopeApi } from '@/src/api/client';

interface StoreSwitcherProps {
  activeScope: string | null;
  onSwitch: (scope: string) => void;
}

export function StoreSwitcher({ activeScope, onSwitch }: StoreSwitcherProps) {
  const [scopes, setScopes] = useState<{ scope: string; role: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const slug = activeScope ? activeScope.replace('shop:', '') : null;
  const storeScopes = scopes.filter(s => s && s.scope && s.scope !== 'shop:main');


  const fetchScopes = useCallback(async () => {
    try {
      const res = await listScopesApi();
      setScopes(res.scopes || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchScopes();
  }, [fetchScopes]);

  const handleCreate = async () => {
    const trimmed = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!trimmed) return;
    setLoading(true);
    try {
      await createScopeApi(`shop:${trimmed}`);
      setNewName('');
      setCreating(false);
      await fetchScopes();
      onSwitch(`shop:${trimmed}`);
    } catch (e) {
      console.error('[StoreSwitcher] Create scope failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>STORES</Text>

      {storeScopes.map(s => {
        const sSlug = (s.scope || '').replace('shop:', '');
        const isActive = s.scope === activeScope;
        return (
          <TouchableOpacity
            key={s.scope}
            style={styles.modalRow}
            onPress={() => { onSwitch(s.scope); }}
            activeOpacity={0.5}
          >
            <Ionicons
              name="storefront-outline"
              size={22}
              color={isActive ? '#FF2D55' : '#8E8E93'}
            />
            <Text style={styles.modalLabel}>
              {sSlug}
            </Text>
            {isActive && <Ionicons name="checkmark" size={20} color="#FF2D55" />}
          </TouchableOpacity>
        );
      })}

      {storeScopes.length === 0 && !creating && (
        <Text style={styles.emptyText}>No stores yet</Text>
      )}

      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="store-name"
            placeholderTextColor="#C7C7CC"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.createBtn, loading && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={loading || !newName.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="checkmark" size={16} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.modalRow}
          onPress={() => setCreating(true)}
          activeOpacity={0.5}
        >
          <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
          <Text style={[styles.modalLabel, { color: '#007AFF' }]}>New Store</Text>
        </TouchableOpacity>
      )}
      <View style={styles.modalSep} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#1C1C1E',
    marginLeft: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    paddingVertical: 12,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  createInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0F0F0',
    marginTop: 16,
  },
});
