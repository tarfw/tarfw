import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [handle, setHandle] = useState('tarfw');

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
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        {user && (
          <View style={s.profileSection}>
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
        )}

        {/* Handle Section */}
        <View style={s.handleSection}>
          <Text style={s.label}>Handle</Text>
          <TextInput
            style={s.handleInput}
            value={handle}
            onChangeText={setHandle}
            placeholder="handle"
            placeholderTextColor="#AEAEB2"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity style={s.continueBtn} activeOpacity={0.7}>
            <Text style={s.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Preview Section */}
        <View style={s.previewCard}>
          <View style={s.previewItem}>
            <Text style={s.previewTitle}>App</Text>
            <Text style={s.previewLink}>{handle || 'handle'}.tarai.space</Text>
          </View>

          <View style={s.previewItem}>
            <Text style={s.previewTitle}>Space</Text>
            <Text style={s.previewLink}>{handle || 'handle'}.tarai.space/me</Text>
          </View>

          <View style={s.previewItem}>
            <Text style={s.previewTitle}>Email</Text>
            <Text style={s.previewLink}>{handle || 'handle'}@tarai.space</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Pressable onPress={handleSignOut}>
            {({ pressed }) => (
              <View style={[s.signOutBtn, pressed && s.signOutPressed]}>
                <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
                <Text style={s.signOutText}>Sign Out</Text>
              </View>
            )}
          </Pressable>
          <Text style={s.idText}>ID: {user?.id}</Text>
        </View>
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
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  profileEmail: {
    fontSize: 13,
    color: '#8E8E93',
  },

  // Handle Input
  handleSection: {
    marginBottom: 20,
  },
  label: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  handleInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#111',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  continueBtn: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '700',
  },

  // Preview List
  previewCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    color: '#AEAEB2',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  previewLink: {
    color: '#3A3A3C',
    fontSize: 14,
    fontWeight: '500',
  },

  // Footer
  footer: {
    marginTop: 10,
    gap: 16,
  },
  idText: {
    fontSize: 10,
    color: '#C7C7CC',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF8F7',
    borderRadius: 16,
    paddingVertical: 14,
  },
  signOutPressed: {
    backgroundColor: '#FFEBEA',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },
});
