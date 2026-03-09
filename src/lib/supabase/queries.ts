import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";

// ============================================
// USER QUERIES
// ============================================

export async function getUserById(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserProfile(userId: string, updates: any) {
  const supabase = await createServerClient();
  // Map legacy field names to profiles columns
  const profileUpdates: any = {};
  if (updates.name !== undefined) profileUpdates.name = updates.name;
  if (updates.email !== undefined) profileUpdates.email = updates.email;
  if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
  if (updates.mobile !== undefined) profileUpdates.phone = updates.mobile;
  if (updates.status !== undefined) profileUpdates.status = updates.status;
  if (updates.role !== undefined) profileUpdates.role = updates.role;

  const { data, error } = await supabase
    .from("profiles")
    .update(profileUpdates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllUsers(filters?: { role?: string; search?: string }) {
  const supabase = await createServerClient();
  let query = supabase.from("profiles").select("*");

  if (filters?.role) {
    query = query.eq("role", filters.role);
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ============================================
// DOCTOR QUERIES
// ============================================

export async function getDoctorProfile(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("doctors")
    .select(`
      *,
      users (
        id,
        full_name,
        email,
        mobile,
        avatar_url
      ),
      specialties (
        id,
        name
      )
    `)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllDoctors(filters?: { specialty?: string; status?: string }) {
  const supabase = await createServerClient();
  let query = supabase.from("doctors").select(`
    *,
    users (
      id,
      full_name,
      email,
      mobile,
      avatar_url
    ),
    specialties (
      id,
      name
    )
  `);

  if (filters?.specialty) {
    query = query.eq("specialty_id", filters.specialty);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateDoctorProfile(doctorId: string, updates: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("doctors")
    .update(updates)
    .eq("id", doctorId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// DOCTOR SCHEDULE QUERIES
// ============================================

export async function getDoctorSchedule(doctorId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week", { ascending: true });

  if (error) throw error;
  return data;
}

export async function upsertDoctorSchedule(schedule: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .upsert(schedule)
    .select();

  if (error) throw error;
  return data;
}

// ============================================
// AGENT QUERIES
// ============================================

export async function getAgentProfile(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("agents")
    .select(`
      *,
      users (
        id,
        full_name,
        email,
        mobile,
        avatar_url
      )
    `)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllAgents(filters?: { status?: string }) {
  const supabase = await createServerClient();
  let query = supabase.from("agents").select(`
    *,
    users (
      id,
      full_name,
      email,
      mobile,
      avatar_url
    )
  `);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateAgentProfile(agentId: string, updates: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("agents")
    .update(updates)
    .eq("id", agentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// ATTENDANT QUERIES
// ============================================

export async function getAttendantProfile(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("attendants")
    .select(`
      *,
      users (
        id,
        full_name,
        email,
        mobile,
        avatar_url
      )
    `)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllAttendants() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("attendants")
    .select(`
      *,
      users (
        id,
        full_name,
        email,
        mobile,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ============================================
// APPOINTMENT QUERIES
// ============================================

export async function getAppointmentById(appointmentId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patients (
        id,
        users (
          full_name,
          email,
          mobile
        )
      ),
      doctors (
        id,
        users (
          full_name
        ),
        specialties (
          name
        )
      ),
      agents (
        id,
        users (
          full_name
        )
      )
    `)
    .eq("id", appointmentId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAppointments(filters: {
  doctorId?: string;
  patientId?: string;
  agentId?: string;
  status?: string;
  date?: string;
}) {
  const supabase = await createServerClient();
  let query = supabase.from("appointments").select(`
    *,
    patients (
      id,
      users (
        full_name,
        email,
        mobile
      )
    ),
    doctors (
      id,
      users (
        full_name
      ),
      specialties (
        name
      )
    ),
    agents (
      id,
      users (
        full_name
      )
    )
  `);

  if (filters.doctorId) {
    query = query.eq("doctor_id", filters.doctorId);
  }

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.agentId) {
    query = query.eq("agent_id", filters.agentId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.date) {
    query = query.gte("appointment_date", `${filters.date} 00:00:00`);
    query = query.lte("appointment_date", `${filters.date} 23:59:59`);
  }

  const { data, error } = await query.order("appointment_date", {
    ascending: true,
  });

  if (error) throw error;
  return data;
}

export async function createAppointment(appointment: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert(appointment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAppointment(appointmentId: string, updates: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// QUEUE QUERIES
// ============================================

export async function getQueue(filters: { doctorId?: string; date?: string }) {
  const supabase = await createServerClient();
  let query = supabase.from("appointments").select(`
    *,
    patients (
      id,
      users (
        full_name,
        email,
        mobile
      )
    ),
    doctors (
      id,
      users (
        full_name
      )
    )
  `);

  if (filters.doctorId) {
    query = query.eq("doctor_id", filters.doctorId);
  }

  if (filters.date) {
    query = query.gte("appointment_date", `${filters.date} 00:00:00`);
    query = query.lte("appointment_date", `${filters.date} 23:59:59`);
  }

  // Only active queue items
  query = query.in("status", ["waiting", "in_progress"]);
  query = query.not("token_number", "is", null);

  const { data, error } = await query.order("token_number", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getNextTokenNumber(date: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_next_token_number", {
    p_date: date,
  });

  if (error) throw error;
  return data;
}

export async function checkInPatient(appointmentId: string, tokenNumber: number) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: "waiting",
      token_number: tokenNumber,
      check_in_time: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function callNextPatient(doctorId: string) {
  const supabase = await createServerClient();
  
  // Get current date
  const today = new Date().toISOString().split("T")[0];

  // First, complete any in_progress appointments
  await supabase
    .from("appointments")
    .update({ status: "completed", consultation_end: new Date().toISOString() })
    .eq("doctor_id", doctorId)
    .eq("status", "in_progress");

  // Get next waiting patient
  const { data: nextPatient, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patients (
        id,
        users (
          full_name,
          mobile
        )
      )
    `)
    .eq("doctor_id", doctorId)
    .eq("status", "waiting")
    .gte("appointment_date", `${today} 00:00:00`)
    .lte("appointment_date", `${today} 23:59:59`)
    .order("token_number", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;

  // Update next patient to in_progress
  const { data: updatedAppointment, error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "in_progress",
      consultation_start: new Date().toISOString(),
    })
    .eq("id", nextPatient.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return updatedAppointment;
}

// ============================================
// PATIENT QUERIES
// ============================================

export async function getPatientById(patientId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select(`
      *,
      users (
        id,
        full_name,
        email,
        mobile,
        avatar_url
      )
    `)
    .eq("id", patientId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllPatients(filters?: { search?: string; doctorId?: string }) {
  const supabase = await createServerClient();
  let query = supabase.from("patients").select(`
    *,
    users (
      id,
      full_name,
      email,
      mobile,
      avatar_url
    )
  `);

  if (filters?.search) {
    query = query.or(
      `users.full_name.ilike.%${filters.search}%,users.mobile.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// ============================================
// HEALTH RECORD QUERIES
// ============================================

export async function getHealthRecords(patientId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("health_records")
    .select(`
      *,
      doctors (
        id,
        users (
          full_name
        )
      ),
      appointments (
        id,
        appointment_date
      )
    `)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createHealthRecord(record: any) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("health_records")
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// WALLET QUERIES
// ============================================

export async function getWalletBalance(userId: string) {
  const supabase = await createServerClient();
  // Wallet balance is in agents table, look up by profile_id or user_id
  const { data, error } = await supabase
    .from("agents")
    .select("wallet_balance")
    .or(`profile_id.eq.${userId},user_id.eq.${userId}`)
    .single();

  if (error) throw error;
  return data?.wallet_balance || 0;
}

export async function getWalletTransactions(userId: string, limit?: number) {
  const supabase = await createServerClient();
  let query = supabase
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function createWalletTransaction(transaction: {
  user_id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  reference_type?: string;
  reference_id?: string;
}) {
  const supabase = await createServerClient();
  
  // Use the stored procedure to handle wallet update atomically
  const { data, error } = await supabase.rpc("update_wallet_balance", {
    p_user_id: transaction.user_id,
    p_amount: transaction.type === "credit" ? transaction.amount : -transaction.amount,
    p_transaction_type: transaction.type,
    p_description: transaction.description,
    p_reference_type: transaction.reference_type,
    p_reference_id: transaction.reference_id,
  });

  if (error) throw error;
  return data;
}

// ============================================
// COMMISSION QUERIES
// ============================================

export async function getAgentCommissions(agentId: string, filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const supabase = await createServerClient();
  let query = supabase
    .from("commission_logs")
    .select(`
      *,
      appointments (
        id,
        appointment_date,
        consultation_fee,
        patients (
          users (
            full_name
          )
        ),
        doctors (
          users (
            full_name
          )
        )
      )
    `)
    .eq("agent_id", agentId);

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function calculateCommission(
  appointmentId: string,
  agentId: string,
  consultationFee: number
) {
  const supabase = await createServerClient();
  
  // Get agent's commission rate
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("commission_rate")
    .eq("id", agentId)
    .single();

  if (agentError) throw agentError;

  const commissionAmount = (consultationFee * agent.commission_rate) / 100;

  // Log commission
  const { data, error } = await supabase.rpc("log_commission", {
    p_agent_id: agentId,
    p_appointment_id: appointmentId,
    p_commission_amount: commissionAmount,
  });

  if (error) throw error;
  return data;
}

// ============================================
// NOTIFICATION QUERIES
// ============================================

export async function getNotifications(userId: string, unreadOnly: boolean = false) {
  const supabase = await createServerClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createNotification(notification: {
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id?: string;
}) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert(notification)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// STATISTICS QUERIES
// ============================================

export async function getDashboardStats(userId: string, role: string) {
  const supabase = await createServerClient();
  const today = new Date().toISOString().split("T")[0];

  if (role === "doctor") {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!doctor) return null;

    // Get today's appointments count
    const { count: todayAppointments } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .gte("appointment_date", `${today} 00:00:00`)
      .lte("appointment_date", `${today} 23:59:59`);

    // Get current queue count
    const { count: queueCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .in("status", ["waiting", "in_progress"])
      .gte("appointment_date", `${today} 00:00:00`)
      .lte("appointment_date", `${today} 23:59:59`);

    // Get total patients
    const { count: totalPatients } = await supabase
      .from("appointments")
      .select("patient_id", { count: "exact", head: true })
      .eq("doctor_id", doctor.id);

    return {
      todayAppointments: todayAppointments || 0,
      queueCount: queueCount || 0,
      totalPatients: totalPatients || 0,
    };
  }

  if (role === "agent") {
    const { data: agent } = await supabase
      .from("agents")
      .select("id, wallet_earnings")
      .eq("user_id", userId)
      .single();

    if (!agent) return null;

    // Get total bookings
    const { count: totalBookings } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent.id);

    // Get pending bookings
    const { count: pendingBookings } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("status", "scheduled");

    // Get this month's commission
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];
    
    const { data: monthCommissions } = await supabase
      .from("commission_logs")
      .select("commission_amount")
      .eq("agent_id", agent.id)
      .gte("created_at", startOfMonth);

    const monthlyEarnings = monthCommissions?.reduce(
      (sum, log) => sum + log.commission_amount,
      0
    ) || 0;

    return {
      totalBookings: totalBookings || 0,
      pendingBookings: pendingBookings || 0,
      monthlyEarnings,
      walletBalance: agent.wallet_earnings || 0,
    };
  }

  if (role === "attendant") {
    // Get today's check-ins
    const { count: todayCheckIns } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .not("check_in_time", "is", null)
      .gte("check_in_time", `${today} 00:00:00`)
      .lte("check_in_time", `${today} 23:59:59`);

    // Get current queue count
    const { count: queueCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .in("status", ["waiting", "in_progress"])
      .gte("appointment_date", `${today} 00:00:00`)
      .lte("appointment_date", `${today} 23:59:59`);

    // Get today's tokens issued
    const { count: tokensIssued } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .not("token_number", "is", null)
      .gte("check_in_time", `${today} 00:00:00`)
      .lte("check_in_time", `${today} 23:59:59`);

    return {
      todayCheckIns: todayCheckIns || 0,
      queueCount: queueCount || 0,
      tokensIssued: tokensIssued || 0,
    };
  }

  return null;
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export function subscribeToQueue(
  doctorId: string,
  callback: (payload: any) => void
) {
  const supabase = createClient();
  
  const subscription = supabase
    .channel("queue_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `doctor_id=eq.${doctorId}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}

export function subscribeToNotifications(
  userId: string,
  callback: (payload: any) => void
) {
  const supabase = createClient();
  
  const subscription = supabase
    .channel("notification_changes")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}
