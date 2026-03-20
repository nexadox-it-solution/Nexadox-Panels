"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Plus, ArrowLeft, Search, Check, X, Clock, Loader,
  AlertCircle, Phone, Building2, Stethoscope, IndianRupee, User, MapPin, Wallet, Users, UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { resolveAgent } from "@/lib/resolveRole";
import LocationMapPicker from "@/components/ui/location-map-picker";

/* ─── Types ─────────────────────────────────────────────────── */
interface Clinic { id: number; name: string; city: string | null; latitude: number | null; longitude: number | null; }
interface Specialty { id: number; name: string; }
interface DoctorRow { id: number; name: string; email: string; clinic_ids: number[] | null; specialty_ids: number[] | null; appointment_fee: number | null; booking_fee: number | null; }
interface PatientRow { id: number; name: string; email: string; phone: string | null; }
interface FamilyMember { id: number; patient_id: number; name: string; age: number; gender: string; relationship: string; date_of_birth?: string; }

const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const SESSION_EMOJI: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙" };

const genId = () => "APT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genVoucher = () => "VCH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genInvoice = () => "INV" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genTxn = () => "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const fmtMoney = (n: number | null | undefined) => n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

export default function AgentBookingPage() {
  const { toast } = useToast();

  /* Master data */
  /* Master data */
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  /* Agent data */
  const router = useRouter();
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agentCommissionRate, setAgentCommissionRate] = useState(30);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  /* Form state */
  const [frmPatientSearch, setFrmPatientSearch] = useState("");
  const [frmPatients, setFrmPatients] = useState<PatientRow[]>([]);
  const [frmPatientId, setFrmPatientId] = useState<number | null>(null);
  const [frmPatientName, setFrmPatientName] = useState("");
  const [frmPatientEmail, setFrmPatientEmail] = useState("");
  const [frmPatientPhone, setFrmPatientPhone] = useState("");
  const [frmIsNewPatient, setFrmIsNewPatient] = useState(false);

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
  const [frmLocation, setFrmLocation] = useState("");
  const [frmLocationCoords, setFrmLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [frmClinicId, setFrmClinicId] = useState<number | null>(null);
  const [frmDoctorId, setFrmDoctorId] = useState<number | null>(null);
  const [frmDate, setFrmDate] = useState("");
  const [frmSlot, setFrmSlot] = useState("");
  const [frmNotes, setFrmNotes] = useState("");

  /* Schedule & availability */
  const [sessionInfo, setSessionInfo] = useState<Record<string, { booked: number; max_seats: number }>>({});
  const [scheduledSlots, setScheduledSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);

  /* Clinic search */
  const [clinicSearch, setClinicSearch] = useState("");
  const [showClinicDrop, setShowClinicDrop] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  /* Map helpers */
  const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

  /* Haversine distance (km) */
  const RADIUS_KM = 5;
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* Location-based filtering (proximity + city fallback) */
  const availableLocations = Array.from(new Set(clinics.map(c => c.city).filter(Boolean) as string[])).sort();
  const locationFilteredClinics = (() => {
    if (!frmLocation) return clinics;
    const loc = frmLocation.toLowerCase().trim();
    if (!loc) return clinics;

    const cityMatches = (city: string | null | undefined) => {
      const c = (city || "").toLowerCase().trim();
      if (!c) return false;
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

  /* ── Fetch master data ──────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Use localStorage session (reliable) with supabase.auth.getUser() fallback
        const session = localStorage.getItem("nexadox-session") || "";
        const sessionUserId = session.split(":")[0] || null;
        const { data: { user } } = await supabase.auth.getUser();
        const userId = sessionUserId || user?.id;
        if (userId) {
          const ag = await resolveAgent(userId);
          if (ag) {
            setAgentUserId(userId);
            setAgentId(ag.id);
            setAgentCommissionRate(ag.commission_value || 30);
            setWalletBalance(Number(ag.wallet_balance) || 0);
          }
        }
        const [clinicRes, docRes, specRes] = await Promise.all([
          supabase.from("clinics").select("id, name, city, latitude, longitude").eq("status", "active").order("name"),
          supabase.from("doctors").select("id, name, email, clinic_ids, specialty_ids, appointment_fee, booking_fee").order("name"),
          supabase.from("specialties").select("id, name").order("name"),
        ]);
        setClinics((clinicRes.data || []) as Clinic[]);
        setDoctors((docRes.data || []) as DoctorRow[]);
        setSpecialties((specRes.data || []) as Specialty[]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Patient search by phone (includes family members) ──────── */
  const [frmSearchFamilyMap, setFrmSearchFamilyMap] = useState<Record<number, FamilyMember[]>>({});

  const searchPatients = async (q: string) => {
    setFrmPatientSearch(q);
    if (q.length < 3) { setFrmPatients([]); setFrmSearchFamilyMap({}); return; }
    try {
      const unique = new Map<string, PatientRow>();
      const { data: patientsData } = await supabase.from("patients").select("id, name, email, phone").ilike("phone", `%${q}%`).limit(20);
      if (patientsData) {
        patientsData.forEach((d: any) => {
          const key = d.phone || d.name;
          if (!unique.has(key)) {
            unique.set(key, { id: d.id || 0, name: d.name || "", email: d.email || "", phone: d.phone || null });
          }
        });
      }
      const { data: aptData } = await supabase.from("appointments").select("patient_name, patient_email, patient_phone").ilike("patient_phone", `%${q}%`).limit(20);
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

      /* Fetch family members for patients with valid IDs */
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

  /* ── When doctor changes: fetch available dates ─────────────── */
  useEffect(() => {
    if (!frmDoctorId) { setAvailableDates([]); setScheduledSlots([]); setSessionInfo({}); setFrmDate(""); setFrmSlot(""); return; }
    (async () => {
      setLoadingDates(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${today}`);
        const json = await res.json();
        const schedData: any[] = json.data || [];
        const dateSet = new Set<string>();
        schedData.forEach((s: any) => { if (s.status === "available") dateSet.add(s.date); });
        setAvailableDates(Array.from(dateSet).sort());
      } catch { setAvailableDates([]); }
      finally { setLoadingDates(false); }
    })();
  }, [frmDoctorId]);

  /* ── When date changes: fetch session info ────────────────── */
  useEffect(() => {
    if (!frmDoctorId || !frmDate) { setSessionInfo({}); setScheduledSlots([]); return; }
    (async () => {
      setLoadingSlots(true);
      try {
        const schedRes = await fetch(`/api/admin/doctor-schedule?doctor_id=${frmDoctorId}&date_from=${frmDate}`).then(r => r.json()).catch(() => ({ data: [] }));
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
      if (frmLocation && c.city !== frmLocation) return false;
      return true;
    });
    if (matchedClinics.length === 1 && !frmClinicId) {
      setFrmClinicId(matchedClinics[0].id);
    }
  }, [frmDoctorId, doctors, clinics, frmLocation, frmClinicId]);

  /* ── Submit booking ────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!frmPatientName.trim()) return setFormError("Patient name is required.");
    if (!frmClinicId) return setFormError("Please select a clinic.");
    if (!frmDoctorId) return setFormError("Please select a doctor.");
    if (!frmDate) return setFormError("Please select a date.");
    if (!frmSlot) return setFormError("Please select a session.");

    setIsSubmitting(true);
    setFormError("");

    try {
      /* Check seat availability */
      const si = sessionInfo[frmSlot];
      if (si && si.booked >= si.max_seats) {
        setFormError(`Session "${frmSlot}" is full (${si.booked}/${si.max_seats} seats booked).`);
        setIsSubmitting(false);
        return;
      }

      const doctor = doctors.find(d => d.id === frmDoctorId);
      const clinic = clinics.find(c => c.id === frmClinicId);
      const clinicName = clinic?.name || "";
      const doctorName = doctor?.name || "";

      const bookingAmount = doctor?.booking_fee || doctor?.appointment_fee || 0;
      const commissionPercent = agentCommissionRate; // Use agent's own commission rate, not doctor's commission
      const commissionAmount = Math.round(bookingAmount * commissionPercent / 100);
      const payableAmount = bookingAmount + commissionAmount;

      /* ── Wallet balance check ────────────────────────────── */
      if (walletBalance < payableAmount) {
        setFormError(`Insufficient wallet balance! You need ${fmtMoney(payableAmount)} but your wallet has only ${fmtMoney(walletBalance)}. Please top up your wallet first.`);
        setIsSubmitting(false);
        return;
      }

      /* Determine booking patient name (self or family member) */
      const bookingPatientName = frmBookingFor === "family" && frmSelectedMember
        ? frmSelectedMember.name : frmPatientName.trim();

      /* Build notes — prepend family member marker if applicable */
      let finalNotes = frmNotes || "";
      if (frmBookingFor === "family" && frmSelectedMember) {
        const fmIndex = frmFamilyMembers.findIndex(fm => fm.id === frmSelectedMember!.id) + 1;
        finalNotes = `[FM:${fmIndex}]${finalNotes ? " " + finalNotes : ""}`;
      }

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
          source_role: "Agent",
          booking_amount: bookingAmount,
          commission_amount: commissionAmount,
          payable_amount: payableAmount,
          doctor_name: doctorName,
          clinic_name: clinicName,
          notes: finalNotes || null,
          agent_user_id: agentUserId,
          agent_id: agentId,
        }),
      });

      const result = await apiRes.json();
      if (!apiRes.ok) throw new Error(result.error || "Booking failed.");

      /* Update local wallet balance after successful booking */
      setWalletBalance(prev => prev - payableAmount);

      toast({ title: "Booking Successful!", description: `Appointment ${result.appointment_id} booked! Voucher: ${result.voucher_number}` });
      
      /* Reset form */
      setShowModal(false);
      setFrmPatientSearch("");
      setFrmPatients([]);
      setFrmPatientId(null);
      setFrmPatientName("");
      setFrmPatientEmail("");
      setFrmPatientPhone("");
      setFrmIsNewPatient(false);
      setFrmFamilyMembers([]); setFrmSelectedMember(null); setFrmBookingFor("self");
      setFrmShowAddFamily(false); setFrmLoadingFamily(false);
      setFrmClinicId(null);
      setFrmDoctorId(null);
      setFrmSpecialtyId(null);
      setFrmLocation("");
      setFrmLocationCoords(null);
      setFrmDate("");
      setFrmSlot("");
      setFrmNotes("");
      setClinicSearch("");
      setFormError("");
    } catch (err: any) {
      setFormError(err?.message || "Booking failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  const selectedDoctor = doctors.find(d => d.id === frmDoctorId);
  const bookingAmount = selectedDoctor?.booking_fee || selectedDoctor?.appointment_fee || 0;
  const commissionPercent = agentCommissionRate; // Use agent's own commission rate
  const commissionAmount = Math.round(bookingAmount * commissionPercent / 100);
  const payableAmount = bookingAmount + commissionAmount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Calendar className="h-8 w-8 text-brand-600" /> Book Appointment</h1>
        <p className="text-muted-foreground mt-1">Book an appointment for a patient and earn commission</p>
      </div>

      <Button onClick={() => setShowModal(true)} className="gap-2 bg-brand-600 hover:bg-brand-700">
        <Plus className="h-4 w-4" /> New Appointment
      </Button>

      {/* Wallet Balance Card */}
      <Card className={`border ${walletBalance < 500 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${walletBalance < 500 ? 'bg-red-100' : 'bg-green-100'}`}>
                <Wallet className={`h-5 w-5 ${walletBalance < 500 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className={`text-2xl font-bold ${walletBalance < 500 ? 'text-red-700' : 'text-green-700'}`}>{fmtMoney(walletBalance)}</p>
              </div>
            </div>
            <Link href="/agent/wallet">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Top Up
              </Button>
            </Link>
          </div>
          {walletBalance < 500 && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Low balance! Top up your wallet to book appointments.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── BOOKING MODAL (Slide-over) ────────────────────────────── */}
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
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
              {formError.includes('Insufficient wallet') && (
                <Link href="/agent/wallet">
                  <Button size="sm" variant="destructive" className="gap-1.5 w-full mt-1">
                    <Wallet className="h-3.5 w-3.5" /> Go to Wallet & Top Up
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Patient Section */}
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

          {/* Date Selection */}
          {frmDoctorId && frmClinicId && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Available Dates
                {loadingDates && <Loader className="h-3 w-3 animate-spin ml-1" />}
              </Label>

              {!loadingDates && availableDates.length > 0 ? (
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

          {/* Session Selection */}
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

          {/* Fee Summary */}
          {selectedDoctor && frmSlot && (
            <div className="rounded-xl border bg-gradient-to-br from-brand-50 to-emerald-50 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> Payment Summary</h4>
              <div className="flex justify-between text-sm"><span>Booking Amount</span><span className="font-semibold">{fmtMoney(bookingAmount)}</span></div>
              <div className="flex justify-between text-sm"><span>Agent Commission ({commissionPercent}%)</span><span className="font-semibold text-orange-600">+ {fmtMoney(commissionAmount)}</span></div>
              <hr />
              <div className="flex justify-between text-base font-bold"><span>Total Payable</span><span className="text-brand-700">{fmtMoney(payableAmount)}</span></div>
              <hr />
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Wallet Balance</span>
                <span className={`font-semibold ${walletBalance >= payableAmount ? 'text-green-600' : 'text-red-600'}`}>{fmtMoney(walletBalance)}</span>
              </div>
              {walletBalance < payableAmount && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Insufficient balance! You need {fmtMoney(payableAmount - walletBalance)} more.
                  </p>
                  <Link href="/agent/wallet">
                    <Button size="sm" variant="destructive" className="gap-1.5 w-full mt-2">
                      <Wallet className="h-3.5 w-3.5" /> Top Up Wallet
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => !isSubmitting && setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
          {selectedDoctor && frmSlot && walletBalance < payableAmount ? (
            <Link href="/agent/wallet">
              <Button className="gap-2 bg-red-600 hover:bg-red-700 min-w-[180px]">
                <Wallet className="h-4 w-4" /> Top Up Wallet
              </Button>
            </Link>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[180px]">
              {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Booking…</> : <><Calendar className="h-4 w-4" /> Book Appointment</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
