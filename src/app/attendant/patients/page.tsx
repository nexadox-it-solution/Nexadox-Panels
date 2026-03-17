"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Search, Eye, FileText, Phone, Mail, Calendar,
  Activity, X, ChevronLeft, ChevronRight, Loader, Download,
  Pill, Stethoscope, ClipboardList, ArrowLeft, Building2,
  Upload, Image, Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─────────────────────────────────────────────────── */
interface Medicine { name: string; dosage: string; frequency: string; duration: string; instructions: string; }
interface TestItem { name: string; instructions: string; }

interface PrescriptionRow {
  id: number; appointment_id: number; doctor_id: number;
  patient_name: string; diagnosis: string; notes: string | null;
  medicines: Medicine[]; tests: TestItem[];
  follow_up_date: string | null; created_at: string;
  manual_prescription_url?: string | null;
}

interface VitalsRow {
  height: number | null; weight: number | null; bmi: number | null;
  bp: string | null; spo2: number | null; temperature: number | null; pulse: number | null;
}

interface AppointmentRecord {
  id: number; appointment_date: string; slot: string | null; status: string;
  symptoms: string | null; diagnosis: string | null; prescription: string | null;
  notes: string | null; consultation_type: string | null;
  clinic_id: number | null; doctor_id: number | null;
  patient_dob: string | null; patient_gender: string | null;
}

interface PatientRecord {
  name: string; email: string; phone: string;
  lastVisit: string; totalVisits: number;
  appointments: AppointmentRecord[];
}

