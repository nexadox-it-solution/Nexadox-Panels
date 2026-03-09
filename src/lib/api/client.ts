/**
 * Client-side API utilities for calling backend APIs
 */

// Appointments API
export async function fetchAppointments(filters?: {
  doctorId?: string;
  patientId?: string;
  agentId?: string;
  status?: string;
  date?: string;
}) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const response = await fetch(`/api/appointments?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch appointments");
  }
  return response.json();
}

export async function updateAppointment(id: string, updates: any) {
  const response = await fetch("/api/appointments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!response.ok) {
    throw new Error("Failed to update appointment");
  }
  return response.json();
}

// Booking API
export async function createBooking(bookingData: {
  patientId: string;
  doctorId: string;
  agentId?: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: string;
  symptoms?: string;
  notes?: string;
}) {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...bookingData }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create booking");
  }
  return response.json();
}

export async function cancelBooking(
  appointmentId: string,
  cancelReason: string,
  refundAmount?: number
) {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "cancel",
      appointmentId,
      cancelReason,
      refundAmount,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to cancel booking");
  }
  return response.json();
}

export async function rescheduleBooking(
  appointmentId: string,
  newDate: string,
  newTime: string
) {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reschedule", appointmentId, newDate, newTime }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reschedule booking");
  }
  return response.json();
}

export async function completeAppointment(
  appointmentId: string,
  diagnosis?: string,
  prescription?: string,
  notes?: string
) {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      appointmentId,
      diagnosis,
      prescription,
      notes,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to complete appointment");
  }
  return response.json();
}

// Queue API
export async function fetchQueue(filters?: { doctorId?: string; date?: string }) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const response = await fetch(`/api/queue?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch queue");
  }
  return response.json();
}

export async function checkInPatient(appointmentId: string, date?: string) {
  const response = await fetch("/api/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId, date }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to check in patient");
  }
  return response.json();
}

export async function callNextPatient(doctorId: string) {
  const response = await fetch("/api/queue/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctorId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to call next patient");
  }
  return response.json();
}

// Wallet API
export async function fetchWalletData() {
  const response = await fetch("/api/wallet");
  if (!response.ok) {
    throw new Error("Failed to fetch wallet data");
  }
  return response.json();
}

export async function fetchWalletBalance() {
  const response = await fetch("/api/wallet?action=balance");
  if (!response.ok) {
    throw new Error("Failed to fetch wallet balance");
  }
  return response.json();
}

export async function fetchWalletTransactions(limit?: number) {
  const params = new URLSearchParams({ action: "transactions" });
  if (limit) params.append("limit", limit.toString());

  const response = await fetch(`/api/wallet?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch wallet transactions");
  }
  return response.json();
}

export async function topUpWallet(amount: number, paymentMethod: string) {
  const response = await fetch("/api/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      type: "credit",
      description: `Wallet top-up via ${paymentMethod}`,
      reference_type: "top_up",
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to top up wallet");
  }
  return response.json();
}

// Commission API
export async function fetchCommissions(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const response = await fetch(`/api/commissions?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch commissions");
  }
  return response.json();
}

// Stats API
export async function fetchDashboardStats() {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }
  return response.json();
}
