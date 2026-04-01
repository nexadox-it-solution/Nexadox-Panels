"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader, Download } from "lucide-react";

/* ─── Brand ──────────────────────────────────────────────────── */
const BRAND       = "#0D8EAD";
const BRAND_LIGHT = "#E6F6FA";
const NX_EMAIL    = "Support@nexadox.com";
const NX_PHONE    = "+91 98300 00000";

/* ─── Types ─────────────────────────────────────────────────── */
interface Medicine {
  type?: string;
  name: string;
  composition?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface TestItem {
  name: string;
  instructions: string;
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
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }); } catch { return d; }
};

/* ─── Component ─────────────────────────────────────────────── */
export default function PrintPrescriptionPage() {
  const supabase = createClient();
  const params   = useParams();
  const router   = useRouter();
  const aptId    = Number(params.id);

  const [loading,     setLoading    ] = useState(true);
  const [error,       setError      ] = useState("");
  const [downloading, setDownloading] = useState(false);

  /* Doctor */
  const [doctorName,        setDoctorName       ] = useState("");
  const [doctorDegrees,     setDoctorDegrees    ] = useState("");
  const [doctorSpecialties, setDoctorSpecialties] = useState("");
  const [doctorPhone,       setDoctorPhone      ] = useState("");

  /* Clinic */
  const [clinicName,    setClinicName   ] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone,   setClinicPhone  ] = useState("");
  const [clinicEmail,   setClinicEmail  ] = useState("");
  const [clinicLogo,    setClinicLogo   ] = useState<string | null>(null);

  /* Patient */
  const [patientName,     setPatientName    ] = useState("");
  const [patientAge,      setPatientAge     ] = useState<number | null>(null);
  const [patientGender,   setPatientGender  ] = useState("");
  const [patientPhone,    setPatientPhone   ] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [patientType,     setPatientType    ] = useState("");
  const [patientUhid,     setPatientUhid    ] = useState("");

  /* Prescription */
  const [complaint,          setComplaint         ] = useState("");
  const [diagnosis,          setDiagnosis         ] = useState("");
  const [notes,              setNotes             ] = useState("");
  const [medicines,          setMedicines         ] = useState<Medicine[]>([]);
  const [tests,              setTests             ] = useState<TestItem[]>([]);
  const [prescriptionNumber, setPrescriptionNumber] = useState("");

  /* Vitals */
  const [vitals, setVitals] = useState<{
    bp?: string; bmi?: number; spo2?: number; pulse?: number;
    temperature?: number; weight?: number; height?: number;
  } | null>(null);

  /* ── Fetch ────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!aptId) return;
    setLoading(true);
    try {
      const { data: apt } = await supabase
        .from("appointments").select("*").eq("id", aptId).single();
      if (!apt) { setError("Appointment not found"); setLoading(false); return; }

      setPatientName(apt.patient_name || "");
      setPatientAge(calcAge(apt.patient_dob));
      setPatientGender(apt.patient_gender || "");
      setPatientPhone(apt.patient_phone || "");
      setAppointmentDate(apt.appointment_date || "");
      setPatientType(apt.consultation_type || "");

      // UHID from patient_id
      if (apt.patient_id) {
        setPatientUhid(`UHID${String(apt.patient_id).padStart(8, '0')}`);
      }

      if (apt.doctor_id) {
        const { data: doc } = await supabase
          .from("doctors").select("name, degrees, specialties, phone, email")
          .eq("id", apt.doctor_id).single();
        if (doc) {
          setDoctorName(doc.name || "");
          setDoctorDegrees(Array.isArray(doc.degrees) ? doc.degrees.join(", ") : (doc.degrees || ""));
          setDoctorSpecialties(Array.isArray(doc.specialties) ? doc.specialties.join(", ") : (doc.specialties || ""));
          setDoctorPhone(doc.phone || doc.email || "");
        }
      }

      if (apt.clinic_id) {
        const { data: cl } = await supabase
          .from("clinics")
          .select("name, building, street, area, city, state, pincode, mobile, email, logo")
          .eq("id", apt.clinic_id).single();
        if (cl) {
          setClinicName(cl.name || "");
          const parts = [cl.building, cl.street, cl.area, cl.city, cl.state, cl.pincode].filter(Boolean);
          setClinicAddress(parts.join(", "));
          setClinicPhone(cl.mobile || "");
          setClinicEmail(cl.email || "");
          setClinicLogo(cl.logo || null);
        }
      }

      const { data: vData } = await supabase
        .from("vitals").select("bp, bmi, spo2, pulse, temperature, weight, height")
        .eq("appointment_id", aptId).limit(1).single();
      if (vData) setVitals(vData);

      const { data: rx } = await supabase
        .from("prescriptions").select("*").eq("appointment_id", aptId).limit(1).single();
      if (!rx) { setError("No prescription found for this appointment"); setLoading(false); return; }

      setComplaint(rx.complaint || "");
      setDiagnosis(rx.diagnosis || "");
      setNotes(rx.notes || "");
      setMedicines((rx.medicines as Medicine[]) || []);
      setTests((rx.tests as TestItem[]) || []);
      if (rx.prescription_number) setPrescriptionNumber(rx.prescription_number);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [aptId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Download PDF ─────────────────────────────────────────── */
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const el = document.getElementById("rx-printable");
      if (!el) return;
      // Temporarily use natural content height for clean single-page PDF
      const origMinH = el.style.minHeight;
      const origShadow = el.style.boxShadow;
      el.style.minHeight = "auto";
      el.style.boxShadow = "none";
      try {
        await html2pdf().set({
          margin: 0,
          filename: `Prescription_${patientName.replace(/\s+/g, "_")}_${appointmentDate}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        }).from(el).save();
      } finally {
        el.style.minHeight = origMinH;
        el.style.boxShadow = origShadow;
      }
    } catch (e) { console.error("PDF failed:", e); }
    finally { setDownloading(false); }
  };

  /* ── Loading / Error ──────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-600 font-medium">{error}</p>
      <Button variant="outline" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Go Back
      </Button>
    </div>
  );

  const filteredMeds  = medicines.filter(m => m.name?.trim());
  const filteredTests = tests.filter(t => t.name?.trim());

  return (
    <>
      {/* ── Embedded print + screen layout CSS ─────────────── */}
      <style>{`
        /* ── Screen: make card A4-tall so footer/signature stay at bottom ── */
        #rx-printable {
          display: flex;
          flex-direction: column;
          min-height: 297mm;
        }
        .rx-body-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .rx-content-spacer { flex: 1; }

        /* ── Print overrides ── */
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hide ALL layout chrome: sidebar, nav, toolbar, layout top bar */
          aside, nav, .rx-toolbar { display: none !important; }
          header:not(.rx-header) { display: none !important; }

          /* Reset main content wrapper padding from sidebar */
          div[class*="lg:pl-"] { padding-left: 0 !important; }

          /* Clean A4 sheet — no fixed positioning */
          .rx-screen-card {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
            border: none !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }

          tr          { page-break-inside: avoid; }
          .rx-section { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Screen toolbar ────────────────────────────────────── */}
      <div className="rx-toolbar sticky top-0 z-50 bg-white border-b px-6 py-3 flex items-center gap-4 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold flex-1">Prescription</h1>
        <Button
          variant="outline" size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-2"
        >
          {downloading ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Generating…" : "Download PDF"}
        </Button>
        <Button
          size="sm"
          onClick={() => window.print()}
          className="gap-2 text-white"
          style={{ backgroundColor: BRAND }}
        >
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* ── Printable document ────────────────────────────────── */}
      <div
        id="rx-printable"
        className="rx-screen-card max-w-[210mm] mx-auto bg-white text-black shadow-lg my-6"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
      >

        {/* ── HEADER ────────────────────────────────────────── */}
        <div
          className="rx-header px-10 pt-8 pb-4"
          style={{ borderBottom: `2.5px solid ${BRAND}` }}
        >
          <div className="flex items-start justify-between gap-6">

            {/* LEFT — Doctor info */}
            <div>
              <p className="text-[18px] font-bold leading-tight" style={{ color: BRAND }}>
                {doctorName || "Doctor"}
              </p>
              {doctorDegrees    && <p className="text-[11px] text-gray-600 mt-0.5">{doctorDegrees}</p>}
              {doctorSpecialties && (
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: BRAND }}>
                  {doctorSpecialties}
                </p>
              )}
              {doctorPhone && <p className="text-[11px] text-gray-500 mt-0.5">📞 {doctorPhone}</p>}
            </div>

            {/* RIGHT — Clinic info + logo */}
            <div className="text-right flex items-start gap-3">
              <div>
                <p className="text-[16px] font-bold" style={{ color: BRAND }}>
                  {clinicName || "Clinic"}
                </p>
                {clinicAddress && (
                  <p className="text-[10px] text-gray-600 mt-0.5 ml-auto max-w-[220px]">
                    {clinicAddress}
                  </p>
                )}
                {clinicPhone && <p className="text-[10px] text-gray-500 mt-0.5">📞 {clinicPhone}</p>}
                {clinicEmail && <p className="text-[10px] text-gray-500">✉ {clinicEmail}</p>}
              </div>
              {clinicLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinicLogo} alt="Clinic" className="h-14 w-14 rounded object-contain" />
              ) : (
                <div
                  className="h-14 w-14 rounded flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={{ backgroundColor: BRAND }}
                >
                  {(clinicName || "C").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────── */}
        <div className="rx-body-wrap px-10 pt-5 pb-6">
          {/* Patient info grid */}
          <div
            className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3 p-3 rounded"
            style={{ backgroundColor: BRAND_LIGHT }}
          >
            <div><span className="font-semibold text-gray-700">Patient:</span> {patientName}</div>
            <div><span className="font-semibold text-gray-700">Date:</span> {fmtDate(appointmentDate)}</div>
            <div>
              <span className="font-semibold text-gray-700">Age / Gender:</span>{" "}
              {patientAge != null ? `${patientAge} yrs` : "—"}
              {patientGender && <span className="capitalize"> / {patientGender}</span>}
            </div>
            {patientUhid && (
              <div><span className="font-semibold text-gray-700">UHID No.:</span> <span className="font-mono">{patientUhid}</span></div>
            )}
            <div className="flex flex-wrap gap-4">
              {patientPhone && <span><span className="font-semibold text-gray-700">Phone:</span> {patientPhone}</span>}
              {patientType  && <span><span className="font-semibold text-gray-700">Type:</span> {patientType}</span>}
            </div>
            {prescriptionNumber && (
              <div><span className="font-semibold text-gray-700">Prescription No.:</span> <span className="font-mono font-semibold" style={{ color: BRAND }}>{prescriptionNumber}</span></div>
            )}
          </div>

          {/* Vitals bar */}
          {vitals && (
            <div
              className="rx-section flex flex-wrap gap-x-6 gap-y-1 text-xs mb-3 p-2 rounded"
              style={{ border: `1px solid ${BRAND}44` }}
            >
              <span className="font-semibold" style={{ color: BRAND }}>Vitals:</span>
              {vitals.bp          && <span>BP: <strong>{vitals.bp}</strong></span>}
              {vitals.pulse       && <span>Pulse: <strong>{vitals.pulse} bpm</strong></span>}
              {vitals.spo2        && <span>SpO₂: <strong>{vitals.spo2}%</strong></span>}
              {vitals.temperature && <span>Temp: <strong>{vitals.temperature}°F</strong></span>}
              {vitals.weight      && <span>Wt: <strong>{vitals.weight} kg</strong></span>}
              {vitals.height      && <span>Ht: <strong>{vitals.height} cm</strong></span>}
              {vitals.bmi         && <span>BMI: <strong>{vitals.bmi}</strong></span>}
            </div>
          )}

          {/* ℞ symbol */}
          <div className="text-4xl font-bold mb-2" style={{ color: BRAND, fontFamily: "serif" }}>℞</div>

          {/* Chief Complaint */}
          {complaint && (
            <div className="rx-section mb-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Chief Complaint</h4>
              <p className="text-sm">{complaint}</p>
            </div>
          )}

          {/* Diagnosis */}
          <div className="rx-section mb-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Diagnosis</h4>
            <p className="text-sm font-semibold">{diagnosis || "—"}</p>
          </div>

          {/* Medicines table */}
          {filteredMeds.length > 0 && (
            <div className="rx-section mb-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Medicines</h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BRAND}` }}>
                    {["#", "Medicine", "Composition", "Dosage", "Frequency", "Duration", "Instructions"].map(h => (
                      <th key={h} className="py-1.5 pr-2 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMeds.map((m, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i % 2 === 1 ? BRAND_LIGHT : "white",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <td className="py-1.5 pr-2 text-gray-400">{i + 1}</td>
                      <td className="py-1.5 pr-2">
                        {m.type && <span className="text-[9px] uppercase text-gray-400 mr-1">[{m.type}]</span>}
                        <span className="font-medium">{m.name}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-gray-500 text-[10px]">{m.composition || "—"}</td>
                      <td className="py-1.5 pr-2">{m.dosage || "—"}</td>
                      <td className="py-1.5 pr-2">{m.frequency || "—"}</td>
                      <td className="py-1.5 pr-2">{m.duration || "—"}</td>
                      <td className="py-1.5 text-gray-600">{m.instructions || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lab Tests */}
          {filteredTests.length > 0 && (
            <div className="rx-section mb-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Lab Tests / Investigations</h4>
              <ul className="list-disc list-inside text-sm space-y-0.5">
                {filteredTests.map((t, i) => (
                  <li key={i}>
                    <span className="font-medium">{t.name}</span>
                    {t.instructions && <span className="text-xs text-gray-500 ml-1">— {t.instructions}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div className="rx-section mb-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Notes / Advice</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-yellow-50 p-2 rounded">{notes}</p>
            </div>
          )}

          {/* Spacer — grows to push signature to bottom */}
          <div className="rx-content-spacer" />

          {/* Doctor signature */}
          <div className="pt-8 pb-2 flex justify-end">
            <div className="text-center">
              <div className="border-t border-gray-400 w-48 mb-1" />
              <p className="text-sm font-semibold">{doctorName}</p>
              {doctorDegrees && <p className="text-[10px] text-gray-500">{doctorDegrees}</p>}
            </div>
          </div>
        </div>{/* end rx-body-wrap */}

        {/* ── FOOTER ────────────────────────────────────────── */}
        <div
          className="rx-footer px-10 py-4"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center justify-between">

            {/* LEFT — Nexadox contact */}
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <p className="font-semibold text-gray-600">Powered by Nexadox</p>
              <p>✉ {NX_EMAIL}</p>
              <p>📞 {NX_PHONE}</p>
            </div>

            {/* RIGHT — QR placeholder + Nexadox logo */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 flex items-center justify-center text-[10px] text-gray-400 text-center leading-tight rounded"
                style={{ border: "1.5px dashed #ccc" }}
              >
                QR
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Nexadox.png" alt="Nexadox" style={{ height: 48 }} />
            </div>
          </div>
        </div>

      </div>{/* end rx-printable */}
    </>
  );
}
