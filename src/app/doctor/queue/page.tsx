"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock, Play, CheckCircle, XCircle, Phone, FileText,
  AlertCircle, Timer, Loader, User, Activity, Stethoscope, Hash,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─────────────────────────────────────────────────── */
interface QueueItem {
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
  completion_time: string | null;
  token_number: number | null;
  consultation_type: string | null;
  notes: string | null;
}

interface VitalsRow {
  id: number;
  appointment_id: number;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  bp: string | null;
  spo2: number | null;
  temperature: number | null;
  pulse: number | null;
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

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
};

const waitMins = (checkinTime: string | null) => {
  if (!checkinTime) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(checkinTime).getTime()) / 60000));
};

const todayStr = () => new Date().toISOString().split("T")[0];

/* ─── Component ─────────────────────────────────────────────── */
export default function QueuePage() {
  const supabase = createClient();
  const router = useRouter();
  const [queue, setQueue]         = useState<QueueItem[]>([]);
  const [vitalsMap, setVitalsMap] = useState<Map<number, VitalsRow>>(new Map());
  const [loading, setLoading]     = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);

  /* ── Fetch queue ──────────────────────────────────────────── */
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      let docId = doctorId;
      if (!docId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Try profile_id first (new architecture), then fall back to auth_user_id
        let doc: { id: number } | null = null;
        const { data: byProfile } = await supabase
          .from("doctors").select("id").eq("profile_id", user.id).single();
        if (byProfile) {
          doc = byProfile;
        } else {
          const { data: byAuth } = await supabase
            .from("doctors").select("id").eq("auth_user_id", user.id).single();
          doc = byAuth;
        }
        if (!doc) return;
        docId = doc.id;
        setDoctorId(docId);
      }

      const today = todayStr();

      /* Checked-in appointments for today for THIS doctor */
      const { data: qData } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", docId)
        .eq("appointment_date", today)
        .eq("checkin_status", "checked_in")
        .order("checkin_time", { ascending: true });

      const items = (qData || []) as QueueItem[];
      setQueue(items);

      /* Fetch vitals for all queue items */
      if (items.length > 0) {
        const ids = items.map(i => i.id);
        const { data: vData } = await supabase
          .from("vitals")
          .select("*")
          .in("appointment_id", ids);

        const vMap = new Map<number, VitalsRow>();
        (vData || []).forEach((v: any) => vMap.set(v.appointment_id, v as VitalsRow));
        setVitalsMap(vMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  /* Auto-refresh every 30 seconds */
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  /* ── Complete consultation ────────────────────────────────── */
  const handleComplete = async (apt: QueueItem) => {
    /* Check if prescription exists */
    const { data: rxData } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("appointment_id", apt.id)
      .limit(1);

    if (!rxData || rxData.length === 0) {
      alert("Cannot complete: No prescription has been created for this patient. Please open the case and write a prescription first.");
      return;
    }

    setCompleting(apt.id);
    try {
      const { error } = await supabase.from("appointments").update({
        checkin_status: "completed",
        completion_time: new Date().toISOString(),
        status: "completed",
      }).eq("id", apt.id);

      if (error) throw error;
      fetchQueue();
    } catch (err) { console.error(err); }
    finally { setCompleting(null); }
  };

  /* ── Open Case → consultation page ───────────────────────── */
  const openCase = (apt: QueueItem) => {
    router.push(`/doctor/consultation/${apt.id}`);
  };

  /* ── Stats ────────────────────────────────────────────────── */
  const totalInQueue = queue.length;
  const avgWait = totalInQueue > 0 ? Math.round(queue.reduce((s, q) => s + waitMins(q.checkin_time), 0) / totalInQueue) : 0;

  /* ─── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-8 w-8 text-blue-600" /> Patient Queue
          </h1>
          <p className="text-muted-foreground mt-1">Patients checked-in and waiting for consultation</p>
        </div>
        <Button variant="outline" onClick={fetchQueue} className="gap-2">
          <Loader className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">In Queue</p><p className="text-3xl font-bold mt-1 text-blue-600">{totalInQueue}</p></div>
              <Clock className="h-8 w-8 text-blue-600 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Auto-refresh</p><p className="text-sm font-medium mt-2 text-green-600">Every 30 seconds</p></div>
              <CheckCircle className="h-8 w-8 text-green-600 opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3 text-muted-foreground">Loading queue…</p></CardContent></Card>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium text-muted-foreground">No patients in queue</p>
            <p className="text-sm text-muted-foreground mt-1">All caught up! Great work.</p>
          </CardContent>
        </Card>
      ) : (
        /* Queue Table */
        <Card>
          <CardHeader><CardTitle>Waiting Patients ({queue.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                  {["#", "Patient", "Age", "Gender", "Type", "Check-In Time", "Vitals", "Actions"].map(h => (
                    <th key={h} className="py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((apt, idx) => {
                  const vitals = vitalsMap.get(apt.id);
                  const age = calcAge(apt.patient_dob);
                  const wait = waitMins(apt.checkin_time);
                  return (
                    <tr key={apt.id} className="border-b hover:bg-blue-50/50 dark:hover:bg-gray-800">
                      {/* Queue number */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {apt.token_number || idx + 1}
                        </div>
                      </td>
                      {/* Patient */}
                      <td className="py-3 px-3">
                        <p className="font-semibold">{apt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{apt.patient_phone || apt.patient_email || "—"}</p>
                      </td>
                      {/* Age */}
                      <td className="py-3 px-3 text-xs">{age != null ? `${age} yrs` : "—"}</td>
                      {/* Gender */}
                      <td className="py-3 px-3 text-xs capitalize">{apt.patient_gender || "—"}</td>
                      {/* Consultation Type */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          apt.consultation_type === "Follow-up" ? "bg-orange-100 text-orange-700" :
                          apt.consultation_type === "Report Check" ? "bg-purple-100 text-purple-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{apt.consultation_type || "—"}</span>
                      </td>
                      {/* Check-in time */}
                      <td className="py-3 px-3 text-xs font-mono">{fmtTime(apt.checkin_time)}</td>
                      {/* Vitals summary */}
                      <td className="py-3 px-3 text-xs">
                        {vitals ? (
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground">BP:</span> <span className="font-medium">{vitals.bp || "—"}</span>
                            {vitals.bmi && <><span className="text-muted-foreground ml-2">BMI:</span> <span className="font-medium">{vitals.bmi}</span></>}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => openCase(apt)} className="gap-1 bg-blue-600 hover:bg-blue-700">
                            <Stethoscope className="h-3.5 w-3.5" /> Open Case
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleComplete(apt)}
                            disabled={completing === apt.id}
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                            {completing === apt.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Complete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
