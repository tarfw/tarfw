import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TokensScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.content}>
        <View style={styles.topSection}>
          {/* Tokens Available Section */}
          <View style={styles.statGroup}>
            <Text style={styles.sectionTitle}>Tokens Available</Text>
            <Text style={styles.statValue}>374,248</Text>
          </View>

          {/* Tokens Used Section */}
          <View style={[styles.statGroup, { marginTop: 60 }]}>
            <Text style={styles.sectionTitle}>Tokens Used</Text>
            <View style={styles.row}>
              <Text style={styles.usedStatValue}>12,450</Text>
              <Text style={styles.historyLabel}>History</Text>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* Divider above Add Tokens (At Bottom) */}
        <View style={styles.divider} />

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.addTokensText}>Add Tokens</Text>
          <Text style={styles.footerLabel}>Token Purchase History</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean white background
  },
  content: {
    flex: 1,
    paddingHorizontal: 28, // Increased for better breathing room
    paddingTop: 40,
    paddingBottom: 40,
  },
  topSection: {
    flex: 0,
  },
  statGroup: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 72,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  usedStatValue: {
    fontSize: 32,
    fontWeight: '400',
    color: '#000',
    letterSpacing: -0.5,
    marginTop:-2
  },
  historyLabel: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.5)',
    fontWeight: '500',
    marginLeft: 12, // Space between number and history
  },
  spacer: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 60,
    marginBottom: 40,
  },
  bottomSection: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  addTokensText: {
    fontSize: 48, // Reduced slightly to avoid clipping
    fontWeight: '700',
    color: '#000',
    letterSpacing: -1, // Safer letter spacing
    marginBottom: 10,
  },
  footerLabel: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.4)',
    fontWeight: '500',
  },
});
