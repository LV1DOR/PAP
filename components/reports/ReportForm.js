'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/reports/LocationPicker'), { ssr: false });

export default function ReportForm({ onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    latitude: null,
    longitude: null,
    address: '',
    priority: 'medium',
    location_id: '',
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useGeolocation, setUseGeolocation] = useState(false);

  // Fetch categories and locations on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    }
    async function loadLocations() {
      try {
        const res = await fetch('/api/locations');
        if (res.ok) {
          const data = await res.json();
          setLocations((data.locations || []).map(l => ({ id: l.id, slug: l.slug, name: l.name })));
        }
      } catch (e) {
        console.error('Failed to load locations', e);
      }
    }
    loadCategories();
    loadLocations();
  }, []);

  // Get user's current location
  const handleUseGeolocation = () => {
    setUseGeolocation(true);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setUseGeolocation(false);
      },
      (err) => {
        setError('Failed to get location: ' + err.message);
        setUseGeolocation(false);
      }
    );
  };

  const handleLocationSelect = (lat, lng) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  // Auto-detect nearest town when coordinates picked and no manual selection
  useEffect(() => {
    if (
      locations.length &&
      formData.latitude != null &&
      formData.longitude != null &&
      !formData.location_id
    ) {
      // Simple haversine to find nearest center
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const distanceKm = (lat1, lon1, lat2, lon2) => {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      let best = null;
      for (const l of locations) {
        // We only have id, slug, name here; need center lat/lng -> fetch missing? We embedded only minimal fields.
        // Fallback: fetch all locations with centers once if not cached.
      }
    }
  }, [locations, formData.latitude, formData.longitude, formData.location_id]);

  // Fetch full location centers once for auto-detect if needed
  const [locationCenters, setLocationCenters] = useState([]);
  useEffect(() => {
    async function loadCenters() {
      if (!locations.length) return;
      const res = await fetch('/api/locations');
      if (res.ok) {
        const data = await res.json();
        setLocationCenters((data.locations || []).map(l => ({ id: l.id, name: l.name, center_lat: l.center_lat, center_lng: l.center_lng })));
      }
    }
    loadCenters();
  }, [locations]);

  useEffect(() => {
    if (
      locationCenters.length &&
      formData.latitude != null &&
      formData.longitude != null &&
      !formData.location_id
    ) {
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const distanceKm = (lat1, lon1, lat2, lon2) => {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      let nearest = null;
      for (const l of locationCenters) {
        const d = distanceKm(formData.latitude, formData.longitude, l.center_lat, l.center_lng);
        if (!nearest || d < nearest.d) nearest = { id: l.id, d };
      }
      if (nearest) {
        setFormData(prev => ({ ...prev, location_id: String(nearest.id) }));
      }
    }
  }, [locationCenters, formData.latitude, formData.longitude, formData.location_id]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }
    setImages(prev => [...prev, ...files]);
    setError(null);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title || !formData.description || !formData.category_id) {
        throw new Error('Please fill in all required fields');
      }
      if (formData.latitude == null || formData.longitude == null) {
        throw new Error('Please select a location on the map or use your current location');
      }

      // Create report
      const reportRes = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('supabase.auth.token') && {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem('supabase.auth.token')).access_token}`,
          }),
        },
        body: JSON.stringify({
          ...formData,
          location_id: formData.location_id || null,
        }),
      });

      if (!reportRes.ok) {
        const errData = await reportRes.json();
        throw new Error(errData.error || 'Failed to create report');
      }

      const reportData = await reportRes.json();
      const reportId = reportData.id;

      // Upload images if any
      if (images.length > 0) {
        const uploadPromises = images.map(async (img) => {
          const fd = new FormData();
          fd.append('image', img);
          fd.append('report_id', reportId);
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) throw new Error('Image upload failed');
          return res.json();
        });
        await Promise.all(uploadPromises);
      }

      // Success callback
      if (onSuccess) onSuccess(reportId, reportData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report an Issue</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the issue"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed description of the problem"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              required
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Town (Location binding) */}
          <div>
            <label className="block text-sm font-medium mb-1">Bind to Town</label>
            <select
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.location_id}
              onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
            >
              <option value="">Auto-detect by coordinates</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                onClick={handleUseGeolocation}
                disabled={useGeolocation}
                className="text-sm"
              >
                {useGeolocation ? 'Getting location...' : 'Use My Location'}
              </Button>
              {formData.latitude && formData.longitude && (
                <span className="text-xs text-gray-600 self-center">
                  {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                </span>
              )}
            </div>
            <LocationPicker
              onLocationSelect={handleLocationSelect}
              initialPosition={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
            />
          </div>

          {/* Address (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">Address (optional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Street address or landmark"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Images (up to 5)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleImageChange}
              className="w-full text-sm"
              disabled={images.length >= 5}
            />
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Preview ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
