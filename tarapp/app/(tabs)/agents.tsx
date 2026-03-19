import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import AIAgents from '../../src/screens/aiagents';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AgentsTab() {
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <AIAgents />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
