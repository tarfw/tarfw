import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgentState } from '@/hooks/useAgentState';
import { generateEmbedding } from '@/src/lib/embeddings';
import { searchStates } from '@/src/db/turso';

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

export function AgentInput() {
  const { loading, setLoading, setResult, selectedMemoryState, activeScope, query, setQuery } = useAgentState();
  const isSitesMode = selectedMemoryState === 'sites';
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedQuery || debouncedQuery.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setSuggestionsLoading(true);
      try {
        const queryVector = await generateEmbedding(debouncedQuery);
        const searchResults = await searchStates(queryVector, activeScope || 'shop:main', 5);
        const aiSuggestions: Suggestion[] = [];
        
        const resultsArray = Array.isArray(searchResults) 
          ? searchResults 
          : (searchResults && (searchResults.results || searchResults.result)) || [];
        
        for (const result of resultsArray) {
          const ucode = result.ucode || result.streamid;
          const title = result.title || '';
          const typeKey = ucode?.split(':')[0];
          
          if (typeKey === 'product') {
            aiSuggestions.push({ text: `buy ${title}`, action: `buy ${title}`, type: 'item', ucode, title });
            aiSuggestions.push({ text: `show ${title}`, action: `show product ${title}`, type: 'info', ucode, title });
          } else if (typeKey === 'service') {
            aiSuggestions.push({ text: `book ${title}`, action: `book ${title}`, type: 'item', ucode, title });
          } else if (typeKey === 'task') {
            aiSuggestions.push({ text: `do ${title}`, action: `start task ${title}`, type: 'command', ucode, title });
            aiSuggestions.push({ text: `show task ${title}`, action: `show task ${title}`, type: 'info', ucode, title });
          }
        }

        const basicSuggestions = generateBasicSuggestions(debouncedQuery, searchResults);
        const allSuggestions = [...aiSuggestions, ...basicSuggestions].slice(0, 6);
        
        setSuggestions(allSuggestions);
        setShowSuggestions(allSuggestions.length > 0);
        
      } catch (err) {
        console.warn('Local autocomplete failed, using fallbacks:', err);
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

  const generateBasicSuggestions = (text: string, _results?: any[]): Suggestion[] => {
    const lower = text.toLowerCase();
    const suggestions: Suggestion[] = [];
    const patterns = [
      { prefix: 'search ', type: 'search' as const, examples: ['products', 'customers', 'memories'] },
      { prefix: 'find ', type: 'search' as const, examples: ['shoes', 'coffee', 'available items'] },
      { prefix: 'create ', type: 'create' as const, examples: ['product', 'task', 'category'] },
      { prefix: 'add ', type: 'create' as const, examples: ['new product', 'item to cart', 'customer'] },
      { prefix: 'show ', type: 'info' as const, examples: ['inventory', 'stats'] },
      { prefix: 'buy ', type: 'command' as const, examples: ['2 coffees', 'shoes size 9'] },
      { prefix: 'sell ', type: 'command' as const, examples: ['10 items', 'product'] },
    ];

    for (const pattern of patterns) {
      if (lower.startsWith(pattern.prefix) || lower === pattern.prefix.slice(0, -1)) {
        for (const example of pattern.examples) {
           suggestions.push({ text: pattern.prefix + example, action: pattern.prefix + example, type: pattern.type });
        }
      }
    }

    if (suggestions.length === 0) {
      const starters = [
        'search products', 'find coffee', 'create product', 'show inventory',
        'sell 2 shoes', 'add to cart', 'create task',
      ];
      const matched = starters
        .filter(s => s.startsWith(lower) || lower.length < 3)
        .slice(0, 5)
        .map(t => ({ text: t, type: 'command' as const }));
      suggestions.push(...matched);
    }
    return suggestions.slice(0, 5);
  };

  const handleSuggestionPress = useCallback(async (suggestion: Suggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]);
    
    if (!loading) {
      setLoading(true);
      setResult(null);
      try {
        const { sendChannelMessage } = await import('@/src/api/client');
        let action: 'DESIGN' | 'DESIGN_UPDATE' | undefined;
        if (isSitesMode && activeScope) action = 'DESIGN_UPDATE';
        else if (isSitesMode && !activeScope) action = 'DESIGN';

        const body: any = {
          channel: 'app_agent',
          userId: 'mobile_user_01',
          scope: activeScope || 'shop:main',
          text: suggestion.text,
        };
        if (action) body.action = action;
        
        const response = await sendChannelMessage(body);
        setResult(response);
        setQuery('');
      } catch (err: any) {
        setResult({ error: err.message });
      } finally {
        setLoading(false);
      }
    }
  }, [loading, setLoading, setResult, isSitesMode, activeScope, setQuery]);

  const handleAgentInput = async () => {
    if (!query || loading) return;
    setShowSuggestions(false);
    setSuggestions([]);
    setLoading(true);
    setResult(null);
    try {
      const { sendChannelMessage } = await import('@/src/api/client');
      let action: 'DESIGN' | 'DESIGN_UPDATE' | undefined;
      if (isSitesMode && activeScope) action = 'DESIGN_UPDATE';
      else if (isSitesMode && !activeScope) action = 'DESIGN';

      const body: any = {
        channel: 'app_agent',
        userId: 'mobile_user_01',
        scope: activeScope || 'shop:main',
        text: query,
      };
      if (action) body.action = action;

      const response = await sendChannelMessage(body);
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

  return (
    <View style={styles.inputContainer}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={
          isSitesMode && !activeScope
            ? "Describe your site… e.g. 'Create site'"
            : isSitesMode && activeScope
              ? "Describe changes… e.g. 'Edit site'"
              : "Type something..."
        }
        placeholderTextColor="#BCBCBC"
        multiline
        maxLength={500}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity key={index} style={styles.suggestionChip} onPress={() => handleSuggestionPress(suggestion)} activeOpacity={0.7}>
                <Ionicons name={getSuggestionIcon(suggestion.type) as any} size={14} color={getSuggestionColor(suggestion.type)} />
                <Text style={styles.suggestionText} numberOfLines={1}>{suggestion.text}</Text>
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
          <Pressable style={[styles.sendButton, loading && styles.sendButtonDisabled]} onPress={handleAgentInput} disabled={!query || loading}>
            <Ionicons name="arrow-up" size={18} color="#FFF" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    minHeight: 40,
    maxHeight: 120,
    padding: 0,
  },
  inputFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  suggestionsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  suggestionsScroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: 200 },
  suggestionText: { fontSize: 14, fontWeight: '500', color: '#1C1C1E', maxWidth: 140 },
  suggestionsLoading: { position: 'absolute', right: 0, top: 12 },
  sendButton: { width: 32, height: 32, backgroundColor: '#000', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#C7C7CC' },
});
