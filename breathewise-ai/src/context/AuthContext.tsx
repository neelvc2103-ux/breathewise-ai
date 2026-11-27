import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AqiStandard,
  AuthUser,
  DemoScenario,
  SupportedLanguage,
  UserProfile,
} from '../types/domain';
import { TRANSLATIONS } from '../i18n/translations';

export type ThemePreference = 'light' | 'dark' | 'system';

interface LocationSelection {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  standard: AqiStandard;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  token: string | null;
  isDemoAccount: boolean;
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  language: SupportedLanguage;
  setLanguage: (l: SupportedLanguage) => void;
  t: (typeof TRANSLATIONS)['en'];
  demoScenario: DemoScenario;
  setDemoScenario: (s: DemoScenario) => void;
  selectedLocation: LocationSelection;
  setSelectedLocation: (loc: LocationSelection) => void;
  setSession: (user: AuthUser, token: string, profile?: UserProfile | null, isDemo?: boolean) => void;
  updateUserLocal: (partial: Partial<AuthUser>) => void;
  setProfileLocal: (p: UserProfile) => void;
  logout: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

const DEFAULT_LOCATION: LocationSelection = {
  city: 'New Delhi',
  region: 'Delhi NCR',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
  standard: 'INDIA_NAQI',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep Bearer session token strictly in React memory (never localStorage/sessionStorage)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemoAccount, setIsDemoAccount] = useState(false);

  const [theme, setTheme] = useState<ThemePreference>('light');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [demoScenario, setDemoScenario] = useState<DemoScenario>('live');
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection>(DEFAULT_LOCATION);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: 'light' | 'dark') => {
      if (mode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mql.matches ? 'dark' : 'light');
      const listener = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
    apply(theme);
  }, [theme]);

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [token],
  );

  const setSession = useCallback(
    (nextUser: AuthUser, nextToken: string, nextProfile?: UserProfile | null, isDemo = false) => {
      setUser(nextUser);
      setToken(nextToken);
      setIsDemoAccount(isDemo);
      if (nextProfile) {
        setProfile(nextProfile);
        setLanguage(nextProfile.preferredLanguage || 'en');
        setSelectedLocation({
          city: nextProfile.city,
          region: nextProfile.stateRegion,
          country: nextProfile.country,
          latitude: nextProfile.latitude,
          longitude: nextProfile.longitude,
          standard: nextProfile.aqiStandard,
        });
      }
    },
    [],
  );

  const updateUserLocal = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  const setProfileLocal = useCallback((p: UserProfile) => {
    setProfile(p);
    setLanguage(p.preferredLanguage || 'en');
    setSelectedLocation({
      city: p.city,
      region: p.stateRegion,
      country: p.country,
      latitude: p.latitude,
      longitude: p.longitude,
      standard: p.aqiStandard,
    });
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setUser(null);
    setProfile(null);
    setToken(null);
    setIsDemoAccount(false);
    setDemoScenario('live');
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isDemoAccount,
        theme,
        setTheme,
        language,
        setLanguage,
        t: TRANSLATIONS[language],
        demoScenario,
        setDemoScenario,
        selectedLocation,
        setSelectedLocation,
        setSession,
        updateUserLocal,
        setProfileLocal,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
