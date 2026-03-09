"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar, Search, Clock, CheckCircle, AlertCircle, XCircle,
  Eye, FileText, Phone, Mail, X, Loader,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Appointment {
  id: number;
  appointment_id: string;
  token_number: number | null;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  appointment_date: string;
  appointment_time: string | null;
  slot: string | null;
  status: string;
  consultation_type: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  booking_amount: number | null;
  checkin_status: string | null;
}

export default function AppointmentsPage() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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

        const { data } = await supabase
          .from("appointments")
          .select("*")
          .eq("doctor_id", doc.id)
          .order("appointment_date", { ascending: false })
          .order("token_number", { ascending: true });

        setAppointments((data || []) as Appointment[]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(apt.token_number || "").includes(searchQuery);
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    const matchesDate = !selectedDate || apt.appointment_date === selectedDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter(a => a.appointment_date === todayStr);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock className="h-3 w-3" />In Progress</span>;
      case "waiting":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3" />Waiting</span>;
      case "scheduled": case "confirmed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><Calendar className="h-3 w-3" />{status === "confirmed" ? "Confirmed" : "Scheduled"}</span>;
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Completed</span>;
      case "cancelled":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="h-3 w-3" />Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Appointments</h1>
        <p className="text-muted-foreground mt-1">Manage your appointment schedule</p>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Today</p><p className="text-3xl font-bold mt-2">{todayAppointments.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-3xl font-bold mt-2 text-green-600">{todayAppointments.filter(a => a.status === "completed").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">In Progress</p><p className="text-3xl font-bold mt-2 text-blue-600">{todayAppointments.filter(a => a.status === "in_progress").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total All Time</p><p className="text-3xl font-bold mt-2 text-purple-600">{appointments.length}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by patient or token..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="waiting">Waiting</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
          <CardDescription>Showing {filteredAppointments.length} appointments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Token</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Slot</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Symptoms</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appointment) => (
                  <tr key={appointment.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-4"><span className="font-mono font-semibold text-primary">#{appointment.token_number || "—"}</span></td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{appointment.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{appointment.patient_phone || ""}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="py-3 px-4 text-sm">{appointment.slot || appointment.appointment_time || "—"}</td>
                    <td className="py-3 px-4 text-sm max-w-xs truncate">{appointment.symptoms || "—"}</td>
                    <td className="py-3 px-4">{getStatusBadge(appointment.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(appointment)}><Eye className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredAppointments.length === 0 && (
            <div className="text-center py-12"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No appointments found</p></div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAppointment(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Appointment Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(null)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary text-white rounded-lg p-4 text-center">
                <p className="text-sm opacity-90">Token Number</p>
                <p className="text-4xl font-bold mt-2">#{selectedAppointment.token_number || "—"}</p>
                <div className="mt-3">{getStatusBadge(selectedAppointment.status)}</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Patient Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><span className="font-medium">Name:</span><span>{selectedAppointment.patient_name}</span></div>
                  {selectedAppointment.patient_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedAppointment.patient_phone}</span></div>}
                  {selectedAppointment.patient_email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selectedAppointment.patient_email}</span></div>}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Appointment Details</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{selectedAppointment.appointment_date ? new Date(selectedAppointment.appointment_date).toLocaleDateString("en-IN") : "—"}</span>
                  <span className="text-muted-foreground">Slot:</span>
                  <span className="font-medium">{selectedAppointment.slot || selectedAppointment.appointment_time || "—"}</span>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{selectedAppointment.consultation_type || "—"}</span>
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">₹{Number(selectedAppointment.booking_amount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {selectedAppointment.symptoms && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Symptoms</h3>
                  <p className="text-sm">{selectedAppointment.symptoms}</p>
                </div>
              )}

              {selectedAppointment.diagnosis && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Diagnosis</h3>
                  <p className="text-sm">{selectedAppointment.diagnosis}</p>
                </div>
              )}

              {selectedAppointment.prescription && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Prescription</h3>
                  <p className="text-sm">{selectedAppointment.prescription}</p>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
