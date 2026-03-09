-- ============================================
-- NEXADOX DATABASE SCHEMA
-- Modern Doctor Booking & Clinic Management SaaS
-- Database: PostgreSQL (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- User Roles
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'attendant', 'agent', 'patient');

-- User Status
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

-- Appointment Status
CREATE TYPE appointment_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Payment Type
CREATE TYPE payment_type AS ENUM ('cash', 'card', 'upi', 'wallet', 'insurance');

-- Payment Status
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Transaction Type
CREATE TYPE transaction_type AS ENUM ('credit', 'debit');

-- Commission Type
CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');

-- Agent Approval Status
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Booking Type
CREATE TYPE booking_type AS ENUM ('self', 'agent', 'attendant');

-- ============================================
-- TABLES
-- ============================================

-- Categories Table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Specialties Table
CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(20),
  avatar_url TEXT,
  status user_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctors Table
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
  experience INTEGER, -- years of experience
  certifications TEXT[], -- array of certification names
  clinic_locations JSONB, -- {address, city, state, pincode, phone}
  availability_schedule JSONB, -- {monday: [{start: "09:00", end: "17:00"}], ...}
  consultation_fee DECIMAL(10, 2),
  is_accepting_patients BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients Table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_group VARCHAR(5),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  emergency_contact VARCHAR(20),
  medical_history TEXT,
  allergies TEXT[],
  kyc_documents JSONB, -- {aadhar_url, pan_url, etc}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents Table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_balance DECIMAL(10, 2) DEFAULT 0,
  commission_type commission_type DEFAULT 'percentage',
  commission_value DECIMAL(10, 2) DEFAULT 0, -- percentage or fixed amount
  approval_status approval_status DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  business_name VARCHAR(255),
  business_address TEXT,
  pan_number VARCHAR(20),
  gst_number VARCHAR(20),
  documents JSONB, -- {pan_url, gst_url, etc}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendants Table
CREATE TABLE attendants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  assigned_doctors UUID[], -- array of doctor user_ids
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  booked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_type booking_type NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL, -- "09:00-09:30"
  token_number INTEGER NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  symptoms TEXT,
  diagnosis TEXT,
  prescription TEXT,
  notes TEXT,
  payment_type payment_type,
  payment_status payment_status DEFAULT 'pending',
  amount DECIMAL(10, 2),
  adjusted_amount DECIMAL(10, 2), -- for agent bookings
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_out_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique token per doctor per day
  CONSTRAINT unique_token_per_doctor_per_day 
    UNIQUE (doctor_id, appointment_date, token_number)
);

-- Wallet Transactions Table
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  type transaction_type NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_id UUID, -- reference to appointment or other transaction
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commission Logs Table
CREATE TABLE commission_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  commission_amount DECIMAL(10, 2) NOT NULL,
  commission_type commission_type NOT NULL,
  commission_value DECIMAL(10, 2) NOT NULL,
  base_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health Records Table
CREATE TABLE health_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  description TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50), -- booking, payment, alert, etc
  read_status BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback Table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Settings Table
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_specialty_id ON doctors(specialty_id);

CREATE INDEX idx_patients_user_id ON patients(user_id);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_approval_status ON agents(approval_status);

CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_booked_by ON appointments(booked_by);

CREATE INDEX idx_wallet_transactions_agent_id ON wallet_transactions(agent_id);
CREATE INDEX idx_commission_logs_agent_id ON commission_logs(agent_id);
CREATE INDEX idx_commission_logs_appointment_id ON commission_logs(appointment_id);

CREATE INDEX idx_health_records_patient_id ON health_records(patient_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_feedback_doctor_id ON feedback(doctor_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

-- Users Table Policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Doctors Table Policies
CREATE POLICY "Anyone can view active doctors" ON doctors
  FOR SELECT USING (true);

CREATE POLICY "Doctors can update own profile" ON doctors
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "Admins can manage doctors" ON doctors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Patients Table Policies
CREATE POLICY "Patients can view own data" ON patients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Patients can update own data" ON patients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Doctors can view patient data for appointments" ON patients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.user_id = auth.uid() AND a.patient_id = patients.id
    )
  );

-- Appointments Table Policies
CREATE POLICY "Users can view own appointments" ON appointments
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR
    booked_by = auth.uid()
  );

CREATE POLICY "Agents can create appointments" ON appointments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents WHERE user_id = auth.uid() AND approval_status = 'approved'
    )
  );

CREATE POLICY "Doctors can update appointments" ON appointments
  FOR UPDATE USING (
    doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
  );

