-- Update Aarvi Clinic with Naihati coordinates and city
-- Naihati, West Bengal: lat 22.8928, lng 88.4219

-- First check what exists:
-- SELECT id, name, city, latitude, longitude FROM clinics WHERE name ILIKE '%aarvi%';

-- Update Aarvi Clinic with Naihati location data
UPDATE clinics
SET
  latitude = 22.8928,
  longitude = 88.4219,
  city = 'Naihati'
WHERE name ILIKE '%aarvi%'
  AND (latitude IS NULL OR longitude IS NULL OR city IS NULL OR city = '');

-- If city is already set but different, just update lat/lng:
UPDATE clinics
SET
  latitude = 22.8928,
  longitude = 88.4219
WHERE name ILIKE '%aarvi%'
  AND (latitude IS NULL OR longitude IS NULL);

-- Verify:
-- SELECT id, name, city, latitude, longitude FROM clinics WHERE name ILIKE '%aarvi%';
