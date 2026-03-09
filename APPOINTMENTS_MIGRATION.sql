-- ============================================================
-- NEXADOX — Appointments & Finance Integration
-- Extends existing system with proper appointment workflow
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Extend appointments table with required fields ───────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS patient_id INT,
  ADD COLUMN IF NOT EXISTS clinic_id INT REFERENCES clinics(id),
  ADD COLUMN IF NOT EXISTS slot VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_role VARCHAR(20) CHECK (source_role IN ('Admin', 'Attendant', 'Agent', 'App')),
  ADD COLUMN IF NOT EXISTS booked_by_id INT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS booking_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS voucher_id INT,
  ADD COLUMN IF NOT EXISTS invoice_id INT;

-- ── 2. Create vouchers table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  voucher_number VARCHAR(50) UNIQUE NOT NULL,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  doctor_name VARCHAR(255) NOT NULL,
  clinic_name VARCHAR(255) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_slot VARCHAR(20) NOT NULL,
  booking_amount DECIMAL(10, 2),
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  total_payable DECIMAL(10, 2),
  status VARCHAR(20) CHECK (status IN ('active', 'used', 'cancelled')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. Add agent commission fields to doctors ────────────────
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS agent_commission_percent DECIMAL(5, 2) DEFAULT 10;

-- ── 4. Extend invoices with appointment_id ───────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS appointment_id INT REFERENCES appointments(id);

-- ── 5. Add unique constraint for slot booking ────────────────
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS unique_doctor_date_slot;

ALTER TABLE appointments
  ADD CONSTRAINT unique_doctor_date_slot UNIQUE (doctor_id, appointment_date, slot);

-- ── 6. Create indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(source_role);
CREATE INDEX IF NOT EXISTS idx_vouchers_appointment ON vouchers(appointment_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_number ON vouchers(voucher_number);

-- ── 7. Disable RLS (admin uses mock session) ──────────────────
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers     DISABLE ROW LEVEL SECURITY;

-- ── 8. Grant permissions ──────────────────────────────────────
GRANT ALL ON TABLE appointments TO anon, authenticated;
GRANT ALL ON TABLE vouchers TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE vouchers_id_seq TO anon, authenticated;

-- ── 9. Notify PostgREST ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
