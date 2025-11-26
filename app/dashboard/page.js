'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: '',
  });
  const [categories, setCategories] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    // Check if user is staff/admin
    async function checkRole() {
      if (!user) {
        router.push('/login');
        return;
      }
      try {
        const token = localStorage.getItem('supabase.auth.token');
        const accessToken = token ? JSON.parse(token).access_token : null;
        const res = await fetch('/api/auth/me', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.role !== 'staff' && data.role !== 'admin') {
            alert('Access denied: Staff only');
            router.push('/');
            return;
          }
          setUserRole(data.role);
        }
      } catch (e) {
        console.error(e);
        router.push('/');
      }
    }
    checkRole();
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      try {
        // Load categories
        const catRes = await fetch('/api/categories');
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }

        // Load reports with filters
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.category) params.append('category', filters.category);
        params.append('limit', '100');
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          let items = data.items || [];
          // Client-side search filter
          if (filters.search) {
            const search = filters.search.toLowerCase();
            items = items.filter((r) => r.title.toLowerCase().includes(search));
          }
          setReports(items);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (userRole) loadData();
    if (!userRole) return;

    // Realtime: refresh dashboard when reports change
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        console.log('[Dashboard Realtime]', payload.eventType, payload);
        if (payload?.eventType === 'INSERT') addToast('New report created', { variant: 'success' });
        else if (payload?.eventType === 'UPDATE') addToast('Report updated', { variant: 'default' });
        else if (payload?.eventType === 'DELETE') addToast('Report deleted', { variant: 'error' });
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters, userRole, addToast]);

  const handleQuickStatus = async (reportId, newStatus) => {
    if (!window.confirm(`Change status to ${newStatus}?`)) return;
    try {
      const token = localStorage.getItem('supabase.auth.token');
      const accessToken = token ? JSON.parse(token).access_token : null;
      const res = await fetch(`/api/reports/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      // Reload reports
      setFilters({ ...filters });
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  if (!userRole) return <div className="p-6 text-center">Checking permissions...</div>;
  if (loading) return <div className="p-6 text-center">Loading reports...</div>;

  const statusColor = {
    reported: 'bg-yellow-100 text-yellow-800',
    validated: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Staff Dashboard</h1>
        <div className="text-sm text-gray-600">
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="reported">Reported</option>
                <option value="validated">Validated</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Search Title</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="Search by title..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                      No reports found
                    </td>
                  </tr>
                )}
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/reports/${report.id}`)}
                        className="text-brand-600 hover:underline text-left font-medium"
                      >
                        {report.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-1 rounded text-xs font-medium', statusColor[report.status])}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {report.status === 'reported' && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickStatus(report.id, 'validated')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Validate
                          </Button>
                        )}
                        {report.status === 'validated' && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickStatus(report.id, 'in_progress')}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            Start
                          </Button>
                        )}
                        {report.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickStatus(report.id, 'resolved')}
                            className="text-xs px-2 py-1 h-auto bg-green-600 hover:bg-green-700"
                          >
                            Resolve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => router.push(`/reports/${report.id}`)}
                          className="text-xs px-2 py-1 h-auto bg-gray-600 hover:bg-gray-700"
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
