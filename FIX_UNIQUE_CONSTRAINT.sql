-- Remove the overly restrictive unique constraint that prevents multiple appointments per slot
-- This constraint was preventing agents from booking multiple patients in the same session

ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS unique_doctor_date_slot;

-- Note: This allows multiple patients to book the same doctor in the same session/slot
-- The seat availability is managed by the max_seats setting in doctor_schedules table
