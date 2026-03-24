-- ═══════════════════════════════════════════════════════════════
-- PRESCRIPTION LOOKUP TABLES MIGRATION
-- Auto-populated searchable dropdowns for prescription fields
-- ═══════════════════════════════════════════════════════════════

-- Medicine names (auto-populated when doctors prescribe)
CREATE TABLE IF NOT EXISTS rx_medicine_names (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicine compositions (e.g. Paracetamol 500mg + Caffeine 65mg)
CREATE TABLE IF NOT EXISTS rx_compositions (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dosages (e.g. 500mg, 250mg, 5ml)
CREATE TABLE IF NOT EXISTS rx_dosages (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Durations (e.g. 3 days, 7 days, 2 weeks)
CREATE TABLE IF NOT EXISTS rx_durations (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lab test names
CREATE TABLE IF NOT EXISTS rx_test_names (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagnosis terms
CREATE TABLE IF NOT EXISTS rx_diagnoses (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaint terms
CREATE TABLE IF NOT EXISTS rx_complaints (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add complaint column to prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS complaint TEXT;

-- Disable RLS on all lookup tables (public read/write via service role)
ALTER TABLE rx_medicine_names DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_compositions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_dosages        DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_durations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_test_names     DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_diagnoses      DISABLE ROW LEVEL SECURITY;
ALTER TABLE rx_complaints     DISABLE ROW LEVEL SECURITY;

-- Seed some common data
INSERT INTO rx_dosages (name) VALUES
  ('50mg'),('100mg'),('150mg'),('200mg'),('250mg'),('300mg'),('400mg'),('500mg'),('650mg'),('750mg'),('1g'),
  ('2.5ml'),('5ml'),('10ml'),('15ml'),('1 drop'),('2 drops')
ON CONFLICT (name) DO NOTHING;

INSERT INTO rx_durations (name) VALUES
  ('1 day'),('2 days'),('3 days'),('5 days'),('7 days'),('10 days'),('14 days'),('15 days'),
  ('21 days'),('30 days'),('1 week'),('2 weeks'),('3 weeks'),('1 month'),('2 months'),('3 months'),
  ('As needed'),('Until follow-up')
ON CONFLICT (name) DO NOTHING;
