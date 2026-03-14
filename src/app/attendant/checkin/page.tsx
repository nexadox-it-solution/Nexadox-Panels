"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserCheck, Search, User, Calendar, CheckCircle,
  X, Loader, AlertCircle, Activity, Heart, Thermometer,
  ClipboardCheck, Stethoscope,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Appointment {
  id: number;
  appointment_id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  patient_dob: string | null;
  patient_gender: string | null;
  doctor_id: number | null;
  clinic_id: number | null;
  appointment_date: string;
  appointment_time: string | null;
  slot: string | null;
  status: string;
  checkin_status: string | null;
  checkin_time: string | null;
  token_number: number | null;
  consultation_type: string | null;
  booking_amount: number | null;
  notes: string | null;
}

interface DoctorRow { id: number; name: string; }

/* ─── Helpers ───────────────────────────────────────────────── */
const calcAge = (dob: string | null) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const calcBMI = (h: string, w: string) => {
  const hVal = parseFloat(h);
  const wVal = parseFloat(w);
  if (!hVal || !wVal || hVal <= 0) return "";
  const hm = hVal / 100;
  return (wVal / (hm * hm)).toFixed(1);
};

const todayStr = () => new Date().toISOString().split("T")[0];

/* ─── Component ─────────────────────────────────────────────── */
export default function CheckInPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors]           = useState<DoctorRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");

  /* Check-in modal state */
  const [selectedApt, setSelectedApt]   = useState<Appointment | null>(null);
  const [showCheckin, setShowCheckin]    = useState(false);
  const [isSubmitting, setIsSubmitting]  = useState(false);
  const [formError, setFormError]       = useState("");
  const [successToken, setSuccessToken] = useState<{number: number; patient: string; doctor: string} | null>(null);

  /* Editable patient info */
  const [patientDob, setPatientDob]       = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientAge, setPatientAge]       = useState("");

  /* Vitals form */
  const [vHeight, setVHeight]           = useState("");
  const [vWeight, setVWeight]           = useState("");
  const [vBP, setVBP]                   = useState("");
  const [vSpO2, setVSpO2]               = useState("");
  const [vTemp, setVTemp]               = useState("");
  const [vPulse, setVPulse]             = useState("");
  const [consultType, setConsultType]   = useState("First Visit");

  /* ── Fetch today's scheduled appointments via API ─────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayStr();

      // 1. Get logged-in attendant's assigned doctors/clinics
      let doctorIdsParam = "";
      let clinicIdsParam = "";
      try {
        const session = localStorage.getItem("nexadox-session"); // "userId:role"
        const userId = session?.split(":")[0];
        if (userId) {
          const { data: attRow } = await (await import("@/lib/supabase")).supabase
            .from("attendants")
            .select("assigned_doctors, assigned_clinic_ids")
            .or(`profile_id.eq.${userId},user_id.eq.${userId}`)
            .limit(1)
            .single();
          if (attRow?.assigned_doctors?.length) {
            doctorIdsParam = `&doctor_ids=${attRow.assigned_doctors.join(",")}`;
          }
          if (attRow?.assigned_clinic_ids?.length) {
            clinicIdsParam = `&clinic_ids=${attRow.assigned_clinic_ids.join(",")}`;
          }
        }
      } catch (_e) { /* fallback: show all if attendant record not found */ }

      // 2. Fetch appointments scoped to this attendant's assignments
      const aptRes = await fetch(`/api/attendant/appointments?date=${today}&status=scheduled${doctorIdsParam}${clinicIdsParam}`);
      const aptJson = await aptRes.json();
      const allApts: Appointment[] = aptJson.appointments || [];
      // Filter: only today's scheduled + pending checkin
      const pending = allApts.filter(a =>
        a.appointment_date === today &&
        a.status === "scheduled" &&
        (!a.checkin_status || a.checkin_status === "pending")
      );
      setAppointments(pending);

      // Fetch doctors
      const docRes = await fetch("/api/attendant/doctors");
      if (docRes.ok) {
        const docJson = await docRes.json();
        setDoctors(docJson.doctors || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Name maps */
  const doctorMap = new Map(doctors.map(d => [d.id, d.name]));

  /* Filter */
  const filtered = appointments.filter(a => {
    const q = searchQuery.toLowerCase();
    return !q || a.patient_name?.toLowerCase().includes(q) || a.appointment_id?.toLowerCase().includes(q) || a.patient_phone?.includes(q);
  });

  /* ── Open check-in modal ──────────────────────────────────── */
  const openCheckin = (apt: Appointment) => {
    setSelectedApt(apt);
    // Pre-fill editable patient info
    setPatientDob(apt.patient_dob || "");
    setPatientGender(apt.patient_gender || "");
    setPatientAge(apt.patient_dob ? String(calcAge(apt.patient_dob) || "") : "");
    // Reset vitals
    setVHeight(""); setVWeight(""); setVBP(""); setVSpO2(""); setVTemp(""); setVPulse("");
    setConsultType("First Visit"); setFormError(""); setShowCheckin(true);
  };

  /* Auto-calculate age when DOB changes */
  useEffect(() => {
    if (patientDob) {
      const age = calcAge(patientDob);
      setPatientAge(age != null ? String(age) : "");
    }
  }, [patientDob]);

  /* ── Submit check-in via API ──────────────────────────────── */
  const handleCheckin = async () => {
    if (!selectedApt) return;
    if (!vBP) return setFormError("Blood Pressure is required.");

    setIsSubmitting(true); setFormError("");

    try {
      const bmi = calcBMI(vHeight, vWeight);

      // Call checkin API
      const res = await fetch("/api/attendant/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: selectedApt.id,
          doctor_id: selectedApt.doctor_id,
          slot: selectedApt.slot,
          // Patient info updates
          patient_dob: patientDob || null,
          patient_gender: patientGender || null,
          // Vitals
          height: vHeight ? parseFloat(vHeight) : null,
          weight: vWeight ? parseFloat(vWeight) : null,
          bmi: bmi ? parseFloat(bmi) : null,
          bp: vBP,
          spo2: vSpO2 ? parseInt(vSpO2) : null,
          temperature: vTemp ? parseFloat(vTemp) : null,
          pulse: vPulse ? parseInt(vPulse) : null,
          consultation_type: consultType,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Check-in failed.");

      const doctorName = doctorMap.get(selectedApt.doctor_id!) || "Doctor";
      setSuccessToken({ number: result.token_number, patient: selectedApt.patient_name, doctor: doctorName });
      setShowCheckin(false);
      fetchData();

    } catch (err: any) {
      setFormError(err?.message || "Check-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const bmiDisplay = calcBMI(vHeight, vWeight);

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserCheck className="h-8 w-8 text-brand-600" /> Patient Check-In
        </h1>
        <p className="text-muted-foreground mt-1">Search scheduled appointments, update patient info, record vitals and check-in</p>
      </div>

      {/* Success Token */}
      {successToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSuccessToken(null)}>
          <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4"><CheckCircle className="h-8 w-8" /></div>
                <CardTitle>Check-in Successful!</CardTitle>
                <CardDescription>Patient has entered the doctor queue</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-brand-600 text-white rounded-lg p-6 text-center">
                <p className="text-sm opacity-90 mb-2">Token Number</p>
                <p className="text-6xl font-bold">#{successToken.number}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{successToken.patient}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{successToken.doctor}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{new Date().toLocaleTimeString()}</span></div>
              </div>
              <Button onClick={() => setSuccessToken(null)} className="w-full">Close</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by patient name, phone, or appointment ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader className="h-8 w-8 animate-spin text-brand-600" /><p className="ml-3 text-muted-foreground">Loading…</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Appointments</CardTitle>
            <CardDescription>{filtered.length} patient(s) pending check-in</CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">{searchQuery ? "No matching appointments" : "No pending check-ins for today"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                          {apt.patient_name?.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold">{apt.patient_name}</h4>
                          <p className="text-sm text-muted-foreground">{apt.patient_phone || apt.patient_email || "—"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                        <div><span className="text-muted-foreground">Session: </span><span className="font-medium">{apt.slot || apt.appointment_time || "—"}</span></div>
                        <div><span className="text-muted-foreground">Doctor: </span><span className="font-medium">{doctorMap.get(apt.doctor_id!) || "—"}</span></div>
                        <div><span className="text-muted-foreground">Gender: </span><span className="font-medium">{apt.patient_gender || "—"}</span></div>
                        <div><span className="text-muted-foreground">Age: </span><span className="font-medium">{calcAge(apt.patient_dob) ?? "—"}</span></div>
                      </div>
                    </div>
                    <Button onClick={() => openCheckin(apt)} className="gap-2 bg-brand-600 hover:bg-brand-700">
                      <UserCheck className="h-4 w-4" /> Check In
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CHECK-IN SLIDE-OVER MODAL ─────────────────────────── */}
      {showCheckin && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setShowCheckin(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${showCheckin ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-brand-600" /> Check-In &amp; Vitals</h2>
          <button onClick={() => !isSubmitting && setShowCheckin(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          {/* ── EDITABLE Patient Info ──────────────────────────── */}
          {selectedApt && (
            <div className="border rounded-xl p-4 bg-blue-50/50 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3.5 w-3.5" /> Patient Info (editable)</Label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name: </span><span className="font-semibold">{selectedApt.patient_name}</span></div>
                <div><span className="text-muted-foreground">Phone: </span><span className="font-medium">{selectedApt.patient_phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Doctor: </span><span className="font-medium">{doctorMap.get(selectedApt.doctor_id!) || "—"}</span></div>
                <div><span className="text-muted-foreground">Session: </span><span className="font-medium">{selectedApt.slot || "—"}</span></div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> DOB</label>
                  <Input
                    type="date"
                    value={patientDob}
                    onChange={e => setPatientDob(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Age</label>
                  <Input
                    type="number"
                    value={patientAge}
                    onChange={e => {
                      setPatientAge(e.target.value);
                      // If user manually sets age, calculate approximate DOB
                      if (e.target.value && !patientDob) {
                        const approxYear = new Date().getFullYear() - parseInt(e.target.value);
                        setPatientDob(`${approxYear}-01-01`);
                      }
                    }}
                    placeholder="Age"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Gender</label>
                  <select
                    value={patientGender}
                    onChange={e => setPatientGender(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Consultation Type — includes "Consultation" */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> Consultation Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {["First Visit", "Follow-up", "Report Check", "Consultation"].map(t => (
                <button key={t} onClick={() => setConsultType(t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${consultType === t ? "bg-brand-600 text-white border-brand-600" : "border-gray-200 hover:bg-gray-50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Vitals */}
          <div className="space-y-4 border rounded-xl p-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Vitals</Label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Height (cm)</label>
                <Input type="number" placeholder="e.g. 170" value={vHeight} onChange={e => setVHeight(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Weight (kg)</label>
                <Input type="number" placeholder="e.g. 65" value={vWeight} onChange={e => setVWeight(e.target.value)} />
              </div>
            </div>

            {/* Auto-calculated BMI */}
            {bmiDisplay && (
              <div className="bg-gradient-to-r from-brand-50 to-emerald-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">BMI (auto-calculated)</span>
                <span className={`text-lg font-bold ${parseFloat(bmiDisplay) < 18.5 ? "text-yellow-600" : parseFloat(bmiDisplay) < 25 ? "text-green-600" : parseFloat(bmiDisplay) < 30 ? "text-orange-600" : "text-red-600"}`}>
                  {bmiDisplay}
                  <span className="text-xs ml-1 font-normal">
                    {parseFloat(bmiDisplay) < 18.5 ? "Underweight" : parseFloat(bmiDisplay) < 25 ? "Normal" : parseFloat(bmiDisplay) < 30 ? "Overweight" : "Obese"}
                  </span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" /> BP (mmHg) *</label>
                <Input placeholder="e.g. 120/80" value={vBP} onChange={e => setVBP(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">SpO2 (%)</label>
                <Input type="number" placeholder="e.g. 98" value={vSpO2} onChange={e => setVSpO2(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp (°F)</label>
                <Input type="number" step="0.1" placeholder="e.g. 98.6" value={vTemp} onChange={e => setVTemp(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pulse (bpm)</label>
                <Input type="number" placeholder="e.g. 72" value={vPulse} onChange={e => setVPulse(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => !isSubmitting && setShowCheckin(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleCheckin} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[160px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : <><UserCheck className="h-4 w-4" /> Check In</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
