'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className='max-w-md mx-auto'>
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className='space-y-4'>
            <div>
              <label className='block text-sm font-medium mb-1'>Name</label>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
              />
            </div>
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
            {success && <p className='text-green-600 text-sm'>Check your email to confirm registration.</p>}
            <Button disabled={loading}>{loading ? 'Registering...' : 'Register'}</Button>
          </form>
          <p className='text-sm mt-4'>Already have an account? <Link href='/login' className='text-brand-600 hover:underline'>Login</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
