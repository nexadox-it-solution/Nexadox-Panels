-- ============================================================
-- TOKEN AT BOOKING TIME — Database Migration
-- ============================================================
-- This migration supports the new flow where token numbers are
-- generated at appointment booking time (not at check-in).
--
-- Changes:
-- 1. Adds token_number column to vouchers table
-- 2. Backfills existing vouchers from linked appointments
-- ============================================================

-- 1. Add token_number to vouchers table
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS token_number INT;

-- 2. Backfill existing vouchers with token from appointments
UPDATE vouchers v
SET token_number = a.token_number
FROM appointments a
WHERE v.appointment_id = a.id
AND a.token_number IS NOT NULL
AND v.token_number IS NULL;

-- 3. Verify
SELECT v.id, v.voucher_number, v.token_number, a.token_number AS apt_token
FROM vouchers v
LEFT JOIN appointments a ON v.appointment_id = a.id
ORDER BY v.id DESC
LIMIT 10;
