'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data } = await supabase.auth.getSession();
      if (!ignore) {
        setUser(data.session?.user || null);
        setLoading(false);
      }
    }
    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[Logout] signOut error:', error);
  } catch (e) {
    console.error('[Logout] Unexpected error:', e);
  } finally {
    try {
      // Aggressively clear Supabase auth storage to prevent stale tokens
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) {
          try { localStorage.removeItem(k); } catch {}
        }
      });
      sessionStorage.clear();
    } catch {}
    // Ensure client state resets and page reloads without cached session
    window.location.href = '/';
    setTimeout(() => window.location.reload(), 50);
  }
}
