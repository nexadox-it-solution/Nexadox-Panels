-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PRESCRIPTION NUMBER + UHID ON PRESCRIPTION MIGRATION       ║
-- ║  Adds prescription_number column with unique NDP format      ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 1. Add prescription_number column to prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number VARCHAR(20);

-- 2. Create a sequence for prescription numbering
CREATE SEQUENCE IF NOT EXISTS prescription_number_seq START WITH 1 INCREMENT BY 1;

-- 3. Add patient_id column to prescriptions (links to patients table for UHID)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id INT;

-- 4. Backfill existing prescriptions with prescription numbers
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

-- 5. Create unique index on prescription_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);

-- Done! New prescriptions will be assigned numbers in format: NDP/000000001, NDP/000000002, etc.
