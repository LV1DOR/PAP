-- Step 1: Add new enum values (run this FIRST, alone)
-- Supabase may wrap multi-statement scripts in a single transaction.
-- Postgres forbids using new enum values inside the same uncommitted transaction.
-- So execute this file first, wait for success, THEN run the main migration.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'municipality_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- After this succeeds you can run: scripts/auth_schema_migration.sql
