import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CHANNELS = [
  {
    id: 'telegram',
    title: 'Telegram Bot',
    url: 'https://taragent.wetarteam.workers.dev/api/channel',
    icon: 'paper-plane' as const,
    color: '#0088cc',
  },
  {
    id: 'slack',
    title: 'Slack Command',
    url: 'https://taragent.wetarteam.workers.dev/api/channel',
    icon: 'logo-slack' as const,
    color: '#4A154B',
  },
];

export default function RelayScreen() {
  const handleCopy = (text: string) => {
    Alert.alert("Endpoint Copied", "The API channel URL has been copied to your clipboard.");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relay</Text>
        <Text style={styles.headerSub}>Connect your external channels to the TAR framework</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {CHANNELS.map((item) => (
          <Pressable 
            key={item.id}
            style={({pressed}) => [
              styles.card, 
              pressed && styles.cardPressed
            ]}
            onPress={() => handleCopy(item.url)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={24} color="#FFF" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.statusTag}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
              <Ionicons name="copy-outline" size={20} color="#AEAEB2" />
            </View>

            <View style={styles.divider} />

            <View style={styles.urlContainer}>
              <Text style={styles.urlLabel}>ENDPOINT URL</Text>
              <Text style={styles.itemUrl} numberOfLines={1} ellipsizeMode="tail">
                {item.url}
              </Text>
            </View>
          </Pressable>
        ))}
        
        {/* Placeholder for adding more items */}
        <Pressable style={styles.addCard}>
          <Ionicons name="add-circle-outline" size={24} color="#ACACAC" />
          <Text style={styles.addCardText}>Configure New Channel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 16,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  cardPressed: {
    backgroundColor: '#F2F2F7',
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75915',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
  },
  urlContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  urlLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AEAEB2',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  itemUrl: {
    fontSize: 13,
    color: '#48484A',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 10,
  },
  addCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
