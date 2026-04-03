import { StyleSheet, KeyboardAvoidingView, Platform, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import AIAgents from '@/src/screens/aiagents';
import { AgentInput } from '@/components/AgentInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AgentsModal() {
  const insets = useSafeAreaInsets();
  
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ThemedView style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={{ flex: 1 }}>
          <AIAgents />
        </View>
        <AgentInput />
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
