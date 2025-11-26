// Tests for the upload API route logic
// Focus: validation and success path attachment flow

jest.mock('sharp', () => {
  return (input) => {
    return {
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 50 }),
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('fakeimage')),
    };
  };
});

// Mock supabase client used in the route
jest.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: null }),
          getPublicUrl: (path) => ({ data: { publicUrl: `https://example.com/${path}` } })
        })
      }
    }
  };
});

// Dynamic import of route after mocks
const { POST } = require('../../app/api/upload/route.js');

function makeMockRequest(formDataMap) {
  const fd = {
    get: (key) => formDataMap[key],
  };
  return {
    formData: async () => fd,
  };
}

// Minimal file-like object
function makeMockFile({ size, type, buffer }) {
  return {
    size,
    type,
    arrayBuffer: async () => buffer,
  };
}

describe('Upload route', () => {
  test('returns 400 when no image provided', async () => {
    const req = makeMockRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No image/i);
  });

  test('returns 400 when file too large', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const file = makeMockFile({ size: bigBuffer.length, type: 'image/jpeg', buffer: bigBuffer });
    const req = makeMockRequest({ image: file });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/File too large/i);
  });

  test('returns 400 for invalid mime type', async () => {
    const buf = Buffer.from('1234');
    const file = makeMockFile({ size: buf.length, type: 'image/gif', buffer: buf });
    const req = makeMockRequest({ image: file });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid file type/i);
  });

  test('successful upload returns expected fields', async () => {
    const buf = Buffer.from('fakejpegdata');
    const file = makeMockFile({ size: buf.length, type: 'image/jpeg', buffer: buf });
    const req = makeMockRequest({ image: file });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storage_path).toMatch(/uploads\//);
    expect(json.thumbnail_path).toMatch(/uploads\//);
    expect(json.url).toMatch(/^https:\/\/example.com\/uploads\//);
    expect(json.thumbnail_url).toMatch(/^https:\/\/example.com\/uploads\//);
    expect(json.width).toBe(100);
    expect(json.height).toBe(50);
    expect(json.size_bytes).toBeGreaterThan(0);
  });
});
