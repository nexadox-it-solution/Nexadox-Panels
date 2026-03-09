-- ============================================================
-- NEXADOX — FULL DATABASE MIGRATION (v3 — June 2025)
-- Run this in your Supabase SQL Editor (safe to run multiple times)
-- Covers: Admin Panel, Doctor/Agent/Attendant Panels, Mobile App
--
-- Booking Model: SESSION-BASED (Morning/Afternoon/Evening/Night)
--   with seat limits (max_seats) per session per doctor per day
-- ============================================================

-- ============================================================
-- SECTION 1: CORE TABLES
-- ============================================================

-- 1. USERS TABLE (SERIAL primary key + auth_user_id for Supabase Auth link)
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  auth_user_id     UUID UNIQUE,            -- links to auth.users.id
  email            VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  full_name        VARCHAR(255),            -- alias used by queries.ts joins
  role             VARCHAR(50)  NOT NULL CHECK (role IN ('admin','doctor','agent','attendant','patient')),
  phone            VARCHAR(20),             -- used by admin panel
  mobile           VARCHAR(20),             -- used by register page / mobile app
  avatar_url       TEXT,
  wallet_balance   DECIMAL(10,2) DEFAULT 0,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id   UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name      VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile         VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10,2) DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Keep full_name in sync with name
