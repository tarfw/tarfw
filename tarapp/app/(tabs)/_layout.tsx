import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { CustomTabBar } from '@/components/CustomTabBar';
import { AgentProvider, useAgentState } from '@/hooks/useAgentState';
import { AddMemories } from '@/components/addmemories';
import { SearchMemories } from '@/components/searchmemories';
import { CrudMemories } from '@/components/crudmemories';
import { InstanceFormModal } from '@/components/InstanceFormModal';
import { StateTypeDef } from '@/src/config/stateSchemas';

function GlobalModals() {
  const { isPickerVisible, setPickerVisible, createState, isSearchVisible, setSearchVisible, addInstance } = useAgentState();
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
    </>
  );
}

export default function TabLayout() {
  return (
    <AgentProvider>
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
      <GlobalModals />
    </AgentProvider>
  );
}
