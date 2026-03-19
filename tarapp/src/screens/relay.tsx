import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
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
    Alert.alert("Copied Endpoint", text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relay</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.list}>
          {CHANNELS.map((item, index) => (
            <Pressable 
              key={item.id}
              style={({pressed}) => [
                styles.listItem, 
                pressed && styles.itemPressed,
                index === CHANNELS.length - 1 && styles.lastItem
              ]}
              onPress={() => handleCopy(item.url)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemUrl} numberOfLines={1} ellipsizeMode="middle">
                  {item.url}
                </Text>
              </View>

              <Ionicons name="copy-outline" size={18} color="#C7C7CC" />
            </Pressable>
          ))}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  list: {
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  itemPressed: {
    backgroundColor: '#F2F2F7',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  itemUrl: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: 'monospace',
  },
});
