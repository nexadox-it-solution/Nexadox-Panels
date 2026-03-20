"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Plus, ArrowLeft, Search, Check, X, Clock, Loader,
  AlertCircle, FileText, Receipt, Eye, Stethoscope, Building2,
  User, Phone, IndianRupee, Ban, Download, Printer, MapPin,
  Trash2, AlertTriangle, Users, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import LocationMapPicker from "@/components/ui/location-map-picker";

/* ─── Types ─────────────────────────────────────────────────── */
interface Clinic { id: number; name: string; city: string | null; latitude: number | null; longitude: number | null; }
interface Specialty { id: number; name: string; }
interface DoctorRow { id: number; name: string; email: string; clinic_ids: number[] | null; specialty_ids: number[] | null; appointment_fee: number | null; booking_fee: number | null; }
interface PatientRow { id: number; name: string; email: string; phone: string | null; }
interface FamilyMember { id: number; patient_id: number; name: string; age: number; gender: string; relationship: string; date_of_birth?: string; }

interface Appointment {
  id: number;
  appointment_id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  doctor_id: number | null;
  clinic_id: number | null;
  appointment_date: string;
  appointment_time: string | null;
  slot: string | null;
  status: string;
  source_role: string | null;
  booking_amount: number | null;
  commission_amount: number | null;
  payable_amount: number | null;
  voucher_id: number | null;
  invoice_id: number | null;
  notes: string | null;
  created_at: string;
  token_number: number | null;
  patient_id: number | null;
}

interface VoucherView {
  id: number;
  voucher_number: string;
  patient_name: string;
  doctor_name: string;
  clinic_name: string;
  appointment_date: string;
  appointment_slot: string;
  booking_amount: number | null;
  commission_amount: number | null;
  total_payable: number | null;
  status: string;
  token_number: number | null;
  _apt?: Appointment;
  _invoice_number?: string;
}

/* ─── Sessions (replaces time slots) ────────────────────────── */
const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const SESSION_EMOJI: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙" };

/* ─── Helpers ───────────────────────────────────────────────── */
const genId = () => "APT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genVoucher = () => "VCH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genInvoice = () => "INV" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genTxn = () => "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
const fmtMoney = (n: number | null | undefined) => n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

/* ─── Number to Words (for voucher) ─────────────────────────── */
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

