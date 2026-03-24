"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Medicine {
  type: string;
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
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};

/* ─── Component ─────────────────────────────────────────────── */
export default function PrintPrescriptionPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const aptId = Number(params.id);
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Data */
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState<number | null>(null);
  const [patientGender, setPatientGender] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorDegrees, setDoctorDegrees] = useState("");
  const [doctorSpecialties, setDoctorSpecialties] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);

  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);

  const [vitals, setVitals] = useState<{ bp?: string; bmi?: number; spo2?: number; pulse?: number; temperature?: number; weight?: number; height?: number } | null>(null);

  /* ── Fetch ────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!aptId) return;
    setLoading(true);
    try {
      /* Appointment */
      const { data: apt } = await supabase.from("appointments").select("*").eq("id", aptId).single();
      if (!apt) { setError("Appointment not found"); setLoading(false); return; }

      setPatientName(apt.patient_name || "");
      setPatientAge(calcAge(apt.patient_dob));
      setPatientGender(apt.patient_gender || "");
      setPatientPhone(apt.patient_phone || "");
      setAppointmentDate(apt.appointment_date || "");

      /* Doctor */
      if (apt.doctor_id) {
        const { data: doc } = await supabase.from("doctors").select("name, degrees, specialties, phone, email").eq("id", apt.doctor_id).single();
        if (doc) {
          setDoctorName(doc.name || "");
          setDoctorDegrees(Array.isArray(doc.degrees) ? doc.degrees.join(", ") : (doc.degrees || ""));
          setDoctorSpecialties(Array.isArray(doc.specialties) ? doc.specialties.join(", ") : (doc.specialties || ""));
          setDoctorPhone(doc.phone || doc.email || "");
        }
      }

      /* Clinic */
      if (apt.clinic_id) {
        const { data: cl } = await supabase.from("clinics").select("name, building, street, area, city, state, pincode, mobile, email, logo").eq("id", apt.clinic_id).single();
        if (cl) {
          setClinicName(cl.name || "");
          const parts = [cl.building, cl.street, cl.area, cl.city, cl.state, cl.pincode].filter(Boolean);
          setClinicAddress(parts.join(", "));
          setClinicPhone(cl.mobile || cl.email || "");
          setClinicLogo(cl.logo || null);
        }
      }

      /* Vitals */
      const { data: vData } = await supabase.from("vitals").select("*").eq("appointment_id", aptId).limit(1).single();
      if (vData) {
        setVitals({ bp: vData.bp, bmi: vData.bmi, spo2: vData.spo2, pulse: vData.pulse, temperature: vData.temperature, weight: vData.weight, height: vData.height });
      }

      /* Prescription */
      const { data: rx } = await supabase.from("prescriptions").select("*").eq("appointment_id", aptId).limit(1).single();
      if (!rx) { setError("No prescription found for this appointment"); setLoading(false); return; }

      setComplaint(rx.complaint || "");
      setDiagnosis(rx.diagnosis || "");
      setNotes(rx.notes || "");
      setMedicines((rx.medicines as Medicine[]) || []);
      setTests((rx.tests as TestItem[]) || []);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [aptId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Print ────────────────────────────────────────────────── */
  const handlePrint = () => window.print();

  /* ── Loading / Error states ───────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const filteredMeds = medicines.filter(m => m.name?.trim());
  const filteredTests = tests.filter(t => t.name?.trim());

  return (
    <>
      {/* ── Screen-only toolbar ─────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 border-b px-6 py-3 flex items-center gap-4 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold flex-1">Print Prescription</h1>
        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* ── Printable content ───────────────────────────────── */}
      <div ref={printRef} className="max-w-[210mm] mx-auto bg-white text-black p-8 print:p-6 print:m-0 print:max-w-none print:shadow-none shadow-lg my-6 print:my-0" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

        {/* ── Header ────────────────────────────────────────── */}
        <div className="border-b-2 border-blue-600 pb-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {clinicLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinicLogo} alt="Clinic Logo" className="h-16 w-16 rounded object-contain" />
              )}
              <div>
                <h2 className="text-xl font-bold text-blue-800">{clinicName || "Clinic"}</h2>
                {clinicAddress && <p className="text-xs text-gray-600 max-w-[350px]">{clinicAddress}</p>}
                {clinicPhone && <p className="text-xs text-gray-600">Phone: {clinicPhone}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-base font-bold">{doctorName}</h3>
              {doctorDegrees && <p className="text-xs text-gray-600">{doctorDegrees}</p>}
              {doctorSpecialties && <p className="text-xs text-blue-700 font-medium">{doctorSpecialties}</p>}
              {doctorPhone && <p className="text-xs text-gray-600">{doctorPhone}</p>}
            </div>
          </div>
        </div>

        {/* ── Patient info row ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-4 bg-gray-50 p-3 rounded">
          <div><span className="font-semibold text-gray-700">Patient:</span> {patientName}</div>
          <div><span className="font-semibold text-gray-700">Date:</span> {fmtDate(appointmentDate)}</div>
          <div>
            <span className="font-semibold text-gray-700">Age:</span> {patientAge != null ? `${patientAge} yrs` : "—"}
            {patientGender && <span className="ml-4"><span className="font-semibold text-gray-700">Gender:</span> <span className="capitalize">{patientGender}</span></span>}
          </div>
          {patientPhone && <div><span className="font-semibold text-gray-700">Phone:</span> {patientPhone}</div>}
        </div>

        {/* ── Vitals ────────────────────────────────────────── */}
        {vitals && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs mb-4 p-2 border rounded bg-blue-50">
            <span className="font-semibold text-blue-800">Vitals:</span>
            {vitals.bp && <span>BP: <strong>{vitals.bp}</strong></span>}
            {vitals.pulse && <span>Pulse: <strong>{vitals.pulse} bpm</strong></span>}
            {vitals.spo2 && <span>SpO₂: <strong>{vitals.spo2}%</strong></span>}
            {vitals.temperature && <span>Temp: <strong>{vitals.temperature}°F</strong></span>}
            {vitals.weight && <span>Wt: <strong>{vitals.weight} kg</strong></span>}
            {vitals.height && <span>Ht: <strong>{vitals.height} cm</strong></span>}
            {vitals.bmi && <span>BMI: <strong>{vitals.bmi}</strong></span>}
          </div>
        )}

        {/* ── Rx symbol ─────────────────────────────────────── */}
        <div className="text-3xl font-bold text-blue-700 mb-2" style={{ fontFamily: "serif" }}>℞</div>

        {/* ── Complaint ─────────────────────────────────────── */}
        {complaint && (
          <div className="mb-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Chief Complaint</h4>
            <p className="text-sm">{complaint}</p>
          </div>
        )}

        {/* ── Diagnosis ─────────────────────────────────────── */}
        <div className="mb-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Diagnosis</h4>
          <p className="text-sm font-semibold">{diagnosis}</p>
        </div>

        {/* ── Medicines table ───────────────────────────────── */}
        {filteredMeds.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Medicines</h4>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left">
                  <th className="py-1.5 pr-2 w-8 font-semibold text-gray-600">#</th>
                  <th className="py-1.5 pr-2 font-semibold text-gray-600">Medicine</th>
                  <th className="py-1.5 pr-2 font-semibold text-gray-600">Dosage</th>
                  <th className="py-1.5 pr-2 font-semibold text-gray-600">Frequency</th>
                  <th className="py-1.5 pr-2 font-semibold text-gray-600">Duration</th>
                  <th className="py-1.5 font-semibold text-gray-600">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeds.map((m, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-1.5 pr-2 text-gray-500">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      {m.type && <span className="text-[10px] uppercase text-gray-500 mr-1">{m.type}</span>}
                      <span className="font-medium">{m.name}</span>
                      {m.composition && <span className="block text-[10px] text-gray-500">{m.composition}</span>}
                    </td>
                    <td className="py-1.5 pr-2">{m.dosage || "—"}</td>
                    <td className="py-1.5 pr-2">{m.frequency || "—"}</td>
                    <td className="py-1.5 pr-2">{m.duration || "—"}</td>
                    <td className="py-1.5 text-xs text-gray-600">{m.instructions || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Lab Tests ─────────────────────────────────────── */}
        {filteredTests.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Lab Tests / Investigations</h4>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {filteredTests.map((t, i) => (
                <li key={i}>
                  <span className="font-medium">{t.name}</span>
                  {t.instructions && <span className="text-xs text-gray-600 ml-1">— {t.instructions}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────────── */}
        {notes && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Notes / Advice</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* ── Signature ─────────────────────────────────────── */}
        <div className="mt-12 pt-4 flex justify-end">
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 mb-1" />
            <p className="text-sm font-semibold">{doctorName}</p>
            {doctorDegrees && <p className="text-[10px] text-gray-600">{doctorDegrees}</p>}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="mt-8 pt-3 border-t text-center text-[10px] text-gray-400">
          This is a computer-generated prescription. • Generated via Nexadox
        </div>
      </div>

      {/* ── Print-specific CSS ──────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </>
  );
}
