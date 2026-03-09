-- Schema Creation for Nexadox Admin Panel
-- This SQL script creates all necessary tables for the Indian healthcare marketplace

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) CHECK (role IN ('admin', 'doctor', 'agent', 'attendant')) NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SPECIALTIES TABLE
CREATE TABLE IF NOT EXISTS specialties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon BYTEA, -- Base64 encoded image
  doctors_count INT DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. DEGREES TABLE
CREATE TABLE IF NOT EXISTS degrees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  doctors_count INT DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  country VARCHAR(255) DEFAULT 'India',
  address TEXT,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. CLINICS TABLE
CREATE TABLE IF NOT EXISTS clinics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  calling_code VARCHAR(10),
  mobile VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  building VARCHAR(255),
  area VARCHAR(255),
  street VARCHAR(255),
  landmark VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255) DEFAULT 'India',
  pincode VARCHAR(10),
  logo BYTEA, -- Base64 encoded image
  doctors_count INT DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DOCTORS TABLE
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  specialties TEXT[], -- Array of specialty IDs
  degrees TEXT[], -- Array of degree IDs
  clinic_id INT REFERENCES clinics(id),
  phone VARCHAR(20),
  status VARCHAR(20) CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  appointment_id VARCHAR(50) UNIQUE NOT NULL,
  doctor_id INT REFERENCES doctors(id),
  patient_name VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255),
  specialty VARCHAR(255),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TRANSACTIONS TABLE (Patient)
CREATE TABLE IF NOT EXISTS patient_transactions (
  id SERIAL PRIMARY KEY,
  txn_id VARCHAR(50) UNIQUE NOT NULL,
  booking_id VARCHAR(50),
  user_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  reason VARCHAR(255),
  amount DECIMAL(10, 2),
  balance DECIMAL(10, 2),
  status VARCHAR(20) CHECK (status IN ('completed', 'pending', 'failed')) DEFAULT 'completed',
  started_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TRANSACTIONS TABLE (Agent)
CREATE TABLE IF NOT EXISTS agent_transactions (
  id SERIAL PRIMARY KEY,
  txn_id VARCHAR(50) UNIQUE NOT NULL,
  booking_id VARCHAR(50),
  user_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  reason VARCHAR(255),
  amount DECIMAL(10, 2),
  balance DECIMAL(10, 2),
  status VARCHAR(20) CHECK (status IN ('completed', 'pending', 'failed')) DEFAULT 'completed',
  started_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. TRANSACTIONS TABLE (Attendant)
CREATE TABLE IF NOT EXISTS attendant_transactions (
  id SERIAL PRIMARY KEY,
  txn_id VARCHAR(50) UNIQUE NOT NULL,
  booking_id VARCHAR(50),
  user_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  reason VARCHAR(255),
  amount DECIMAL(10, 2),
  balance DECIMAL(10, 2),
  status VARCHAR(20) CHECK (status IN ('completed', 'pending', 'failed')) DEFAULT 'completed',
  started_on DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  txn_id VARCHAR(50) UNIQUE,
  booking_id VARCHAR(50),
  user_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  taxable_amount DECIMAL(10, 2),
  gst_amount DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  gst_percentage INT DEFAULT 18,
  status VARCHAR(20) CHECK (status IN ('issued', 'paid', 'pending')) DEFAULT 'issued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_specialties_name ON specialties(name);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_clinics_name ON clinics(name);
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_transactions_user_email ON patient_transactions(user_email);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
