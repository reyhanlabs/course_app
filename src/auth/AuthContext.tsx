import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { errorMessage } from '../lib/errors';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile?.();
      unsubProfile = null;
      setUser(u);
      setProfile(null);
      setProfileError(null);
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      // Profil dipantau realtime: bila admin menonaktifkan akun, efeknya langsung terasa.
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          setProfile(snap.exists() ? ({ ...snap.data(), id: snap.id } as UserProfile) : null);
          setLoading(false);
        },
        (err) => {
          setProfileError(errorMessage(err));
          setLoading(false);
        },
      );
    });
    return () => {
      unsubAuth();
      unsubProfile?.();
    };
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

/** Hanya dipakai di halaman yang dibungkus ProtectedLayout (profil pasti ada). */
export function useProfile(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Profil pengguna belum dimuat');
  return profile;
}
