import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import Trace from '../../src/screens/trace';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TraceScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Trace />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
