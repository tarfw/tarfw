import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import MemoriesScreen from '../../src/screens/memories';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MemoriesTab() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <MemoriesScreen />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
