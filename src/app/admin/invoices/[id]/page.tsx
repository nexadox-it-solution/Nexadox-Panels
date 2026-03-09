"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Loader } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useRef, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      console.error("Error fetching invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-12 flex flex-col items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
          <p className="mt-2">Loading invoice...</p>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Card className="p-12 text-center text-muted-foreground">
          Invoice not found
        </Card>
      </div>
    );
  }

  const invoiceData = {
    invoiceNumber: invoice.invoice_number,
    date: invoice.invoice_date,
    company: {
      name: "Nexadox Healthcare Solutions",
      email: "billing@nexadox.com",
      gstin: "19AAXFN9593Q1ZK",
      state: "19-West Bengal",
    },
    billTo: {
      name: invoice.user_name,
      email: invoice.user_email,
      userId: invoice.user_id,
    },
    items: [
      {
        id: 1,
        description: "Appointment Booking Charges",
        hsn: "998554",
        qty: 1,
        price: invoice.taxable_amount,
        gst: invoice.gst,
        amount: invoice.total_amount,
      },
    ],
    totals: {
      subTotal: invoice.taxable_amount,
      gst: invoice.gst,
      total: invoice.total_amount,
    },
    amountInWords: "One Thousand Two Hundred Rupees Only", // TODO: Calculate dynamically
  };

  const handleDownloadPDF = () => {
    if (!invoiceRef.current) return;

    const element = invoiceRef.current;
    const opt = {
      margin: 10,
      filename: `${invoiceData.invoiceNumber}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait" as const, unit: "mm" as const, format: "a4" as const },
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Invoice</h1>
            <p className="text-muted-foreground mt-1">Specific invoice data</p>
          </div>
        </div>
        <Button className="gap-2" onClick={handleDownloadPDF}>
          <Download className="h-4 w-4" />
          DOWNLOAD
        </Button>
      </div>

      {/* Invoice Content */}
      <Card className="p-8" ref={invoiceRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Header */}
          <div className="border-b pb-6">
            <h2 className="text-2xl font-bold">Nexadox IT Solutions</h2>
            <p className="text-sm text-gray-600">Email: {invoiceData.company.email}</p>
            <p className="text-sm text-gray-600">GSTIN: {invoiceData.company.gstin}</p>
            <p className="text-sm text-gray-600">State: {invoiceData.company.state}</p>
          </div>

          {/* Invoice Title and Details */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-blue-600">TAX INVOICE</h3>
            </div>
            <div className="text-right">
              <p className="text-sm"><strong>Invoice Number:</strong> {invoiceData.invoiceNumber}</p>
              <p className="text-sm"><strong>Date:</strong> {invoiceData.date}</p>
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold mb-2">Bill to</h4>
              <p className="font-bold text-lg">{invoiceData.billTo.name}</p>
              <p className="text-sm text-gray-600">Email: {invoiceData.billTo.email}</p>
              <p className="text-sm text-gray-600">User ID: {invoiceData.billTo.userId}</p>
            </div>
            <div></div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-2 text-left border">#</th>
                  <th className="p-2 text-left border">ITEM</th>
                  <th className="p-2 text-left border">HSN/SAC</th>
                  <th className="p-2 text-center border">QTY</th>
                  <th className="p-2 text-right border">PRICE</th>
                  <th className="p-2 text-right border">GST (18%)</th>
                  <th className="p-2 text-right border">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item) => (
                  <tr key={item.id} className="border">
                    <td className="p-2 border">{item.id}</td>
                    <td className="p-2 border">{item.description}</td>
                    <td className="p-2 border">{item.hsn}</td>
                    <td className="p-2 border text-center">{item.qty}</td>
                    <td className="p-2 border text-right">{item.price}</td>
                    <td className="p-2 border text-right">{item.gst}</td>
                    <td className="p-2 border text-right">{item.amount}</td>
                  </tr>
                ))}
                <tr className="border">
                  <td colSpan={5} className="p-2 border text-right font-bold">
                    Total
                  </td>
                  <td className="p-2 border text-right font-bold">1</td>
                  <td className="p-2 border text-right font-bold">{invoiceData.totals.total}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-bold mb-2">Amount in words</p>
              <p>{invoiceData.amountInWords}</p>
            </div>
            <div className="text-right space-y-2">
              <div className="flex justify-between gap-4">
                <span>SUB TOTAL</span>
                <span className="font-bold">{invoiceData.totals.subTotal}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>GST (18%)</span>
                <span className="font-bold">{invoiceData.totals.gst}</span>
              </div>
              <div className="border-t pt-2 flex justify-between gap-4">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold">{invoiceData.totals.total}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