/* ─── Component ─────────────────────────────────────────────── */
export default function AttendantPatientsPage() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 15;

  /* Prescription state */
  const [prescriptions, setPrescriptions] = useState<Map<number, PrescriptionRow>>(new Map());
  const [vitalsMap, setVitalsMap] = useState<Map<number, VitalsRow>>(new Map());
  const [clinicMap, setClinicMap] = useState<Map<number, string>>(new Map());
  const [doctorMap, setDoctorMap] = useState<Map<number, string>>(new Map());

  /* Prescription full view */
  const [viewingRx, setViewingRx] = useState<PrescriptionRow | null>(null);
  const [viewingApt, setViewingApt] = useState<AppointmentRecord | null>(null);
  const [downloading, setDownloading] = useState(false);
  const rxRef = useRef<HTMLDivElement>(null);

  /* Manual Rx upload */
  const [uploading, setUploading] = useState<number | null>(null);
  const [viewingManualRx, setViewingManualRx] = useState<{ url: string; patientName: string; date: string; aptId: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetAptId, setUploadTargetAptId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Resolve attendant record to get assigned clinics/doctors
      let myClinicIds: number[] = [];
      let myDoctorIds: number[] = [];

      const { data: att } = await supabase
        .from("attendants")
        .select("id, assigned_clinic_ids, assigned_doctors")
        .eq("profile_id", user.id)
        .single();

      if (att) {
        myClinicIds = att.assigned_clinic_ids || [];
        myDoctorIds = att.assigned_doctors || [];
      } else {
        // Fallback: try user_id
        const { data: attByUser } = await supabase
          .from("attendants")
          .select("id, assigned_clinic_ids, assigned_doctors")
          .eq("user_id", user.id)
          .single();
        if (attByUser) {
          myClinicIds = attByUser.assigned_clinic_ids || [];
          myDoctorIds = attByUser.assigned_doctors || [];
        }
      }

      if (myClinicIds.length === 0 && myDoctorIds.length === 0) {
        setPatients([]);
        setLoading(false);
        return;
      }

      // Fetch doctors scoped to attendant
      const { data: allDocs } = await supabase.from("doctors").select("id, name, clinic_ids");
      const scopedDoctorIds = new Set<number>();
      if (allDocs) {
        for (const d of allDocs) {
          if (myDoctorIds.includes(d.id)) { scopedDoctorIds.add(d.id); continue; }
          if (d.clinic_ids && d.clinic_ids.some((cid: number) => myClinicIds.includes(cid))) { scopedDoctorIds.add(d.id); }
        }
      }

      // Build doctor map
      const dMap = new Map<number, string>();
      if (allDocs) allDocs.forEach((d: any) => { if (scopedDoctorIds.has(d.id)) dMap.set(d.id, d.name); });
      setDoctorMap(dMap);

      // Fetch clinics
      if (myClinicIds.length > 0) {
        const { data: cls } = await supabase.from("clinics").select("id, name").in("id", myClinicIds);
        if (cls) {
          const cMap = new Map<number, string>();
          cls.forEach((c: any) => cMap.set(c.id, c.name));
          setClinicMap(cMap);
        }
      }

      // Fetch appointments for scoped doctors OR scoped clinics
      let allAppts: any[] = [];

      // By doctor IDs
      const dIds = Array.from(scopedDoctorIds);
      if (dIds.length > 0) {
        const { data: docAppts } = await supabase
          .from("appointments")
          .select("id, patient_name, patient_email, patient_phone, patient_dob, patient_gender, appointment_date, slot, status, symptoms, diagnosis, prescription, notes, consultation_type, clinic_id, doctor_id")
          .in("doctor_id", dIds)
          .order("appointment_date", { ascending: false });
        if (docAppts) allAppts = docAppts;
      }

      // By clinic IDs (merge, dedup)
      if (myClinicIds.length > 0) {
        const { data: clinicAppts } = await supabase
          .from("appointments")
          .select("id, patient_name, patient_email, patient_phone, patient_dob, patient_gender, appointment_date, slot, status, symptoms, diagnosis, prescription, notes, consultation_type, clinic_id, doctor_id")
          .in("clinic_id", myClinicIds)
          .order("appointment_date", { ascending: false });
        if (clinicAppts) {
          const existingIds = new Set(allAppts.map((a: any) => a.id));
          for (const apt of clinicAppts) {
            if (!existingIds.has(apt.id)) allAppts.push(apt);
          }
        }
      }

      // Sort by date desc
      allAppts.sort((a: any, b: any) => b.appointment_date.localeCompare(a.appointment_date));

      if (allAppts.length === 0) { setPatients([]); setLoading(false); return; }

      // Fetch prescriptions for these appointment IDs
      const aptIds = allAppts.map((a: any) => a.id);
      const rxMap = new Map<number, PrescriptionRow>();
      const batchSize = 500;
      for (let i = 0; i < aptIds.length; i += batchSize) {
        const batch = aptIds.slice(i, i + batchSize);
        const { data: rxData } = await supabase.from("prescriptions").select("*").in("appointment_id", batch);
        if (rxData) rxData.forEach((r: any) => rxMap.set(r.appointment_id, r as PrescriptionRow));
      }
      setPrescriptions(rxMap);

      // Fetch vitals
      const vMap = new Map<number, VitalsRow>();
      for (let i = 0; i < aptIds.length; i += batchSize) {
        const batch = aptIds.slice(i, i + batchSize);
        const { data: vData } = await supabase
          .from("vitals")
          .select("appointment_id, height, weight, bmi, bp, spo2, temperature, pulse")
          .in("appointment_id", batch);
        if (vData) vData.forEach((v: any) => vMap.set(v.appointment_id, v as VitalsRow));
      }
      setVitalsMap(vMap);

      // Group by patient
      const patientMap = new Map<string, PatientRecord>();
      for (const apt of allAppts) {
        const key = `${(apt.patient_name || "").toLowerCase()}_${(apt.patient_phone || apt.patient_email || "").toLowerCase()}`;
        if (!patientMap.has(key)) {
          patientMap.set(key, {
            name: apt.patient_name || "Unknown",
            email: apt.patient_email || "",
            phone: apt.patient_phone || "",
            lastVisit: apt.appointment_date,
            totalVisits: 0,
            appointments: [],
          });
        }
        const p = patientMap.get(key)!;
        p.totalVisits++;
        if (apt.appointment_date > p.lastVisit) p.lastVisit = apt.appointment_date;
        p.appointments.push({
          id: apt.id, appointment_date: apt.appointment_date, slot: apt.slot,
          status: apt.status, symptoms: apt.symptoms, diagnosis: apt.diagnosis,
          prescription: apt.prescription, notes: apt.notes,
          consultation_type: apt.consultation_type, clinic_id: apt.clinic_id,
          doctor_id: apt.doctor_id,
          patient_dob: apt.patient_dob, patient_gender: apt.patient_gender,
        });
      }

      setPatients(Array.from(patientMap.values()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Download prescription as PDF ─────────────────────────── */
  const downloadPrescriptionPDF = async () => {
    if (!rxRef.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set({
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `Prescription_${(viewingRx?.patient_name || "Patient").replace(/\s+/g, "_")}_${viewingApt?.appointment_date || ""}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      }).from(rxRef.current).save();
    } catch (e) { console.error("PDF download failed:", e); }
    finally { setDownloading(false); }
  };

  /* ── Upload manual prescription (attendant) ──────────────── */
  const handleUploadManualRx = (aptId: number, patientName: string) => {
    setUploadTargetAptId(aptId);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetAptId) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return; }

    setUploading(uploadTargetAptId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "prescriptions");
      formData.append("path", `manual_rx_${uploadTargetAptId}_${Date.now()}`);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const uploadData = await res.json();

      const existingRx = prescriptions.get(uploadTargetAptId);
      if (existingRx) {
        const { error } = await supabase.from("prescriptions").update({ manual_prescription_url: uploadData.url }).eq("id", existingRx.id);
        if (error) { console.error(error); alert("Failed to update prescription"); return; }
        existingRx.manual_prescription_url = uploadData.url;
        setPrescriptions(new Map(prescriptions));
      } else {
        let patName = "Patient";
        for (const p of patients) {
          const apt = p.appointments.find(a => a.id === uploadTargetAptId);
          if (apt) { patName = p.name; break; }
        }
        const { data: newRx, error } = await supabase.from("prescriptions").insert({
          appointment_id: uploadTargetAptId,
          doctor_id: 0,
          patient_name: patName,
          diagnosis: "Manual Prescription",
          medicines: [],
          tests: [],
          manual_prescription_url: uploadData.url,
        }).select().single();
        if (error) { console.error(error); alert("Failed to save prescription record"); return; }
        if (newRx) {
          prescriptions.set(uploadTargetAptId, newRx as PrescriptionRow);
          setPrescriptions(new Map(prescriptions));
        }
      }
      alert("Manual prescription uploaded successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(null);
      setUploadTargetAptId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── Download manual Rx as PDF ────────────────────────────── */
  const downloadManualRxPDF = async (imageUrl: string, patientName: string, date: string) => {
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const container = document.createElement("div");
      container.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px 28px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700;">NexaDox</h1>
            <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.85;">Doctor Appointment &amp; Clinic Management</p>
          </div>
          <div style="background: #f1f5f9; padding: 12px 28px; border-bottom: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px;"><strong>Patient:</strong> ${patientName} &nbsp;&nbsp; <strong>Date:</strong> ${date} &nbsp;&nbsp; <strong>Type:</strong> Manual Prescription</p>
          </div>
          <div style="padding: 20px; text-align: center;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 800px; border: 1px solid #e2e8f0; border-radius: 8px;" crossorigin="anonymous" />
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding: 12px 28px; text-align: center; font-size: 10px; color: #94a3b8;">
            Manual Prescription — Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} • NexaDox Platform
          </div>
        </div>
      `;
      document.body.appendChild(container);
      const fileName = `Manual_Prescription_${patientName.replace(/\s+/g, "_")}_${date}.pdf`;
      await html2pdf().set({
        margin: [0.2, 0.2, 0.2, 0.2],
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      }).from(container).save();
      document.body.removeChild(container);
    } catch (e) { console.error("Manual PDF download failed:", e); }
    finally { setDownloading(false); }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);
  const todayStr = new Date().toISOString().split("T")[0];

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  /* ─── Manual Prescription View (full-page image) ───────────── */
  if (viewingManualRx) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setViewingManualRx(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Patient Records
          </Button>
          <Button
            onClick={() => downloadManualRxPDF(viewingManualRx.url, viewingManualRx.patientName, viewingManualRx.date)}
            disabled={downloading}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {downloading ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Generating PDF…" : "Download PDF"}
          </Button>
        </div>
        <div className="bg-white border rounded-xl shadow-lg overflow-hidden">
          <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", color: "#fff", padding: "20px 28px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>NexaDox</h1>
            <p style={{ fontSize: "11px", margin: "4px 0 0", opacity: 0.85 }}>Manual Prescription</p>
          </div>
          <div style={{ background: "#f1f5f9", padding: "12px 28px", borderBottom: "1px solid #e2e8f0" }}>
            <p style={{ margin: 0, fontSize: "13px" }}>
              <strong>Patient:</strong> {viewingManualRx.patientName} &nbsp;&nbsp;
              <strong>Date:</strong> {viewingManualRx.date} &nbsp;&nbsp;
              <strong>Type:</strong> Manual Prescription
            </p>
          </div>
          <div className="p-6 flex justify-center">
            <img
              src={viewingManualRx.url}
              alt="Manual Prescription"
              className="max-w-full rounded-lg border shadow-sm"
              style={{ maxHeight: "800px" }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ─── Prescription View (full-page) ────────────────────────── */
  if (viewingRx && viewingApt) {
    const clinicName = viewingApt.clinic_id ? clinicMap.get(viewingApt.clinic_id) : null;
    const docName = viewingApt.doctor_id ? doctorMap.get(viewingApt.doctor_id) : null;
    const vitals = vitalsMap.get(viewingApt.id);
    const calcAge = (dob: string | null) => {
      if (!dob) return null;
      const birth = new Date(dob); const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    };
    const patientAge = calcAge(viewingApt.patient_dob);

    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setViewingRx(null); setViewingApt(null); }} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Patient Records
          </Button>
          <Button onClick={downloadPrescriptionPDF} disabled={downloading} className="gap-2 bg-blue-600 hover:bg-blue-700">
            {downloading ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Generating PDF…" : "Download PDF"}
          </Button>
        </div>

        <div ref={rxRef} className="bg-white border rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#1e293b" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", color: "#fff", padding: "24px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>NexaDox</h1>
                <p style={{ fontSize: "11px", margin: "4px 0 0", opacity: 0.85 }}>Doctor Appointment &amp; Clinic Management</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{docName || "Doctor"}</p>
                {clinicName && <p style={{ fontSize: "12px", margin: "2px 0 0", opacity: 0.9 }}>{clinicName}</p>}
              </div>
            </div>
          </div>

          {/* Patient Info */}
          <div style={{ background: "#f1f5f9", padding: "14px 32px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Patient Name</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, margin: "2px 0 0" }}>{viewingRx.patient_name}</p>
                </div>
                {viewingApt.patient_gender && (
                  <div><span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Sex</span>
                  <p style={{ fontSize: "13px", fontWeight: 500, margin: "2px 0 0" }}>{viewingApt.patient_gender}</p></div>
                )}
                {patientAge !== null && (
                  <div><span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Age</span>
                  <p style={{ fontSize: "13px", fontWeight: 500, margin: "2px 0 0" }}>{patientAge} yrs</p></div>
                )}
              </div>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div><span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Date</span>
                <p style={{ fontSize: "13px", fontWeight: 500, margin: "2px 0 0" }}>{fmtDate(viewingApt.appointment_date)}</p></div>
                {viewingApt.slot && (
                  <div><span style={{ fontSize: "10px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Slot</span>
                  <p style={{ fontSize: "13px", fontWeight: 500, margin: "2px 0 0" }}>{viewingApt.slot}</p></div>
                )}
              </div>
            </div>
          </div>

          {/* Vitals */}
          {vitals && (
            <div style={{ padding: "12px 32px", borderBottom: "1px solid #e2e8f0", background: "#fefce8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Activity style={{ width: 14, height: 14, color: "#ca8a04" }} />
                <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#854d0e", margin: 0, textTransform: "uppercase" }}>Vitals</h3>
              </div>
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                {vitals.height != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>Height:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.height} cm</span></div>}
                {vitals.weight != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>Weight:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.weight} kg</span></div>}
                {vitals.bp && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>BP:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.bp} mmHg</span></div>}
                {vitals.pulse != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>Pulse:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.pulse} bpm</span></div>}
                {vitals.spo2 != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>SpO2:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.spo2}%</span></div>}
                {vitals.temperature != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>Temp:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.temperature}°F</span></div>}
                {vitals.bmi != null && <div style={{ display: "flex", gap: "4px", alignItems: "baseline" }}><span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>BMI:</span><span style={{ fontSize: "13px", fontWeight: 500 }}>{vitals.bmi}</span></div>}
              </div>
            </div>
          )}

          {/* Body */}
          <div style={{ padding: "24px 32px" }}>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Stethoscope style={{ width: 16, height: 16, color: "#3b82f6" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e40af", margin: 0, textTransform: "uppercase" }}>Diagnosis</h3>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px 16px" }}>
                <p style={{ fontSize: "14px", margin: 0, lineHeight: 1.5 }}>{viewingRx.diagnosis}</p>
              </div>
            </div>

            {viewingRx.medicines?.length > 0 && viewingRx.medicines.some(m => m.name.trim()) && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", fontFamily: "serif", fontStyle: "italic" }}>&#8478;</span>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#15803d", margin: 0, textTransform: "uppercase" }}>Medicines</h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f0fdf4", borderBottom: "2px solid #86efac" }}>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>#</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>Medicine</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>Dosage</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>Frequency</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>Duration</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#166534" }}>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingRx.medicines.filter(m => m.name.trim()).map((med, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{i + 1}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{med.name}</td>
                        <td style={{ padding: "10px 12px" }}>{med.dosage || "—"}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{med.frequency || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>{med.duration || "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{med.instructions || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewingRx.tests?.length > 0 && viewingRx.tests.some(t => t.name.trim()) && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <ClipboardList style={{ width: 16, height: 16, color: "#d97706" }} />
                  <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#b45309", margin: 0, textTransform: "uppercase" }}>Lab Tests Advised</h3>
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px 16px" }}>
                  {viewingRx.tests.filter(t => t.name.trim()).map((test, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400e" }}>{i + 1}.</span>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{test.name}</span>
                        {test.instructions && <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>— {test.instructions}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewingRx.notes && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "6px", textTransform: "uppercase" }}>Notes / Advice</h3>
                <p style={{ fontSize: "13px", color: "#4b5563", lineHeight: 1.6, margin: 0, background: "#f9fafb", padding: "10px 14px", borderRadius: "6px", borderLeft: "3px solid #9ca3af" }}>{viewingRx.notes}</p>
              </div>
            )}

            {viewingRx.follow_up_date && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "8px", padding: "8px 16px" }}>
                  <Calendar style={{ width: 14, height: 14, color: "#92400e" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400e" }}>Follow-up: {fmtDate(viewingRx.follow_up_date)}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", padding: "16px 32px", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>Generated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} &bull; NexaDox Platform</p>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>{docName}</p>
              <p style={{ fontSize: "10px", color: "#94a3b8", margin: "2px 0 0" }}>Digital Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">      {/* Hidden file input for manual Rx upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelected}
        accept="image/*"
        className="hidden"
      />      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Patients</h1>
        <p className="text-muted-foreground mt-1">Patients for your assigned doctors &amp; clinics</p>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Patients</p><p className="text-3xl font-bold mt-2">{patients.length}</p></div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Today&apos;s Patients</p><p className="text-3xl font-bold mt-2">{patients.filter(p => p.lastVisit === todayStr).length}</p></div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Avg Visits / Patient</p><p className="text-3xl font-bold mt-2">{patients.length > 0 ? Math.round(patients.reduce((s, p) => s + p.totalVisits, 0) / patients.length) : 0}</p></div>
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or mobile..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Patients</CardTitle>
          <CardDescription>Showing {paginatedPatients.length} of {filteredPatients.length} patients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Visit</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total Visits</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Prescriptions</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPatients.map((patient, idx) => {
                  const rxCount = patient.appointments.filter(a => prescriptions.has(a.id)).length;
                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4"><p className="font-medium">{patient.name}</p></td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {patient.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /><span>{patient.phone}</span></div>}
                          {patient.email && <div className="flex items-center gap-1 mt-1"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate max-w-[200px]">{patient.email}</span></div>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString("en-IN") : "—"}</td>
                      <td className="py-3 px-4 text-center font-semibold">{patient.totalVisits}</td>
                      <td className="py-3 px-4 text-center">
                        {rxCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <FileText className="h-3 w-3" /> {rxCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(patient)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginatedPatients.length === 0 && (
            <div className="text-center py-12"><Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No patients found</p></div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Patient Details Sidebar Drawer ─────────────────────── */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedPatient(null)}>
          <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
          <div
            className="relative bg-white dark:bg-gray-900 h-full w-full max-w-[520px] shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col"
            style={{ animation: "slideInRight 0.25s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patient Records</p>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPatient.name}</h2>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-6 space-y-5">
              {/* Contact + visits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    {selectedPatient.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedPatient.phone}</span></div>}
                    {selectedPatient.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="truncate">{selectedPatient.email}</span></div>}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Visit Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Visits:</span><span className="font-medium">{selectedPatient.totalVisits}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Last Visit:</span><span className="font-medium">{selectedPatient.lastVisit ? new Date(selectedPatient.lastVisit).toLocaleDateString("en-IN") : "—"}</span></div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prescriptions:</span>
                      <span className="font-medium">{selectedPatient.appointments.filter(a => prescriptions.has(a.id)).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Treatment History */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /> Treatment &amp; Prescription History</h3>
                <div className="space-y-3">
                  {selectedPatient.appointments.map((record) => {
                    const rx = prescriptions.get(record.id);
                    const docName = record.doctor_id ? doctorMap.get(record.doctor_id) : null;
                    const clName = record.clinic_id ? clinicMap.get(record.clinic_id) : null;
                    return (
                      <div key={record.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-medium text-muted-foreground">
                              {new Date(record.appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            {record.slot && <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{record.slot}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              record.status === "completed" ? "bg-green-100 text-green-700" :
                              record.status === "cancelled" ? "bg-red-100 text-red-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>{record.status}</span>
                            {rx && (
                              <Button variant="outline" size="sm" onClick={() => { setViewingRx(rx); setViewingApt(record); setSelectedPatient(null); }} className="gap-1 text-xs h-7 text-green-700 border-green-300 hover:bg-green-50">
                                <Eye className="h-3 w-3" /> Rx
                              </Button>
                            )}
                            {rx && (
                              <Button variant="outline" size="sm" onClick={() => { setViewingRx(rx); setViewingApt(record); setSelectedPatient(null); setTimeout(() => downloadPrescriptionPDF(), 500); }} className="gap-1 text-xs h-7 text-blue-700 border-blue-300 hover:bg-blue-50">
                                <Download className="h-3 w-3" /> PDF
                              </Button>
                            )}
                            {/* Manual Rx buttons */}
                            {rx?.manual_prescription_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setViewingManualRx({
                                    url: rx.manual_prescription_url!,
                                    patientName: selectedPatient!.name,
                                    date: new Date(record.appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                                    aptId: record.id,
                                  });
                                  setSelectedPatient(null);
                                }}
                                className="gap-1 text-xs h-7 text-purple-700 border-purple-300 hover:bg-purple-50"
                              >
                                <Image className="h-3 w-3" /> Manual Rx
                              </Button>
                            )}
                            {!rx && record.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUploadManualRx(record.id, selectedPatient!.name)}
                                disabled={uploading === record.id}
                                className="gap-1 text-xs h-7 text-orange-700 border-orange-300 hover:bg-orange-50"
                              >
                                {uploading === record.id ? <Loader className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                Upload Rx
                              </Button>
                            )}
                            {rx && !rx.manual_prescription_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUploadManualRx(record.id, selectedPatient!.name)}
                                disabled={uploading === record.id}
                                className="gap-1 text-xs h-7 text-orange-700 border-orange-300 hover:bg-orange-50"
                              >
                                {uploading === record.id ? <Loader className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                Add Manual Rx
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                            {docName && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {docName}</span>}
                            {clName && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clName}</span>}
                            {record.consultation_type && <span>{record.consultation_type}</span>}
                          </div>

                          {(() => { const v = vitalsMap.get(record.id); return v ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2.5 flex flex-wrap gap-3 text-xs">
                              <span className="font-semibold text-amber-700 uppercase tracking-wide">Vitals:</span>
                              {v.height != null && <span>Height: <b>{v.height}</b> cm</span>}
                              {v.weight != null && <span>Weight: <b>{v.weight}</b> kg</span>}
                              {v.bp && <span>BP: <b>{v.bp}</b></span>}
                              {v.pulse != null && <span>Pulse: <b>{v.pulse}</b></span>}
                              {v.spo2 != null && <span>SpO2: <b>{v.spo2}</b>%</span>}
                              {v.temperature != null && <span>Temp: <b>{v.temperature}</b>°F</span>}
                            </div>
                          ) : null; })()}

                          {rx ? (
                            <div className="mt-2 space-y-2">
                              {rx.manual_prescription_url && rx.diagnosis === "Manual Prescription" ? (
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2.5 flex items-center gap-2">
                                  <Image className="h-4 w-4 text-purple-600" />
                                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Manual Prescription Uploaded</span>
                                </div>
                              ) : (
                                <>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2.5">
                                    <span className="font-semibold text-blue-700 text-xs uppercase tracking-wide">Diagnosis:</span>
                                    <span className="ml-2 text-sm">{rx.diagnosis}</span>
                                  </div>
                              {rx.medicines?.filter(m => m.name.trim()).length > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2.5">
                                  <span className="font-semibold text-green-700 text-xs uppercase tracking-wide flex items-center gap-1 mb-1">
                                    <Pill className="h-3 w-3" /> Medicines ({rx.medicines.filter(m => m.name.trim()).length})
                                  </span>
                                  <div className="space-y-1 ml-4">
                                    {rx.medicines.filter(m => m.name.trim()).map((med, i) => (
                                      <p key={i} className="text-xs">
                                        <span className="font-medium">{med.name}</span>
                                        {med.dosage && <span className="text-muted-foreground"> &bull; {med.dosage}</span>}
                                        {med.frequency && <span className="text-muted-foreground"> &bull; {med.frequency}</span>}
                                        {med.duration && <span className="text-muted-foreground"> &bull; {med.duration}</span>}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {rx.tests?.filter(t => t.name.trim()).length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2.5">
                                  <span className="font-semibold text-amber-700 text-xs uppercase tracking-wide">Tests:</span>
                                  <span className="ml-2 text-xs">{rx.tests.filter(t => t.name.trim()).map(t => t.name).join(", ")}</span>
                                </div>
                              )}
                              {rx.follow_up_date && (
                                <div className="flex items-center gap-1 text-xs text-amber-700">
                                  <Calendar className="h-3 w-3" /> Follow-up: {fmtDate(rx.follow_up_date)}
                                </div>
                              )}
                              {rx.manual_prescription_url && rx.diagnosis !== "Manual Prescription" && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2.5 flex items-center gap-2">
                                  <Image className="h-3 w-3 text-purple-600" />
                                  <span className="text-xs font-semibold text-purple-700">Manual Rx also attached</span>
                                </div>
                              )}
                                </>
                              )}
                            </div>
                          ) : (
                            <>
                              {record.diagnosis && <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2"><span className="font-medium">Diagnosis:</span> {record.diagnosis}</div>}
                              {record.prescription && <div className="bg-green-50 dark:bg-green-900/20 rounded p-2"><span className="font-medium">Prescription:</span> {record.prescription}</div>}
                            </>
                          )}
                          {record.notes && <div><span className="font-medium text-muted-foreground">Notes:</span> {record.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                  {selectedPatient.appointments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No treatment records found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
