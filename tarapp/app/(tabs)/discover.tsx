import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import DiscoverScreen from '../../src/screens/discover';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiscoverTab() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <DiscoverScreen />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
