// Middleware for route protection
// Place in app/middleware.js or use in individual components

import { createMiddlewareClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Check if user has required role and optionally municipality access
 */
export async function checkAuth(request, options = {}) {
  const {
    requiredRoles = [],
    checkMunicipality = false,
    municipalityId = null,
  } = options;

  try {
    const supabase = createMiddlewareClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { authorized: false, redirect: '/login', user: null };
    }

    // Fetch user from our users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, municipality_id, status')
      .eq('id', session.user.id)
      .single();

    if (error || !user) {
      return { authorized: false, redirect: '/login', user: null };
    }

    // Check if user is active
    if (user.status !== 'active') {
      return { authorized: false, redirect: '/login?error=account_suspended', user: null };
    }

    // Check role requirement
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      return { authorized: false, redirect: '/?error=unauthorized', user: null };
    }

    // Check municipality access (unless super_admin)
    if (checkMunicipality && user.role !== 'super_admin') {
      if (municipalityId && user.municipality_id !== municipalityId) {
        return { authorized: false, redirect: '/?error=unauthorized', user: null };
      }
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    return { authorized: true, user };
  } catch (error) {
    console.error('Auth check error:', error);
    return { authorized: false, redirect: '/login', user: null };
  }
}

/**
 * Client-side auth check hook
 */
export function useRequireAuth(requiredRoles = []) {
  const { user } = useAuth(); // from your AuthProvider
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function check() {
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch full user data
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      
      if (data.status !== 'active') {
        router.push('/login?error=account_suspended');
        return;
      }

      if (requiredRoles.length > 0 && !requiredRoles.includes(data.role)) {
        router.push('/?error=unauthorized');
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    check();
  }, [user, router]);

  return { authorized, loading };
}
