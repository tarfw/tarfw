import { Tabs } from 'expo-router';
import React from 'react';
import { CustomTabBar } from '@/components/CustomTabBar';
import { AgentProvider } from '@/hooks/useAgentState';

export default function TabLayout() {
  return (
    <AgentProvider>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Trace' }} />
        <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
        <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
        <Tabs.Screen name="relay" options={{ title: 'Relay' }} />
      </Tabs>
    </AgentProvider>
  );
}
