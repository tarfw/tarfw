import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { CustomTabBar } from '@/components/CustomTabBar';
import { AgentProvider, useAgentState } from '@/hooks/useAgentState';
import { AddMemories } from '@/components/addmemories';
import { SearchMemories } from '@/components/searchmemories';
import { CrudMemories } from '@/components/crudmemories';
import { StateTypeDef } from '@/src/config/stateSchemas';

function GlobalModals() {
  const { isPickerVisible, setPickerVisible, createState, isSearchVisible, setSearchVisible } = useAgentState();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<StateTypeDef | null>(null);

  const handleTypeSelect = (type: StateTypeDef) => {
    setSelectedType(type);
    setPickerVisible(false);
    setShowForm(true);
  };

  const handleSubmit = async (ucode: string, title: string, payload: Record<string, any>) => {
    await createState(ucode, title, payload);
    setShowForm(false);
  };

  return (
    <>
      <AddMemories
        visible={isPickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleTypeSelect}
      />
      <CrudMemories
        visible={showForm}
        stateType={selectedType}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
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
        <Tabs.Screen name="relay" options={{ title: 'Relay' }} />
      </Tabs>
      <GlobalModals />
    </AgentProvider>
  );
}
