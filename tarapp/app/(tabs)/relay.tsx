import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import Relay from '../../src/screens/relay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RelayTab() {
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Relay />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
