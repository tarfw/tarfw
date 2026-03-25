import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';

// Backend auth API endpoints
const AUTH_API_BASE = "https://taragent.wetarteam.workers.dev";

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthState {
  isLoading: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  scopes: string[];
}

// Initialize Google Sign-In with the client ID from app.json
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: '291840005173-dqgbihtc6e9q9rq94r17la3d213imb2t.apps.googleusercontent.com',
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });
}

// Sign in with Google
export async function signInWithGoogle(): Promise<AuthState> {
  try {
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Get the Google ID token
    const signInResult = await GoogleSignin.signIn();
    // The result has idToken property - cast to access it
    const idToken = (signInResult as Record<string, unknown>).idToken as string | undefined;

    if (!idToken) {
      throw new Error('No ID token received from Google');
    }

    // Send the token to our backend to validate and create a session
    const response = await fetch(`${AUTH_API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ google_token: idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to authenticate with backend');
    }

    const authData = await response.json();

    // Store token securely
    await SecureStore.setItemAsync(TOKEN_KEY, authData.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authData.user));

    return {
      isLoading: false,
      isSignedIn: true,
      user: authData.user,
      token: authData.token,
      scopes: authData.scopes || [],
    };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    
    // Handle specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign-in was cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign-in is already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available');
    }
    
    throw error;
  }
}

// Sign out from Google and backend
export async function signOut(): Promise<void> {
  try {
    // Clear backend session
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${AUTH_API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (e) {
        // Ignore logout errors - token might be expired
      }
    }

    // Sign out from Google
    await GoogleSignin.signOut();

    // Clear local storage
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Check if user is already signed in (restore session)
export async function restoreSession(): Promise<AuthState | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userJson = await SecureStore.getItemAsync(USER_KEY);

    if (!token || !userJson) {
      return null;
    }

    // Validate token with backend
    const response = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token expired, clear session
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      return null;
    }

    const authData = await response.json();

    return {
      isLoading: false,
      isSignedIn: true,
      user: authData.user,
      token,
      scopes: authData.scopes || [],
    };
  } catch (error) {
    console.error('Restore session error:', error);
    return null;
  }
}

// Get stored token
export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

// Get stored user
export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}