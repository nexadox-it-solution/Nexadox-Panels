"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  ArrowLeft, User, Activity, Stethoscope, FileText, Plus, Trash2,
  Loader, CheckCircle, Calendar, Clock, Heart, Thermometer,
  AlertCircle, Save, X, Pill,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  checkin_status: string;
  checkin_time: string | null;
  consultation_type: string | null;
  token_number: number | null;
  notes: string | null;
}

interface VitalsRow {
  height: number | null;
  weight: number | null;
  bmi: number | null;
  bp: string | null;
  spo2: number | null;
  temperature: number | null;
  pulse: number | null;
  recorded_at: string | null;
}

interface Medicine {
  type: string;
  name: string;
  composition: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface TestItem {
  name: string;
  instructions: string;
}

interface Prescription {
  id?: number;
  complaint: string;
  diagnosis: string;
  notes: string;
  medicines: Medicine[];
  tests: TestItem[];
}

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

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
};

const emptyMedicine = (): Medicine => ({ type: "", name: "", composition: "", dosage: "", frequency: "", duration: "", instructions: "" });
const emptyTest = (): TestItem => ({ name: "", instructions: "" });

const MEDICINE_TYPES = ["Tablet", "Capsule", "Caplet", "Syrup", "Drop", "Emulsion", "Vials", "Ointment", "Cream", "Lotion", "Gel", "Injection"] as const;
const FREQUENCY_OPTIONS = ["1-0-1", "1-1-1", "1-0-0", "0-0-1", "0-1-0", "1-1-1-1"] as const;