CREATE OR REPLACE FUNCTION sync_full_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := COALESCE(NEW.full_name, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_full_name ON users;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_full_name();

-- Backfill existing rows
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- 2. SPECIALTIES
CREATE TABLE IF NOT EXISTS specialties (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  icon          TEXT,          -- base64 or URL
  category_id   INT,           -- optional category grouping
  doctors_count INT            DEFAULT 0,
  status        VARCHAR(20)    DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMPTZ    DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE specialties ADD COLUMN IF NOT EXISTS category_id INT;

-- 3. DEGREES
CREATE TABLE IF NOT EXISTS degrees (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  doctors_count INT         DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LOCATIONS
CREATE TABLE IF NOT EXISTS locations (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  address    TEXT,
  city       VARCHAR(255) NOT NULL,
  state      VARCHAR(255) NOT NULL,
  country    VARCHAR(255) DEFAULT 'India',
  status     VARCHAR(20)  DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- 5. CLINICS
CREATE TABLE IF NOT EXISTS clinics (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  title          VARCHAR(255),
  contact_person VARCHAR(255),
  email          VARCHAR(255),
  calling_code   VARCHAR(10),
  mobile         VARCHAR(20),
  latitude       DECIMAL(10,8),
  longitude      DECIMAL(11,8),
  building       VARCHAR(255),
  area           VARCHAR(255),
  street         VARCHAR(255),
  landmark       VARCHAR(255),
  city           VARCHAR(255),
  state          VARCHAR(255),
  country        VARCHAR(255) DEFAULT 'India',
  pincode        VARCHAR(10),
  location       TEXT,           -- combined location string used by clinic edit
  logo           TEXT,
  doctors_count  INT          DEFAULT 0,
  status         VARCHAR(20)  DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS location TEXT;

-- 6. DOCTORS (full schema used by all panels + mobile app)
CREATE TABLE IF NOT EXISTS doctors (
  id                       SERIAL PRIMARY KEY,
  auth_user_id             UUID UNIQUE,   -- links to auth.users.id for doctor login
  user_id                  INT REFERENCES users(id) ON DELETE SET NULL,
  name                     VARCHAR(255) NOT NULL,
  email                    VARCHAR(255) UNIQUE NOT NULL,
  mobile                   VARCHAR(20),
  avatar_url               TEXT,
  specialty_ids            INT[]        DEFAULT '{}',    -- FK array → specialties.id
  degree_ids               INT[]        DEFAULT '{}',    -- FK array → degrees.id
  clinic_ids               INT[]        DEFAULT '{}',    -- FK array → clinics.id
  experience               INT,                          -- years
  appointment_fee          DECIMAL(10,2) DEFAULT 0,
  consultation_fee         DECIMAL(10,2) DEFAULT 0,      -- alias used by booking service
  booking_fee              DECIMAL(10,2) DEFAULT 0,      -- fee charged by agent / portal
  agent_commission_percent DECIMAL(5,2)  DEFAULT 10,     -- % commission for agents
  about                    TEXT,
  achievements             TEXT[],                        -- array of achievement strings
  is_accepting_patients    BOOLEAN       DEFAULT true,
  status                   VARCHAR(20)   DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS auth_user_id             UUID;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mobile                   VARCHAR(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS avatar_url               TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty_ids            INT[]        DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS degree_ids               INT[]        DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_ids               INT[]        DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS appointment_fee          DECIMAL(10,2) DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee         DECIMAL(10,2) DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS booking_fee              DECIMAL(10,2) DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS agent_commission_percent DECIMAL(5,2)  DEFAULT 10;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS about                    TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS achievements             TEXT[];
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS is_accepting_patients    BOOLEAN       DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_auth_user_id ON doctors(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 7. PATIENTS (for mobile app users booking via App)
CREATE TABLE IF NOT EXISTS patients (
  id            SERIAL PRIMARY KEY,
  auth_user_id  UUID UNIQUE,    -- links to Supabase Auth
  user_id       INT REFERENCES users(id) ON DELETE SET NULL,
  name          VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(20),
  date_of_birth DATE,
  gender        VARCHAR(20),
  blood_group   VARCHAR(5),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  pincode       VARCHAR(10),
  emergency_contact VARCHAR(20),
  medical_history   TEXT,
  allergies         TEXT,
  profile_image     TEXT,
  status        VARCHAR(20) DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS auth_user_id      UUID;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_image     TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth     DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history   TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies         TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_auth_user_id ON patients(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 8. AGENTS
CREATE TABLE IF NOT EXISTS agents (
  id                SERIAL PRIMARY KEY,
  user_id           INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_balance    DECIMAL(10,2) DEFAULT 0,
  wallet_earnings   DECIMAL(10,2) DEFAULT 0,     -- lifetime earnings
  total_bookings    INT           DEFAULT 0,      -- lifetime booking count
  commission_type   VARCHAR(20)   DEFAULT 'percentage' CHECK (commission_type IN ('percentage','fixed')),
  commission_value  DECIMAL(10,2) DEFAULT 10,     -- main column
  commission_rate   DECIMAL(5,2)  DEFAULT 10,     -- alias used by commission service
  approval_status   VARCHAR(20)   DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by       INT,                           -- FK to users.id who approved
  approved_at       TIMESTAMPTZ,
  business_name     VARCHAR(255),
  business_address  TEXT,
  pan_number        VARCHAR(20),
  gst_number        VARCHAR(20),
  kyc_documents     JSONB,                         -- uploaded KYC docs
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_balance   DECIMAL(10,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_earnings  DECIMAL(10,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_bookings   INT           DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_type  VARCHAR(20)   DEFAULT 'percentage';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) DEFAULT 10;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_rate  DECIMAL(5,2)  DEFAULT 10;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approval_status  VARCHAR(20)   DEFAULT 'pending';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approved_by      INT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_name    VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS pan_number       VARCHAR(20);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gst_number       VARCHAR(20);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS kyc_documents    JSONB;

-- 9. ATTENDANTS
CREATE TABLE IF NOT EXISTS attendants (
  id                  SERIAL PRIMARY KEY,
  user_id             INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  assigned_doctors    INT[]     DEFAULT '{}',      -- array of doctors.id
  assigned_clinic_ids INT[]     DEFAULT '{}',      -- array of clinics.id
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attendants ADD COLUMN IF NOT EXISTS assigned_doctors    INT[] DEFAULT '{}';
ALTER TABLE attendants ADD COLUMN IF NOT EXISTS assigned_clinic_ids INT[] DEFAULT '{}';

-- ============================================================
-- SECTION 2: APPOINTMENTS (comprehensive — used by all panels + app)
-- Session-based: slot stores "Morning","Afternoon","Evening","Night"
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
  id                   SERIAL PRIMARY KEY,
  appointment_id       VARCHAR(50) UNIQUE NOT NULL,     -- e.g. APT1A2B3C
  patient_name         VARCHAR(255) NOT NULL,
  patient_email        VARCHAR(255),
  patient_phone        VARCHAR(20),
  patient_dob          DATE,
  patient_gender       VARCHAR(20),
  doctor_id            INT REFERENCES doctors(id) ON DELETE SET NULL,
  clinic_id            INT REFERENCES clinics(id) ON DELETE SET NULL,
  patient_id           INT REFERENCES patients(id) ON DELETE SET NULL,
  agent_id             INT REFERENCES users(id) ON DELETE SET NULL,
  specialty            VARCHAR(255),                     -- denormalized specialty name
  appointment_date     DATE NOT NULL,
  appointment_time     VARCHAR(10),                      -- nullable for session-based
  slot                 VARCHAR(20),                      -- "Morning","Afternoon","Evening","Night"
  token_number         INT,
  status               VARCHAR(30) DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','waiting','in_progress','completed','cancelled','no_show')),
  checkin_status       VARCHAR(30),                      -- 'pending','checked_in','waiting','in_progress','completed'
  checkin_time         TIMESTAMPTZ,
  check_in_time        TIMESTAMPTZ,                      -- alias used by queries.ts
  consultation_type    VARCHAR(30),                      -- 'in_person','video','phone','in-person','teleconsult'
  consultation_start   TIMESTAMPTZ,
  consultation_end     TIMESTAMPTZ,
  completion_time      TIMESTAMPTZ,
  consultation_fee     DECIMAL(10,2) DEFAULT 0,
  source_role          VARCHAR(30) DEFAULT 'Admin'
                         CHECK (source_role IN ('Admin','Agent','Attendant','App')),
  booking_amount       DECIMAL(10,2) DEFAULT 0,
  commission_amount    DECIMAL(10,2) DEFAULT 0,
  commission_paid      BOOLEAN DEFAULT false,
  payable_amount       DECIMAL(10,2) DEFAULT 0,
  payment_status       VARCHAR(20) DEFAULT 'pending'
                         CHECK (payment_status IN ('pending','completed','paid','failed','refunded')),
  voucher_id           INT,
  invoice_id           INT,
  created_by_agent_id  INT REFERENCES users(id) ON DELETE SET NULL,
  notes                TEXT,
  symptoms             TEXT,
  diagnosis            TEXT,
  prescription         TEXT,
  cancellation_reason  TEXT,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone        VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_dob          DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_gender       VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id            INT REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id           INT REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS agent_id             INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS specialty            VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS slot                 VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS token_number         INT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checkin_status       VARCHAR(30);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checkin_time         TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_time        TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_type    VARCHAR(30);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_start   TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_end     TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_time      TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_fee     DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source_role          VARCHAR(30) DEFAULT 'Admin';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_amount       DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS commission_amount    DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS commission_paid      BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payable_amount       DECIMAL(10,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status       VARCHAR(20) DEFAULT 'pending';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS voucher_id           INT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS invoice_id           INT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_agent_id  INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS symptoms             TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis            TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription         TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;

-- Make appointment_time nullable (session-based booking doesn't require a time)
ALTER TABLE appointments ALTER COLUMN appointment_time DROP NOT NULL;

-- ============================================================
-- SECTION 3: VOUCHERS (created for every appointment)
-- ============================================================

CREATE TABLE IF NOT EXISTS vouchers (
  id                SERIAL PRIMARY KEY,
  voucher_number    VARCHAR(50) UNIQUE NOT NULL,
  appointment_id    INT REFERENCES appointments(id) ON DELETE SET NULL,
  patient_name      VARCHAR(255),
  doctor_name       VARCHAR(255),
  clinic_name       VARCHAR(255),
  appointment_date  DATE,
  appointment_slot  VARCHAR(20),
  booking_amount    DECIMAL(10,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  total_payable     DECIMAL(10,2) DEFAULT 0,
  status            VARCHAR(20)   DEFAULT 'active' CHECK (status IN ('active','cancelled','used')),
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS appointment_slot  VARCHAR(20);

-- ============================================================
-- SECTION 4: INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  txn_id          VARCHAR(50) UNIQUE,
  booking_id      VARCHAR(50),
  appointment_id  INT REFERENCES appointments(id) ON DELETE SET NULL,
  user_id         VARCHAR(50),
  user_name       VARCHAR(255),
  user_email      VARCHAR(255),
  invoice_number  VARCHAR(50) UNIQUE NOT NULL,
  invoice_date    DATE NOT NULL,
  taxable_amount  DECIMAL(10,2),
  gst_amount      DECIMAL(10,2),
  gst             DECIMAL(10,2),            -- alias used by invoice detail page
  total_amount    DECIMAL(10,2),
  gst_percentage  INT     DEFAULT 18,
  status          VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('issued','paid','pending')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst            DECIMAL(10,2);

-- ============================================================
-- SECTION 5: DOCTOR SCHEDULES (Session-based)
-- slot values: "Morning", "Afternoon", "Evening", "Night"
-- max_seats: max appointments allowed per session (default 30)
-- doctor_id stored as TEXT for flexibility (can hold SERIAL id or UUID)
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id         SERIAL PRIMARY KEY,
  doctor_id  VARCHAR(50) NOT NULL,     -- stored as text for flexibility
  date       DATE NOT NULL,
  slot       VARCHAR(20) NOT NULL,     -- "Morning","Afternoon","Evening","Night"
  max_seats  INT NOT NULL DEFAULT 30,  -- max appointments per session
  clinic_id  INT REFERENCES clinics(id) ON DELETE SET NULL,
  status     VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','booked','cancelled')),
  day_of_week INT,                     -- 0=Sun..6=Sat (used by queries.ts ordering)
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, date, slot)
);

ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS clinic_id   INT REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS max_seats   INT NOT NULL DEFAULT 30;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS day_of_week INT;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS notes       TEXT;

-- ============================================================
-- SECTION 6: WALLET TRANSACTIONS (general — used by queries.ts)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES users(id) ON DELETE CASCADE,
  amount         DECIMAL(10,2) NOT NULL,
  type           VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit')),
  description    TEXT,
  reference_type VARCHAR(50),      -- 'appointment','appointment_refund','top_up','commission','withdrawal'
  reference_id   INT,
  balance_before DECIMAL(10,2),
  balance_after  DECIMAL(10,2),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS balance_before  DECIMAL(10,2);
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS balance_after   DECIMAL(10,2);
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reference_type  VARCHAR(50);

-- Agent-specific wallet transactions (legacy)
CREATE TABLE IF NOT EXISTS agent_wallet_transactions (
  id           SERIAL PRIMARY KEY,
  agent_id     INT REFERENCES agents(id) ON DELETE CASCADE,
  amount       DECIMAL(10,2) NOT NULL,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit')),
  balance_before DECIMAL(10,2),
  balance_after  DECIMAL(10,2),
  description  TEXT,
  reference_id INT,     -- appointment id
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Agent transactions (admin panel view)
-- Agent transactions (admin panel view)
CREATE TABLE IF NOT EXISTS agent_transactions (
  id          SERIAL PRIMARY KEY,
  txn_id      VARCHAR(50) UNIQUE NOT NULL,
  booking_id  VARCHAR(50),
  user_id     VARCHAR(50),
  user_name   VARCHAR(255),
  user_email  VARCHAR(255),
  reason      VARCHAR(255),
  amount      DECIMAL(10,2),
  balance     DECIMAL(10,2),
  status      VARCHAR(20) DEFAULT 'completed',
  started_on  DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Admin transactions (tracks bookings created by admin)
CREATE TABLE IF NOT EXISTS admin_transactions (
  id          SERIAL PRIMARY KEY,
  txn_id      VARCHAR(50) UNIQUE NOT NULL,
  booking_id  VARCHAR(50),
  user_id     VARCHAR(50),
  user_name   VARCHAR(255),
  user_email  VARCHAR(255),
  reason      VARCHAR(255),
  amount      DECIMAL(10,2),
  balance     DECIMAL(10,2),
  status      VARCHAR(20) DEFAULT 'completed',
  started_on  DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_transactions DISABLE ROW LEVEL SECURITY;

-- Attendant transactions (admin panel view)
CREATE TABLE IF NOT EXISTS attendant_transactions (
  id          SERIAL PRIMARY KEY,
  txn_id      VARCHAR(50) UNIQUE NOT NULL,
  booking_id  VARCHAR(50),
  user_id     VARCHAR(50),
  user_name   VARCHAR(255),
  user_email  VARCHAR(255),
  reason      VARCHAR(255),
  amount      DECIMAL(10,2),
  balance     DECIMAL(10,2),
  status      VARCHAR(20) DEFAULT 'completed',
  started_on  DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Patient transactions (admin panel + mobile app wallet)
CREATE TABLE IF NOT EXISTS patient_transactions (
  id         SERIAL PRIMARY KEY,
  txn_id     VARCHAR(50) UNIQUE NOT NULL,
  booking_id VARCHAR(50),
  patient_id INT REFERENCES patients(id) ON DELETE SET NULL,
  user_id    VARCHAR(50),
  user_name  VARCHAR(255),
  user_email VARCHAR(255),
  reason     VARCHAR(255),
  amount     DECIMAL(10,2),
  balance    DECIMAL(10,2),
  status     VARCHAR(20) DEFAULT 'completed',
  started_on DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patient_transactions ADD COLUMN IF NOT EXISTS patient_id INT REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE patient_transactions ADD COLUMN IF NOT EXISTS user_id    VARCHAR(50);

-- ============================================================
-- SECTION 7: COMMISSION LOGS (Agent commissions per booking)
-- ============================================================

CREATE TABLE IF NOT EXISTS commission_logs (
  id                SERIAL PRIMARY KEY,
  agent_id          INT REFERENCES agents(id) ON DELETE CASCADE,
  appointment_id    INT REFERENCES appointments(id) ON DELETE SET NULL,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_type   VARCHAR(20),       -- 'percentage' or 'fixed'
  commission_value  DECIMAL(10,2),     -- rate or fixed amount used
  base_amount       DECIMAL(10,2),     -- the amount commission was calculated on
  status            VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS commission_type  VARCHAR(20);
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2);
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS base_amount      DECIMAL(10,2);

-- ============================================================
-- SECTION 8: QUEUE / CHECK-IN (Attendant panel)
-- ============================================================

CREATE TABLE IF NOT EXISTS queue (
  id                SERIAL PRIMARY KEY,
  appointment_id    INT REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id         INT REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id         INT REFERENCES clinics(id) ON DELETE SET NULL,
  patient_name      VARCHAR(255),
  token_number      INT,
  queue_date        DATE DEFAULT CURRENT_DATE,
  status            VARCHAR(30) DEFAULT 'waiting'
                      CHECK (status IN ('waiting','in_progress','completed','skipped')),
  checked_in_at     TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 9: VITALS (Attendant checkin + Doctor panel)
-- ============================================================

CREATE TABLE IF NOT EXISTS vitals (
  id             SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  patient_name   VARCHAR(255),
  bp             VARCHAR(20),           -- blood pressure (e.g. "120/80")
  pulse          INT,                    -- heart rate / BPM
  spo2           INT,                    -- oxygen saturation %
  temperature    DECIMAL(5,2),           -- body temperature
  weight         DECIMAL(5,2),           -- kg
  height         DECIMAL(5,2),           -- cm
  bmi            DECIMAL(5,2),           -- body mass index
  notes          TEXT,
  recorded_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vitals ADD COLUMN IF NOT EXISTS bp    VARCHAR(20);
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS pulse INT;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS spo2  INT;
ALTER TABLE vitals ADD COLUMN IF NOT EXISTS bmi   DECIMAL(5,2);

-- ============================================================
-- SECTION 10: PRESCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS prescriptions (
  id             SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id      INT REFERENCES doctors(id) ON DELETE SET NULL,
  patient_name   VARCHAR(255),
  diagnosis      TEXT,
  medicines      JSONB,       -- [{name, dosage, frequency, duration, instructions}]
  notes          TEXT,         -- doctor notes / instructions
  tests          JSONB,       -- [{name, instructions}]
  follow_up_date DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tests JSONB;

-- ============================================================
-- SECTION 11: NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INT REFERENCES users(id) ON DELETE CASCADE,
  patient_id   INT REFERENCES patients(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  message      TEXT,          -- notification body text
  body         TEXT,          -- alias
  type         VARCHAR(50),   -- 'appointment','wallet','booking_confirmed','reminder'
  data         JSONB,
  reference_id INT,
  is_read      BOOLEAN DEFAULT false,
  read_status  VARCHAR(20),   -- optional read tracking
  action_url   TEXT,           -- optional deep link
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS patient_id    INT REFERENCES patients(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message       TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body          TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data          JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id  INT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read       BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_status   VARCHAR(20);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url    TEXT;

-- ============================================================
-- SECTION 12: PATIENT HEALTH RECORDS (Mobile app + Doctor panel)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_records (
  id             SERIAL PRIMARY KEY,
  patient_id     INT REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id      INT REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL,
  diagnosis      TEXT,
  prescription   TEXT,
  notes          TEXT,
  file_url       TEXT,
  file_name      VARCHAR(255),
  file_type      VARCHAR(50),
  file_size      INT,
  description    TEXT,
  uploaded_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE health_records ADD COLUMN IF NOT EXISTS doctor_id    INT REFERENCES doctors(id) ON DELETE SET NULL;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS diagnosis    TEXT;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS uploaded_by  INT REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 13: FEEDBACK / RATINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id             SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id     INT REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id      INT REFERENCES doctors(id) ON DELETE CASCADE,
  rating         INT CHECK (rating BETWEEN 1 AND 5),
  review         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 14: SYSTEM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(100) UNIQUE NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 15: FK CONSTRAINTS (add after all tables exist)
-- ============================================================

-- Link voucher_id in appointments → vouchers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_appointments_voucher_id'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT fk_appointments_voucher_id
      FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Link invoice_id in appointments → invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_appointments_invoice_id'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT fk_appointments_invoice_id
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- SECTION 16: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status          ON users(status);

CREATE INDEX IF NOT EXISTS idx_doctors_email         ON doctors(email);
CREATE INDEX IF NOT EXISTS idx_doctors_status        ON doctors(status);

CREATE INDEX IF NOT EXISTS idx_patients_email        ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_phone        ON patients(phone);

CREATE INDEX IF NOT EXISTS idx_agents_user_id        ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_approval       ON agents(approval_status);

CREATE INDEX IF NOT EXISTS idx_attendants_user_id    ON attendants(user_id);

CREATE INDEX IF NOT EXISTS idx_appt_doctor_id        ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_id        ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appt_patient_id       ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_agent_id_col     ON appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appt_date             ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_status           ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_checkin          ON appointments(checkin_status);
CREATE INDEX IF NOT EXISTS idx_appt_source           ON appointments(source_role);
CREATE INDEX IF NOT EXISTS idx_appt_slot             ON appointments(slot);
CREATE INDEX IF NOT EXISTS idx_appt_agent_id         ON appointments(created_by_agent_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_appt_id      ON vouchers(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_appt_id      ON invoices(appointment_id);

CREATE INDEX IF NOT EXISTS idx_sched_doctor_date     ON doctor_schedules(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_sched_status          ON doctor_schedules(status);

CREATE INDEX IF NOT EXISTS idx_queue_doctor_date     ON queue(doctor_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_status          ON queue(status);

CREATE INDEX IF NOT EXISTS idx_vitals_appt           ON vitals(appointment_id);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_user       ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_agent      ON commission_logs(agent_id);

CREATE INDEX IF NOT EXISTS idx_notif_user            ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_patient         ON notifications(patient_id);

CREATE INDEX IF NOT EXISTS idx_health_patient        ON health_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_feedback_doctor       ON feedback(doctor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_patient      ON feedback(patient_id);

-- ============================================================
-- SECTION 17: ROW LEVEL SECURITY — DISABLE
-- Admin panel uses service role key, so RLS is bypassed anyway.
-- Disabling ensures anon/authenticated keys also work from
-- client components without needing explicit policies.
-- ============================================================

ALTER TABLE users                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctors                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendants                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinics                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE specialties                DISABLE ROW LEVEL SECURITY;
ALTER TABLE degrees                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules           DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_wallet_transactions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_transactions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendant_transactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_transactions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs            DISABLE ROW LEVEL SECURITY;
ALTER TABLE queue                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE vitals                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions              DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications              DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_records             DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings            DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 18: STORED PROCEDURES / RPC FUNCTIONS
-- Used by booking.service, wallet.service, commission.service
-- ============================================================

-- 18a. Update wallet balance atomically
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_user_id        INT,
  p_amount         DECIMAL(10,2),
  p_type           VARCHAR(10),      -- 'credit' or 'debit'
  p_description    TEXT DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id   INT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current DECIMAL(10,2);
  v_new     DECIMAL(10,2);
BEGIN
  SELECT wallet_balance INTO v_current FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User % not found', p_user_id; END IF;

  IF p_type = 'credit' THEN
    v_new := v_current + p_amount;
  ELSIF p_type = 'debit' THEN
    IF v_current < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance: current=%, requested=%', v_current, p_amount;
    END IF;
    v_new := v_current - p_amount;
  ELSE
    RAISE EXCEPTION 'Invalid type: %. Must be credit or debit.', p_type;
  END IF;

  UPDATE users SET wallet_balance = v_new, updated_at = NOW() WHERE id = p_user_id;

  INSERT INTO wallet_transactions (user_id, amount, type, description, reference_type, reference_id, balance_before, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_description, p_reference_type, p_reference_id, v_current, v_new);
END;
$$ LANGUAGE plpgsql;

-- 18b. Get next token number for a doctor+date+slot
CREATE OR REPLACE FUNCTION get_next_token_number(
  p_doctor_id INT,
  p_date      DATE,
  p_slot      VARCHAR(20) DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(token_number), 0) INTO v_max
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND appointment_date = p_date
    AND (p_slot IS NULL OR slot = p_slot)
    AND status != 'cancelled';
  RETURN v_max + 1;
END;
$$ LANGUAGE plpgsql;

-- 18c. Log a commission for an agent
CREATE OR REPLACE FUNCTION log_commission(
  p_agent_id          INT,
  p_appointment_id    INT,
  p_commission_amount DECIMAL(10,2)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO commission_logs (agent_id, appointment_id, commission_amount, status)
  VALUES (p_agent_id, p_appointment_id, p_commission_amount, 'pending');

  -- Update agent wallet
  UPDATE agents
  SET wallet_balance  = wallet_balance + p_commission_amount,
      wallet_earnings = wallet_earnings + p_commission_amount,
      total_bookings  = total_bookings + 1,
      updated_at      = NOW()
  WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 19: SEED — DEFAULT SYSTEM SETTINGS
-- ============================================================

INSERT INTO system_settings (key, value, description)
VALUES
  ('platform_name',            '"Nexadox"',                                          'Platform display name'),
  ('default_gst_percent',      '18',                                                  'Default GST percentage'),
  ('default_agent_commission', '10',                                                  'Default agent commission %'),
  ('booking_sessions',         '["Morning","Afternoon","Evening","Night"]',           'Available booking sessions'),
  ('default_max_seats',        '30',                                                  'Default max seats per session')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SECTION 20: REALTIME — Enable for subscribed tables
-- ============================================================

-- Enable realtime for tables that have live subscriptions
DO $$
BEGIN
  -- appointments (doctor queue, attendant queue)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- notifications (live notification feed)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ✅ MIGRATION COMPLETE  (v3 — June 2025)
--
-- After running this in Supabase SQL Editor:
--   1. Authentication → Policies → Ensure service_role bypass is ON
--   2. Storage → Create buckets for avatars/documents if needed
--   3. Create auth users via the admin panel (they auto-link via auth_user_id)
--
-- Session-based booking:
--   Slots = "Morning" | "Afternoon" | "Evening" | "Night"
--   Each doctor_schedule row = 1 session + max_seats (default 30)
--   Appointments reference the session name in the `slot` column
--
-- Tables (26):
--   users, specialties, degrees, locations, clinics, doctors, patients,
--   agents, attendants, appointments, vouchers, invoices,
--   doctor_schedules, wallet_transactions, agent_wallet_transactions,
--   agent_transactions, attendant_transactions, patient_transactions,
--   commission_logs, queue, vitals, prescriptions, notifications,
--   health_records, feedback, system_settings
--
-- RPC Functions (3):
--   update_wallet_balance, get_next_token_number, log_commission
-- ============================================================
