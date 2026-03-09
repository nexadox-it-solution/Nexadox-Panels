"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Plus, Search, Check, X, Clock, Loader, AlertCircle,
  FileText, Stethoscope, Building2, User, Phone, IndianRupee, Ban,
  Printer, Download, Pill,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─────────────────────────────────────────────────── */
interface Clinic { id: number; name: string; city: string | null; }
interface Specialty { id: number; name: string; }
interface DoctorRow { id: number; name: string; email: string; clinic_ids: number[] | null; specialty_ids: number[] | null; appointment_fee: number | null; booking_fee: number | null; }
interface PatientRow { id: number; name: string; email: string; phone: string | null; }
interface Appointment {
  id: number; appointment_id: string; patient_name: string; patient_email: string | null;
  patient_phone: string | null;
  doctor_id: number | null; clinic_id: number | null; appointment_date: string;
  appointment_time: string | null; slot: string | null; status: string;
  source_role: string | null; booking_amount: number | null;
  voucher_id: number | null; invoice_id: number | null; notes: string | null; created_at: string;
  token_number: number | null;
}
interface VoucherView {
  id: number; voucher_number: string; patient_name: string; doctor_name: string;
  clinic_name: string; appointment_date: string; appointment_slot: string;
  booking_amount: number | null; commission_amount: number | null;
  total_payable: number | null; status: string;
  token_number: number | null;
  _apt?: Appointment;
}
interface Medicine { name: string; dosage: string; frequency: string; duration: string; instructions: string; }
interface TestItem { name: string; instructions: string; }
interface PrescriptionView {
  id: number; appointment_id: number; doctor_id: number;
  patient_name: string; diagnosis: string; notes: string;
  medicines: Medicine[]; tests: TestItem[];
  follow_up_date: string | null; created_at: string;
}

/* ─── Helpers ───────────────────────────────────────────────── */
const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
const fmtMoney = (n: number | null | undefined) => n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

/* ─── Number to Words (Indian system) ───────────────────────── */
const numberToWords = (num: number): string => {
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " and " + convert(n%100) : "");
    if (n < 100000) return convert(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + convert(n%1000) : "");
    if (n < 10000000) return convert(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + convert(n%100000) : "");
    return convert(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + convert(n%10000000) : "");
  };
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let words = convert(intPart);
  if (decPart > 0) words += " and " + convert(decPart) + " Paise";
  return words;
};

/* ─── Sessions ──────────────────────────────────────────────── */
const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const SESSION_EMOJI: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙" };

