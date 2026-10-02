import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, type ApiUser } from '@/lib/api';

const TOKEN_KEY = 'devratna.auth.token';

/**
 * Single server-token login — koi dummy/offline session nahi.
 * Testing ke liye backend OTP_FIXED_CODE=1234 accept karta hai.
 * Errors (galat OTP, expired OTP, server down) seedha UI ko milte hain.
 */

type AuthState = {
  token: string | null;
  user: ApiUser | null;
  ready: boolean;
  requestOtp: (phone: string) => Promise<{ devOtp?: string; expiresIn: number }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ isNew: boolean }>;
  updateProfile: (body: { name?: string; default_address?: string | null }) => Promise<void>;
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
    const res = await api.requestOtp(phone);
    return { devOtp: res.dev_otp, expiresIn: res.expires_in_seconds };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, name?: string) => {
    const res = await api.verifyOtp(phone, otp, name);
    setToken(res.token);
    setUser(res.user);
    await saveToken(res.token);
    return { isNew: res.is_new };
  }, []);

  const updateProfile = useCallback(
    async (body: { name?: string; default_address?: string | null }) => {
      if (!token) throw new Error('Please log in again.');
      const res = await api.updateProfile(token, body);
      setUser(res.user);
    },
    [token],
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        // Server slow/cold-start ho to bhi logout atke nahi — 8s me local session clear pakka.
        await Promise.race([
          api.logout(token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('logout timeout')), 8000)),
        ]);
      } catch {
        // Clear the local session even when server logout fails/times out.
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
    () => ({ token, user, ready, requestOtp, verifyOtp, updateProfile, logout, forceLogout }),
    [token, user, ready, requestOtp, verifyOtp, updateProfile, logout, forceLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
