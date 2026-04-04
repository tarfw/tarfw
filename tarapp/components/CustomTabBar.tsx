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
  Modal,
  FlatList,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAgentState } from '@/hooks/useAgentState';
import { StoreSwitcher } from './StoreSwitcher';
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const { setPickerVisible, setSearchVisible, isMemoryStateVisible, setMemoryStateVisible, selectedMemoryState, setSelectedMemoryState, activeScope, setActiveScope } = useAgentState();
  const isSitesMode = selectedMemoryState === 'sites';
  const renderIcon = (routeName: string, focused: boolean) => {
    const color = focused ? '#000' : '#ACACAC';
    const size = 24;
    switch (routeName) {
      case 'index':
        return <Feather name="circle" size={size} color={color} />;
      case 'memories':
        return <Ionicons name="cube-outline" size={size} color={color} />;
      case 'discover':
        return <Ionicons name="globe-outline" size={size} color={color} />;
      default:
        return null;
    }
  };

  const MEMORY_STATE_TYPES = [
    { type: 'sites', label: 'Sites', icon: 'globe-outline', color: '#007AFF' },
    { type: 'inventory', label: 'Inventory', icon: 'cube-outline', color: '#34C759' },
    { type: 'products', label: 'Products', icon: 'pricetag-outline', color: '#FF9500' },
    { type: 'sale', label: 'Sales', icon: 'cash-outline', color: '#AF52DE' },
    { type: 'pages', label: 'Pages', icon: 'document-text-outline', color: '#FF3B30' },
    { type: 'collection', label: 'Collections', icon: 'layers-outline', color: '#5856D6' }
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: keyboardVisible ? 0 : 0 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
    >
      <View style={[
        styles.wrapper,
        { 
          paddingBottom: keyboardVisible 
            ? (Platform.OS === 'android' ? keyboardHeight + 20 : 0) 
            : Math.max(insets.bottom, 8) 
        },
      ]}>


        {!keyboardVisible && (
          <View style={styles.bottomSection}>
            {/* FLOATING ACTION CLUSTER */}
            <View style={[styles.toggleCluster, { alignSelf: 'flex-end', backgroundColor: '#FFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' }]}>
              <TouchableOpacity
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setSearchVisible(true);
                }}
                activeOpacity={0.7}
                style={[styles.toggleTab, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
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
                style={[styles.toggleTab, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
              >
                <Ionicons name="arrow-up" size={20} color="#8E8E93" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  navigation.navigate('aiagents');
                }}
                activeOpacity={0.7}
                style={[styles.toggleTab, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
              >
                <Text style={{ fontWeight: '800', fontSize: 16, color: '#000' }}>AI</Text>
              </TouchableOpacity>
            </View>

            <BlurView intensity={80} tint="light" style={styles.barContainer}>
            <View style={styles.tabRow}>
              {/* LEFT SECTION: Toggle cluster for Workspace, Memories & Discover */}
              <View style={styles.leftSection}>
                <View style={styles.toggleCluster}>
                  {state.routes.filter(r => r.name !== 'agents').map((route) => {
                    const index = state.routes.indexOf(route);
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

              {/* CENTER SECTION: No Square */}
              <View style={styles.centerSection}>

              </View>

              {/* RIGHT SECTION: Memory State Selector in Bar */}
              <View style={styles.rightSection}>
                <TouchableOpacity
                  style={[styles.selectedMemoryStateContainer, { borderWidth: 0, paddingVertical: 4, backgroundColor: 'transparent' }]}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setMemoryStateVisible(true);
                  }}
                >
                  {selectedMemoryState ? (
                    <>
                      <Ionicons 
                        name={MEMORY_STATE_TYPES.find(t => t.type === selectedMemoryState)?.icon as any} 
                        size={14} 
                        color={MEMORY_STATE_TYPES.find(t => t.type === selectedMemoryState)?.color} 
                      />
                      <Text style={styles.selectedMemoryStateText}>
                        {MEMORY_STATE_TYPES.find(t => t.type === selectedMemoryState)?.label}
                      </Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="asterisk" size={12} color="#8E8E93" />
                      <Text style={styles.selectedMemoryStateText}>Memory</Text>
                    </>
                  )}
                  <Ionicons name="chevron-down" size={14} color="#8E8E93" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
          </View>
        )}
      </View>

      <Modal animationType="slide" visible={isMemoryStateVisible} onRequestClose={() => setMemoryStateVisible(false)}>
        <View style={styles.modalSafe}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
            <Text style={styles.modalTitle}>Memory State</Text>
            <TouchableOpacity onPress={() => setMemoryStateVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={[styles.modalList, { paddingBottom: Math.max(insets.bottom, 40) }]}>
            <StoreSwitcher activeScope={activeScope} onSwitch={(s) => { setActiveScope(s); setMemoryStateVisible(false); }} />
            
            <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
              <Text style={styles.sectionTitle}>TYPES</Text>
            </View>
            
            {MEMORY_STATE_TYPES.map(item => (
              <React.Fragment key={item.type}>
                <TouchableOpacity
                  style={[styles.modalRow, { paddingHorizontal: 20 }]}
                  activeOpacity={0.5}
                  onPress={() => {
                    setSelectedMemoryState(item.type);
                    setMemoryStateVisible(false);
                  }}
                >
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                  <Text style={styles.modalLabel}>{item.label}</Text>
                  {selectedMemoryState === item.type && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                </TouchableOpacity>
                <View style={[styles.modalSep, { marginHorizontal: 20 }]} />
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  bottomSection: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 8,
  },
  selectedMemoryStateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  selectedMemoryStateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
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
  modalSafe: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalList: {
    paddingBottom: 40,
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
  modalSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0F0F0',
  },
});
