"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Eye, Calendar, ChevronLeft, ChevronRight, X, Loader,
  FileText, IndianRupee, Printer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveAgent } from "@/lib/resolveRole";

/* ─── Types ─────────────────────────────────────────────────── */
interface Appointment {
  id: number; appointment_id: string; patient_name: string; patient_email: string | null;
  patient_phone: string | null; doctor_id: number | null; clinic_id: number | null;
  appointment_date: string; appointment_time: string | null; slot: string | null;
  status: string; source_role: string | null; booking_amount: number | null;
  commission_amount: number | null; payable_amount: number | null;
  voucher_id: number | null; notes: string | null; created_at: string;
}
interface VoucherView {
  id: number; voucher_number: string; patient_name: string; doctor_name: string;
  clinic_name: string; appointment_date: string; appointment_slot: string;
  booking_amount: number | null; commission_amount: number | null;
  total_payable: number | null; status: string;
}

const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
const fmtMoney = (n: number | null | undefined) => n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const numberToWords = (num: number): string => {
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " and " + convert(n%100) : "");
    if (n < 100000) return convert(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + convert(n%1000) : "");
    if (n < 10000000) return convert(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + convert(n%100000) : "");
    return convert(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + convert(n%10000000) : "");
  };
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let words = convert(intPart);
  if (decPart > 0) words += " and " + convert(decPart) + " Paise";
  return words;
};