/* ─── Component ─────────────────────────────────────────────── */
export default function AttendantAppointmentsPage() {
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics]         = useState<Clinic[]>([]);
  const [doctors, setDoctors]         = useState<DoctorRow[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading]         = useState(true);

  /* Attendant's assigned scope */
  const [assignedClinicIds, setAssignedClinicIds] = useState<number[]>([]);

  /* Filters */
  const [fDate, setFDate]     = useState("");
  const [fClinic, setFClinic] = useState("all");
  const [fDoctor, setFDoctor] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fSearch, setFSearch] = useState("");

  /* Modal */
  const [showModal, setShowModal]       = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError]       = useState("");
  const [successMsg, setSuccessMsg]     = useState("");

  /* Voucher viewer */
  const [viewVoucher, setViewVoucher] = useState<VoucherView | null>(null);

  /* Prescription viewer */
  const [viewPrescription, setViewPrescription] = useState<PrescriptionView | null>(null);
  const [rxDoctorName, setRxDoctorName] = useState("");
  const [rxClinicName, setRxClinicName] = useState("");

  /* Form fields — patient search (like admin) */
  const [frmPatientSearch, setFrmPatientSearch] = useState("");
  const [frmPatients, setFrmPatients]           = useState<PatientRow[]>([]);
  const [frmPatientId, setFrmPatientId]         = useState<number | null>(null);
  const [frmPatientName, setFrmPatientName]     = useState("");
  const [frmPatientEmail, setFrmPatientEmail]   = useState("");
  const [frmPatientPhone, setFrmPatientPhone]   = useState("");
  const [frmIsNewPatient, setFrmIsNewPatient]   = useState(false);

  const [frmSpecialtyId, setFrmSpecialtyId] = useState<number | null>(null);
  const [frmClinicId, setFrmClinicId]   = useState<number | null>(null);
  const [frmDoctorId, setFrmDoctorId]   = useState<number | null>(null);
  const [frmDate, setFrmDate]           = useState("");
  const [frmSlot, setFrmSlot]           = useState("");
  const [frmNotes, setFrmNotes]         = useState("");

  const [sessionInfo, setSessionInfo]       = useState<Record<string, { booked: number; max_seats: number }>>({});
  const [scheduledSlots, setScheduledSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots]     = useState(false);
  const [loadingDates, setLoadingDates]     = useState(false);

  /* ── Patient search — by phone number (search both patients + appointments) ──────── */
  const searchPatients = async (q: string) => {
    setFrmPatientSearch(q);
    if (q.length < 3) { setFrmPatients([]); return; }
    try {
      const unique = new Map<string, PatientRow>();
      
      // 1. Search patients table (mobile app users)
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, name, email, phone")
        .ilike("phone", `%${q}%`)
        .limit(20);
      if (patientsData) {
        patientsData.forEach((d: any) => {
          const key = d.phone || d.name;
          if (!unique.has(key)) {
            unique.set(key, { id: d.id || 0, name: d.name || "", email: d.email || "", phone: d.phone || null });
          }
        });
      }
      
      // 2. Also search appointments table for patients who booked before (deduped)
      const { data: aptData } = await supabase
        .from("appointments")
        .select("patient_name, patient_email, patient_phone")
        .ilike("patient_phone", `%${q}%`)
        .limit(20);
      if (aptData) {
        aptData.forEach((d: any) => {
          const key = d.patient_phone || d.patient_name;
          if (!unique.has(key)) {
            unique.set(key, { id: 0, name: d.patient_name || "", email: d.patient_email || "", phone: d.patient_phone || null });
          }
        });
      }
      
      setFrmPatients(Array.from(unique.values()));
    } catch { setFrmPatients([]); }
  };

  /* ── Fetch attendant scope + data ─────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let myClinicIds: number[] = [];
      let myDoctorIds: number[] = [];

      console.log("[Attendant Appointments] Current user:", user?.id);

      if (user) {
        // Try profile_id first for attendant lookup
        const { data: att, error: attErr } = await supabase
          .from("attendants")
          .select("id, user_id, assigned_clinic_ids, assigned_doctors")
          .eq("profile_id", user.id)
          .single();

        console.log("[Attendant Appointments] Attendant record (profile_id):", att);

        if (att) {
          myClinicIds = att.assigned_clinic_ids || [];
          myDoctorIds = att.assigned_doctors || [];
          console.log("[Attendant Appointments] Assigned clinic IDs:", myClinicIds);
          console.log("[Attendant Appointments] Assigned doctor IDs:", myDoctorIds);
        } else {
          // Fallback: try user_id for backward compat
          const { data: attByUser } = await supabase
            .from("attendants")
            .select("id, user_id, assigned_clinic_ids, assigned_doctors")
            .eq("user_id", user.id)
            .single();
          
          console.log("[Attendant Appointments] Attendant record (user_id fallback):", attByUser);
          
          if (attByUser) {
            myClinicIds = attByUser.assigned_clinic_ids || [];
            myDoctorIds = attByUser.assigned_doctors || [];
          } else {
            console.warn("[Attendant Appointments] No attendant record found for user:", user.id);
          }
        }
      }

      // If no attendant record found, show ALL clinics/doctors (fallback for demo)
      const hasAttendantScope = myClinicIds.length > 0 || myDoctorIds.length > 0;
      setAssignedClinicIds(myClinicIds);

      // Fetch clinics — if attendant has assigned clinics, only those; otherwise ALL
      const [clinicRes, docRes, specRes] = await Promise.all([
        hasAttendantScope && myClinicIds.length > 0
          ? supabase.from("clinics").select("id, name, city").in("id", myClinicIds).order("name")
          : supabase.from("clinics").select("id, name, city").order("name"),
        supabase.from("doctors").select("id, name, email, clinic_ids, specialty_ids, appointment_fee, booking_fee").order("name"),
        supabase.from("specialties").select("id, name").order("name"),
      ]);

      const allClinics = (clinicRes.data || []) as Clinic[];
      const allDoctors = (docRes.data || []) as DoctorRow[];
      const allSpecs = (specRes.data || []) as Specialty[];

      console.log("[Attendant] hasAttendantScope:", hasAttendantScope);
      console.log("[Attendant] Fetched clinics:", allClinics.length);
      console.log("[Attendant] Fetched doctors:", allDoctors.length);
      console.log("[Attendant] Fetched specialties:", allSpecs.length, allSpecs);

      // Filter doctors to scope — or show ALL if no attendant record
      const scopedDoctors = hasAttendantScope
        ? allDoctors.filter(d => {
            if (myDoctorIds.length > 0 && myDoctorIds.includes(d.id)) return true;
            if (d.clinic_ids && d.clinic_ids.some(cid => myClinicIds.includes(cid))) return true;
            return false;
          })
        : allDoctors;
      const scopedDoctorIds = scopedDoctors.map(d => d.id);

      console.log("[Attendant Appointments] Scoped doctors count:", scopedDoctors.length);

      setClinics(allClinics);
      setDoctors(scopedDoctors);
      setSpecialties(allSpecs);

      // Fetch ALL appointments (shows new and previous appointments)
      try {
        const res = await fetch(`/api/attendant/appointments`);
        const json = await res.json();
        setAppointments((json.appointments || []) as Appointment[]);
      } catch {
        setAppointments([]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── When doctor changes: fetch available dates ─────────────── */
  useEffect(() => {
    if (!frmDoctorId) { setAvailableDates([]); setScheduledSlots([]); setSessionInfo({}); setFrmDate(""); setFrmSlot(""); return; }
    (async () => {
      setLoadingDates(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${today}`);
        const json = await res.json();
        const dateSet = new Set<string>();
        (json.data || []).forEach((s: any) => { if (s.status === "available") dateSet.add(s.date); });
        setAvailableDates(Array.from(dateSet).sort());
      } catch { setAvailableDates([]); }
      finally { setLoadingDates(false); }
    })();
  }, [frmDoctorId]);

  /* ── When date changes: fetch session info ───────────────────── */
  useEffect(() => {
    if (!frmDoctorId || !frmDate) { setSessionInfo({}); setScheduledSlots([]); return; }
    (async () => {
      setLoadingSlots(true);
      try {
        const schedRes = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${frmDate}`)
          .then(r => r.json()).catch(() => ({ data: [] }));
        const schedData: any[] = schedRes.data || [];
        const forDate = schedData.filter((s: any) => s.date === frmDate && s.status === "available");
        setScheduledSlots(forDate.map((s: any) => s.slot));
        const info: Record<string, { booked: number; max_seats: number }> = {};
        forDate.forEach((s: any) => {
          info[s.slot] = { booked: s.booked_count || 0, max_seats: s.max_seats || 30 };
        });
        setSessionInfo(info);
      } catch { setSessionInfo({}); setScheduledSlots([]); }
      finally { setLoadingSlots(false); }
    })();
  }, [frmDoctorId, frmDate]);

  /* ── Auto-select clinic when doctor has only one assigned clinic ── */
  useEffect(() => {
    if (!frmDoctorId) return;
    const doc = doctors.find(d => d.id === frmDoctorId);
    const matchedClinics = clinics.filter(c => doc?.clinic_ids?.includes(c.id));
    if (matchedClinics.length === 1 && !frmClinicId) {
      setFrmClinicId(matchedClinics[0].id);
    }
  }, [frmDoctorId, doctors, clinics, frmClinicId]);

  const filteredDoctors = frmSpecialtyId ? doctors.filter(d => d.specialty_ids?.includes(frmSpecialtyId)) : doctors;
  const filteredClinicsForDoctor = frmDoctorId
    ? clinics.filter(c => {
        const doc = doctors.find(d => d.id === frmDoctorId);
        return doc?.clinic_ids?.includes(c.id) ?? false;
      })
    : [];
  // Show all specialties — doctors will be filtered by selected specialty
  const availableSpecialties = specialties;
  
  const selectedDoctor = doctors.find(d => d.id === frmDoctorId);
  const bookingAmount = selectedDoctor?.booking_fee || selectedDoctor?.appointment_fee || 0;

  const doctorMap = new Map(doctors.map(d => [d.id, d.name]));
  const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

  /* ── Filtered list ───────────────────────────────────────────── */
  const filtered = appointments.filter(a => {
    const q = fSearch.toLowerCase();
    return (!q || a.patient_name?.toLowerCase().includes(q) || a.appointment_id?.toLowerCase().includes(q))
      && (!fDate || a.appointment_date === fDate)
      && (fClinic === "all" || String(a.clinic_id) === fClinic)
      && (fDoctor === "all" || String(a.doctor_id) === fDoctor)
      && (fStatus === "all" || a.status === fStatus);
  });

  const openAddModal = () => {
    setFrmPatientSearch(""); setFrmPatients([]); setFrmPatientId(null);
    setFrmPatientName(""); setFrmPatientEmail(""); setFrmPatientPhone("");
    setFrmIsNewPatient(false);
    setFrmSpecialtyId(null); setFrmClinicId(null); setFrmDoctorId(null); setFrmDate(""); setFrmSlot(""); setFrmNotes("");
    setAvailableDates([]); setScheduledSlots([]); setSessionInfo({});
    setFormError(""); setShowModal(true);
  };

  /* ── Submit — uses server API ───────────────────────────────── */
  const handleSubmit = async () => {
    if (!frmPatientName.trim()) return setFormError("Patient name is required.");
    if (!frmClinicId) return setFormError("Select a clinic.");
    if (!frmDoctorId) return setFormError("Select a doctor.");
    if (!frmDate) return setFormError("Select a date.");
    if (!frmSlot) return setFormError("Select a session.");

    setIsSubmitting(true); setFormError("");
    try {
      const si = sessionInfo[frmSlot];
      if (si && si.booked >= si.max_seats) {
        setFormError(`Session "${frmSlot}" is full (${si.booked}/${si.max_seats} seats booked).`);
        setIsSubmitting(false);
        return;
      }

      const clinicName = clinicMap.get(frmClinicId) || "";
      const doctorName = doctorMap.get(frmDoctorId) || "";

      /* Use server API — bypasses RLS, handles voucher + invoice + transaction */
      const apiRes = await fetch("/api/attendant/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: frmPatientName.trim(),
          patient_email: frmPatientEmail || null,
          patient_phone: frmPatientPhone || null,
          doctor_id: frmDoctorId,
          clinic_id: frmClinicId,
          appointment_date: frmDate,
          slot: frmSlot,
          source_role: "Attendant",
          booking_amount: bookingAmount,
          commission_amount: 0,
          payable_amount: bookingAmount,
          doctor_name: doctorName,
          clinic_name: clinicName,
          notes: frmNotes || null,
        }),
      });

      const result = await apiRes.json();
      if (!apiRes.ok) throw new Error(result.error || "Booking failed.");

      setShowModal(false);
      setSuccessMsg(`Appointment ${result.appointment_id} booked! Token #${result.token_number || '—'} | Voucher: ${result.voucher_number}`);
      setTimeout(() => setSuccessMsg(""), 5000);
      fetchAll();
    } catch (err: any) { setFormError(err?.message || "Booking failed."); }
    finally { setIsSubmitting(false); }
  };

  /* ── View voucher (full booking slip like admin) ─────────── */
  const openVoucher = async (apt: Appointment) => {
    if (!apt.voucher_id) return;
    try {
      const { data } = await supabase.from("vouchers").select("*").eq("id", apt.voucher_id).single();
      if (data) setViewVoucher({ ...(data as VoucherView), _apt: apt });
    } catch (err) { console.error(err); }
  };

  /* ── Print/Download voucher (same as admin) ────────────── */
  const printVoucher = () => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow || !viewVoucher) return;
    const v = viewVoucher;
    const aptExtra = v._apt;
    const html = `<!DOCTYPE html>
<html><head><title>Booking Slip - ${v.voucher_number}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
  .header h1 { margin: 0; font-size: 18px; color: #0D8EAD; }
  .header p { margin: 2px 0; font-size: 11px; color: #666; }
  .slip-title { text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0; padding: 5px; background: #E8F4F8; border: 1px solid #0D8EAD; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 15px; }
  .info-row { display: flex; gap: 8px; padding: 3px 0; }
  .info-label { font-weight: bold; min-width: 110px; color: #333; }
  .info-value { color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #E8F4F8; font-weight: bold; }
  .total-row td { font-weight: bold; background: #f9fafb; }
  .amount-words { margin: 10px 0; font-style: italic; font-size: 11px; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; }
  .footer-col { text-align: center; }
  .footer-line { border-top: 1px solid #333; padding-top: 4px; min-width: 150px; display: inline-block; }
  @media print { body { padding: 10px; } }
</style></head><body>
  <div class="header">
    <h1>NEXADOX IT SOLUTIONS</h1>
    <p>Address: Ramkrishna Pally, English Bazar, Malda, WB - 732101</p>
    <p>info@nexadox.com</p>
    <p>GSTIN: 19AAXFN9593Q1ZK</p>
  </div>
  <div class="slip-title">BOOKING SLIP</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">UHID No.:</span><span class="info-value">${v.voucher_number}</span></div>
    <div class="info-row"><span class="info-label">Bill No.:</span><span class="info-value">${v.voucher_number}</span></div>
    <div class="info-row"><span class="info-label">Patient Name:</span><span class="info-value">${v.patient_name}</span></div>
    <div class="info-row"><span class="info-label">Bill Date:</span><span class="info-value">${v.appointment_date}</span></div>
    <div class="info-row"><span class="info-label">Contact No.:</span><span class="info-value">${aptExtra?.patient_phone || aptExtra?.patient_email || '—'}</span></div>
    <div class="info-row"><span class="info-label">Doctor Name:</span><span class="info-value">${v.doctor_name}</span></div>
    <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${v.clinic_name}</span></div>
  </div>
  <div style="font-weight:bold;font-size:13px;margin:15px 0 8px;padding:4px 8px;background:#E8F4F8;border-left:3px solid #0D8EAD;">APPOINTMENT DETAILS</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${v.appointment_date}</span></div>
    <div class="info-row"><span class="info-label">Slot:</span><span class="info-value">${v.appointment_slot}</span></div>
    <div class="info-row"><span class="info-label">Token No.:</span><span class="info-value" style="font-size:16px;font-weight:bold;color:#0D8EAD;">#${aptExtra?.token_number || v.token_number || '—'}</span></div>
    <div class="info-row"><span class="info-label">Serial No.:</span><span class="info-value">${aptExtra?.id || '—'}</span></div>
  </div>
  <table>
    <thead><tr><th>Sl. No.</th><th>Particulars</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Booking Charges</td><td>₹${Number(v.booking_amount || 0).toFixed(2)}</td></tr>
      ${(v.commission_amount || 0) > 0 ? '<tr><td>2</td><td>Agent Commission</td><td>₹' + Number(v.commission_amount).toFixed(2) + '</td></tr>' : ''}
      <tr class="total-row"><td colspan="2">Total Amount</td><td>₹${Number(v.total_payable || 0).toFixed(2)}</td></tr>
    </tbody>
  </table>
  <p class="amount-words">Amount Received in Words: Rupees ${numberToWords(Number(v.total_payable || 0))} Only</p>
  <div class="footer">
    <div class="footer-col"><div class="footer-line">Booked by: ${aptExtra?.source_role || 'Attendant'}</div></div>
    <div class="footer-col"><div class="footer-line">Authorized Signature</div></div>
  </div>
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  /* ── View prescription ──────────────────────────────────── */
  const openPrescription = async (apt: Appointment) => {
    try {
      const { data } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("appointment_id", apt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setViewPrescription(data as PrescriptionView);
        setRxDoctorName(doctorMap.get(apt.doctor_id!) || "Doctor");
        setRxClinicName(clinicMap.get(apt.clinic_id!) || "");
      } else {
        alert("No prescription found for this appointment.");
      }
    } catch { alert("No prescription found for this appointment."); }
  };

  /* ── Print/Download prescription ─────────────────────────── */
  const printPrescription = () => {
    const printWindow = window.open("", "_blank", "width=600,height=900");
    if (!printWindow || !viewPrescription) return;
    const rx = viewPrescription;
    const medicines = (rx.medicines || []) as Medicine[];
    const tests = (rx.tests || []) as TestItem[];
    const medRows = medicines.map((m, i) => `<tr><td>${i+1}</td><td>${m.name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${m.instructions || '—'}</td></tr>`).join("");
    const testRows = tests.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.instructions || '—'}</td></tr>`).join("");

    const html = `<!DOCTYPE html>
<html><head><title>Prescription - ${rx.patient_name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
  .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { margin: 0; font-size: 18px; color: #2563eb; }
  .header p { margin: 2px 0; font-size: 11px; color: #666; }
  .rx-symbol { font-size: 28px; font-weight: bold; color: #2563eb; margin: 10px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 15px; }
  .info-row { display: flex; gap: 8px; padding: 3px 0; }
  .info-label { font-weight: bold; min-width: 100px; color: #333; }
  .info-value { color: #555; }
  .section-title { font-weight: bold; font-size: 13px; margin: 15px 0 8px; padding: 4px 8px; background: #eff6ff; border-left: 3px solid #2563eb; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 11px; }
  th { background: #eff6ff; font-weight: bold; }
  .notes { margin: 15px 0; padding: 10px; background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; font-size: 11px; }
  .follow-up { margin: 10px 0; padding: 8px 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; }
  .footer { margin-top: 40px; text-align: right; }
  .footer-line { border-top: 1px solid #333; padding-top: 4px; display: inline-block; min-width: 180px; text-align: center; }
  @media print { body { padding: 10px; } }
</style></head><body>
  <div class="header">
    <h1>NEXADOX IT SOLUTIONS</h1>
    <p>Address: Ramkrishna Pally, English Bazar, Malda, WB - 732101</p>
    <p>info@nexadox.com</p>
  </div>
  <div class="rx-symbol">℞</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Patient Name:</span><span class="info-value">${rx.patient_name}</span></div>
    <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
    <div class="info-row"><span class="info-label">Doctor:</span><span class="info-value">${rxDoctorName}</span></div>
    <div class="info-row"><span class="info-label">Clinic:</span><span class="info-value">${rxClinicName}</span></div>
  </div>
  <div class="section-title">DIAGNOSIS</div>
  <p style="padding:0 8px;">${rx.diagnosis || '—'}</p>
  ${medicines.length > 0 ? `
  <div class="section-title">MEDICINES</div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>` : ''}
  ${tests.length > 0 ? `
  <div class="section-title">RECOMMENDED TESTS</div>
  <table>
    <thead><tr><th>#</th><th>Test</th><th>Instructions</th></tr></thead>
    <tbody>${testRows}</tbody>
  </table>` : ''}
  ${rx.notes ? `<div class="notes"><strong>Doctor's Notes:</strong> ${rx.notes}</div>` : ''}
  ${rx.follow_up_date ? `<div class="follow-up"><strong>Follow-up Date:</strong> ${new Date(rx.follow_up_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>` : ''}
  <div class="footer">
    <div class="footer-line">Doctor's Signature<br/><small>${rxDoctorName}</small></div>
  </div>
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700", waiting: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-purple-100 text-purple-700", completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const sourceColor: Record<string, string> = {
    Admin: "bg-purple-100 text-purple-700", Agent: "bg-orange-100 text-orange-700",
    Attendant: "bg-cyan-100 text-cyan-700", App: "bg-brand-100 text-brand-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-cyan-600" /> Appointments
          </h1>
          <p className="text-muted-foreground mt-1">
            View & create appointments for your assigned clinics/doctors
            {assignedClinicIds.length > 0 && <span className="text-xs ml-2">({clinics.length} clinic(s), {doctors.length} doctor(s))</span>}
          </p>
        </div>
        <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={openAddModal}>
          <Plus className="h-4 w-4" /> Add Appointment
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✅ {successMsg}</div>
      )}

      {/* Filters */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={fSearch} onChange={e => setFSearch(e.target.value)} className="pl-9" />
          </div>
          <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
          <Select value={fDoctor} onValueChange={setFDoctor}>
            <SelectTrigger><SelectValue placeholder="All Doctors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setFSearch(""); setFDate(""); setFDoctor("all"); setFStatus("all"); }}>Reset</Button>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-cyan-600" />
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Appointments ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No appointments found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {["Patient", "Clinic", "Doctor", "Date", "Session", "Token", "Source", "Amount", "Status", "Actions"].map(h => (
                      <th key={h} className="py-3 px-3 text-xs font-semibold text-muted-foreground uppercase text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(apt => (
                    <tr key={apt.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-medium">{apt.patient_name}</p>
                          {apt.patient_phone && <p className="text-xs text-muted-foreground">{apt.patient_phone}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs">{clinicMap.get(apt.clinic_id!) || "—"}</td>
                      <td className="py-3 px-3 text-xs">{doctorMap.get(apt.doctor_id!) || "—"}</td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">{apt.appointment_date ? fmtDate(apt.appointment_date) : "—"}</td>
                      <td className="py-3 px-3 text-xs font-mono">{apt.slot || "—"}</td>
                      <td className="py-3 px-3">
                        {apt.token_number ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">#{apt.token_number}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {apt.source_role && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceColor[apt.source_role] || "bg-gray-100"}`}>{apt.source_role}</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">{fmtMoney(apt.booking_amount)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[apt.status] || "bg-gray-100"}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {apt.voucher_id && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" title="View Voucher" onClick={() => openVoucher(apt)}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {apt.status === "completed" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="View Prescription" onClick={() => openPrescription(apt)}>
                              <Pill className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── BOOKING SLIP VOUCHER MODAL (same as admin) ────────── */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center border-b-2 border-brand-600 p-5">
              <h1 className="text-xl font-bold text-brand-700">NEXADOX IT SOLUTIONS</h1>
              <p className="text-xs text-gray-500 mt-1">Address: Ramkrishna Pally, English Bazar, Malda, WB - 732101</p>
              <p className="text-xs text-gray-500">info@nexadox.com</p>
              <p className="text-xs text-gray-500">GSTIN: 19AAXFN9593Q1ZK</p>
            </div>

            <div className="mx-5 mt-4 mb-3 text-center">
              <div className="inline-block px-6 py-1.5 bg-brand-50 border border-brand-300 rounded font-bold text-brand-800 tracking-wide">
                BOOKING SLIP
              </div>
            </div>

            <div className="px-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">UHID No.:</span><span className="text-gray-600">{viewVoucher.voucher_number}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Bill No.:</span><span className="text-gray-600">{viewVoucher.voucher_number}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Patient Name:</span><span className="text-gray-600">{viewVoucher.patient_name}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Bill Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Contact No.:</span><span className="text-gray-600">{viewVoucher._apt?.patient_phone || viewVoucher._apt?.patient_email || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Doctor Name:</span><span className="text-gray-600">{viewVoucher.doctor_name}</span></div>
              <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-700 min-w-[100px]">Address:</span><span className="text-gray-600">{viewVoucher.clinic_name}</span></div>
            </div>

            <div className="mx-5 mt-4">
              <div className="font-bold text-sm bg-brand-50 border-l-4 border-brand-600 px-3 py-1.5 mb-2">APPOINTMENT DETAILS</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm px-1">
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Slot:</span><span className="text-gray-600">{viewVoucher.appointment_slot}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Token No.:</span><span className="text-lg font-bold text-brand-700">#{viewVoucher._apt?.token_number || viewVoucher.token_number || "—"}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Serial No.:</span><span className="text-gray-600">{viewVoucher._apt?.id || "—"}</span></div>
              </div>
            </div>

            <div className="mx-5 mt-4">
              <table className="w-full text-sm border border-gray-200">
                <thead><tr className="bg-brand-50">
                  <th className="border border-gray-200 px-3 py-2 text-left w-12">Sl. No.</th>
                  <th className="border border-gray-200 px-3 py-2 text-left">Particulars</th>
                  <th className="border border-gray-200 px-3 py-2 text-right w-28">Amount</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">1</td>
                    <td className="border border-gray-200 px-3 py-2">Booking Charges</td>
                    <td className="border border-gray-200 px-3 py-2 text-right font-mono">{fmtMoney(viewVoucher.booking_amount)}</td>
                  </tr>
                  {(viewVoucher.commission_amount || 0) > 0 && (
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">2</td>
                      <td className="border border-gray-200 px-3 py-2">Agent Commission</td>
                      <td className="border border-gray-200 px-3 py-2 text-right font-mono text-orange-600">{fmtMoney(viewVoucher.commission_amount)}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={2} className="border border-gray-200 px-3 py-2">Total Amount</td>
                    <td className="border border-gray-200 px-3 py-2 text-right font-mono text-brand-700">{fmtMoney(viewVoucher.total_payable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mx-5 mt-2 text-xs italic text-gray-500">
              Amount Received in Words: <span className="font-medium text-gray-700">Rupees {numberToWords(Number(viewVoucher.total_payable || 0))} Only</span>
            </div>

            <div className="mx-5 mt-6 flex justify-between text-sm pb-2">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Booked by: <span className="font-semibold">{viewVoucher._apt?.source_role || "Attendant"}</span></div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Authorized Signature</div>
              </div>
            </div>

            <div className="mx-5 mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${viewVoucher.status === "active" ? "bg-green-100 text-green-700" : viewVoucher.status === "used" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{viewVoucher.status}</span>
            </div>

            <div className="flex gap-3 p-5 border-t mt-4">
              <Button onClick={printVoucher} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white gap-2"><Printer className="h-4 w-4" /> Print / Download</Button>
              <Button onClick={() => setViewVoucher(null)} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRESCRIPTION VIEW MODAL ───────────────────────────── */}
      {viewPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center border-b-2 border-blue-600 p-5">
              <h1 className="text-xl font-bold text-blue-700">NEXADOX IT SOLUTIONS</h1>
              <p className="text-xs text-gray-500 mt-1">Address: Ramkrishna Pally, English Bazar, Malda, WB - 732101</p>
              <p className="text-xs text-gray-500">info@nexadox.com</p>
            </div>

            {/* Rx Symbol & Patient Info */}
            <div className="px-5 mt-4">
              <div className="text-3xl font-bold text-blue-700 mb-3">℞</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[90px]">Patient:</span><span className="text-gray-600">{viewPrescription.patient_name}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[90px]">Date:</span><span className="text-gray-600">{new Date(viewPrescription.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[90px]">Doctor:</span><span className="text-gray-600">{rxDoctorName}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[90px]">Clinic:</span><span className="text-gray-600">{rxClinicName}</span></div>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="mx-5 mt-4">
              <div className="font-bold text-sm bg-blue-50 border-l-4 border-blue-600 px-3 py-1.5 mb-2">DIAGNOSIS</div>
              <p className="text-sm text-gray-700 px-1">{viewPrescription.diagnosis || "—"}</p>
            </div>

            {/* Medicines */}
            {(viewPrescription.medicines as Medicine[])?.length > 0 && (
              <div className="mx-5 mt-4">
                <div className="font-bold text-sm bg-blue-50 border-l-4 border-blue-600 px-3 py-1.5 mb-2">MEDICINES</div>
                <table className="w-full text-xs border border-gray-200">
                  <thead><tr className="bg-blue-50">
                    <th className="border border-gray-200 px-2 py-1.5 text-left w-8">#</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left">Medicine</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left">Dosage</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left">Frequency</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left">Duration</th>
                  </tr></thead>
                  <tbody>
                    {(viewPrescription.medicines as Medicine[]).map((m, i) => (
                      <tr key={i}>
                        <td className="border border-gray-200 px-2 py-1.5">{i+1}</td>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium">{m.name}</td>
                        <td className="border border-gray-200 px-2 py-1.5">{m.dosage}</td>
                        <td className="border border-gray-200 px-2 py-1.5">{m.frequency}</td>
                        <td className="border border-gray-200 px-2 py-1.5">{m.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tests */}
            {(viewPrescription.tests as TestItem[])?.length > 0 && (
              <div className="mx-5 mt-4">
                <div className="font-bold text-sm bg-blue-50 border-l-4 border-blue-600 px-3 py-1.5 mb-2">RECOMMENDED TESTS</div>
                <div className="space-y-1 px-1">
                  {(viewPrescription.tests as TestItem[]).map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="font-semibold text-blue-600">{i+1}.</span>
                      <div>
                        <span className="font-medium">{t.name}</span>
                        {t.instructions && <span className="text-muted-foreground ml-1">— {t.instructions}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {viewPrescription.notes && (
              <div className="mx-5 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Doctor&apos;s Notes:</p>
                <p className="text-sm text-gray-700">{viewPrescription.notes}</p>
              </div>
            )}

            {/* Follow-up */}
            {viewPrescription.follow_up_date && (
              <div className="mx-5 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm"><span className="font-semibold text-green-800">Follow-up Date:</span> {fmtDate(viewPrescription.follow_up_date)}</p>
              </div>
            )}

            {/* Signature */}
            <div className="mx-5 mt-6 text-right pb-2">
              <div className="border-t border-gray-400 pt-1 px-4 inline-block text-sm text-center">
                Doctor&apos;s Signature<br/><small className="font-semibold">{rxDoctorName}</small>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-5 border-t mt-4">
              <Button onClick={printPrescription} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"><Printer className="h-4 w-4" /> Print / Download</Button>
              <Button onClick={() => setViewPrescription(null)} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD APPOINTMENT SLIDE-OVER ────────────────────────── */}
      {showModal && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setShowModal(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${showModal ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2"><Calendar className="h-5 w-5 text-cyan-600" /> New Appointment</h2>
          <button onClick={() => !isSubmitting && setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          {/* Patient — phone search like admin */}
          <div className="space-y-2 border rounded-xl p-4 bg-gray-50/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3.5 w-3.5" /> Patient</Label>
            {!frmIsNewPatient ? (
              <>
                {/* Phone search */}
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by phone number…" value={frmPatientSearch}
                    onChange={(e) => searchPatients(e.target.value)} className="pl-9" />
                </div>

                {/* Search results dropdown */}
                {frmPatients.length > 0 && !frmPatientId && (
                  <div className="border rounded-lg divide-y max-h-44 overflow-y-auto bg-white">
                    {frmPatients.map((p, i) => (
                      <button key={i} className="w-full text-left px-3 py-2.5 hover:bg-cyan-50 text-sm transition-colors"
                        onClick={() => { setFrmPatientId(p.id); setFrmPatientName(p.name); setFrmPatientEmail(p.email); setFrmPatientPhone(p.phone || ""); setFrmPatients([]); setFrmPatientSearch(p.phone || ""); }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs font-mono text-cyan-600">{p.phone}</span>
                        </div>
                        {p.email && <p className="text-xs text-muted-foreground mt-0.5">{p.email}</p>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Confirmed patient card */}
                {frmPatientId !== null && frmPatientName && (
                  <div className="border border-cyan-200 bg-cyan-50/50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{frmPatientName}</p>
                      <p className="text-xs text-muted-foreground">{frmPatientPhone}{frmPatientEmail ? ` • ${frmPatientEmail}` : ""}</p>
                    </div>
                    <button onClick={() => { setFrmPatientId(null); setFrmPatientName(""); setFrmPatientEmail(""); setFrmPatientPhone(""); setFrmPatientSearch(""); }}
                      className="p-1 rounded hover:bg-cyan-100"><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                )}

                <button onClick={() => setFrmIsNewPatient(true)} className="text-xs text-cyan-600 font-medium hover:underline">
                  + Create new patient
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <Input placeholder="Patient Name *" value={frmPatientName} onChange={e => setFrmPatientName(e.target.value)} />
                <Input placeholder="Email" type="email" value={frmPatientEmail} onChange={e => setFrmPatientEmail(e.target.value)} />
                <Input placeholder="Phone *" value={frmPatientPhone} onChange={e => setFrmPatientPhone(e.target.value)} />
                <button onClick={() => setFrmIsNewPatient(false)} className="text-xs text-muted-foreground hover:underline">
                  ← Search existing patient
                </button>
              </div>
            )}
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> Specialty</Label>
            {availableSpecialties.length === 0 ? (
              <p className="text-sm text-amber-600 italic">No specialties available.</p>
            ) : (
              <Select value={frmSpecialtyId ? String(frmSpecialtyId) : ""} onValueChange={v => { setFrmSpecialtyId(Number(v)); setFrmDoctorId(null); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}>
                <SelectTrigger><SelectValue placeholder="Select Specialty" /></SelectTrigger>
                <SelectContent>
                  {availableSpecialties.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Doctor — filtered by specialty, ONLY tagged doctors */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3.5 w-3.5" /> Doctor</Label>
            {filteredDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{frmSpecialtyId ? "No doctors for this specialty." : "Select a specialty first."}</p>
            ) : (
              <Select value={frmDoctorId ? String(frmDoctorId) : ""} onValueChange={v => { setFrmDoctorId(Number(v)); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}>
                <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                <SelectContent>
                  {filteredDoctors.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} {d.booking_fee ? `(₹${d.booking_fee})` : d.appointment_fee ? `(₹${d.appointment_fee})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Clinic — filtered by selected doctor's clinics, ONLY tagged clinics */}
          {frmDoctorId && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Clinic</Label>
              {filteredClinicsForDoctor.length === 0 ? (
                <p className="text-sm text-amber-600 italic">No assigned clinics for this doctor.</p>
              ) : filteredClinicsForDoctor.length === 1 ? (
                <div className="border border-cyan-200 bg-cyan-50/50 rounded-lg px-3 py-2.5">
                  <p className="font-semibold text-sm">{filteredClinicsForDoctor[0].name}</p>
                  {filteredClinicsForDoctor[0].city && <p className="text-xs text-muted-foreground">{filteredClinicsForDoctor[0].city}</p>}
                </div>
              ) : (
                <Select value={frmClinicId ? String(frmClinicId) : ""} onValueChange={v => { setFrmClinicId(Number(v)); setFrmDate(""); setFrmSlot(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select Clinic" /></SelectTrigger>
                  <SelectContent>
                    {filteredClinicsForDoctor.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.city ? ` — ${c.city}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Date — from schedule */}
          {frmDoctorId && frmClinicId && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Available Dates
                {loadingDates && <Loader className="h-3 w-3 animate-spin ml-1" />}
              </Label>
              {!loadingDates && availableDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableDates.map(d => (
                    <button key={d} onClick={() => { setFrmDate(d); setFrmSlot(""); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        frmDate === d ? "bg-cyan-600 text-white border-cyan-600" : "border-gray-200 hover:bg-cyan-50 hover:border-cyan-300"
                      }`}>
                      {new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </button>
                  ))}
                </div>
              ) : !loadingDates ? (
                <p className="text-sm text-amber-600 italic flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> No schedule available for this doctor.
                </p>
              ) : null}
            </div>
          )}

          {/* Session — auto-loaded */}
          {frmDoctorId && frmClinicId && frmDate && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Session {loadingSlots && <Loader className="h-3 w-3 animate-spin ml-1" />}
              </Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader className="h-4 w-4 animate-spin" /> Loading sessions…</div>
              ) : scheduledSlots.length === 0 ? (
                <p className="text-sm text-amber-600 italic flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> No sessions scheduled for this date.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {scheduledSlots.map(s => {
                      const info = sessionInfo[s];
                      const booked = info?.booked || 0;
                      const maxSeats = info?.max_seats || 30;
                      const isFull = booked >= maxSeats;
                      const isSelected = frmSlot === s;
                      const remaining = maxSeats - booked;
                      return (
                        <button key={s} disabled={isFull} onClick={() => setFrmSlot(s)}
                          className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                            isFull ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed"
                            : isSelected ? "bg-cyan-600 text-white border-cyan-600"
                            : "border-gray-200 hover:bg-cyan-50"
                          }`}>
                          <div className="flex items-center gap-2">
                            <span>{SESSION_EMOJI[s] || "📅"}</span>
                            <span className="font-semibold">{s}</span>
                          </div>
                          <div className={`text-xs mt-1 ${isSelected ? "text-cyan-100" : isFull ? "text-red-400" : "text-muted-foreground"}`}>
                            {isFull ? "Full" : `${remaining} seat${remaining !== 1 ? "s" : ""} left`} ({booked}/{maxSeats})
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {`${scheduledSlots.length} session(s) available`}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
            <Input placeholder="Any notes…" value={frmNotes} onChange={e => setFrmNotes(e.target.value)} />
          </div>

          {/* Fee summary */}
          {selectedDoctor && frmSlot && (
            <div className="rounded-xl border bg-gradient-to-br from-cyan-50 to-brand-50 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> Payment Summary</h4>
              <div className="flex justify-between text-sm"><span>Booking Amount</span><span className="font-semibold">{fmtMoney(bookingAmount)}</span></div>
              <hr />
              <div className="flex justify-between text-base font-bold"><span>Total Payable</span><span className="text-brand-700">{fmtMoney(bookingAmount)}</span></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => !isSubmitting && setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-cyan-600 hover:bg-cyan-700 min-w-[160px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Booking…</> : <><Calendar className="h-4 w-4" /> Book Appointment</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
