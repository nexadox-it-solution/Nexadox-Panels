-- ============================================================
-- FIX: Change specialties.icon from BYTEA to TEXT
-- ============================================================
-- The icon column was created as BYTEA (binary) but stores text
-- values (URLs and data URIs). This causes the Supabase client
-- to return hex-encoded strings (\x68747470...) instead of
-- plain text (https://...), breaking image display.
--
-- This migration converts the column to TEXT and decodes all
-- existing values from their bytea representation.
-- ============================================================

-- Step 1: Convert column from bytea to text, decoding existing values
ALTER TABLE specialties 
ALTER COLUMN icon TYPE TEXT 
USING convert_from(icon, 'UTF8');

-- Verify the fix
SELECT id, name, LEFT(icon, 80) AS icon_preview 
FROM specialties 
ORDER BY id;
