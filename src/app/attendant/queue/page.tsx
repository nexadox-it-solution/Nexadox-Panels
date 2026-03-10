"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock, Activity, Users, AlertCircle, RefreshCw, CheckCircle, Loader,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function getSupabase() {
  return createClient();
}

/* ─── Types ─────────────────────────────────────────────────── */
interface QueueItem {
  id: number;
  appointment_id: string;
  patient_name: string;
  patient_phone: string | null;
  patient_gender: string | null;
  patient_dob: string | null;
  doctor_id: number | null;
  token_number: number | null;
  checkin_status: string;
  checkin_time: string | null;
  completion_time: string | null;
  consultation_type: string | null;
  status: string;
}

const calcAge = (dob: string | null) => {
  if (!dob) return null;
  const b = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
};

const waitMins = (checkinTime: string | null) => {
  if (!checkinTime) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(checkinTime).getTime()) / 60000));
};

export default function QueueDisplayPage() {
  const [currentTime, setCurrentTime]   = useState(new Date());
  const [loading, setLoading]           = useState(true);
  const [queue, setQueue]               = useState<QueueItem[]>([]);
  const [completed, setCompleted]       = useState<QueueItem[]>([]);
  const [doctorMap, setDoctorMap]       = useState<Record<number, string>>({});

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Fetch queue data */
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      /* Checked-in (waiting) patients */
      const { data: waiting } = await getSupabase()
        .from("appointments")
        .select("*")
        .eq("appointment_date", today)
        .eq("checkin_status", "checked_in")
        .order("checkin_time", { ascending: true });

      /* Today's completed consultations */
      const { data: done } = await getSupabase()
        .from("appointments")
        .select("*")
        .eq("appointment_date", today)
        .eq("checkin_status", "completed")
        .order("completion_time", { ascending: false })
        .limit(10);

      const all = [...(waiting || []), ...(done || [])];
      setQueue((waiting || []) as QueueItem[]);
      setCompleted((done || []) as QueueItem[]);

      /* Fetch doctor names */
      const docIds = [...new Set(all.filter(a => a.doctor_id).map(a => a.doctor_id))];
      if (docIds.length) {
        const { data: docs } = await getSupabase().from("doctors").select("id, name").in("id", docIds);
        if (docs) {
          const m: Record<number, string> = {};
          docs.forEach(d => { m[d.id] = d.name; });
          setDoctorMap(m);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  /* Auto-refresh every 15s */
  useEffect(() => {
    const iv = setInterval(fetchQueue, 15000);
    return () => clearInterval(iv);
  }, [fetchQueue]);

  const avgWait = queue.length > 0
    ? Math.round(queue.reduce((s, q) => s + waitMins(q.checkin_time), 0) / queue.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Digital Clock Header */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-700 text-white border-0">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Current Time</p>
              <p className="text-4xl font-bold">{currentTime.toLocaleTimeString()}</p>
              <p className="text-sm opacity-90 mt-1">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={fetchQueue} className="text-white hover:bg-white/20">
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Clock className="h-16 w-16 opacity-80" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Queue</p>
                <p className="text-4xl font-bold mt-2">{queue.length}</p>
              </div>
              <Users className="h-10 w-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-4xl font-bold mt-2">{completed.length}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                <p className="text-4xl font-bold mt-2">{avgWait}m</p>
              </div>
              <Clock className="h-10 w-10 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Up - Large Display */}
      {queue.length > 0 ? (
        <Card className="border-4 border-blue-500">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-blue-600">NEXT IN QUEUE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8 text-center">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-blue-500 text-white mb-6">
                <span className="text-6xl font-bold">#{queue[0].token_number}</span>
              </div>
              <h2 className="text-3xl font-bold mb-2">{queue[0].patient_name}</h2>
              <p className="text-xl text-muted-foreground">
                {queue[0].doctor_id ? doctorMap[queue[0].doctor_id] || "Doctor" : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Waiting {waitMins(queue[0].checkin_time)} min • {queue[0].consultation_type || "General"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-4 border-gray-300">
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              {loading ? (
                <Loader className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-spin" />
              ) : (
                <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              )}
              <p className="text-2xl font-semibold text-gray-600">{loading ? "Loading queue…" : "No patients in queue"}</p>
              <p className="text-muted-foreground mt-2">{loading ? "" : "Waiting for check-ins"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting Queue Grid */}
      {queue.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">WAITING QUEUE ({queue.length - 1} more)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {queue.slice(1).map((patient, index) => {
                const wait = waitMins(patient.checkin_time);
                const age = calcAge(patient.patient_dob);
                return (
                  <div key={patient.id}
                    className={`border-2 rounded-lg p-4 hover:shadow-lg transition-shadow ${
                      wait > 30 ? "bg-red-50 border-red-200" : wait > 15 ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex items-center justify-center w-16 h-16 rounded-full text-white font-bold text-2xl flex-shrink-0 ${
                        wait > 30 ? "bg-red-500" : wait > 15 ? "bg-orange-500" : "bg-yellow-500"
                      }`}>
                        #{patient.token_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-medium">
                            Position {index + 2}
                          </span>
                          {patient.consultation_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {patient.consultation_type}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-lg truncate">{patient.patient_name}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        <span className="truncate">{patient.doctor_id ? doctorMap[patient.doctor_id] || "Doctor" : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-2 font-medium ${
                          wait > 30 ? "text-red-600" : wait > 15 ? "text-orange-600" : "text-yellow-600"
                        }`}>
                          <Clock className="h-4 w-4" />
                          <span>Waiting: {wait} min</span>
                        </div>
                        {age != null && <span className="text-xs text-muted-foreground">{age} yrs • {patient.patient_gender || "—"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Completed */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /> Recently Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {completed.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">#{c.token_number}</span>
                    <span className="font-medium">{c.patient_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.completion_time ? new Date(c.completion_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-refresh indicator */}
      <p className="text-center text-xs text-muted-foreground">Auto-refreshes every 15 seconds</p>
    </div>
  );
}
