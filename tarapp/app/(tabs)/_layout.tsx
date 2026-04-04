import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text } from 'react-native';
import { CustomTabBar } from '@/components/CustomTabBar';
import { AgentProvider, useAgentState } from '@/hooks/useAgentState';
import { SearchMemories } from '@/components/searchmemories';

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
  const { isSearchVisible, setSearchVisible } = useAgentState();

  return (
    <>
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
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Workspace' }} />
          <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
          <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
        </Tabs>
      </View>
      <ErrorBoundary>
        <GlobalModals />
      </ErrorBoundary>
    </AgentProvider>
  );
}
