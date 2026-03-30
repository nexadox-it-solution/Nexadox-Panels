import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ─── IST Timezone Helpers (Asia/Kolkata) ──────────────────── */
const IST_TZ = "Asia/Kolkata";

/** Get current date-time in IST */
export function nowIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TZ }));
}

/** Get today's date string (YYYY-MM-DD) in IST */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST_TZ }); // en-CA gives YYYY-MM-DD
}

/** Format an ISO date/datetime to IST date string */
export function fmtDateIST(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST_TZ });
  } catch { return d; }
}

/** Format an ISO datetime to IST time string */
export function fmtTimeIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST_TZ });
  } catch { return "—"; }
}

/** Format an ISO datetime to full IST date+time string */
export function fmtDateTimeIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { timeZone: IST_TZ });
  } catch { return "—"; }
}

/** Get IST ISO string for database writes */
export function isoNowIST(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: IST_TZ }).replace(" ", "T");
}

/**
 * Generate time slots for appointments
 */
export function generateTimeSlots(
  startHour: number = 9,
  endHour: number = 17,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const time = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      slots.push(time);
    }
  }
  return slots;
}

/**
 * Calculate commission based on amount and percentage
 */
export function calculateCommission(
  amount: number,
  commissionType: "percentage" | "fixed",
  commissionValue: number
): number {
  if (commissionType === "percentage") {
    return (amount * commissionValue) / 100;
  }
  return commissionValue;
}
