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
import { listScopesApi } from '../src/api/client';

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

  // Initialize Google Sign-In and restore session
  useEffect(() => {
    const initAuth = async () => {
      configureGoogleSignIn();
      
      const savedSession = await restoreSession();
      if (savedSession) {
        // Fetch scopes from API since restoreSession doesn't persist them
        try {
          const res = await listScopesApi();
          savedSession.scopes = (res.scopes || []).map(s => s.scope);
        } catch {
          // Continue without scopes - will be empty
        }
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
      console.log('[Auth] signInWithGoogle result:', result.isSignedIn, result.user?.email);
      setAuthState(result);
      console.log('[Auth] setState called with isSignedIn:', result.isSignedIn);
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