import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();

  const handleCopy = (url: string) => {
    Alert.alert('Endpoint Copied', 'The API channel URL has been copied to your clipboard.');
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Channels</Text>
        <Text style={s.headerSub}>Connect external channels to TAR</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>CHANNELS</Text>

        <View style={s.card}>
          {CHANNELS.map((ch, i) => (
            <Pressable key={ch.id} onPress={() => handleCopy(ch.url)}>
              {({ pressed }) => (
                <View style={[s.row, pressed && s.rowPressed, i > 0 && s.rowBorder]}>
                  <View style={[s.channelIcon, { backgroundColor: ch.color }]}>
                    <Ionicons name={ch.icon} size={18} color="#fff" />
                  </View>

                  <View style={s.rowText}>
                    <Text style={s.rowTitle}>{ch.title}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{ch.url}</Text>
                  </View>

                  <Ionicons name="copy-outline" size={17} color="#C7C7CC" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <Pressable style={s.addBtn}>
          {({ pressed }) => (
            <View style={[s.addBtnInner, pressed && { opacity: 0.6 }]}>
              <Ionicons name="add" size={18} color="#0C5027" />
              <Text style={s.addBtnText}>Add Channel</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backBtn: {
    marginBottom: 8,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#AEAEB2',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 2,
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F7F7F7',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  rowPressed: {
    backgroundColor: '#EFEFEF',
  },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  rowSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  addBtn: {
    marginBottom: 28,
  },
  addBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C5027',
  },
});
