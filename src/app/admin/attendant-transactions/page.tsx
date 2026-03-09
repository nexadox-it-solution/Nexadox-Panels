"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, Loader, XCircle, Clock, Search, RotateCcw, IndianRupee, ArrowUpRight, ArrowDownRight, Hash, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Txn { id: number; reason: string; status: string; txn_id: string; booking_id: string | null; user_id: string; user_name: string | null; user_email: string | null; amount: string; balance: string; started_on: string; created_at?: string; }

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };
const SC: Record<string, { icon: typeof Check; cls: string }> = {
  completed: { icon: Check, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  success:   { icon: Check, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  failed:    { icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
  pending:   { icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200" },
};

export default function AttendantTransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [status, setStatus] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { setLoading(true); const { data } = await supabase.from("attendant_transactions").select("*").order("created_at", { ascending: false }); setTxns(data || []); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filtered = txns.filter(t => {
    const q = search.toLowerCase();
    if (q && !(t.txn_id || "").toLowerCase().includes(q) && !(t.booking_id || "").toLowerCase().includes(q)) return false;
    if (status && t.status !== status) return false;
    if (userName && !(t.user_name || "").toLowerCase().includes(userName.toLowerCase())) return false;
    if (dateStart && dateEnd) { const d = new Date(t.started_on || t.created_at || ""); if (d < new Date(dateStart) || d > new Date(dateEnd)) return false; }
    return true;
  });

  const total = filtered.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const hasFilters = search || dateStart || dateEnd || status || userName;
  const reset = () => { setSearch(""); setDateStart(""); setDateEnd(""); setStatus(""); setUserName(""); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Attendant Transactions</h1><p className="text-sm text-muted-foreground">{filtered.length} of {txns.length} transactions</p></div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: txns.length, icon: Hash, bg: "bg-blue-100", fg: "text-blue-600" },
          { label: "Amount", value: inr(total), icon: IndianRupee, bg: "bg-emerald-100", fg: "text-emerald-600" },
          { label: "Completed", value: txns.filter(t => t.status === "completed" || t.status === "success").length, icon: Check, bg: "bg-green-100", fg: "text-green-600" },
          { label: "Pending", value: txns.filter(t => t.status === "pending").length, icon: Clock, bg: "bg-amber-100", fg: "text-amber-600" },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center`}><c.icon className={`h-4 w-4 ${c.fg}`} /></div>
            <div><p className="text-xs text-muted-foreground">{c.label}</p><p className="text-lg font-bold">{c.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Search</label><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Txn / Booking ID" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" /></div></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 text-sm" /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 text-sm" /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="success">Success</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">User</label><Input placeholder="Search by name" value={userName} onChange={e => setUserName(e.target.value)} className="h-9 text-sm" /></div>
        </div>
        {hasFilters && <Button variant="ghost" size="sm" className="mt-3 gap-1.5 text-xs" onClick={reset}><RotateCcw className="h-3 w-3" /> Clear Filters</Button>}
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center"><Loader className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-2 text-sm text-muted-foreground">Loading…</p></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b">
                {["Date","Txn ID","User","Reason","Status","Amount","Balance"].map(h => (
                  <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider ${h === "Amount" || h === "Balance" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground"><Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No transactions found</p></td></tr>
                ) : filtered.map(t => {
                  const sc = SC[t.status] || SC.pending; const Icon = sc.icon;
                  const isCredit = (t.reason || "").toLowerCase().match(/top|credit|add|razorpay/);
                  const amt = Math.abs(Number(t.amount) || 0);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3"><div className="font-medium">{fmtDate(t.started_on || "")}</div>{t.created_at && <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>}</td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t.txn_id || "—"}</span>{t.booking_id && <div className="text-xs text-muted-foreground mt-0.5">Booking: {t.booking_id}</div>}</td>
                      <td className="px-4 py-3"><div className="font-medium">{t.user_name || "—"}</div><div className="text-xs text-muted-foreground">{t.user_email || "—"}</div></td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[220px] truncate">{t.reason || "—"}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.cls}`}><Icon className="h-3 w-3" />{t.status}</span></td>
                      <td className="px-4 py-3 text-right"><span className={`inline-flex items-center gap-0.5 font-semibold ${isCredit ? "text-emerald-600" : "text-red-600"}`}>{isCredit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{inr(amt)}</span></td>
                      <td className="px-4 py-3 text-right font-medium">{t.balance != null ? inr(Number(t.balance)) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