export default function BookingsPage() {
  const [bookings, setBookings]   = useState<Appointment[]>([]);
  const [doctors, setDoctors]     = useState<Map<number, string>>(new Map());
  const [clinicNames, setClinicNames] = useState<Map<number, string>>(new Map());
  const [loading, setLoading]     = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter]   = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null);
  const [viewVoucher, setViewVoucher]         = useState<VoucherView | null>(null);

  /* ── Fetch agent's own bookings ─────────────────────────── */
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let agentUserId: number | null = null;
      if (user) {
        const ag = await resolveAgent(user.id);
        if (ag) agentUserId = ag.user_id || ag.id;
      }

      // Only show agent's own appointments
      let q = supabase.from("appointments").select("*").eq("source_role", "Agent").order("created_at", { ascending: false });
      if (agentUserId) q = q.eq("created_by_agent_id", agentUserId);

      const [aptRes, docRes, clinicRes] = await Promise.all([
        q,
        supabase.from("doctors").select("id, name"),
        supabase.from("clinics").select("id, name"),
      ]);

      setBookings((aptRes.data || []) as Appointment[]);
      setDoctors(new Map((docRes.data || []).map((d: any) => [d.id, d.name])));
      setClinicNames(new Map((clinicRes.data || []).map((c: any) => [c.id, c.name])));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  /* ── Filtering ──────────────────────────────────────────── */
  const filtered = bookings.filter(b => {
    const sq = searchQuery.toLowerCase();
    return (!sq || b.patient_name?.toLowerCase().includes(sq) || b.appointment_id?.toLowerCase().includes(sq))
      && (statusFilter === "all" || b.status === statusFilter)
      && (!dateFilter || b.appointment_date === dateFilter);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalCommission = bookings.reduce((s, b) => s + (b.commission_amount || 0), 0);

  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700", waiting: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-purple-100 text-purple-700",
  };

  /* ── Voucher viewer ─────────────────────────────────────── */
  const openVoucher = async (apt: Appointment) => {
    if (!apt.voucher_id) return;
    const { data } = await supabase.from("vouchers").select("*").eq("id", apt.voucher_id).single();
    if (data) setViewVoucher(data as VoucherView);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8 text-orange-500" /> My Bookings
        </h1>
        <p className="text-muted-foreground mt-1">Appointments you have booked as an agent</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold mt-2">{bookings.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-3xl font-bold mt-2 text-green-600">{bookings.filter(b => b.status === "completed").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Scheduled</p><p className="text-3xl font-bold mt-2 text-blue-600">{bookings.filter(b => b.status === "scheduled").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Commission</p><p className="text-3xl font-bold mt-2 text-green-600">{fmtMoney(totalCommission)}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search patient or booking ID…" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-9" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }} />
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader className="h-8 w-8 animate-spin text-orange-500" /></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Bookings ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No bookings found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {["Booking ID", "Patient", "Doctor", "Date", "Slot", "Fee", "Commission", "Status", ""].map(h => (
                      <th key={h} className="py-3 px-3 text-xs font-semibold text-muted-foreground uppercase text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(b => (
                    <tr key={b.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-xs text-orange-600 font-semibold">{b.appointment_id}</td>
                      <td className="py-3 px-3">
                        <p className="font-medium">{b.patient_name}</p>
                        {b.patient_phone && <p className="text-xs text-muted-foreground">{b.patient_phone}</p>}
                      </td>
                      <td className="py-3 px-3 text-xs">{doctors.get(b.doctor_id!) || "—"}</td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">{b.appointment_date ? fmtDate(b.appointment_date) : "—"}</td>
                      <td className="py-3 px-3 text-xs font-mono">{b.slot || "—"}</td>
                      <td className="py-3 px-3 text-xs font-semibold">{fmtMoney(b.booking_amount)}</td>
                      <td className="py-3 px-3 text-xs font-semibold text-green-600">{fmtMoney(b.commission_amount)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[b.status] || "bg-gray-100"}`}>{b.status}</span>
                      </td>
                      <td className="py-3 px-3 flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedBooking(b)}><Eye className="h-3.5 w-3.5" /></Button>
                        {b.voucher_id && <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" onClick={() => openVoucher(b)}><FileText className="h-3.5 w-3.5" /></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedBooking(null)}>
          <Card className="max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Booking Details</CardTitle>
                <button onClick={() => setSelectedBooking(null)}><X className="h-5 w-5" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-500 text-white rounded-xl p-4 text-center">
                <p className="text-sm opacity-90">Booking ID</p>
                <p className="text-2xl font-bold mt-1 font-mono">{selectedBooking.appointment_id}</p>
                <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[selectedBooking.status] || "bg-gray-100"}`}>{selectedBooking.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-muted-foreground text-xs mb-1">Patient</p><p className="font-semibold">{selectedBooking.patient_name}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-muted-foreground text-xs mb-1">Doctor</p><p className="font-semibold">{doctors.get(selectedBooking.doctor_id!) || "—"}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-muted-foreground text-xs mb-1">Date</p><p className="font-semibold">{selectedBooking.appointment_date ? fmtDate(selectedBooking.appointment_date) : "—"}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-muted-foreground text-xs mb-1">Slot</p><p className="font-semibold font-mono">{selectedBooking.slot || "—"}</p></div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Booking Fee</span><span className="font-semibold">{fmtMoney(selectedBooking.booking_amount)}</span></div>
                <div className="flex justify-between text-green-600"><span>Your Commission</span><span className="font-semibold">{fmtMoney(selectedBooking.commission_amount)}</span></div>
                <hr />
                <div className="flex justify-between font-bold text-base"><span>Total Payable</span><span className="text-brand-700">{fmtMoney(selectedBooking.payable_amount)}</span></div>
              </div>
              <Button onClick={() => setSelectedBooking(null)} className="w-full">Close</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Voucher Modal - Professional Booking Slip */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center border-b-2 border-brand-600 p-5">
              <h1 className="text-xl font-bold text-brand-700">NEXADOX IT SOLUTIONS</h1>
              <p className="text-xs text-gray-500 mt-1">Address: Ramkrishna Pally, English Bazar, Malda, WB - 732101</p>
              <p className="text-xs text-gray-500">info@nexadox.com</p>
              <p className="text-xs text-gray-500">GSTIN: 19AAXFN9593Q1ZK</p>
            </div>

            {/* Title */}
            <div className="mx-5 mt-4 mb-3 text-center">
              <div className="inline-block px-6 py-1.5 bg-brand-50 border border-brand-300 rounded font-bold text-brand-800 tracking-wide">
                BOOKING SLIP
              </div>
            </div>

            {/* Patient & Booking Info */}
            <div className="px-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">UHID No.:</span><span className="text-gray-600">{viewVoucher.voucher_number}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Bill No.:</span><span className="text-gray-600">{viewVoucher.voucher_number}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Patient Name:</span><span className="text-gray-600">{viewVoucher.patient_name}</span></div>
              <div className="flex gap-2"><span className="font-semibold text-gray-700 min-w-[100px]">Bill Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
              <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-700 min-w-[100px]">Clinic:</span><span className="text-gray-600">{viewVoucher.clinic_name}</span></div>
            </div>

            {/* Appointment Details */}
            <div className="mx-5 mt-4">
              <div className="font-bold text-sm bg-brand-50 border-l-4 border-brand-600 px-3 py-1.5 mb-2">APPOINTMENT DETAILS</div>
              <div className="grid grid-cols-3 gap-x-4 text-sm px-1">
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Date:</span><span className="text-gray-600">{fmtDate(viewVoucher.appointment_date)}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Doctor:</span><span className="text-gray-600 truncate">{viewVoucher.doctor_name}</span></div>
                <div className="flex gap-2"><span className="font-semibold text-gray-700">Slot:</span><span className="text-gray-600">{viewVoucher.appointment_slot}</span></div>
              </div>
            </div>

            {/* Fee Table - Direct Price */}
            <div className="mx-5 mt-4">
              <table className="w-full text-sm border border-gray-200">
                <thead><tr className="bg-brand-50">
                  <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-200 px-3 py-2 text-right w-28">Amount</th>
                </tr></thead>
                <tbody>
                  <tr className="bg-gray-50 font-bold">
                    <td className="border border-gray-200 px-3 py-2">Total Amount</td>
                    <td className="border border-gray-200 px-3 py-2 text-right font-mono text-brand-700 text-base">{fmtMoney(viewVoucher.total_payable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Amount in Words */}
            <div className="mx-5 mt-2 text-xs italic text-gray-500">
              Amount Received in Words: <span className="font-medium text-gray-700">Rupees {numberToWords(Number(viewVoucher.total_payable || 0))} Only</span>
            </div>

            {/* Booked By & Signature */}
            <div className="mx-5 mt-6 flex justify-between text-sm pb-2">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Booked by: <span className="font-semibold">Agent</span></div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1 px-4 inline-block">Authorized Signature</div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mx-5 mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${viewVoucher.status === "active" ? "bg-green-100 text-green-700" : viewVoucher.status === "used" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{viewVoucher.status}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-5 border-t mt-4">
              <Button onClick={() => window.print()} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white gap-2"><Printer className="h-4 w-4" /> Print / Download</Button>
              <Button onClick={() => setViewVoucher(null)} variant="outline" className="flex-1">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
