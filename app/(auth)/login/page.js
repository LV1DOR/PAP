'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      // redirect to home
      window.location.href = '/';
    }
  }

  return (
    <div className='max-w-md mx-auto'>
      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium mb-1'>Email</label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1'>Password</label>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
              />
            </div>
            {error && <p className='text-red-600 text-sm'>{error}</p>}
            <Button disabled={loading}>{loading ? 'Logging in...' : 'Login'}</Button>
          </form>
          <p className='text-sm mt-4'>No account? <Link href='/register' className='text-brand-600 hover:underline'>Register</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
