'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, logout } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

export function NavBar() {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    async function fetchUserRole() {
      if (loading) {
        setUserRole(null);
        return;
      }
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        
        if (!accessToken) {
          setUserRole(null);
          return;
        }
        
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (res.status === 401) {
          // Not authenticated; clear role and stop logging noisy error on logout
          setUserRole(null);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
        } else {
          console.error('Failed to fetch user role:', res.status);
        }
      } catch (e) {
        console.error('Failed to fetch user role:', e);
      }
    }

    fetchUserRole();
  }, [user, loading]);

  return (
    <nav className="flex items-center justify-between mb-6 pb-4 border-b">
      <Link href="/" className="text-2xl font-bold text-brand-700">CivicLens</Link>
      <div className="flex items-center gap-4">
        <Link href="/reports" className="text-sm text-gray-700 hover:text-brand-600">Reports</Link>
        <Link href="/locations" className="text-sm text-gray-700 hover:text-brand-600">Locations</Link>
        {userRole === 'super_admin' && (
          <Link href="/admin" className="text-sm text-purple-700 hover:text-purple-900 font-semibold">Admin Panel</Link>
        )}
        <Link href="/reports/new" className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded hover:bg-brand-700">New Report</Link>
        {loading && <span className="text-sm text-gray-500">Loading...</span>}
        {!loading && !user && (
          <>
            <Link href="/login" className="text-sm text-brand-600 hover:underline">Login</Link>
          </>
        )}
        {!loading && user && (
          <>
            <span className="text-sm text-gray-700">
              {user.email}
              {userRole && userRole !== 'citizen' && (
                <span className="ml-1 text-xs text-gray-500">({userRole.replace('_', ' ')})</span>
              )}
            </span>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
