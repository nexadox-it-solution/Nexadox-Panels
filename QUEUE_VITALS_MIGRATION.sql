-- ================================================================
-- QUEUE + VITALS + PRESCRIPTIONS MIGRATION
-- Run this in your Supabase SQL Editor
-- ================================================================

-- 1. Extend appointments table: add check-in workflow columns
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_time TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(50);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS token_number INT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_dob DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_gender VARCHAR(10);

-- Drop existing status constraint if it exists and add expanded one
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'waiting', 'in_progress', 'no_show'));

-- Add check constraint for checkin_status
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_checkin_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_checkin_status_check 
  CHECK (checkin_status IN ('pending', 'checked_in', 'completed'));

-- 2. Create vitals table
CREATE TABLE IF NOT EXISTS vitals (
  id SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  height DECIMAL(5,1),        -- cm
  weight DECIMAL(5,1),        -- kg
  bmi DECIMAL(4,1),           -- auto-calculated
  bp VARCHAR(20),             -- e.g. "120/80"
  spo2 INT,                   -- percentage
  temperature DECIMAL(4,1),   -- °F
  pulse INT,                  -- bpm
  recorded_by INT REFERENCES users(id),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vitals_appointment ON vitals(appointment_id);

-- 3. Create prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id INT REFERENCES doctors(id),
  patient_name VARCHAR(255),
  diagnosis TEXT,
  notes TEXT,
  medicines JSONB DEFAULT '[]',    -- [{name, dosage, frequency, duration, instructions}]
  tests JSONB DEFAULT '[]',        -- [{name, instructions}]
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);

-- 4. Disable RLS
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all vitals" ON vitals;
CREATE POLICY "Allow all vitals" ON vitals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all prescriptions" ON prescriptions;
CREATE POLICY "Allow all prescriptions" ON prescriptions FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant access
GRANT ALL ON vitals TO anon, authenticated;
GRANT ALL ON prescriptions TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE vitals_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE prescriptions_id_seq TO anon, authenticated;

-- 6. Add index for queue queries
CREATE INDEX IF NOT EXISTS idx_appointments_checkin ON appointments(checkin_status, doctor_id, appointment_date);
