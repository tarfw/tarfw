import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';

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
  const { signOut, user } = useAuth();

  const handleCopy = (url: string) => {
    Alert.alert('Endpoint Copied', 'The API channel URL has been copied to your clipboard.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/login');
          } catch {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Relay</Text>
        <Text style={s.headerSub}>Connect external channels to TAR</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── CHANNELS ─── */}
        <Text style={s.sectionLabel}>CHANNELS</Text>

        <View style={s.card}>
          {CHANNELS.map((ch, i) => (
            <Pressable key={ch.id} onPress={() => handleCopy(ch.url)}>
              {({ pressed }) => (
                <View style={[s.row, pressed && s.rowPressed, i > 0 && s.rowBorder]}>
                  {/* icon */}
                  <View style={[s.channelIcon, { backgroundColor: ch.color }]}>
                    <Ionicons name={ch.icon} size={18} color="#fff" />
                  </View>

                  {/* text */}
                  <View style={s.rowText}>
                    <Text style={s.rowTitle}>{ch.title}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{ch.url}</Text>
                  </View>

                  {/* action */}
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

        {/* ─── ACCOUNT ─── */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>

        {/* User profile card */}
        {user && (
          <View style={s.profileCard}>
            {/* avatar + name */}
            <View style={s.profileRow}>
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarInitial}>
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.profileText}>
                <Text style={s.profileName}>{user.name ?? 'User'}</Text>
                <Text style={s.profileEmail}>{user.email}</Text>
              </View>
            </View>

            {/* user id */}
            <View style={s.idRow}>
              <Text style={s.idText}>ID: {user.id}</Text>
            </View>
          </View>
        )}

        {/* Sign out */}
        <Pressable onPress={handleSignOut}>
          {({ pressed }) => (
            <View style={[s.signOutBtn, pressed && s.signOutPressed]}>
              <Ionicons name="log-out-outline" size={19} color="#FF3B30" />
              <Text style={s.signOutText}>Sign Out</Text>
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
    paddingTop: 14,
    paddingBottom: 20,
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
    paddingBottom: 48,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#AEAEB2',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 2,
  },

  /* Channel card */
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

  /* Add channel */
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

  /* Profile card */
  profileCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DDDDF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5555AA',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  profileEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  idRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    backgroundColor: '#fff',
  },
  idText: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  /* Sign out */
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF4F3',
    borderRadius: 16,
    paddingVertical: 15,
  },
  signOutPressed: {
    backgroundColor: '#FFE5E3',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
  },
});
