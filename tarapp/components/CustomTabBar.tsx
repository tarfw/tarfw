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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useAgentState } from '@/hooks/useAgentState';
import { StoreSwitcher } from './StoreSwitcher';
import { InstancesModal } from './InstancesModal';
import { AddProductModal } from './AddProductModal';
import { ProductsListModal } from './ProductsListModal';
import TokensScreen from '@/app/tokens';
import ChannelsScreen from '@/app/channels';
import ProfileScreen from '@/app/profile';
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const { setSearchVisible, isMemoryStateVisible, setMemoryStateVisible, selectedMemoryState, setSelectedMemoryState, activeScope, setActiveScope, setQuery } = useAgentState();
  const isSitesMode = selectedMemoryState === 'sites';
  
  const [activeModalTitle, setActiveModalTitle] = useState<string | null>(null);
  const [addProductVisible, setAddProductVisible] = useState(false);
  const [productsListVisible, setProductsListVisible] = useState(false);
  const [tokenStatsVisible, setTokenStatsVisible] = useState(false);
  const [channelsVisible, setChannelsVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  const MEMORY_STATE_TYPES = [
    { type: 'storefront', label: 'Storefront', icon: 'storefront-outline', color: '#FF2D55' },
    { type: 'sites', label: 'Pages', icon: 'globe-outline', color: '#007AFF' },
    { type: 'inventory', label: 'Inventory', icon: 'cube-outline', color: '#34C759' },
    { type: 'products', label: 'Products', icon: 'pricetag-outline', color: '#FF9500' },
    { type: 'sale', label: 'Sales', icon: 'cash-outline', color: '#AF52DE' },
    { type: 'collection', label: 'Collections', icon: 'layers-outline', color: '#5856D6' },
    { type: 'tokens', label: 'Tokens', icon: 'server-outline', color: '#FF9500' },
    { type: 'channels', label: 'Channels', icon: 'paper-plane-outline', color: '#0088cc' },
    { type: 'peoples', label: 'Peoples', icon: 'people-outline', color: '#FF2D55' },
    { type: 'profile', label: 'Profile', icon: 'person-outline', color: '#8E8E93' }
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
            : Math.max(insets.bottom, 8) + 12 
        },
      ]}>


        {!keyboardVisible && (
          <View style={styles.bottomSection}>
            {selectedMemoryState === 'storefront' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    navigation.navigate('aiagents');
                    setQuery("Create storefront ");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Create Site</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    navigation.navigate('aiagents');
                    setQuery("Edit storefront ");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Sites</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {selectedMemoryState === 'sale' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                {['Tables', 'Quick Sale'].map((card) => (
                  <TouchableOpacity
                    key={card}
                    style={styles.suggestionCard}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setActiveModalTitle(card);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionCardText}>{card}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedMemoryState === 'products' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setAddProductVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Add Product</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setProductsListVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Products</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {selectedMemoryState === 'channels' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setChannelsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Channels</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {selectedMemoryState === 'profile' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setProfileVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Profile</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {selectedMemoryState === 'tokens' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionCardsScroll}
                style={styles.suggestionCardsContainer}
              >
                <TouchableOpacity
                  style={styles.suggestionCard}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setTokenStatsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionCardText}>Token Stats</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <BlurView intensity={80} tint="light" style={styles.barContainer}>
            <View style={styles.tabRow}>
              {/* LEFT SECTION: Workspace tab + Search + AI */}
              <View style={styles.leftSection}>
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
                      navigation.navigate('aiagents');
                    }}
                    activeOpacity={0.7}
                    style={styles.toggleTab}
                  >
                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#000' }}>AI</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* RIGHT SECTION: Memory State Selector in Bar */}
              <View style={styles.rightSection}>
                <TouchableOpacity
                  style={[styles.selectedMemoryStateContainer, { borderWidth: 0, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 14 }]}
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
                        size={20}
                        color={MEMORY_STATE_TYPES.find(t => t.type === selectedMemoryState)?.color}
                      />
                      <Text style={[styles.selectedMemoryStateText, { fontSize: 15 }]}>
                        {MEMORY_STATE_TYPES.find(t => t.type === selectedMemoryState)?.label}
                      </Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="asterisk" size={16} color="#8E8E93" />
                      <Text style={[styles.selectedMemoryStateText, { fontSize: 15 }]}>Memory</Text>
                    </>
                  )}
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

      <InstancesModal
        visible={activeModalTitle !== null}
        onClose={() => setActiveModalTitle(null)}
        title={activeModalTitle || ''}
        activeScope={activeScope || 'shop:main'}
      />

      <AddProductModal
        visible={addProductVisible}
        onClose={() => setAddProductVisible(false)}
      />

      <ProductsListModal
        visible={productsListVisible}
        onClose={() => setProductsListVisible(false)}
      />

      <Modal animationType="slide" visible={tokenStatsVisible} onRequestClose={() => setTokenStatsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
            <Text style={styles.modalTitle}>Token Stats</Text>
            <TouchableOpacity onPress={() => setTokenStatsVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <TokensScreen />
        </View>
      </Modal>

      <Modal animationType="slide" visible={channelsVisible} onRequestClose={() => setChannelsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
            <Text style={styles.modalTitle}>Channels</Text>
            <TouchableOpacity onPress={() => setChannelsVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <ChannelsScreen />
        </View>
      </Modal>

      <Modal animationType="slide" visible={profileVisible} onRequestClose={() => setProfileVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
            <Text style={styles.modalTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setProfileVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <ProfileScreen />
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
  suggestionCardsContainer: {
    width: '100%',
    marginBottom: 4,
  },
  suggestionCardsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionCard: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  suggestionCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
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
