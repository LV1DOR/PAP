-- CivicLens Database Schema
-- Execute this in Supabase SQL Editor after creating your project

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- fuzzy title search

-- Enable PostGIS for geospatial queries (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS "postgis";


-- =====================================================
-- 2. ENUMS
-- =====================================================
CREATE TYPE user_role AS ENUM ('citizen', 'staff', 'admin');
CREATE TYPE report_status AS ENUM ('reported', 'validated', 'in_progress', 'resolved', 'rejected');
CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high');


-- =====================================================
-- 3. TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role user_role DEFAULT 'citizen' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Categories for issue types
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Locations
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  center_lat NUMERIC(9,6) NOT NULL,
  center_lng NUMERIC(9,6) NOT NULL,
  bbox_min_lat NUMERIC(9,6),
  bbox_min_lng NUMERIC(9,6),
  bbox_max_lat NUMERIC(9,6),
  bbox_max_lng NUMERIC(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Main reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  address TEXT,
  status report_status DEFAULT 'reported' NOT NULL,
  priority report_priority DEFAULT 'medium' NOT NULL,
  is_potential_duplicate BOOLEAN DEFAULT FALSE NOT NULL,
  suppressed BOOLEAN DEFAULT FALSE NOT NULL,
  duplicate_of UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND 
    longitude BETWEEN -180 AND 180
  )
);

-- Report images
CREATE TABLE report_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL, -- path in Supabase Storage
  thumbnail_path TEXT, -- optional thumbnail
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Audit logs for tracking changes
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL, -- e.g., 'status_changed', 'duplicate_merged', 'report_created'
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  meta JSONB, -- flexible metadata storage
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- =====================================================
-- 4. INDEXES
-- =====================================================

-- Reports indexes for common queries
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_category ON reports(category_id);
CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_updated_at ON reports(updated_at DESC);

-- Geospatial index for location queries (composite)
CREATE INDEX idx_reports_location ON reports(latitude, longitude);
CREATE INDEX idx_reports_location_id ON reports(location_id);
CREATE INDEX idx_reports_title_trgm ON reports USING GIN (title gin_trgm_ops);
CREATE INDEX idx_reports_duplicate_of ON reports(duplicate_of);
CREATE INDEX idx_reports_suppressed_true ON reports(suppressed) WHERE suppressed = TRUE;

-- If PostGIS is enabled, use spatial index instead:
-- CREATE INDEX idx_reports_geom ON reports USING GIST(ST_MakePoint(longitude, latitude)::geography);

-- Report images index
CREATE INDEX idx_report_images_report ON report_images(report_id);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_report ON audit_logs(report_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- USERS table policies
-- Anyone authenticated can read user profiles
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- New users can insert their profile (triggered by auth)
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);


-- CATEGORIES table policies
-- Everyone can read categories (public)
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

-- Only admins can modify categories (implement via service role or admin check)
-- For now, restrict to service role only


-- REPORTS table policies
CREATE POLICY "Anyone can view reports"
  ON reports FOR SELECT USING (true);

CREATE POLICY "Anyone can view locations"
  ON locations FOR SELECT USING (true);

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL); -- allow anonymous if user_id NULL

-- Users can update their own reports (citizens only)
CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (
    auth.uid() = user_id
  );

-- Staff and admins can update any report (check role from users table)
CREATE POLICY "Staff can update any report"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('staff', 'admin')
    )
  );


-- REPORT_IMAGES table policies
-- Anyone can view images
CREATE POLICY "Anyone can view report images"
  ON report_images FOR SELECT
  USING (true);

-- Users can insert images for their own reports
CREATE POLICY "Users can add images to own reports"
  ON report_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_id
      AND (reports.user_id = auth.uid() OR reports.user_id IS NULL)
    )
  );

-- Staff can add images to any report
CREATE POLICY "Staff can add images to any report"
  ON report_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('staff', 'admin')
    )
  );


-- AUDIT_LOGS table policies
-- Only staff and admins can view audit logs
CREATE POLICY "Staff can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('staff', 'admin')
    )
  );

-- System can insert audit logs (typically via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- controlled via service role in API


-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp on reports
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- 8. SEED DATA (Optional - run after schema)
-- =====================================================

-- Insert default categories
INSERT INTO categories (slug, label) VALUES
  ('pothole', 'Pothole'),
  ('streetlight', 'Street Light'),
  ('graffiti', 'Graffiti'),
  ('sidewalk', 'Sidewalk Damage'),
  ('traffic', 'Traffic Signal Issue'),
  ('garbage', 'Garbage Collection'),
  ('park', 'Park Maintenance'),
  ('other', 'Other')
ON CONFLICT (slug) DO NOTHING;

-- Seed locations (Algarve)
INSERT INTO locations (slug, name, center_lat, center_lng) VALUES
  ('faro','Faro',37.0194,-7.9322),
  ('silves','Silves',37.1899,-8.4385),
  ('lagos','Lagos',37.1020,-8.6732),
  ('albufeira','Albufeira',37.0891,-8.2479),
  ('portimao','Portimão',37.1386,-8.5392),
  ('loulea','Loulé',37.1370,-8.0197)
ON CONFLICT (slug) DO NOTHING;


-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================
-- 1. After running this schema, test RLS policies by creating test users with different roles
-- 2. Use Supabase service role key for server-side operations that bypass RLS
-- 3. For geospatial queries with PostGIS, uncomment the extension and spatial index
-- 4. Consider adding more indexes based on actual query patterns
-- 5. Audit logs should be inserted via API routes using service role
-- 6. For production: add backup policies and review security rules
