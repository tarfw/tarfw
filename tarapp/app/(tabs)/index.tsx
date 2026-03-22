import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import Workspace from '../../src/screens/workspace';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Workspace />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
