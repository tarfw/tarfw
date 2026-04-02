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
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const slug = activeScope ? activeScope.replace('shop:', '') : null;

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

  if (!open) {
    return (
      <TouchableOpacity
        style={slug ? styles.pill : styles.pillMuted}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="storefront-outline"
          size={14}
          color={slug ? '#FF2D55' : '#8E8E93'}
        />
        <Text style={slug ? styles.pillText : styles.pillTextMuted}>
          {slug || 'No store'}
        </Text>
        <Ionicons name="chevron-down" size={12} color="#8E8E93" />
      </TouchableOpacity>
    );
  }

  const storeScopes = scopes.filter(s => s && s.scope && s.scope !== 'shop:main');

  return (
    <View style={styles.dropdown}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Stores</Text>
        <TouchableOpacity onPress={() => { setOpen(false); setCreating(false); }} hitSlop={8}>
          <Ionicons name="close" size={18} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Scope list */}
      {storeScopes.map(s => {
        const sSlug = (s.scope || '').replace('shop:', '');
        const isActive = s.scope === activeScope;
        return (
          <TouchableOpacity
            key={s.scope}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={() => { onSwitch(s.scope); setOpen(false); }}
          >
            <Ionicons
              name="storefront-outline"
              size={16}
              color={isActive ? '#FF2D55' : '#1C1C1E'}
            />
            <Text style={[styles.itemText, isActive && styles.itemTextActive]}>
              {sSlug}
            </Text>
            <Text style={styles.roleBadge}>{s.role}</Text>
            {isActive && <Ionicons name="checkmark" size={16} color="#FF2D55" />}
          </TouchableOpacity>
        );
      })}

      {storeScopes.length === 0 && !creating && (
        <Text style={styles.emptyText}>No stores yet</Text>
      )}

      {/* Create new store */}
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
          style={styles.newStoreBtn}
          onPress={() => setCreating(true)}
        >
          <Ionicons name="add" size={16} color="#007AFF" />
          <Text style={styles.newStoreBtnText}>New Store</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF2D55',
  },
  pillTextMuted: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  dropdown: {
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 8,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: '#FFF0F3',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  itemTextActive: {
    color: '#FF2D55',
  },
  roleBadge: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '600',
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
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  createBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  newStoreBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
});
