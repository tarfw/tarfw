import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

export default function LoginScreen() {
  const { signIn, isLoading, isSignedIn } = useAuth();

  // If already signed in, redirect to main app
  React.useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn]);

  const handleSignIn = async () => {
    try {
      await signIn();
      // Explicitly navigate after success (safety net alongside the useEffect)
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(
        'Sign In Failed',
        error.message || 'Unable to sign in with Google. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo / Brand */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>TAR</Text>
          <Text style={styles.tagline}>Framework</Text>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to access your workspace, memories, and agents
          </Text>
        </View>

        {/* Sign In Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.customButton, isLoading && styles.buttonDisabled]} 
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#1C1C1E" />
            ) : (
              <View style={styles.buttonContent}>
                <FontAwesome name="google" size={20} color="#1C1C1E" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#0C5027',
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  customButton: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Flat design
    elevation: 0,
    shadowColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  termsText: {
    fontSize: 12,
    color: '#AEAEB2',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});