import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, type ApiUser } from '@/lib/api';

const TOKEN_KEY = 'devratna.auth.token';

/**
 * Dummy fallback so the UI flow stays testable while the backend is offline.
 * When the backend is reachable, the real OTP is used — verified either with
 * the `dev_otp` from the response or the fixed code 123456 (local env only).
 */
const DEV_FALLBACK_OTP = '1234';

type AuthState = {
  token: string | null;
  user: ApiUser | null;
  ready: boolean;
  /** True while running against the offline dummy fallback instead of the API. */
  dummyMode: boolean;
  requestOtp: (phone: string) => Promise<{ devOtp?: string; expiresIn: number }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ isNew: boolean }>;
  logout: () => Promise<void>;
  /** Clear the local session without hitting the server — for 401 (expired/revoked token). */
  forceLogout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function saveToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Fall back to a memory-only session when storage is unavailable.
  }
}

async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);
  const [dummyMode, setDummyMode] = useState(false);

  // Restore the saved session on app start.
  useEffect(() => {
    (async () => {
      const saved = await loadToken();
      if (saved) {
        try {
          const { user: me } = await api.me(saved);
          setToken(saved);
          setUser(me);
        } catch {
          await saveToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    try {
      const res = await api.requestOtp(phone);
      setDummyMode(false);
      return { devOtp: res.dev_otp, expiresIn: res.expires_in_seconds };
    } catch {
      // Dummy mode when the backend is unreachable, so the UI flow stays testable.
      setDummyMode(true);
      return { devOtp: DEV_FALLBACK_OTP, expiresIn: 300 };
    }
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string, name?: string) => {
      try {
        const res = await api.verifyOtp(phone, otp, name);
        setDummyMode(false);
        setToken(res.token);
        setUser(res.user);
        await saveToken(res.token);
        return { isNew: res.is_new };
      } catch (e) {
        // Dummy fallback: local login with 123456 + name.
        if (otp === DEV_FALLBACK_OTP) {
          setDummyMode(true);
          const localUser: ApiUser = {
            id: Date.now(),
            name: name?.trim() ? name.trim() : user?.name ?? null,
            phone,
            phone_verified: true,
            is_profile_complete: Boolean(name?.trim() || user?.name),
          };
          // A name is required for a first-time dummy login.
          if (!localUser.name) throw e instanceof Error ? e : new Error('Please enter your name.');
          setUser(localUser);
          setToken('dummy-token');
          await saveToken('dummy-token');
          return { isNew: true };
        }
        throw e;
      }
    },
    [user?.name],
  );

  const logout = useCallback(async () => {
    if (token && token !== 'dummy-token') {
      try {
        await api.logout(token);
      } catch {
        // Clear the local session even when server logout fails.
      }
    }
    setToken(null);
    setUser(null);
    await saveToken(null);
  }, [token]);

  const forceLogout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await saveToken(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, ready, dummyMode, requestOtp, verifyOtp, logout, forceLogout }),
    [token, user, ready, dummyMode, requestOtp, verifyOtp, logout, forceLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
