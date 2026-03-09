// ============================================
// DATABASE TYPES
// ============================================

export type UserRole = 'admin' | 'doctor' | 'attendant' | 'agent' | 'patient';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentType = 'cash' | 'card' | 'upi' | 'wallet' | 'insurance';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type TransactionType = 'credit' | 'debit';
export type CommissionType = 'percentage' | 'fixed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BookingType = 'self' | 'agent' | 'attendant';

/**
 * Profile — SSoT for user identity.
 * PK = auth.users.id (UUID).
 */
export interface Profile {
  id: string;           // UUID from auth.users
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  status: UserStatus;
  created_at: string;
  updated_at?: string;
}

/**
 * AdminDetail — extension table for admin-role profiles.
 */
export interface AdminDetail {
  id: number;
  profile_id: string;   // FK → profiles.id
  permissions?: string[];
  created_at: string;
}

/**
 * @deprecated Use Profile instead. Kept for backward compatibility with legacy `users` table.
 */
export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  mobile?: string;
  avatar_url?: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Specialty {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  specialty_id?: string;
  experience?: number;
  certifications?: string[];
  clinic_locations?: ClinicLocation[];
  availability_schedule?: AvailabilitySchedule;
  consultation_fee?: number;
  is_accepting_patients: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
  specialty?: Specialty;
}

export interface ClinicLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
}

export interface AvailabilitySchedule {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface Patient {
  id: string;
  user_id: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergency_contact?: string;
  medical_history?: string;
  allergies?: string[];
  kyc_documents?: Record<string, string>;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Agent {
  id: string;
  user_id: string;
  profile_id?: string;      // FK → profiles.id
  wallet_balance: number;
  commission_type: CommissionType;
  commission_value: number;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  business_name?: string;
  business_address?: string;
  pan_number?: string;
  gst_number?: string;
  documents?: Record<string, string>;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Attendant {
  id: string;
  user_id: string;
  profile_id?: string;      // FK → profiles.id
  assigned_doctors?: string[];
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  booked_by?: string;
  booking_type: BookingType;
  appointment_date: string;
  time_slot: string;
  token_number: number;
  status: AppointmentStatus;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  notes?: string;
  payment_type?: PaymentType;
  payment_status: PaymentStatus;
  amount?: number;
  adjusted_amount?: number;
  checked_in_at?: string;
  checked_out_at?: string;
  created_at: string;
  updated_at: string;
  doctor?: Doctor;
  patient?: Patient;
  booked_by_user?: User;
}

export interface WalletTransaction {
  id: string;
  agent_id: string;
  amount: number;
  type: TransactionType;
  balance_before: number;
  balance_after: number;
  description?: string;
  reference_id?: string;
  created_at: string;
}

export interface CommissionLog {
  id: string;
  appointment_id: string;
  agent_id: string;
  commission_amount: number;
  commission_type: CommissionType;
  commission_value: number;
  base_amount: number;
  created_at: string;
}

export interface HealthRecord {
  id: string;
  patient_id: string;
  appointment_id?: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  read_status: boolean;
  action_url?: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  rating: number;
  review?: string;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  mobile: string;
  role: UserRole;
}

export interface AppointmentFormData {
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  time_slot: string;
  symptoms?: string;
  payment_type: PaymentType;
  amount: number;
}

export interface DoctorFormData {
  name: string;
  email: string;
  mobile: string;
  specialty_id: string;
  experience: number;
  consultation_fee: number;
  clinic_locations: ClinicLocation[];
  availability_schedule: AvailabilitySchedule;
}

// ============================================
// DASHBOARD STATS TYPES
// ============================================

export interface DashboardStats {
  total_users: number;
  total_doctors: number;
  total_agents: number;
  total_patients: number;
  total_appointments: number;
  total_revenue: number;
  pending_approvals: number;
  active_bookings: number;
}
