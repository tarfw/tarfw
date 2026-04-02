import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { CustomTabBar } from '@/components/CustomTabBar';
import { StoreSwitcher } from '@/components/StoreSwitcher';
import { AgentProvider, useAgentState } from '@/hooks/useAgentState';
import { AddMemories } from '@/components/addmemories';
import { SearchMemories } from '@/components/searchmemories';
import { CrudMemories } from '@/components/crudmemories';
import { MemoryStateModal } from '@/components/MemoryStateModal';
import { InstanceFormModal } from '@/components/InstanceFormModal';
import { StateTypeDef } from '@/src/config/stateSchemas';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error: String(error?.message || error) };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[ErrorBoundary] Caught error:', error?.message, error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ padding: 20, backgroundColor: '#FF3B30' }}>
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
            GlobalModals Error: {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function GlobalModals() {
  const { isPickerVisible, setPickerVisible, createState, isSearchVisible, setSearchVisible, addInstance, isMemoryStateVisible, setMemoryStateVisible, setSelectedMemoryState } = useAgentState();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<StateTypeDef | null>(null);
  
  // Instance modal state
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [selectedStateForInstance, setSelectedStateForInstance] = useState<{ ucode: string; title: string } | null>(null);

  const handleTypeSelect = (type: StateTypeDef) => {
    setSelectedType(type);
    setPickerVisible(false);
    setShowForm(true);
  };

  const handleSelectStateForInstance = (state: { ucode: string; title: string }) => {
    setSelectedStateForInstance(state);
    setPickerVisible(false);
    setShowInstanceModal(true);
  };

  const handleSubmit = async (ucode: string, title: string, payload: Record<string, any>) => {
    await createState(ucode, title, payload);
    setShowForm(false);
  };

  const handleInstanceSubmit = async (data: any) => {
    if (data.stateid) {
      await addInstance(data);
    }
    setShowInstanceModal(false);
  };

  return (
    <>
      <AddMemories
        visible={isPickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleTypeSelect}
        onSelectStateForInstance={handleSelectStateForInstance}
      />
      <CrudMemories
        visible={showForm}
        stateType={selectedType}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
      />
      <InstanceFormModal
        visible={showInstanceModal}
        stateUcode={selectedStateForInstance?.ucode || ''}
        stateTitle={selectedStateForInstance?.title || ''}
        existingInstance={undefined}
        onClose={() => {
          setShowInstanceModal(false);
          setSelectedStateForInstance(null);
        }}
        onSubmit={handleInstanceSubmit}
        onDelete={undefined}
      />
      <SearchMemories
        visible={isSearchVisible}
        onClose={() => setSearchVisible(false)}
      />
      <MemoryStateModal
        visible={isMemoryStateVisible}
        onClose={() => setMemoryStateVisible(false)}
        onSelect={(type) => {
          console.log('[GlobalModals] Selected type from MemoryStateModal:', type);
          setSelectedMemoryState(type);
        }}
      />
    </>
  );
}

function StoreHeader() {
  const { activeScope, setActiveScope } = useAgentState();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, backgroundColor: '#FFF' }}>
      <StoreSwitcher activeScope={activeScope} onSwitch={setActiveScope} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <AgentProvider>
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <StoreHeader />
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Workspace' }} />
          <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
          <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
        </Tabs>
      </View>
      <ErrorBoundary>
        <GlobalModals />
      </ErrorBoundary>
    </AgentProvider>
  );
}
