'use client';
import Link from 'next/link';
import { useAuth, logout } from '@/components/auth/AuthProvider';

export function NavBar() {
  const { user, loading } = useAuth();
  return (
    <nav className="flex items-center justify-between mb-6">
      <Link href="/" className="text-2xl font-bold text-brand-700">CivicLens</Link>
      <div className="flex items-center gap-4">
        {loading && <span className="text-sm text-gray-500">Loading...</span>}
        {!loading && !user && (
          <>
            <Link href="/login" className="text-sm text-brand-600 hover:underline">Login</Link>
            <Link href="/register" className="text-sm text-brand-600 hover:underline">Register</Link>
          </>
        )}
        {!loading && user && (
          <>
            <span className="text-sm text-gray-700">{user.email}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
