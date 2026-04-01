import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';

// Backend auth API endpoints
const AUTH_API_BASE = "https://taragent.tar-54d.workers.dev";

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
    webClientId: '291840005173-g572mhgipfla7qq1k9ugnt5fpnir47en.apps.googleusercontent.com',
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });
}

// Sign in with Google
export async function signInWithGoogle(): Promise<AuthState> {
  try {
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign out any cached session first to ensure a fresh token is issued
    try { await GoogleSignin.signOut(); } catch (e) { /* ignore */ }

    // Get user info from Google Sign-In
    // According to official docs, the response has a 'data' property containing idToken
    const { data } = await GoogleSignin.signIn();
    
    // Log for debugging
    console.log('Google signIn data:', JSON.stringify(data));
    
    // Extract idToken from the data object
    const idToken = data?.idToken;
    const serverAuthCode = data?.serverAuthCode;
    
    console.log('idToken:', idToken ? 'present' : 'missing');
    console.log('serverAuthCode:', serverAuthCode || 'missing');

    if (!idToken && !serverAuthCode) {
      throw new Error('No ID token or server auth code received from Google');
    }

    const authCredential = idToken || serverAuthCode;
    const isServerAuthCode = !idToken && !!serverAuthCode;

    // Send the token to our backend to validate and create a session
    const requestBody = isServerAuthCode 
      ? { server_auth_code: serverAuthCode } 
      : { google_token: authCredential };
      
    const response = await fetch(`${AUTH_API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
    
    // Attempt cleanup on failure so it's fresh next time
    try {
      await GoogleSignin.signOut();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {
      // Ignore cleanup errors
    }
    
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
  // Always clear local storage first, regardless of network errors
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch (e) {}
  try { await SecureStore.deleteItemAsync(USER_KEY); } catch (e) {}
  try { await GoogleSignin.signOut(); } catch (e) {}

  // Best-effort backend session invalidation
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      await fetch(`${AUTH_API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  } catch (e) {
    // Ignore - local session is already cleared
  }
}

// Check if user is already signed in (restore session from SecureStore)
export async function restoreSession(): Promise<AuthState | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userJson = await SecureStore.getItemAsync(USER_KEY);

    if (!token || !userJson) {
      console.log('[Auth] No stored session found');
      return null;
    }

    const user: AuthUser = JSON.parse(userJson);
    console.log('[Auth] Restored session for:', user.email);

    return {
      isLoading: false,
      isSignedIn: true,
      user,
      token,
      scopes: [],
    };
  } catch (error) {
    console.error('[Auth] Restore session error:', error);
    // Clear corrupted data
    try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch (e) {}
    try { await SecureStore.deleteItemAsync(USER_KEY); } catch (e) {}
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