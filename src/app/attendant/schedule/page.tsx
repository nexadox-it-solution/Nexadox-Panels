"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock, Loader, ChevronLeft, ChevronRight, Plus, Trash2, Check, X, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────── */
interface DoctorRow { id: number; name: string; clinic_ids: number[] | null; }
interface Clinic { id: number; name: string; }
interface ScheduleRow { id: number; doctor_id: number; date: string; slot: string; status: string; clinic_id?: number | null; }

/* ─── Session config ─────────────────────────────────────────── */
const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const SESSION_EMOJI: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌇", Night: "🌙" };

const statusColor: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  booked: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_CYCLE = ["available", "booked", "cancelled"];

const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); } catch { return d; } };

export default function AttendantSchedulePage() {
  const [doctors, setDoctors]           = useState<DoctorRow[]>([]);
  const [clinics, setClinics]           = useState<Clinic[]>([]);
  const [loading, setLoading]           = useState(true);
  const [assignedClinicIds, setAssignedClinicIds] = useState<number[]>([]);

  /* Schedule state */
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [schedDate, setSchedDate]         = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [maxSeats, setMaxSeats]           = useState<number>(30);
  const [schedClinicId, setSchedClinicId] = useState<number | null>(null);

  const [schedules, setSchedules]   = useState<ScheduleRow[]>([]);
  const [loadingSched, setLoadingSched] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState("");
  const [errMsg, setErrMsg]             = useState("");

  /* Calendar */
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  /* Tab */
  const [tab, setTab] = useState<"add" | "view">("add");

  /* ── Load attendant scope ───────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let myClinicIds: number[] = [];
        let myDoctorIds: string[] = [];

        if (user) {
          // Try profile_id first, then fall back to user_id
          const { data: att } = await supabase.from("attendants").select("assigned_clinic_ids, assigned_doctors").eq("profile_id", user.id).single();
          if (att) {
            myClinicIds = att.assigned_clinic_ids || [];
            myDoctorIds = att.assigned_doctors || [];
          } else {
            // Fallback: try user_id for backward compat
            const { data: attByUser } = await supabase.from("attendants").select("assigned_clinic_ids, assigned_doctors").eq("user_id", user.id).single();
            if (attByUser) { myClinicIds = attByUser.assigned_clinic_ids || []; myDoctorIds = attByUser.assigned_doctors || []; }
          }
        }
        if (myClinicIds.length === 0) {
          const { data: allClinics } = await supabase.from("clinics").select("id").eq("status", "active");
          myClinicIds = (allClinics || []).map((c: any) => c.id);
        }
        setAssignedClinicIds(myClinicIds);

        const [clinicRes, docRes] = await Promise.all([
          supabase.from("clinics").select("id, name").eq("status", "active").in("id", myClinicIds.length > 0 ? myClinicIds : [0]).order("name"),
          supabase.from("doctors").select("id, name, clinic_ids").eq("status", "active").order("name"),
        ]);
        const allDocs = (docRes.data || []) as DoctorRow[];
        const scoped = allDocs.filter(d => {
          if (myDoctorIds.length > 0 && myDoctorIds.includes(String(d.id))) return true;
          if (d.clinic_ids?.some(c => myClinicIds.includes(c))) return true;
          return false;
        });
        setClinics((clinicRes.data || []) as Clinic[]);
        setDoctors(scoped);
        if (scoped.length > 0) setSelectedDocId(scoped[0].id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Fetch schedules when doctor changes ────────────────────── */
  const fetchSchedules = useCallback(async () => {
    if (!selectedDocId) return;
    setLoadingSched(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${selectedDocId}&date_from=${today}`);
      const json = await res.json();
      setSchedules(res.ok ? ((json.data || []) as ScheduleRow[]) : []);
    } catch { setSchedules([]); }
    finally { setLoadingSched(false); }
  }, [selectedDocId]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  /* ── Calendar helpers ───────────────────────────────────────── */
  const today = new Date().toISOString().split("T")[0];
  const scheduledDatesSet = useMemo(() => new Set(schedules.map(s => s.date)), [schedules]);

  const calendarDays = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (null | string)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(ds);
    }
    return cells;
  }, [calMonth]);

  /* ── Toggle session ───────────────────────────────────────────── */
  const toggleSession = (s: string) => setSelectedSessions(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  /* ── Save schedule ──────────────────────────────────────────── */
  const handleSave = async () => {
    if (!selectedDocId || !schedDate || selectedSessions.length === 0) return;
    setSaving(true); setErrMsg(""); setMsg("");
    try {
      const res = await fetch("/api/admin/doctor-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: String(selectedDocId), date: schedDate, slots: selectedSessions, clinic_id: schedClinicId, max_seats: maxSeats }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setMsg(`Saved ${selectedSessions.length} session(s) for ${fmtDate(schedDate)}`);
      setSelectedSessions([]);
      fetchSchedules();
      setTimeout(() => setMsg(""), 4000);
    } catch (e: any) { setErrMsg(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  /* ── Delete schedule ────────────────────────────────────────── */
  const handleDelete = async (id: number) => {
    try {
      await fetch("/api/admin/doctor-schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(id) }),
      });
      fetchSchedules();
    } catch (e) { console.error(e); }
  };

  /* ── Status cycle ───────────────────────────────────────────── */
  const handleCycleStatus = async (s: ScheduleRow) => {
    const idx = STATUS_CYCLE.indexOf(s.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    try {
      await fetch("/api/admin/doctor-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(s.id), status: next }),
      });
      setSchedules(prev => prev.map(r => r.id === s.id ? { ...r, status: next } : r));
    } catch (e) { console.error(e); }
  };

  const selectedDoctor = doctors.find(d => d.id === selectedDocId);
  const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

  /* ── Existing sessions for selected date ──────────────────────── */
  const existingForDate = useMemo(() => schedules.filter(s => s.date === schedDate).map(s => s.slot), [schedules, schedDate]);

  /* ── Group schedules by date ────────────────────────────────── */
  const groupedSchedules = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    schedules.forEach(s => { const arr = map.get(s.date) || []; arr.push(s); map.set(s.date, arr); });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [schedules]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader className="h-8 w-8 animate-spin text-cyan-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><CalendarClock className="h-8 w-8 text-cyan-600" /> Doctor Schedule</h1>
        <p className="text-muted-foreground mt-1">Manage schedules for your assigned doctors</p>
      </div>

      {/* Doctor selector */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide">Doctor</label>
            <Select value={selectedDocId ? String(selectedDocId) : ""} onValueChange={v => { setSelectedDocId(Number(v)); setSelectedSessions([]); }}>
              <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant={tab === "add" ? "default" : "outline"} onClick={() => setTab("add")}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            <Button variant={tab === "view" ? "default" : "outline"} onClick={() => setTab("view")}>View All</Button>
          </div>
        </div>
      </Card>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2"><Check className="h-4 w-4" /> {msg}</div>}
      {errMsg && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {errMsg}</div>}

      {!selectedDocId ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Select a doctor to manage their schedule</CardContent></Card>
      ) : tab === "add" ? (
        /* ── Add Schedule Tab ──────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Select Date</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm font-medium w-32 text-center">{calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="font-semibold text-muted-foreground py-1">{d}</div>)}
                {calendarDays.map((ds, i) => {
                  if (!ds) return <div key={`e${i}`} />;
                  const isPast = ds < today;
                  const isSelected = ds === schedDate;
                  const hasSchedule = scheduledDatesSet.has(ds);
                  return (
                    <button key={ds} disabled={isPast} onClick={() => { setSchedDate(ds); setSelectedSessions([]); }}
                      className={`py-1.5 rounded-lg text-xs relative transition ${isPast ? "text-gray-300 cursor-not-allowed" : isSelected ? "bg-cyan-600 text-white font-bold" : "hover:bg-cyan-50"}`}>
                      {parseInt(ds.split("-")[2])}
                      {hasSchedule && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-cyan-500" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader><CardTitle className="text-base">Select Sessions — {fmtDate(schedDate)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {SESSIONS.map(session => {
                  const exists = existingForDate.includes(session);
                  const selected = selectedSessions.includes(session);
                  return (
                    <button key={session} disabled={exists} onClick={() => toggleSession(session)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                        exists ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : selected ? "bg-cyan-50 text-cyan-700 border-cyan-500 shadow-sm"
                        : "border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50"
                      }`}>
                      <span className="text-2xl">{SESSION_EMOJI[session]}</span>
                      <div className="text-left">
                        <p className="font-semibold text-sm">{session}</p>
                        <p className="text-xs text-muted-foreground">{exists ? "Already set ✓" : selected ? "Selected" : "Available"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Max Seats */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">Max Seats per Session</label>
                <Input type="number" min={1} max={500} value={maxSeats}
                  onChange={e => setMaxSeats(Math.max(1, parseInt(e.target.value) || 30))}
                  className="w-32" />
                <p className="text-xs text-muted-foreground">Maximum appointments allowed per session</p>
              </div>

              {/* Clinic picker */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">Clinic (optional)</label>
                <Select value={schedClinicId ? String(schedClinicId) : "none"} onValueChange={v => setSchedClinicId(v === "none" ? null : Number(v))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clinics.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSave} disabled={saving || selectedSessions.length === 0} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
                {saving ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : <><Plus className="h-4 w-4" /> Save {selectedSessions.length} Session(s)</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── View All Tab ──────────────────────────────────────── */
        <div className="space-y-4">
          {/* Summary bar */}
          <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-6 w-6 text-cyan-600" />
                <div>
                  <h2 className="font-bold text-lg text-cyan-900">Upcoming Schedules</h2>
                  <p className="text-sm text-cyan-700">{selectedDoctor?.name}</p>
                </div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-cyan-700">{groupedSchedules.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-cyan-600 font-medium">Days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-700">{schedules.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-cyan-600 font-medium">Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingSched ? (
            <div className="flex items-center justify-center py-12"><Loader className="h-6 w-6 animate-spin text-cyan-600" /></div>
          ) : groupedSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CalendarClock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No upcoming schedules</p>
                <p className="text-xs text-muted-foreground mt-1">Switch to &ldquo;Add&rdquo; tab to create new sessions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedSchedules.map(([date, rows]) => {
                const dateObj = new Date(date + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "long" });
                const fullDate = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
                const isToday = date === new Date().toISOString().split("T")[0];

                return (
                  <Card key={date} className={`overflow-hidden ${isToday ? "ring-2 ring-cyan-400 shadow-lg" : ""}`}>
                    {/* Date header */}
                    <div className={`px-5 py-3 flex items-center justify-between ${isToday ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white" : "bg-gray-50 border-b"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${isToday ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700"}`}>
                          {parseInt(date.split("-")[2])}
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isToday ? "text-white" : "text-gray-900"}`}>{dayName}</p>
                          <p className={`text-xs ${isToday ? "text-cyan-100" : "text-muted-foreground"}`}>{fullDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isToday && <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Today</span>}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isToday ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700"}`}>
                          {rows.length} session{rows.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {/* Sessions grid */}
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {rows.map(r => (
                          <div key={r.id} className="group relative flex items-center gap-3 p-3 rounded-xl border bg-white hover:shadow-md transition-all duration-200">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl">
                              {SESSION_EMOJI[r.slot] || "📅"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900">{r.slot}</p>
                              {r.clinic_id && <p className="text-xs text-muted-foreground truncate">{clinicMap.get(r.clinic_id)}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleCycleStatus(r)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${statusColor[r.status] || "bg-gray-100"}`}>
                                {r.status}
                              </button>
                              <button onClick={() => handleDelete(r.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
