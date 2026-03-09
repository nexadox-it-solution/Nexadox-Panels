-- ============================================================
-- FIX ATTENDANT CLINIC/DOCTOR ASSIGNMENTS
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Check current attendant data
SELECT 
  u.id as user_id, 
  u.name, 
  u.email, 
  a.id as attendant_id, 
  a.assigned_clinic_ids, 
  a.assigned_doctors
FROM users u
LEFT JOIN attendants a ON a.user_id = u.id
WHERE u.role = 'attendant';

-- STEP 2: Check available clinics
SELECT id, name, city FROM clinics WHERE status = 'active' ORDER BY name;

-- STEP 3: Check available doctors
SELECT id, name, email, clinic_ids FROM doctors ORDER BY name;

-- ============================================================
-- STEP 4: UPDATE ATTENDANT ASSIGNMENTS
-- Replace the values below with actual IDs from steps 2 & 3
-- ============================================================

-- Example: Assign clinic ID 1 and doctor ID 5 to attendant ID 1
UPDATE attendants 
SET 
  assigned_clinic_ids = ARRAY[1],    -- Replace 1 with actual clinic ID
  assigned_doctors = ARRAY[5],       -- Replace 5 with actual doctor ID (or use '{}' for all doctors of clinic)
  updated_at = NOW()
WHERE id = 1;  -- Replace 1 with actual attendant ID from STEP 1

-- STEP 5: Verify the update
SELECT 
  a.id,
  a.assigned_clinic_ids,
  a.assigned_doctors,
  u.name as attendant_name,
  u.email
FROM attendants a
JOIN users u ON u.id = a.user_id;

-- ============================================================
-- ALTERNATIVE: If you want to assign ALL doctors at a clinic
-- ============================================================
-- UPDATE attendants 
-- SET 
--   assigned_clinic_ids = ARRAY[1],  -- clinic ID
--   assigned_doctors = '{}',         -- empty array means "all doctors at assigned clinics"
--   updated_at = NOW()
-- WHERE id = 1;
