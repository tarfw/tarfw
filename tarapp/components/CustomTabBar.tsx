import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAgentState } from '@/hooks/useAgentState';
import { generateEmbedding } from '@/src/lib/embeddings';
import { searchStates, getAllStates } from '@/src/db/turso';

interface Suggestion {
  text: string;
  action?: string;
  type?: 'command' | 'search' | 'create' | 'info' | 'item';
  ucode?: string;
  title?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isAgentsTab = state.routes[state.index]?.name === 'agents';
  const { visible: keyboardVisible } = useKeyboard();
  const { loading, setLoading, setResult, setPickerVisible, setSearchVisible } = useAgentState();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<TextInput>(null);

  // Fetch suggestions using local embeddings + Turso semantic search
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedQuery || debouncedQuery.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setSuggestionsLoading(true);
      try {
        // Step 1: Generate embedding locally using MiniLM model
        const queryVector = await generateEmbedding(debouncedQuery);
        
        // Step 2: Search local Turso database for similar states
        const searchResults = await searchStates(queryVector, 'shop:main', 5);
        
        // Step 3: Generate suggestions from search results
        const aiSuggestions: Suggestion[] = [];
        
        for (const result of searchResults) {
          const ucode = result.ucode || result.streamid;
          const title = result.title || '';
          const typeKey = ucode?.split(':')[0];
          
          // Generate contextual suggestions based on matched items
          if (typeKey === 'product') {
            aiSuggestions.push({
              text: `buy ${title}`,
              action: `buy ${title}`,
              type: 'item',
              ucode,
              title,
            });
            aiSuggestions.push({
              text: `show ${title}`,
              action: `show product ${title}`,
              type: 'info',
              ucode,
              title,
            });
          } else if (typeKey === 'service') {
            aiSuggestions.push({
              text: `book ${title}`,
              action: `book ${title}`,
              type: 'item',
              ucode,
              title,
            });
          } else if (typeKey === 'task') {
            aiSuggestions.push({
              text: `do ${title}`,
              action: `start task ${title}`,
              type: 'command',
              ucode,
              title,
            });
            aiSuggestions.push({
              text: `show task ${title}`,
              action: `show task ${title}`,
              type: 'info',
              ucode,
              title,
            });
          } else if (typeKey === 'order') {
            aiSuggestions.push({
              text: `track order ${title}`,
              action: `track ${title}`,
              type: 'info',
              ucode,
              title,
            });
          }
        }

        // Add basic pattern suggestions as fallback
        const basicSuggestions = generateBasicSuggestions(debouncedQuery, searchResults);
        
        // Combine AI suggestions with basic ones (AI suggestions first)
        const allSuggestions = [...aiSuggestions, ...basicSuggestions].slice(0, 6);
        
        setSuggestions(allSuggestions);
        setShowSuggestions(allSuggestions.length > 0);
        
      } catch (err) {
        console.warn('Local autocomplete failed, using fallbacks:', err);
        // Fallback suggestions on error - still try basic patterns
        try {
          const basicSuggestions = generateBasicSuggestions(debouncedQuery, []);
          setSuggestions(basicSuggestions);
          setShowSuggestions(basicSuggestions.length > 0);
        } catch (fallbackErr) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setSuggestionsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // Generate basic suggestions based on common patterns
  const generateBasicSuggestions = (text: string, _results?: any[]): Suggestion[] => {
    const lower = text.toLowerCase();
    const suggestions: Suggestion[] = [];

    const patterns = [
      { prefix: 'search ', type: 'search' as const, examples: ['products', 'orders', 'customers', 'memories'] },
      { prefix: 'find ', type: 'search' as const, examples: ['shoes', 'coffee', 'available items'] },
      { prefix: 'create ', type: 'create' as const, examples: ['product', 'order', 'task', 'category'] },
      { prefix: 'add ', type: 'create' as const, examples: ['new product', 'item to cart', 'customer'] },
      { prefix: 'show ', type: 'info' as const, examples: ['my orders', 'inventory', 'stats'] },
      { prefix: 'buy ', type: 'command' as const, examples: ['2 coffees', 'shoes size 9'] },
      { prefix: 'sell ', type: 'command' as const, examples: ['10 items', 'product'] },
    ];

    for (const pattern of patterns) {
      if (lower.startsWith(pattern.prefix) || lower === pattern.prefix.slice(0, -1)) {
        for (const example of pattern.examples) {
          suggestions.push({
            text: pattern.prefix + example,
            action: pattern.prefix + example,
            type: pattern.type,
          });
        }
      }
    }

    // If no pattern matched, show common starter commands
    if (suggestions.length === 0) {
      const starters = [
        'search products',
        'find coffee',
        'create product',
        'show my orders',
        'sell 2 shoes',
        'add to cart',
        'show inventory',
        'create task',
      ];
      const matched = starters
        .filter(s => s.startsWith(lower) || lower.length < 3)
        .slice(0, 5)
        .map(text => ({ text, type: 'command' as const }));
      suggestions.push(...matched);
    }

    return suggestions.slice(0, 5);
  };

  const handleSuggestionPress = useCallback(async (suggestion: Suggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Execute the suggestion immediately
    if (!loading) {
      setLoading(true);
      setResult(null);
      try {
        const r = await fetch('https://taragent.wetarteam.workers.dev/api/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'app_agent',
            userId: 'mobile_user_01',
            scope: 'shop:main',
            text: suggestion.text,
          }),
        });
        const response = await r.json();
        setResult(response);
        setQuery('');
      } catch (err: any) {
        setResult({ error: err.message });
      } finally {
        setLoading(false);
      }
    }
  }, [loading, setLoading, setResult]);

  const handleAgentInput = async () => {
    if (!query || loading) return;
    setShowSuggestions(false);
    setSuggestions([]);
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('https://taragent.wetarteam.workers.dev/api/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'app_agent',
          userId: 'mobile_user_01',
          scope: 'shop:main',
          text: query,
        }),
      });
      const response = await r.json();
      setResult(response);
      setQuery('');
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getSuggestionIcon = (type?: string) => {
    switch (type) {
      case 'search': return 'search';
      case 'create': return 'add-circle';
      case 'info': return 'information-circle';
      default: return 'flash';
    }
  };

  const getSuggestionColor = (type?: string) => {
    switch (type) {
      case 'search': return '#007AFF';
      case 'create': return '#34C759';
      case 'info': return '#FF9500';
      default: return '#5856D6';
    }
  };

  const renderIcon = (routeName: string, focused: boolean) => {
    const color = focused ? '#000' : '#ACACAC';
    const size = 24;
    switch (routeName) {
      case 'index':
        return <Feather name="circle" size={size} color={color} />;
      case 'agents':
        return <Feather name="square" size={size} color={color} />;
      case 'memories':
        return <Ionicons name="cube-outline" size={size} color={color} />;
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[
        styles.wrapper,
        { paddingBottom: keyboardVisible ? 0 : Math.max(insets.bottom, 8) },
      ]}>
        {isAgentsTab && (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Type something..."
              placeholderTextColor="#BCBCBC"
              multiline
              maxLength={500}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                // Delay hiding to allow suggestion press
                setTimeout(() => setShowSuggestions(false), 200);
              }}
            />
            
            {/* AI Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsScroll}
                >
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => handleSuggestionPress(suggestion)}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={getSuggestionIcon(suggestion.type) as any} 
                        size={14} 
                        color={getSuggestionColor(suggestion.type)} 
                      />
                      <Text style={styles.suggestionText} numberOfLines={1}>
                        {suggestion.text}
                      </Text>
                      <Ionicons name="arrow-forward-outline" size={12} color="#C7C7CC" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {suggestionsLoading && (
                  <View style={styles.suggestionsLoading}>
                    <ActivityIndicator size="small" color="#8E8E93" />
                  </View>
                )}
              </View>
            )}
            
            {query.length > 0 && (
              <View style={styles.inputFooter}>
                <Pressable
                  style={[
                    styles.sendButton,
                    loading && styles.sendButtonDisabled,
                  ]}
                  onPress={handleAgentInput}
                  disabled={!query || loading}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFF" />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {!keyboardVisible && (
          <BlurView intensity={80} tint="light" style={styles.barContainer}>
            <View style={styles.tabRow}>
              {/* LEFT SECTION: Toggle cluster for Workspace & Memories */}
              <View style={styles.leftSection}>
                <View style={styles.toggleCluster}>
                  {state.routes.slice(0, 2).map((route, index) => {
                    const isFocused = state.index === index;
                    const onPress = () => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                      });
                      if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        activeOpacity={0.7}
                        style={[
                          styles.toggleTab,
                          isFocused && styles.toggleTabActive,
                        ]}
                      >
                        {renderIcon(route.name, isFocused)}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* CENTER SECTION: Agents Tab */}
              <View style={styles.centerSection}>
                {(() => {
                  const route = state.routes[2];
                  const isFocused = state.index === 2;
                  const onPress = () => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    navigation.navigate(route.name);
                  };
                  return (
                    <TouchableOpacity
                      onPress={onPress}
                      activeOpacity={0.7}
                      style={styles.mainTab}
                    >
                      {renderIcon(route.name, isFocused)}
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* RIGHT SECTION: Relay & Add Button */}
              <View style={styles.rightSection}>
                <View style={styles.toggleCluster}>
                  <TouchableOpacity
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setSearchVisible(true);
                    }}
                    activeOpacity={0.7}
                    style={styles.toggleTab}
                  >
                    <Ionicons name="search" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                    style={styles.toggleTab}
                  >
                    <Ionicons name="arrow-up" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </BlurView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    paddingTop: 10,
  },
  barContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  toggleCluster: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 14,
    padding: 3,
    gap: 2,
  },
  toggleTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTabActive: {
    backgroundColor: '#FFF',
    // Removed elevation and shadow as requested
  },
  mainTab: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    minHeight: 72,
    maxHeight: 120,
    padding: 0,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  suggestionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: 200,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    maxWidth: 140,
  },
  suggestionsLoading: {
    position: 'absolute',
    right: 0,
    top: 12,
  },
  sendButton: {
    width: 32,
    height: 32,
    backgroundColor: '#000',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});
