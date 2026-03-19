import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAgentState } from '@/hooks/useAgentState';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isAgentsTab = state.routes[state.index]?.name === 'agents';
  const { visible: keyboardVisible } = useKeyboard();
  const { loading, setLoading, setResult } = useAgentState();

  const [query, setQuery] = useState('');

  const handleAgentInput = async () => {
    if (!query || loading) return;
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

  const renderIcon = (routeName: string, focused: boolean) => {
    const color = focused ? '#000' : '#ACACAC';
    const size = 24;
    switch (routeName) {
      case 'index':
        return <Feather name="circle" size={size} color={color} />;
      case 'agents':
        return <Feather name="square" size={size} color={color} />;
      case 'memories':
        return <Ionicons name="albums-outline" size={size} color={color} />;
      case 'relay':
        return <MaterialCommunityIcons name="asterisk" size={size} color={color} />;
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
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Type something..."
              placeholderTextColor="#BCBCBC"
              multiline
              maxLength={500}
            />
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
              {state.routes.map((route, index) => {
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
                    accessibilityRole="button"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    onPress={onPress}
                    activeOpacity={0.7}
                    style={styles.tab}
                  >
                    {renderIcon(route.name, isFocused)}
                  </TouchableOpacity>
                );
              })}
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
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
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
