"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock, Play, CheckCircle, XCircle, Phone, FileText,
  AlertCircle, Timer, Loader, User, Activity, Stethoscope, Hash,
  Search, Filter, X, ChevronDown, ChevronUp, Calendar, Mail, Printer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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

  /* ── Filter state ─────────────────────────────────────────── */
  const [showFilters, setShowFilters] = useState(false);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "completed">("all");
  const [filterType, setFilterType] = useState<"all" | "First Visit" | "Follow-up" | "Report Check">("all");
  const [filterGender, setFilterGender] = useState<"all" | "Male" | "Female" | "Other">("all");

  const hasActiveFilters = filterName || filterPhone || filterEmail || filterStatus !== "all" || filterType !== "all" || filterGender !== "all" || filterDate !== todayStr();

  const clearFilters = () => {
    setFilterName(""); setFilterPhone(""); setFilterEmail("");
    setFilterStatus("all"); setFilterType("all"); setFilterGender("all");
    setFilterDate(todayStr());
  };

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

      /* Checked-in appointments for selected date for THIS doctor */
      const { data: qData } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", docId)
        .eq("appointment_date", filterDate)
        .in("checkin_status", ["checked_in", "completed"])
        .order("checkin_time", { ascending: true });

      const items = (qData || []) as QueueItem[];
      // Sort: waiting patients first, then completed
      items.sort((a, b) => {
        if (a.checkin_status !== b.checkin_status) return a.checkin_status === "checked_in" ? -1 : 1;
        return 0;
      });
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
  }, [filterDate]);

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
  const totalWaiting = queue.filter(q => q.checkin_status === "checked_in").length;
  const totalCompleted = queue.filter(q => q.checkin_status === "completed").length;

  /* ── Client-side filtering ────────────────────────────────── */
  const filteredQueue = queue.filter(q => {
    if (filterName && !q.patient_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterPhone && !(q.patient_phone || "").includes(filterPhone)) return false;
    if (filterEmail && !(q.patient_email || "").toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterStatus !== "all" && q.checkin_status !== filterStatus) return false;
    if (filterType !== "all") {
      const ct = q.consultation_type || "First Visit";
      if (ct !== filterType) return false;
    }
    if (filterGender !== "all" && (q.patient_gender || "").toLowerCase() !== filterGender.toLowerCase()) return false;
    return true;
  });

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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Waiting</p><p className="text-3xl font-bold mt-1 text-blue-600">{totalWaiting}</p></div>
              <Clock className="h-8 w-8 text-blue-600 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Completed</p><p className="text-3xl font-bold mt-1 text-green-600">{totalCompleted}</p></div>
              <CheckCircle className="h-8 w-8 text-green-600 opacity-30" />
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

      {/* ── Advanced Search & Filters ───────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          {/* Quick search + toggle */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Quick search by name, phone or email…"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(v => !v)}
                className="gap-1.5"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-red-500 inline-block" />}
                {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                  <X className="h-4 w-4" /> Clear
                </Button>
              )}
            </div>
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value || todayStr())} className="pl-9" />
                </div>
              </div>
              {/* Phone */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search by phone…" value={filterPhone} onChange={e => setFilterPhone(e.target.value)} className="pl-9" />
                </div>
              </div>
              {/* Email */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input placeholder="Search by email…" value={filterEmail} onChange={e => setFilterEmail(e.target.value)} className="pl-9" />
                </div>
              </div>
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="checked_in">Waiting</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              {/* Consultation Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Consultation Type</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Types</option>
                  <option value="First Visit">First Visit</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Report Check">Report Check</option>
                </select>
              </div>
              {/* Gender */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gender</label>
                <select
                  value={filterGender}
                  onChange={e => setFilterGender(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3 text-muted-foreground">Loading queue…</p></CardContent></Card>
      ) : filteredQueue.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium text-muted-foreground">{hasActiveFilters ? "No patients match your filters" : "No patients in queue"}</p>
            <p className="text-sm text-muted-foreground mt-1">{hasActiveFilters ? "Try adjusting your search criteria" : "All caught up! Great work."}</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Clear Filters</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Queue Table */
        <Card>
          <CardHeader>
            <CardTitle>
              {filterDate === todayStr() ? "Today's Patients" : `Patients on ${filterDate}`} ({filteredQueue.length})
              {hasActiveFilters && filteredQueue.length !== queue.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">of {queue.length} total</span>
              )}
            </CardTitle>
          </CardHeader>
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
                {filteredQueue.map((apt, idx) => {
                  const vitals = vitalsMap.get(apt.id);
                  const age = calcAge(apt.patient_dob);
                  const wait = waitMins(apt.checkin_time);
                  return (
                    <tr key={apt.id} className={`border-b ${apt.checkin_status === "completed" ? "bg-green-50/30" : ""} hover:bg-blue-50/50 dark:hover:bg-gray-800`}>
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
                          {apt.checkin_status === "completed" ? (
                            <>
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">✓ Done</span>
                              <Button size="sm" variant="outline" onClick={() => openCase(apt)} className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50">
                                <FileText className="h-3.5 w-3.5" /> Edit Rx
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => router.push(`/prescription/print/${apt.id}`)} className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                                <Printer className="h-3.5 w-3.5" /> Print Rx
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => openCase(apt)} className="gap-1 bg-blue-600 hover:bg-blue-700">
                                <Stethoscope className="h-3.5 w-3.5" /> Open Case
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleComplete(apt)}
                                disabled={completing === apt.id}
                                className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
                                {completing === apt.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Complete
                              </Button>
                            </>
                          )}
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
