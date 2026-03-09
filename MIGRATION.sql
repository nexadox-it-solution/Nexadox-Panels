-- ============================================================
-- Nexadox — Database Migration
-- Run this in your Supabase SQL Editor to add required columns
-- ============================================================

-- 1. Add auth_user_id column to users table (links Supabase auth UUID to users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 2. Ensure appointments table has source tracking columns
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source_role VARCHAR(50);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_agent_id INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_amount NUMERIC(10, 2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10, 2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payable_amount NUMERIC(10, 2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS voucher_id INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS invoice_id INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(20);

-- 3. Create vouchers table if not exists
CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  voucher_number VARCHAR(50) UNIQUE NOT NULL,
  appointment_id INTEGER REFERENCES appointments(id),
  patient_name VARCHAR(255),
  doctor_name VARCHAR(255),
  clinic_name VARCHAR(255),
  appointment_date DATE,
  appointment_slot VARCHAR(20),
  booking_amount NUMERIC(10, 2),
  commission_amount NUMERIC(10, 2) DEFAULT 0,
  total_payable NUMERIC(10, 2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create invoices table if not exists
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  txn_id VARCHAR(50),
  booking_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  invoice_number VARCHAR(50) UNIQUE,
  invoice_date DATE,
  taxable_amount NUMERIC(10, 2),
  gst_amount NUMERIC(10, 2),
  total_amount NUMERIC(10, 2),
  gst_percentage NUMERIC(5, 2) DEFAULT 18,
  status VARCHAR(20) DEFAULT 'issued',
  appointment_id INTEGER REFERENCES appointments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create doctor_schedules table if not exists
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL,
  date DATE NOT NULL,
  slot VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  clinic_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(doctor_id, date, slot)
);

-- 6. Ensure agents table has wallet/commission columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) DEFAULT 'percentage';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10, 2) DEFAULT 10;

-- 7. Ensure attendants table has assignment columns
ALTER TABLE attendants ADD COLUMN IF NOT EXISTS assigned_doctors TEXT[];
ALTER TABLE attendants ADD COLUMN IF NOT EXISTS assigned_clinic_ids INTEGER[];

-- Done!
