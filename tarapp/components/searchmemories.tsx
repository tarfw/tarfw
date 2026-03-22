import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';
import { BlurView } from 'expo-blur';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SearchMemories({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { search, loading, result, setResult } = useAgentState();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResult(null);
    }
  }, [visible]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        search(query);
      } else {
        setResult(null);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.resultItem}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="cube-outline" size={20} color="#8E8E93" />
      </View>
      <Text style={styles.resultText} numberOfLines={1}>
        {item.title || item.ucode}
      </Text>
    </TouchableOpacity>
  );

  const recentlyViewed = [
    "public and private schema",
    "Chennai-scale on Turso managed cloud",
    "Events table schema",
    "TAR-AI MASTER OPCODE TABLE",
    "Nodes, Actors, Points, OR & Collab",
    "tar app",
    "GPUs"
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.headerTitle}>Search</Text>
          <TouchableOpacity style={styles.headerAction}>
            <Feather name="edit" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scroll} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {loading && !result && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#000" />
            </View>
          )}

          {result?.result && (
            <View>
              <Text style={styles.sectionTitle}>
                {query ? 'Results' : 'Available Memories'}
              </Text>
              {result.result.map((item: any) => (
                <TouchableOpacity key={item.ucode || item.id} style={styles.resultItem}>
                  <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name="cube-outline" size={20} color="#8E8E93" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultText} numberOfLines={1}>
                      {item.title || item.ucode}
                    </Text>
                    <Text style={styles.resultSubtext} numberOfLines={1}>
                      {item.ucode}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.searchBarContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.searchInputRow}>
            <View style={styles.searchIconWrapper}>
              <Ionicons name="search" size={20} color="#000" />
            </View>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Search workspace"
              placeholderTextColor="#BCBCBC"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <TouchableOpacity 
              style={styles.closeIconWrapper} 
              onPress={() => {
                if (query) setQuery('');
                else onClose();
              }}
            >
              <Ionicons name="close" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 16,
    marginTop: 10,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  resultSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  loadingContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  keyboardView: {
    // No absolute positioning here so it can push up
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 6,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  searchIconWrapper: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    paddingRight: 10,
  },
  closeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