-- Wallet Transactions Policies
CREATE POLICY "Agents can view own transactions" ON wallet_transactions
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- Health Records Policies
CREATE POLICY "Patients can view own health records" ON health_records
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Doctors can view patient health records" ON health_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.user_id = auth.uid() AND a.patient_id = health_records.patient_id
    )
  );

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Public access for categories and specialties
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view specialties" ON specialties
  FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate next token number for a doctor on a specific date
CREATE OR REPLACE FUNCTION get_next_token_number(
  p_doctor_id UUID,
  p_appointment_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  next_token INTEGER;
BEGIN
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO next_token
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND appointment_date = p_appointment_date;
  
  RETURN next_token;
END;
$$ LANGUAGE plpgsql;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_agent_id UUID,
  p_amount DECIMAL,
  p_type transaction_type,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  current_balance DECIMAL;
  new_balance DECIMAL;
  transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT wallet_balance INTO current_balance
  FROM agents
  WHERE id = p_agent_id
  FOR UPDATE;
  
  -- Calculate new balance
  IF p_type = 'credit' THEN
    new_balance := current_balance + p_amount;
  ELSE
    new_balance := current_balance - p_amount;
  END IF;
  
  -- Update agent balance
  UPDATE agents
  SET wallet_balance = new_balance,
      updated_at = NOW()
  WHERE id = p_agent_id;
  
  -- Insert transaction record
  INSERT INTO wallet_transactions (
    agent_id, amount, type, balance_before, balance_after, description, reference_id
  )
  VALUES (
    p_agent_id, p_amount, p_type, current_balance, new_balance, p_description, p_reference_id
  )
  RETURNING id INTO transaction_id;
  
  RETURN transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate and log commission
CREATE OR REPLACE FUNCTION log_commission(
  p_appointment_id UUID,
  p_agent_id UUID,
  p_base_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  agent_commission_type commission_type;
  agent_commission_value DECIMAL;
  calculated_commission DECIMAL;
  commission_log_id UUID;
BEGIN
  -- Get agent commission details
  SELECT commission_type, commission_value
  INTO agent_commission_type, agent_commission_value
  FROM agents
  WHERE id = p_agent_id;
  
  -- Calculate commission
  IF agent_commission_type = 'percentage' THEN
    calculated_commission := (p_base_amount * agent_commission_value) / 100;
  ELSE
    calculated_commission := agent_commission_value;
  END IF;
  
  -- Insert commission log
  INSERT INTO commission_logs (
    appointment_id, agent_id, commission_amount, commission_type, commission_value, base_amount
  )
  VALUES (
    p_appointment_id, p_agent_id, calculated_commission, agent_commission_type, agent_commission_value, p_base_amount
  )
  RETURNING id INTO commission_log_id;
  
  RETURN commission_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (Optional)
-- ============================================

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('General Medicine', 'General health and wellness'),
  ('Pediatrics', 'Child healthcare'),
  ('Cardiology', 'Heart and cardiovascular system'),
  ('Dermatology', 'Skin, hair, and nails'),
  ('Orthopedics', 'Bones, joints, and muscles');

-- Insert default specialties
INSERT INTO specialties (category_id, name, description)
SELECT 
  c.id,
  specialty_name,
  specialty_desc
FROM categories c
CROSS JOIN (
  VALUES 
    ('General Medicine', 'General Physician', 'Primary healthcare provider'),
    ('Pediatrics', 'Pediatrician', 'Child specialist'),
    ('Cardiology', 'Cardiologist', 'Heart specialist'),
    ('Dermatology', 'Dermatologist', 'Skin specialist'),
    ('Orthopedics', 'Orthopedic Surgeon', 'Bone and joint specialist')
) AS s(category_name, specialty_name, specialty_desc)
WHERE c.name = s.category_name;

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_commission_percentage', '10', 'Default commission percentage for agents'),
  ('booking_enabled', 'true', 'Global booking on/off switch'),
  ('max_appointments_per_day', '50', 'Maximum appointments per doctor per day'),
  ('appointment_slot_duration', '30', 'Duration of each appointment slot in minutes');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'Main users table extending Supabase Auth';
COMMENT ON TABLE doctors IS 'Doctor profiles with specialties and availability';
COMMENT ON TABLE patients IS 'Patient profiles with medical history';
COMMENT ON TABLE agents IS 'Booking agents with wallet and commission';
COMMENT ON TABLE appointments IS 'Appointment bookings with token system';
COMMENT ON TABLE wallet_transactions IS 'Agent wallet transaction ledger';
COMMENT ON TABLE commission_logs IS 'Commission calculation and tracking';