/* ─── Component ─────────────────────────────────────────────── */
export default function AppointmentsPage() {
  /* List state */
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics]           = useState<Clinic[]>([]);
  const [doctors, setDoctors]           = useState<DoctorRow[]>([]);
  const [specialties, setSpecialties]   = useState<Specialty[]>([]);
  const [loading, setLoading]           = useState(true);

  /* Filters */
  const [fDate, setFDate]       = useState("");
  const [fClinic, setFClinic]   = useState("all");
  const [fDoctor, setFDoctor]   = useState("all");
  const [fStatus, setFStatus]   = useState("all");
  const [fSource, setFSource]   = useState("all");
  const [fSearch, setFSearch]   = useState("");

  /* Modal */
  const [showModal, setShowModal]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [formError, setFormError]         = useState("");
  const [successMsg, setSuccessMsg]       = useState("");

  /* Voucher viewer */
  const [viewVoucher, setViewVoucher]     = useState<VoucherView | null>(null);

  /* Bulk delete */
  const [showBulkDelete, setShowBulkDelete]     = useState(false);
  const [bulkDateFrom, setBulkDateFrom]         = useState("");
  const [bulkDateTo, setBulkDateTo]             = useState("");
  const [bulkDeleting, setBulkDeleting]         = useState(false);
  const [bulkDeleteMsg, setBulkDeleteMsg]       = useState("");
  const [bulkDeleteError, setBulkDeleteError]   = useState("");
  const [bulkConfirm, setBulkConfirm]           = useState(false);

  /* Form fields */
  const [frmPatientSearch, setFrmPatientSearch] = useState("");
  const [frmPatients, setFrmPatients]           = useState<PatientRow[]>([]);
  const [frmPatientId, setFrmPatientId]         = useState<number | null>(null);
  const [frmPatientName, setFrmPatientName]     = useState("");
  const [frmPatientEmail, setFrmPatientEmail]   = useState("");
  const [frmPatientPhone, setFrmPatientPhone]   = useState("");
  const [frmIsNewPatient, setFrmIsNewPatient]   = useState(false);

  /* Family member state */
  const [frmFamilyMembers, setFrmFamilyMembers]     = useState<FamilyMember[]>([]);
  const [frmSelectedMember, setFrmSelectedMember]   = useState<FamilyMember | null>(null);
  const [frmBookingFor, setFrmBookingFor]           = useState<"self" | "family">("self");
  const [frmLoadingFamily, setFrmLoadingFamily]     = useState(false);
  const [frmShowAddFamily, setFrmShowAddFamily]     = useState(false);
  const [frmNewFamilyName, setFrmNewFamilyName]     = useState("");
  const [frmNewFamilyAge, setFrmNewFamilyAge]       = useState("");
  const [frmNewFamilyGender, setFrmNewFamilyGender] = useState("Male");
  const [frmNewFamilyRelation, setFrmNewFamilyRelation] = useState("Spouse");
  const [frmAddingFamily, setFrmAddingFamily]       = useState(false);

  const [frmSpecialtyId, setFrmSpecialtyId] = useState<number | null>(null);
  const [frmLocation, setFrmLocation]     = useState("");
  const [frmLocationCoords, setFrmLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [frmClinicId, setFrmClinicId]     = useState<number | null>(null);
  const [frmDoctorId, setFrmDoctorId]     = useState<number | null>(null);
  const [frmDate, setFrmDate]             = useState("");
  const [frmSlot, setFrmSlot]             = useState("");
  const [frmNotes, setFrmNotes]           = useState("");
  const [frmSourceRole, setFrmSourceRole] = useState("Admin");

  /* Slot availability */
  const [sessionInfo, setSessionInfo]       = useState<Record<string, { booked: number; max_seats: number }>>({});
  const [scheduledSlots, setScheduledSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);   // dates doctor has schedule
  const [loadingSlots, setLoadingSlots]     = useState(false);
  const [loadingDates, setLoadingDates]     = useState(false);

  /* ── Data fetching (uses server API for appointments — bypasses RLS) ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aptApiRes, clinicRes, docRes, specRes] = await Promise.all([
        fetch("/api/admin/appointments").then(r => r.json()).catch(() => ({ appointments: [] })),
        supabase.from("clinics").select("id, name, city, latitude, longitude").eq("status", "active").order("name"),
        supabase.from("doctors").select("id, name, email, clinic_ids, specialty_ids, appointment_fee, booking_fee").order("name"),
        supabase.from("specialties").select("id, name").order("name"),
      ]);
      setAppointments((aptApiRes.appointments || []) as Appointment[]);
      if (clinicRes.data) setClinics(clinicRes.data as Clinic[]);
      if (docRes.data) setDoctors(docRes.data as DoctorRow[]);
      setSpecialties((specRes.data || []) as Specialty[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Clinic search state ───────────────────────────────────── */
  const [clinicSearch, setClinicSearch]       = useState("");
  const [showClinicDrop, setShowClinicDrop]   = useState(false);

  const filteredClinics = clinicSearch.trim().length > 0
    ? clinics.filter(c => c.name.toLowerCase().includes(clinicSearch.toLowerCase()) || (c.city || "").toLowerCase().includes(clinicSearch.toLowerCase()))
    : clinics;

  /* ── Patient search — by phone number (search patients + appointments + family) ── */
  const [frmSearchFamilyMap, setFrmSearchFamilyMap] = useState<Record<number, FamilyMember[]>>({});

  const searchPatients = async (q: string) => {
    setFrmPatientSearch(q);
    if (q.length < 3) { setFrmPatients([]); setFrmSearchFamilyMap({}); return; }
    try {
      const unique = new Map<string, PatientRow>();
      
      /* 1. Search patients table (mobile app users) */
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
      
      /* 2. Also search appointments for existing patients (deduped) */
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
      
      const patientsList = Array.from(unique.values());
      setFrmPatients(patientsList);

      /* 3. Fetch family members for patients with valid IDs */
      const validPatients = patientsList.filter(p => p.id > 0);
      if (validPatients.length > 0) {
        const familyMap: Record<number, FamilyMember[]> = {};
        await Promise.all(validPatients.map(async (p) => {
          try {
            const res = await fetch(`/api/admin/family-members?patient_id=${p.id}`);
            if (res.ok) {
              const json = await res.json();
              if (json.data?.length > 0) familyMap[p.id] = json.data;
            }
          } catch {}
        }));
        setFrmSearchFamilyMap(familyMap);
      } else {
        setFrmSearchFamilyMap({});
      }
    } catch { setFrmPatients([]); setFrmSearchFamilyMap({}); }
  };

  /* ── Fetch family members when patient selected ─────────── */
  const fetchFamilyMembers = async (patientId: number) => {
    setFrmLoadingFamily(true);
    try {
      const res = await fetch(`/api/admin/family-members?patient_id=${patientId}`);
      if (res.ok) {
        const json = await res.json();
        setFrmFamilyMembers(json.data || []);
      }
    } catch { setFrmFamilyMembers([]); }
    finally { setFrmLoadingFamily(false); }
  };

  const addFamilyMember = async () => {
    if (!frmNewFamilyName.trim()) return;
    const pid = frmPatientId;
    if (!pid) return;
    setFrmAddingFamily(true);
    try {
      const res = await fetch("/api/admin/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: pid,
          name: frmNewFamilyName.trim(),
          age: parseInt(frmNewFamilyAge) || 0,
          gender: frmNewFamilyGender,
          relationship: frmNewFamilyRelation,
        }),
      });
      if (res.ok) {
        setFrmShowAddFamily(false);
        setFrmNewFamilyName(""); setFrmNewFamilyAge(""); setFrmNewFamilyGender("Male"); setFrmNewFamilyRelation("Spouse");
        await fetchFamilyMembers(pid);
      }
    } catch {}
    finally { setFrmAddingFamily(false); }
  };

  /* ── When doctor changes: fetch all scheduled dates ─────────── */
  useEffect(() => {
    if (!frmDoctorId) { setAvailableDates([]); setScheduledSlots([]); setSessionInfo({}); setFrmDate(""); setFrmSlot(""); return; }
    (async () => {
      setLoadingDates(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${today}`);
        const json = await res.json();
        const schedData: any[] = json.data || [];
        // Collect unique dates that have at least one 'available' slot
        const dateSet = new Set<string>();
        schedData.forEach((s: any) => { if (s.status === "available") dateSet.add(s.date); });
        setAvailableDates(Array.from(dateSet).sort());
      } catch { setAvailableDates([]); }
      finally { setLoadingDates(false); }
    })();
  }, [frmDoctorId]);

  /* ── When date changes: fetch session info for that date ───── */
  useEffect(() => {
    if (!frmDoctorId || !frmDate) { setSessionInfo({}); setScheduledSlots([]); return; }
    (async () => {
      setLoadingSlots(true);
      try {
        const schedRes = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${frmDate}`)
          .then(r => r.json()).catch(() => ({ data: [] }));
        const schedData: any[] = schedRes.data || [];
        const forDate = schedData.filter((s: any) => s.date === frmDate && s.status === "available");
        const availableSessions = forDate.map((s: any) => s.slot);
        setScheduledSlots(availableSessions);
        const info: Record<string, { booked: number; max_seats: number }> = {};
        forDate.forEach((s: any) => {
          info[s.slot] = { booked: s.booked_count || 0, max_seats: s.max_seats || 30 };
        });
        setSessionInfo(info);
      } catch { setSessionInfo({}); setScheduledSlots([]); }
      finally { setLoadingSlots(false); }
    })();
  }, [frmDoctorId, frmDate]);

  /* ── Auto-select clinic when doctor has only one clinic ───── */
  useEffect(() => {
    if (!frmDoctorId) return;
    const doc = doctors.find(d => d.id === frmDoctorId);
    const matchedClinics = clinics.filter(c => {
      if (!(doc?.clinic_ids?.includes(c.id))) return false;
      if (frmLocation && !locationClinicIds.has(c.id)) return false;
      return true;
    });
    if (matchedClinics.length === 1 && !frmClinicId) {
      setFrmClinicId(matchedClinics[0].id);
    }
  }, [frmDoctorId, doctors, clinics, frmLocation, frmClinicId]);

  /* ── Haversine distance (km) ─────────────────────────────── */
  const RADIUS_KM = 5; // clinics within 5 km radius
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* ── Location-based filtering (proximity + city fallback) ── */
  const availableLocations = Array.from(new Set(clinics.map(c => c.city).filter(Boolean) as string[])).sort();

  const locationFilteredClinics = (() => {
    if (!frmLocation) return clinics;
    const loc = frmLocation.toLowerCase().trim();
    if (!loc) return clinics;

    // Helper: safe city match (skip empty cities)
    const cityMatches = (city: string | null | undefined) => {
      const c = (city || "").toLowerCase().trim();
      if (!c) return false; // never match clinics with empty city
      return c.includes(loc) || loc.includes(c);
    };

    // Step 1: Try exact city name matching first
    const cityMatched = clinics.filter(c => cityMatches(c.city));
    if (cityMatched.length > 0) return cityMatched;

    // Step 2: If no city match but we have coords, use proximity
    if (frmLocationCoords) {
      return clinics.filter(c => {
        if (c.latitude != null && c.longitude != null) {
          return haversineKm(frmLocationCoords.lat, frmLocationCoords.lng, c.latitude, c.longitude) <= RADIUS_KM;
        }
        return false;
      });
    }

    return [];
  })();
  const locationClinicIds = new Set(locationFilteredClinics.map(c => c.id));

  const filteredDoctors = doctors.filter(d => {
    if (frmSpecialtyId && !d.specialty_ids?.includes(frmSpecialtyId)) return false;
    if (frmLocation && !d.clinic_ids?.some(cid => locationClinicIds.has(cid))) return false;
    return true;
  });

  const filteredClinicsForDoctor = frmDoctorId
    ? clinics.filter(c => {
        const doc = doctors.find(d => d.id === frmDoctorId);
        if (!(doc?.clinic_ids?.includes(c.id))) return false;
        if (frmLocation && !locationClinicIds.has(c.id)) return false;
        return true;
      })
    : [];

  const availableSpecialties = specialties.filter(s => {
    const docsForSpec = doctors.filter(d => d.specialty_ids?.includes(s.id));
    if (frmLocation) return docsForSpec.some(d => d.clinic_ids?.some(cid => locationClinicIds.has(cid)));
    return docsForSpec.length > 0;
  });

  /* ── Selected doctor for fee calc ─────────────────────────── */
  const selectedDoctor = doctors.find((d) => d.id === frmDoctorId);
  const bookingAmount = selectedDoctor?.booking_fee || selectedDoctor?.appointment_fee || 0;
  const isAgent = frmSourceRole === "Agent";
  const commissionAmount = isAgent ? Math.round(bookingAmount * 10 / 100) : 0; // Agent commission is set per agent, default 10% for admin preview
  const payableAmount = bookingAmount + commissionAmount;

  /* ── Doctor / Clinic name maps for display ────────────────── */
  const doctorMap = new Map(doctors.map((d) => [d.id, d.name]));
  const clinicMap = new Map(clinics.map((c) => [c.id, c.name]));

  /* ── Open modal ───────────────────────────────────────────── */
  const openAddModal = () => {
    setFrmPatientSearch(""); setFrmPatients([]); setFrmPatientId(null);
    setFrmPatientName(""); setFrmPatientEmail(""); setFrmPatientPhone("");
    setFrmIsNewPatient(false);
    setFrmFamilyMembers([]); setFrmSelectedMember(null); setFrmBookingFor("self");
    setFrmShowAddFamily(false); setFrmLoadingFamily(false);
    setFrmSpecialtyId(null); setFrmLocation(""); setFrmLocationCoords(null);
    setFrmClinicId(null); setFrmDoctorId(null); setFrmDate(""); setFrmSlot(""); setFrmNotes("");
    setFrmSourceRole("Admin"); setFormError(""); setClinicSearch(""); setShowClinicDrop(false);
    setAvailableDates([]); setScheduledSlots([]); setSessionInfo({});
    setShowModal(true);
  };

  /* ── Submit booking ───────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!frmPatientName.trim()) return setFormError("Patient name is required.");
    if (!frmClinicId) return setFormError("Please select a clinic.");
    if (!frmDoctorId) return setFormError("Please select a doctor.");
    if (!frmDate) return setFormError("Please select a date.");
    if (!frmSlot) return setFormError("Please select a session.");

    setIsSubmitting(true); setFormError("");

    try {
      /* Check seat availability */
      const si = sessionInfo[frmSlot];
      if (si && si.booked >= si.max_seats) {
        setFormError(`Session "${frmSlot}" is full (${si.booked}/${si.max_seats} seats booked).`);
        setIsSubmitting(false);
        return;
      }

      const clinicName = clinicMap.get(frmClinicId) || "";
      const doctorName = doctorMap.get(frmDoctorId) || "";

      /* Call server API — handles appointment + voucher + invoice + transaction */
      /* Determine booking patient name (self or family member) */
      const bookingPatientName = frmBookingFor === "family" && frmSelectedMember
        ? frmSelectedMember.name : frmPatientName.trim();

      const apiRes = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: bookingPatientName,
          patient_email: frmPatientEmail || null,
          patient_phone: frmPatientPhone || null,
          doctor_id: frmDoctorId,
          clinic_id: frmClinicId,
          appointment_date: frmDate,
          slot: frmSlot,
          source_role: frmSourceRole,
          booking_amount: bookingAmount,
          commission_amount: commissionAmount,
          payable_amount: payableAmount,
          doctor_name: doctorName,
          clinic_name: clinicName,
          notes: frmNotes || null,
        }),
      });

      const result = await apiRes.json();
      if (!apiRes.ok) throw new Error(result.error || "Booking failed.");

      /* Refresh & close */
      setShowModal(false);
      setSuccessMsg(`Appointment ${result.appointment_id} booked! Token #${result.token_number || '—'} | Voucher: ${result.voucher_number}`);
      setTimeout(() => setSuccessMsg(""), 5000);
      fetchAll();

    } catch (err: any) {
      setFormError(err?.message || "Booking failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Status update (via API — bypasses RLS) ──────────────── */
  const updateStatus = async (apt: Appointment, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apt.id, status: newStatus }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: newStatus } : a));
    } catch (err) { console.error(err); }
  };

  /* ── Bulk delete appointments by date range ─────────────── */
  const executeBulkDelete = async () => {
    if (!bulkDateFrom || !bulkDateTo) { setBulkDeleteError("Please select both start and end dates."); return; }
    if (bulkDateFrom > bulkDateTo) { setBulkDeleteError("Start date must be before end date."); return; }

    setBulkDeleting(true);
    setBulkDeleteError("");
    setBulkDeleteMsg("");
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom: bulkDateFrom, dateTo: bulkDateTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      setBulkDeleteMsg(`Successfully deleted ${json.deletedCount} appointment(s).`);
      setBulkConfirm(false);
      setBulkDateFrom("");
      setBulkDateTo("");
      // Refresh data
      fetchAll();
    } catch (err: any) {
      setBulkDeleteError(err.message || "Delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ── View voucher (via service role) ─────────────────────── */
  const openVoucher = async (apt: Appointment) => {
    // If no voucher exists, generate records first
    if (!apt.voucher_id) {
      try {
        const res = await fetch("/api/admin/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: apt.id, action: "generate-records" }),
        });
        const result = await res.json();
        if (result.voucher_id) {
          apt.voucher_id = result.voucher_id;
          apt.invoice_id = result.invoice_id;
          // Update local state
          setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, voucher_id: result.voucher_id, invoice_id: result.invoice_id } : a));
        } else {
          return;
        }
      } catch (err) { console.error(err); return; }
    }
    try {
      const { data } = await supabase.from("vouchers").select("*").eq("id", apt.voucher_id).single();
      let invoiceNumber = "";
      if (apt.invoice_id) {
        const { data: inv } = await supabase.from("invoices").select("invoice_number").eq("id", apt.invoice_id).single();
        if (inv) invoiceNumber = inv.invoice_number;
      }
      if (data) setViewVoucher({ ...(data as VoucherView), _apt: apt, _invoice_number: invoiceNumber });
    } catch (err) { console.error(err); }
  };

  /* ── Print/Download voucher ─────────────────────────────── */
  const printVoucher = () => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow || !viewVoucher) return;
    const v = viewVoucher;
    const aptExtra = (v as any)._apt as Appointment | undefined;
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
  .section-title { font-weight: bold; font-size: 13px; margin: 15px 0 8px; padding: 4px 8px; background: #E8F4F8; border-left: 3px solid #0D8EAD; }
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
    <div class="info-row"><span class="info-label">UHID No.:</span><span class="info-value">UHID${String(aptExtra?.patient_id || 0).padStart(8, '0')}</span></div>
    <div class="info-row"><span class="info-label">Booking ID:</span><span class="info-value">NXD${String(aptExtra?.id || 0).padStart(8, '0')}</span></div>
    <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${v.appointment_date}</span></div>
    <div class="info-row"><span class="info-label">Patient Name:</span><span class="info-value">${v.patient_name}</span></div>
    <div class="info-row"><span class="info-label">Doctor Name:</span><span class="info-value">${v.doctor_name}</span></div>
    <div class="info-row"><span class="info-label">Contact No.:</span><span class="info-value">${aptExtra?.patient_phone || aptExtra?.patient_email || '—'}</span></div>
    <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${v.clinic_name}</span></div>
  </div>
  <div class="section-title">APPOINTMENT DETAILS</div>
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
    <div class="footer-col"><div class="footer-line">Booked by: ${aptExtra?.source_role || 'Admin'}</div></div>
    <div class="footer-col"><div class="footer-line">Authorized Signature</div></div>
  </div>
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  /* ── Filtered list ────────────────────────────────────────── */
  const filtered = appointments.filter((a) => {
    const q = fSearch.toLowerCase();
    const matchSearch = !q || a.patient_name?.toLowerCase().includes(q) || a.appointment_id?.toLowerCase().includes(q);
    const matchDate = !fDate || a.appointment_date === fDate;
    const matchClinic = fClinic === "all" || String(a.clinic_id) === fClinic;
    const matchDoctor = fDoctor === "all" || String(a.doctor_id) === fDoctor;
    const matchStatus = fStatus === "all" || a.status === fStatus;
    const matchSource = fSource === "all" || a.source_role === fSource;
    return matchSearch && matchDate && matchClinic && matchDoctor && matchStatus && matchSource;
  });

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === "scheduled").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const sourceColor: Record<string, string> = {
    Admin: "bg-purple-100 text-purple-700",
    Agent: "bg-orange-100 text-orange-700",
    Attendant: "bg-cyan-100 text-cyan-700",
    App: "bg-brand-100 text-brand-700",
  };

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8 text-brand-600" /> Appointments
            </h1>
            <p className="text-muted-foreground mt-1">Book, manage & track all appointments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setShowBulkDelete(!showBulkDelete); setBulkDeleteMsg(""); setBulkDeleteError(""); setBulkConfirm(false); }}>
            <Trash2 className="h-4 w-4" /> Bulk Delete
          </Button>
          <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAddModal}>
            <Plus className="h-4 w-4" /> Add Appointment
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✅ {successMsg}</div>
      )}

      {/* Bulk Delete Panel */}
      {showBulkDelete && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold text-red-800">Bulk Delete Appointments</h3>
                  <p className="text-sm text-red-600 mt-1">Select a date range to permanently delete all appointments within that period. This action cannot be undone.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-red-700">Start Date</label>
                    <Input type="date" value={bulkDateFrom} onChange={(e) => setBulkDateFrom(e.target.value)} className="border-red-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-red-700">End Date</label>
                    <Input type="date" value={bulkDateTo} onChange={(e) => setBulkDateTo(e.target.value)} className="border-red-300" />
                  </div>
                  <div className="flex gap-2">
                    {!bulkConfirm ? (
                      <Button variant="destructive" className="gap-2" onClick={() => {
                        if (!bulkDateFrom || !bulkDateTo) { setBulkDeleteError("Select both dates."); return; }
                        if (bulkDateFrom > bulkDateTo) { setBulkDeleteError("Start date must be before end date."); return; }
                        setBulkDeleteError("");
                        // Count appointments in range
                        const count = appointments.filter(a => a.appointment_date >= bulkDateFrom && a.appointment_date <= bulkDateTo).length;
                        if (count === 0) { setBulkDeleteError("No appointments found in this date range."); return; }
                        setBulkDeleteMsg(`Found ${count} appointment(s) in range. Click "Confirm Delete" to proceed.`);
                        setBulkConfirm(true);
                      }} disabled={bulkDeleting}>
                        <Search className="h-4 w-4" /> Preview
                      </Button>
                    ) : (
                      <Button variant="destructive" className="gap-2 bg-red-700 hover:bg-red-800" onClick={executeBulkDelete} disabled={bulkDeleting}>
                        {bulkDeleting ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {bulkDeleting ? "Deleting…" : "Confirm Delete"}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => { setShowBulkDelete(false); setBulkConfirm(false); setBulkDeleteMsg(""); setBulkDeleteError(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
                {bulkDeleteError && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-100 rounded px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {bulkDeleteError}
                  </div>
                )}
                {bulkDeleteMsg && (
                  <div className={`flex items-center gap-2 text-sm rounded px-3 py-2 ${bulkConfirm ? "text-amber-800 bg-amber-100" : "text-green-700 bg-green-100"}`}>
                    {bulkConfirm ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />} {bulkDeleteMsg}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-800", icon: Calendar },
          { label: "Scheduled", value: stats.scheduled, color: "text-blue-600", icon: Clock },
          { label: "Completed", value: stats.completed, color: "text-green-600", icon: Check },
          { label: "Cancelled", value: stats.cancelled, color: "text-red-600", icon: Ban },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div><p className="text-xs text-muted-foreground mt-1">{s.label}</p></div>
                <s.icon className={`h-8 w-8 opacity-30 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Patient or ID…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Clinic</label>
            <Select value={fClinic} onValueChange={setFClinic}>
              <SelectTrigger><SelectValue placeholder="All Clinics" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinics</SelectItem>
                {clinics.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Doctor</label>
            <Select value={fDoctor} onValueChange={setFDoctor}>
              <SelectTrigger><SelectValue placeholder="All Doctors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Source</label>
            <Select value={fSource} onValueChange={setFSource}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="App">App</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Agent">Agent</SelectItem>
                <SelectItem value="Attendant">Attendant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => { setFSearch(""); setFDate(""); setFClinic("all"); setFDoctor("all"); setFStatus("all"); setFSource("all"); }}>
            Reset
          </Button>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-brand-600" /><p className="ml-3 text-muted-foreground">Loading…</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Appointments ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No appointments found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                    {["Patient", "Clinic", "Doctor", "Date", "Session", "Token", "Source", "Amount", "Commission", "Payable", "Status", "Actions"].map((h) => (
                      <th key={h} className="py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((apt) => (
                    <tr key={apt.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-3">
                        <div><p className="font-medium">{apt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{apt.patient_email || "—"}</p></div>
                      </td>
                      <td className="py-3 px-3 text-xs">{clinicMap.get(apt.clinic_id!) || "—"}</td>
                      <td className="py-3 px-3 text-xs">{doctorMap.get(apt.doctor_id!) || "—"}</td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">{apt.appointment_date ? fmtDate(apt.appointment_date) : "—"}</td>
                      <td className="py-3 px-3 text-xs font-mono">{apt.slot || apt.appointment_time || "—"}</td>
                      <td className="py-3 px-3">
                        {apt.token_number ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">#{apt.token_number}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {apt.source_role ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceColor[apt.source_role] || "bg-gray-100 text-gray-600"}`}>{apt.source_role}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">{fmtMoney(apt.booking_amount)}</td>
                      <td className="py-3 px-3 text-xs">{fmtMoney(apt.commission_amount)}</td>
                      <td className="py-3 px-3 text-xs font-semibold text-brand-700">{fmtMoney(apt.payable_amount)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[apt.status] || "bg-gray-100 text-gray-600"}`}>
                          {apt.status?.charAt(0).toUpperCase() + apt.status?.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" title="View Voucher" onClick={() => openVoucher(apt)}>
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {apt.status === "scheduled" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Complete" onClick={() => updateStatus(apt, "completed")}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Cancel" onClick={() => updateStatus(apt, "cancelled")}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
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

      {/* ── BOOKING SLIP VOUCHER MODAL ─────────────────────────── */}
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

            {/* Title */}
            <div className="mx-5 mt-4 mb-3 text-center">
              <div className="inline-block px-6 py-1.5 bg-brand-50 border border-brand-300 rounded font-bold text-brand-800 tracking-wide">
                BOOKING SLIP
              </div>
            </div>

            {/* Patient & Booking Info */}
            <div className="px-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">UHID No.:</span><span className="text-gray-600">UHID{String(viewVoucher._apt?.patient_id || 0).padStart(8, '0')}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Booking ID:</span><span className="text-gray-600">NXD{String(viewVoucher._apt?.id || 0).padStart(8, '0')}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Patient Name:</span><span className="text-gray-600">{viewVoucher.patient_name}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Doctor Name:</span><span className="text-gray-600">{viewVoucher.doctor_name}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Contact No.:</span><span className="text-gray-600">{viewVoucher._apt?.patient_phone || viewVoucher._apt?.patient_email || "—"}</span></div>
              <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-700 min-w-[100px]">Address:</span><span className="text-gray-600">{viewVoucher.clinic_name}</span></div>
            </div>

            {/* Appointment Details */}
            <div className="mx-5 mt-4">
              <div className="font-bold text-sm bg-brand-50 border-l-4 border-brand-600 px-3 py-1.5 mb-2">APPOINTMENT DETAILS</div>
              <div className="grid grid-cols-3 gap-x-4 text-sm px-1">
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Slot:</span><span className="text-gray-600">{viewVoucher.appointment_slot}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Token No.:</span><span className="text-lg font-bold text-brand-700">#{(viewVoucher as any)._apt?.token_number || viewVoucher.token_number || '—'}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Serial No.:</span><span className="text-gray-600">{(viewVoucher as any)._apt?.id || "—"}</span></div>
              </div>
            </div>

            {/* Fee Table */}
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

            {/* Amount in Words */}
            <div className="mx-5 mt-2 text-xs italic text-gray-500">
              Amount Received in Words: <span className="font-medium text-gray-700">Rupees {numberToWords(Number(viewVoucher.total_payable || 0))} Only</span>
            </div>

            {/* Booked By & Signature */}
            <div className="mx-5 mt-6 flex justify-between text-sm pb-2">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Booked by: <span className="font-semibold">{(viewVoucher as any)._apt?.source_role || "Admin"}</span></div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Authorized Signature</div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mx-5 mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${viewVoucher.status === "active" ? "bg-green-100 text-green-700" : viewVoucher.status === "used" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{viewVoucher.status}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-5 border-t mt-4">
              <Button onClick={printVoucher} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white gap-2"><Printer className="h-4 w-4" /> Print / Download</Button>
              <Button onClick={() => setViewVoucher(null)} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD APPOINTMENT SLIDE-OVER ────────────────────────── */}
      {showModal && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setShowModal(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${showModal ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"><Calendar className="h-5 w-5 text-brand-600" /> New Appointment</h2>
          <button onClick={() => !isSubmitting && setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          {/* Source Role */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Source</Label>
            <div className="flex gap-2">
              {["Admin", "Agent", "Attendant", "App"].map((r) => (
                <button key={r} onClick={() => setFrmSourceRole(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${frmSourceRole === r ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 hover:bg-gray-50"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Patient */}
          <div className="space-y-2 border rounded-xl p-4 bg-gray-50/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3.5 w-3.5" /> Patient</Label>
            {!frmIsNewPatient ? (
              <>
                {/* Phone search */}
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by phone number…" value={frmPatientSearch}
                    onChange={(e) => { searchPatients(e.target.value); }} className="pl-9" />
                </div>

                {/* Search results with family members */}
                {frmPatients.length > 0 && !frmPatientId && (
                  <div className="border rounded-lg max-h-64 overflow-y-auto bg-white">
                    {frmPatients.map((p, i) => (
                      <div key={i}>
                        <button className="w-full text-left px-3 py-2.5 hover:bg-brand-50 text-sm transition-colors border-b"
                          onClick={() => { setFrmPatientId(p.id); setFrmPatientName(p.name); setFrmPatientEmail(p.email); setFrmPatientPhone(p.phone || ""); setFrmPatients([]); setFrmPatientSearch(p.phone || ""); setFrmBookingFor("self"); setFrmSelectedMember(null); setFrmSearchFamilyMap({}); if (p.id) fetchFamilyMembers(p.id); }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs font-mono text-brand-600">{p.phone}</span>
                          </div>
                          {p.email && <p className="text-xs text-muted-foreground mt-0.5">{p.email}</p>}
                        </button>
                        {/* Family members under this patient */}
                        {frmSearchFamilyMap[p.id]?.map((fm) => (
                          <button key={`fm-${fm.id}`}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm transition-colors border-b bg-gray-50/80 pl-7"
                            onClick={() => {
                              setFrmPatientId(p.id); setFrmPatientName(p.name); setFrmPatientEmail(p.email); setFrmPatientPhone(p.phone || "");
                              setFrmPatients([]); setFrmPatientSearch(p.phone || "");
                              setFrmBookingFor("family"); setFrmSelectedMember(fm);
                              setFrmFamilyMembers(frmSearchFamilyMap[p.id] || []);
                              setFrmSearchFamilyMap({});
                            }}>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-emerald-600" />
                                <span className="font-medium text-emerald-700">{fm.name}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">{fm.relationship} · {fm.age} yrs</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmed patient card */}
                {frmPatientId !== null && frmPatientName && (
                  <div className="border border-brand-200 bg-brand-50/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{frmPatientName}</p>
                        <p className="text-xs text-muted-foreground">{frmPatientPhone}{frmPatientEmail ? ` • ${frmPatientEmail}` : ""}</p>
                      </div>
                      <button onClick={() => { setFrmPatientId(null); setFrmPatientName(""); setFrmPatientEmail(""); setFrmPatientPhone(""); setFrmPatientSearch(""); setFrmFamilyMembers([]); setFrmSelectedMember(null); setFrmBookingFor("self"); setFrmSearchFamilyMap({}); }}
                        className="p-1 rounded hover:bg-brand-100"><X className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                    {frmBookingFor === "family" && frmSelectedMember && (
                      <div className="mt-2 pt-2 border-t border-brand-200">
                        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <Users className="h-3 w-3" /> Booking for: {frmSelectedMember.name} ({frmSelectedMember.relationship})
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setFrmIsNewPatient(true)} className="text-xs text-brand-600 font-medium hover:underline">
                  + Create new patient
                </button>

                {/* Family Member Booking Section */}
                {frmPatientId && frmPatientId > 0 && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Book For
                    </Label>
                    <div className="flex gap-2">
                      <button onClick={() => { setFrmBookingFor("self"); setFrmSelectedMember(null); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${frmBookingFor === "self" ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 hover:bg-gray-50"}`}>
                        Self ({frmPatientName.split(" ")[0]})
                      </button>
                      <button onClick={() => setFrmBookingFor("family")}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${frmBookingFor === "family" ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 hover:bg-gray-50"}`}>
                        Family Member
                      </button>
                    </div>

                    {frmBookingFor === "family" && (
                      <div className="space-y-2">
                        {frmLoadingFamily ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader className="h-3 w-3 animate-spin" /> Loading family members...
                          </div>
                        ) : frmFamilyMembers.length > 0 ? (
                          <div className="space-y-1">
                            {frmFamilyMembers.map((fm) => (
                              <button key={fm.id} onClick={() => setFrmSelectedMember(fm)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                  frmSelectedMember?.id === fm.id
                                    ? "bg-brand-50 border-brand-300 ring-1 ring-brand-200"
                                    : "border-gray-200 hover:bg-gray-50"
                                }`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{fm.name}</span>
                                  <span className="text-xs text-muted-foreground">{fm.relationship} · {fm.gender} · {fm.age} yrs</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-1">No family members found.</p>
                        )}

                        {/* Add family member inline form */}
                        {!frmShowAddFamily ? (
                          <button onClick={() => setFrmShowAddFamily(true)} className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
                            <UserPlus className="h-3 w-3" /> Add family member
                          </button>
                        ) : (
                          <div className="border rounded-lg p-3 bg-white space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">New Family Member</p>
                            <Input placeholder="Name *" value={frmNewFamilyName} onChange={(e) => setFrmNewFamilyName(e.target.value)} className="h-8 text-sm" />
                            <div className="grid grid-cols-3 gap-2">
                              <Input placeholder="Age" type="number" value={frmNewFamilyAge} onChange={(e) => setFrmNewFamilyAge(e.target.value)} className="h-8 text-sm" />
                              <select value={frmNewFamilyGender} onChange={(e) => setFrmNewFamilyGender(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                              </select>
                              <select value={frmNewFamilyRelation} onChange={(e) => setFrmNewFamilyRelation(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                <option value="Spouse">Spouse</option><option value="Child">Child</option><option value="Parent">Parent</option><option value="Sibling">Sibling</option><option value="Other">Other</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs bg-brand-600 hover:bg-brand-700" onClick={addFamilyMember} disabled={frmAddingFamily}>
                                {frmAddingFamily ? <Loader className="h-3 w-3 animate-spin" /> : "Add"}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFrmShowAddFamily(false)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <Input placeholder="Patient Name *" value={frmPatientName}
                  onChange={(e) => setFrmPatientName(e.target.value)} />
                <Input placeholder="Email" type="email" value={frmPatientEmail}
                  onChange={(e) => setFrmPatientEmail(e.target.value)} />
                <Input placeholder="Phone *" value={frmPatientPhone}
                  onChange={(e) => setFrmPatientPhone(e.target.value)} />
                <button onClick={() => setFrmIsNewPatient(false)} className="text-xs text-muted-foreground hover:underline">
                  ← Search existing patient
                </button>
              </div>
            )}
          </div>

          {/* Location — Google Map */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Location</Label>
            <LocationMapPicker
              value={frmLocation}
              onSelect={(city, coords) => { setFrmLocation(city); setFrmLocationCoords(coords || null); setFrmSpecialtyId(null); setFrmDoctorId(null); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}
              onClear={() => { setFrmLocation(""); setFrmLocationCoords(null); setFrmSpecialtyId(null); setFrmDoctorId(null); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}
            />
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> Specialty</Label>
            {availableSpecialties.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{frmLocation ? "No specialties in this location." : "No specialties available."}</p>
            ) : (
              <Select value={frmSpecialtyId ? String(frmSpecialtyId) : ""} onValueChange={v => { setFrmSpecialtyId(Number(v)); setFrmDoctorId(null); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}>
                <SelectTrigger><SelectValue placeholder="Select Specialty" /></SelectTrigger>
                <SelectContent>
                  {availableSpecialties.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Doctor — filtered by specialty + location */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3.5 w-3.5" /> Doctor</Label>
            {filteredDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{frmSpecialtyId ? "No doctors for this specialty." : "Select a specialty first."}</p>
            ) : (
              <Select value={frmDoctorId ? String(frmDoctorId) : ""} onValueChange={(v) => { setFrmDoctorId(Number(v)); setFrmClinicId(null); setFrmDate(""); setFrmSlot(""); }}>
                <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                <SelectContent>
                  {filteredDoctors.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} {d.booking_fee ? `(₹${d.booking_fee})` : d.appointment_fee ? `(₹${d.appointment_fee})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Clinic — filtered by doctor's clinics + location */}
          {frmDoctorId && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Clinic</Label>
              {filteredClinicsForDoctor.length === 0 ? (
                <p className="text-sm text-amber-600 italic">No clinics for this doctor{frmLocation ? ` in ${frmLocation}` : ""}.</p>
              ) : filteredClinicsForDoctor.length === 1 ? (
                <div className="border border-brand-200 bg-brand-50/50 rounded-lg px-3 py-2.5">
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
                /* Scheduled dates as chips */
                <div className="flex flex-wrap gap-2">
                  {availableDates.map((d) => (
                    <button key={d} onClick={() => { setFrmDate(d); setFrmSlot(""); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        frmDate === d
                          ? "bg-brand-600 text-white border-brand-600"
                          : "border-gray-200 hover:bg-brand-50 hover:border-brand-300"
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

          {/* Session — auto-loaded after date is chosen */}
          {frmDoctorId && frmClinicId && frmDate && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Session
                {loadingSlots && <Loader className="h-3 w-3 animate-spin ml-1" />}
              </Label>

              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader className="h-4 w-4 animate-spin" /> Loading sessions…
                </div>
              ) : scheduledSlots.length === 0 ? (
                <p className="text-sm text-amber-600 italic flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> No sessions scheduled for this date.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {scheduledSlots.map((s) => {
                      const info = sessionInfo[s];
                      const booked = info?.booked || 0;
                      const maxSeats = info?.max_seats || 30;
                      const isFull = booked >= maxSeats;
                      const isSelected = frmSlot === s;
                      const remaining = maxSeats - booked;
                      return (
                        <button key={s} disabled={isFull}
                          onClick={() => setFrmSlot(s)}
                          className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                            isFull
                              ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed"
                              : isSelected
                              ? "bg-brand-600 text-white border-brand-600"
                              : "border-gray-200 hover:bg-brand-50 hover:border-brand-300"
                          }`}>
                          <div className="flex items-center gap-2">
                            <span>{SESSION_EMOJI[s] || "📅"}</span>
                            <span className="font-semibold">{s}</span>
                          </div>
                          <div className={`text-xs mt-1 ${isSelected ? "text-brand-100" : isFull ? "text-red-400" : "text-muted-foreground"}`}>
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
            <Input placeholder="Any notes…" value={frmNotes} onChange={(e) => setFrmNotes(e.target.value)} />
          </div>

          {/* Fee summary */}
          {selectedDoctor && frmSlot && (
            <div className="rounded-xl border bg-gradient-to-br from-brand-50 to-emerald-50 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> Payment Summary</h4>
              <div className="flex justify-between text-sm"><span>Booking Amount</span><span className="font-semibold">{fmtMoney(bookingAmount)}</span></div>
              {isAgent && (
                <div className="flex justify-between text-sm"><span>Agent Commission (10%)</span><span className="font-semibold text-orange-600">+ {fmtMoney(commissionAmount)}</span></div>
              )}
              <hr />
              <div className="flex justify-between text-base font-bold"><span>Total Payable</span><span className="text-brand-700">{fmtMoney(payableAmount)}</span></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => !isSubmitting && setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[180px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Booking…</> : <><Calendar className="h-4 w-4" /> Book Appointment</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