/* ─── Component ─────────────────────────────────────────────── */
export default function ConsultationPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const aptId = Number(params.id);

  const [loading, setLoading]           = useState(true);
  const [apt, setApt]                   = useState<Appointment | null>(null);
  const [vitals, setVitals]             = useState<VitalsRow | null>(null);
  const [doctorName, setDoctorName]     = useState("");
  const [clinicName, setClinicName]     = useState("");

  /* Prescription state */
  const [rx, setRx]                     = useState<Prescription>({ complaint: "", diagnosis: "", notes: "", medicines: [emptyMedicine()], tests: [] });
  const [existingRxId, setExistingRxId] = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState("");

  /* ── Fetch all data ───────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!aptId) return;
    setLoading(true);
    try {
      /* Appointment */
      const { data: aptData } = await supabase.from("appointments").select("*").eq("id", aptId).single();
      if (!aptData) { setLoading(false); return; }
      setApt(aptData as Appointment);

      /* Vitals */
      const { data: vData } = await supabase.from("vitals").select("*").eq("appointment_id", aptId).limit(1).single();
      if (vData) setVitals(vData as VitalsRow);

      /* Doctor & Clinic names */
      if (aptData.doctor_id) {
        const { data: doc } = await supabase.from("doctors").select("name").eq("id", aptData.doctor_id).single();
        if (doc) setDoctorName(doc.name);
      }
      if (aptData.clinic_id) {
        const { data: cl } = await supabase.from("clinics").select("name").eq("id", aptData.clinic_id).single();
        if (cl) setClinicName(cl.name);
      }

      /* Existing prescription */
      const { data: rxData } = await supabase.from("prescriptions").select("*").eq("appointment_id", aptId).limit(1).single();
      if (rxData) {
        setExistingRxId(rxData.id);
        setRx({
          complaint: rxData.complaint || "",
          diagnosis: rxData.diagnosis || "",
          notes: rxData.notes || "",
          medicines: (rxData.medicines as Medicine[]) || [emptyMedicine()],
          tests: (rxData.tests as TestItem[]) || [],
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [aptId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Medicine helpers ─────────────────────────────────────── */
  const addMedicine = () => setRx(prev => ({ ...prev, medicines: [...prev.medicines, emptyMedicine()] }));
  const removeMedicine = (i: number) => setRx(prev => ({ ...prev, medicines: prev.medicines.filter((_, idx) => idx !== i) }));
  const updateMedicine = (i: number, field: keyof Medicine, value: string) => {
    setRx(prev => ({
      ...prev,
      medicines: prev.medicines.map((m, idx) => idx === i ? { ...m, [field]: value } : m),
    }));
  };

  /* ── Test helpers ─────────────────────────────────────────── */
  const addTest = () => setRx(prev => ({ ...prev, tests: [...prev.tests, emptyTest()] }));
  const removeTest = (i: number) => setRx(prev => ({ ...prev, tests: prev.tests.filter((_, idx) => idx !== i) }));
  const updateTest = (i: number, field: keyof TestItem, value: string) => {
    setRx(prev => ({
      ...prev,
      tests: prev.tests.map((t, idx) => idx === i ? { ...t, [field]: value } : t),
    }));
  };

  /* ── Save prescription ────────────────────────────────────── */
  const savePrescription = async () => {
    if (!apt) return;
    if (!rx.diagnosis.trim()) return setError("Diagnosis is required.");

    setSaving(true); setError(""); setSaved(false);
    try {
      const filteredMeds = rx.medicines.filter(m => m.name.trim());
      const filteredTests = rx.tests.filter(t => t.name.trim());

      const basePayload: Record<string, any> = {
        appointment_id: apt.id,
        doctor_id: apt.doctor_id,
        patient_name: apt.patient_name,
        diagnosis: rx.diagnosis.trim(),
        notes: rx.notes.trim() || null,
        medicines: filteredMeds,
        tests: filteredTests,
        follow_up_date: null,
      };

      // Include complaint if column exists (added by migration)
      const payloadWithComplaint = { ...basePayload, complaint: rx.complaint.trim() || null };

      const trySave = async (payload: Record<string, any>) => {
        if (existingRxId) {
          const { error: err } = await supabase.from("prescriptions").update(payload).eq("id", existingRxId);
          return err;
        } else {
          const { data, error: err } = await supabase.from("prescriptions").insert(payload).select("id").single();
          if (!err && data) setExistingRxId(data.id);
          return err;
        }
      };

      // Try with complaint first; if column missing (42703), retry without
      let saveErr = await trySave(payloadWithComplaint);
      if (saveErr?.code === "42703") {
        saveErr = await trySave(basePayload);
      }
      if (saveErr) throw saveErr;

      /* Auto-save new values to lookup tables (fire-and-forget) */
      const saveToLookup = (table: string, values: string[]) => {
        const unique = [...new Set(values.filter(v => v.trim()))];
        if (unique.length > 0) {
          fetch("/api/rx-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table, values: unique }),
          }).catch(() => {});
        }
      };

      saveToLookup("medicine_names", filteredMeds.map(m => m.name));
      saveToLookup("compositions", filteredMeds.map(m => m.composition).filter(Boolean));
      saveToLookup("dosages", filteredMeds.map(m => m.dosage).filter(Boolean));
      saveToLookup("durations", filteredMeds.map(m => m.duration).filter(Boolean));
      saveToLookup("test_names", filteredTests.map(t => t.name));
      if (rx.diagnosis.trim()) saveToLookup("diagnoses", [rx.diagnosis.trim()]);
      if (rx.complaint.trim()) saveToLookup("complaints", [rx.complaint.trim()]);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Complete consultation ────────────────────────────────── */
  const completeConsultation = async () => {
    if (!apt) return;
    if (!existingRxId) {
      setError("Please save a prescription before completing.");
      return;
    }

    try {
      const { error: err } = await supabase.from("appointments").update({
        checkin_status: "completed",
        completion_time: new Date().toISOString(),
        status: "completed",
      }).eq("id", apt.id);

      if (err) throw err;
      setApt(prev => prev ? { ...prev, checkin_status: "completed" } : prev);
    } catch (err: any) {
      setError(err?.message || "Failed to complete.");
    }
  };

  const age = apt ? calcAge(apt.patient_dob) : null;

  /* ─── RENDER ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
        <p className="ml-3 text-muted-foreground">Loading case…</p>
      </div>
    );
  }

  if (!apt) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">Appointment not found</p>
        <Button onClick={() => router.push("/doctor/queue")} className="mt-4">Back to Queue</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/doctor/queue")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Stethoscope className="h-6 w-6 text-blue-600" /> Consultation</h1>
          <p className="text-sm text-muted-foreground">Appointment #{apt.appointment_id} • Token #{apt.token_number}</p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            apt.checkin_status === "checked_in" ? "bg-blue-100 text-blue-700" :
            apt.checkin_status === "completed" ? "bg-green-100 text-green-700" :
            "bg-gray-100 text-gray-600"
          }`}>{apt.checkin_status === "checked_in" ? "In Consultation" : apt.checkin_status}</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4" /> Prescription saved successfully!
        </div>
      )}

      {/* Patient Info + Vitals side-by-side */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Patient Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Patient Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div><span className="text-muted-foreground">Name</span><p className="font-semibold">{apt.patient_name}</p></div>
              <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{apt.patient_phone || "—"}</p></div>
              <div><span className="text-muted-foreground">Gender</span><p className="font-medium capitalize">{apt.patient_gender || "—"}</p></div>
              <div><span className="text-muted-foreground">Age</span><p className="font-semibold text-blue-700">{age != null ? `${age} yrs` : "—"}</p></div>
              <div><span className="text-muted-foreground">DOB</span><p className="font-medium">{fmtDate(apt.patient_dob)}</p></div>
              <div><span className="text-muted-foreground">Email</span><p className="font-medium text-xs">{apt.patient_email || "—"}</p></div>
            </div>
            <hr />
            <div className="grid grid-cols-2 gap-y-2">
              <div><span className="text-muted-foreground">Doctor</span><p className="font-medium">{doctorName || "—"}</p></div>
              <div><span className="text-muted-foreground">Clinic</span><p className="font-medium">{clinicName || "—"}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-medium">{fmtDate(apt.appointment_date)}</p></div>
              <div><span className="text-muted-foreground">Slot</span><p className="font-mono">{apt.slot || apt.appointment_time || "—"}</p></div>
              <div><span className="text-muted-foreground">Type</span><p className="font-medium">{apt.consultation_type || "—"}</p></div>
              <div><span className="text-muted-foreground">Check-in</span><p className="font-mono">{fmtTime(apt.checkin_time)}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-green-600" /> Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            {vitals ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Height", value: vitals.height ? `${vitals.height} cm` : "—", icon: User },
                  { label: "Weight", value: vitals.weight ? `${vitals.weight} kg` : "—", icon: User },
                  { label: "BMI", value: vitals.bmi ? String(vitals.bmi) : "—", icon: Activity,
                    color: vitals.bmi ? (vitals.bmi < 18.5 ? "text-yellow-600" : vitals.bmi < 25 ? "text-green-600" : vitals.bmi < 30 ? "text-orange-600" : "text-red-600") : "" },
                  { label: "Blood Pressure", value: vitals.bp || "—", icon: Heart },
                  { label: "SpO2", value: vitals.spo2 ? `${vitals.spo2}%` : "—", icon: Activity },
                  { label: "Temperature", value: vitals.temperature ? `${vitals.temperature}°F` : "—", icon: Thermometer },
                  { label: "Pulse", value: vitals.pulse ? `${vitals.pulse} bpm` : "—", icon: Heart },
                  { label: "Recorded", value: fmtTime(vitals.recorded_at), icon: Clock },
                ].map((v, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><v.icon className="h-3 w-3" />{v.label}</p>
                    <p className={`font-semibold text-sm mt-0.5 ${v.color || ""}`}>{v.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No vitals recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── PRESCRIPTION EDITOR ───────────────────────────────── */}
      <Card className="border-t-4 border-t-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> Digital Prescription</CardTitle>
          <CardDescription>{existingRxId ? "Edit existing prescription" : "Create new prescription"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Complaint */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Complaint</Label>
            <textarea rows={2} value={rx.complaint} onChange={e => setRx(p => ({ ...p, complaint: e.target.value }))}
              placeholder="Enter patient's chief complaint…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Diagnosis *</Label>
            <textarea rows={2} value={rx.diagnosis} onChange={e => setRx(p => ({ ...p, diagnosis: e.target.value }))}
              placeholder="Enter diagnosis…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Medicines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1"><Pill className="h-4 w-4" /> Medicines</Label>
              <Button variant="outline" size="sm" onClick={addMedicine} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Medicine</Button>
            </div>
            {rx.medicines.map((med, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-gray-50/50 relative">
                {rx.medicines.length > 1 && (
                  <button onClick={() => removeMedicine(i)} className="absolute top-2 right-2 p-1 rounded hover:bg-red-100 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {/* Type */}
                  <SearchableSelect value={med.type || ""} onValueChange={v => updateMedicine(i, "type", v)} options={MEDICINE_TYPES} placeholder="Type" />
                  {/* Medicine Name */}
                  <SearchableCombobox value={med.name} onValueChange={v => updateMedicine(i, "name", v)} lookupTable="medicine_names" placeholder="Medicine name *" />
                  {/* Composition */}
                  <SearchableCombobox value={med.composition} onValueChange={v => updateMedicine(i, "composition", v)} lookupTable="compositions" placeholder="Composition" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {/* Dosage */}
                  <SearchableCombobox value={med.dosage} onValueChange={v => updateMedicine(i, "dosage", v)} lookupTable="dosages" placeholder="Dosage (e.g. 500mg)" />
                  {/* Frequency */}
                  <SearchableSelect value={med.frequency || ""} onValueChange={v => updateMedicine(i, "frequency", v)} options={FREQUENCY_OPTIONS} placeholder="Frequency" />
                  {/* Duration */}
                  <SearchableCombobox value={med.duration} onValueChange={v => updateMedicine(i, "duration", v)} lookupTable="durations" placeholder="Duration (e.g. 7 days)" />
                </div>
                <Input placeholder="Special instructions (optional)" value={med.instructions} onChange={e => updateMedicine(i, "instructions", e.target.value)} />
              </div>
            ))}
          </div>

          {/* Tests */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Lab Tests</Label>
              <Button variant="outline" size="sm" onClick={addTest} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Test</Button>
            </div>
            {rx.tests.map((test, i) => (
              <div key={i} className="flex gap-2 items-center">
                <SearchableCombobox value={test.name} onValueChange={v => updateTest(i, "name", v)} lookupTable="test_names" placeholder="Test name" className="flex-1" />
                <Input placeholder="Instructions" value={test.instructions} onChange={e => updateTest(i, "instructions", e.target.value)} className="flex-1" />
                <button onClick={() => removeTest(i)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes</Label>
            <textarea rows={2} value={rx.notes} onChange={e => setRx(p => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes, advice…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={savePrescription} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 min-w-[180px]">
              {saving ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {existingRxId ? "Update Prescription" : "Save Prescription"}</>}
            </Button>

            {existingRxId && apt.checkin_status === "checked_in" && (
              <Button onClick={completeConsultation} variant="outline" className="gap-2 text-green-700 border-green-300 hover:bg-green-50">
                <CheckCircle className="h-4 w-4" /> Complete & Return to Queue
              </Button>
            )}

            <Button variant="ghost" onClick={() => router.push("/doctor/queue")}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
