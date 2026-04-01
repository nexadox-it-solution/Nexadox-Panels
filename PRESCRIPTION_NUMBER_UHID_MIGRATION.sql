-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PRESCRIPTION MIGRATION - complaint, prescription_number,   ║
-- ║  patient_id columns + RLS policies                          ║
-- ║  Run this in Supabase SQL Editor                            ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 1. Add complaint column
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS complaint TEXT;

-- 2. Add prescription_number column
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number VARCHAR(20);

-- 3. Add patient_id column (links to patients table for UHID)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id INT;

-- 4. Create sequence for prescription numbering
CREATE SEQUENCE IF NOT EXISTS prescription_number_seq START WITH 1 INCREMENT BY 1;

-- 5. Backfill existing prescriptions with prescription numbers
DO $$
DECLARE
  rx RECORD;
  seq_val INT;
BEGIN
  FOR rx IN SELECT id FROM prescriptions WHERE prescription_number IS NULL ORDER BY id ASC LOOP
    seq_val := nextval('prescription_number_seq');
    UPDATE prescriptions SET prescription_number = 'NDP/' || LPAD(seq_val::TEXT, 9, '0') WHERE id = rx.id;
  END LOOP;
END $$;

-- 6. Create unique index on prescription_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);

-- 7. Fix RLS policies so prescriptions can be inserted/updated/read
DROP POLICY IF EXISTS "Doctors can insert prescriptions" ON prescriptions;
CREATE POLICY "Doctors can insert prescriptions" ON prescriptions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Doctors can update prescriptions" ON prescriptions;
CREATE POLICY "Doctors can update prescriptions" ON prescriptions
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read prescriptions" ON prescriptions;
CREATE POLICY "Anyone can read prescriptions" ON prescriptions
  FOR SELECT USING (true);
