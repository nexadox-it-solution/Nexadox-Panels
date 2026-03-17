"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, Search, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Invoice {
  id: number;
  txn_id: string;
  booking_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  total_amount: string;
  taxable_amount: string;
  gst: string;
  invoice_number: string;
  invoice_date: string;
  appointment_id: number | null;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [user, setUser] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesId = invoice.txn_id.toLowerCase().includes(searchId.toLowerCase()) ||
                      invoice.booking_id.toLowerCase().includes(searchId.toLowerCase());
    const matchesUser = invoice.user_name.toLowerCase().includes(user.toLowerCase());
    
    let matchesDate = true;
    if (dateStart && dateEnd) {
      const invoiceDate = new Date(invoice.invoice_date);
      const start = new Date(dateStart);
      const end = new Date(dateEnd);
      matchesDate = invoiceDate >= start && invoiceDate <= end;
    }

    return matchesId && matchesUser && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Showing 1 to {filteredInvoices.length} | Total {invoices.length} records
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Transaction ID</label>
            <Input
              placeholder="Enter ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Start</label>
            <Input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date End</label>
            <Input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">User</label>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="newagent">NEW AGENT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="bg-brand-600 hover:bg-brand-700">SEARCH</Button>
          <Button variant="secondary" onClick={() => {
            setSearchId("");
            setDateStart("");
            setDateEnd("");
            setUser("");
          }}>RESET</Button>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-12 flex flex-col items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
          <p className="mt-2">Loading invoices...</p>
        </Card>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100 dark:bg-gray-800">
                <th className="text-left p-3 font-semibold text-sm">TXNID</th>
                <th className="text-left p-3 font-semibold text-sm">BOOKINGID</th>
                <th className="text-left p-3 font-semibold text-sm">USERID</th>
                <th className="text-left p-3 font-semibold text-sm">USER NAME</th>
                <th className="text-left p-3 font-semibold text-sm">USER EMAIL</th>
                <th className="text-left p-3 font-semibold text-sm">TOTAL AMOUNT</th>
                <th className="text-left p-3 font-semibold text-sm">TAXABLE AMOUNT</th>
                <th className="text-left p-3 font-semibold text-sm">GST</th>
                <th className="text-left p-3 font-semibold text-sm">INVOICE #</th>
                <th className="text-left p-3 font-semibold text-sm">DATE</th>
                <th className="text-left p-3 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-3 text-center text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-3 text-sm">{invoice.txn_id}</td>
                    <td className="p-3 text-sm">NXD{String(invoice.appointment_id || 0).padStart(8, '0')}</td>
                    <td className="p-3 text-sm">{invoice.user_id}</td>
                    <td className="p-3 text-sm font-medium">{invoice.user_name}</td>
                    <td className="p-3 text-sm">{invoice.user_email}</td>
                    <td className="p-3 text-sm font-medium">{invoice.total_amount}</td>
                    <td className="p-3 text-sm">{invoice.taxable_amount}</td>
                    <td className="p-3 text-sm">{invoice.gst}</td>
                    <td className="p-3 text-sm">INV{String(invoice.id).padStart(8, '0')}</td>
                    <td className="p-3 text-sm">{invoice.invoice_date}</td>
                    <td className="p-3 text-sm">
                      <Link href={`/admin/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
