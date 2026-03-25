import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AuthState,
  AuthUser,
  configureGoogleSignIn,
  signInWithGoogle,
  signOut as googleSignOut,
  restoreSession,
  getAuthToken,
} from '../src/auth/googleSignIn';

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoading: true,
  isSignedIn: false,
  user: null,
  token: null,
  scopes: [],
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isSignedIn: false,
    user: null,
    token: null,
    scopes: [],
  });

  // Initialize Google Sign-In and restore session on mount
  useEffect(() => {
    const initAuth = async () => {
      configureGoogleSignIn();
      
      // Try to restore existing session
      const savedSession = await restoreSession();
      
      if (savedSession) {
        setAuthState(savedSession);
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []);

  const signIn = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await signInWithGoogle();
      setAuthState(result);
    } catch (error) {
      console.error('Sign in failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await googleSignOut();
      setAuthState({
        isLoading: false,
        isSignedIn: false,
        user: null,
        token: null,
        scopes: [],
      });
    } catch (error) {
      console.error('Sign out failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Helper hook to get auth token for API calls
export function useAuthToken() {
  const { token, isSignedIn } = useAuth();
  return isSignedIn ? token : null;
}