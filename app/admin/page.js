'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SuperAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'municipality_admin',
    municipality_id: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);

  useEffect(() => {
    async function checkAccess() {
      console.log('[Admin] Starting access check, user:', user);
      
      if (!user) {
        console.log('[Admin] No user, redirecting to login');
        router.push('/login');
        return;
      }

      try {
        // Get session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Admin] Session:', session ? 'exists' : 'null');
        const accessToken = session?.access_token;

        if (!accessToken) {
          console.log('[Admin] No access token, redirecting to login');
          router.push('/login');
          return;
        }
        
        console.log('[Admin] Fetching /api/auth/me...');
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });

        console.log('[Admin] API response status:', res.status);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[Admin] Auth check failed:', errorText);
          router.push('/login');
          return;
        }

        const data = await res.json();
        console.log('[Admin] User data:', data);
        
        if (data.role !== 'super_admin') {
          console.log('[Admin] Not super_admin, role is:', data.role);
          router.push('/?error=unauthorized');
          return;
        }

        console.log('[Admin] Access granted!');
        setUserRole(data);
        loadData(accessToken);
      } catch (e) {
        console.error('[Admin] Check access error:', e);
        router.push('/login');
      }
    }

    checkAccess();
  }, [user, router]);

  async function loadData(accessToken) {
    try {
      // Load municipalities
      const locRes = await fetch('/api/locations', {
        cache: 'no-store',
      });
      if (locRes.ok) {
        const locData = await locRes.json();
        setMunicipalities(locData.locations || []);
      }

      // Load invitations
      const invRes = await fetch('/api/invitations', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }
    } catch (e) {
      console.error('Load data error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setSuccess(`Invitation created for ${formData.email}`);
      setInviteLink(data.invite_url || null);
      setFormData({ email: '', role: 'municipality_admin', municipality_id: '' });
      setShowInviteForm(false);
      
      // Reload invitations
      loadData(accessToken);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !userRole) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  if (!userRole) return null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Panel</h1>
          <p className="text-gray-600">Manage users and invitations across all municipalities</p>
        </div>
        <Button onClick={() => setShowInviteForm(!showInviteForm)}>
          {showInviteForm ? 'Cancel' : '+ Invite User'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded space-y-2">
          <div>{success}</div>
          {inviteLink && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-2 py-1 border rounded text-sm"
              />
              <Button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteLink)}
              >
                Copy Invite Link
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <Card>
          <CardHeader>
            <CardTitle>Send Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="municipality_admin">Municipality Administrator</option>
                  <option value="staff">Staff Member</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Municipality <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.municipality_id}
                  onChange={(e) => setFormData({ ...formData, municipality_id: e.target.value })}
                  required
                >
                  <option value="">Select municipality</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Invitation'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Municipality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Invited By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invitations.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No invitations yet
                    </td>
                  </tr>
                )}
                {invitations.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  const isUsed = !!inv.used_at;
                  
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{inv.email}</td>
                      <td className="px-4 py-3 text-sm">{inv.role.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm">{inv.locations?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{inv.users?.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isUsed
                              ? 'bg-green-100 text-green-800'
                              : isExpired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {isUsed ? 'Used' : isExpired ? 'Expired' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{municipalities.length}</div>
            <div className="text-sm text-gray-600">Municipalities</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-yellow-600">
              {invitations.filter((i) => !i.used_at && new Date(i.expires_at) > new Date()).length}
            </div>
            <div className="text-sm text-gray-600">Pending Invitations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              {invitations.filter((i) => !!i.used_at).length}
            </div>
            <div className="text-sm text-gray-600">Accounts Created</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
