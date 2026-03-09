"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, X, Loader, AlertCircle,
  Stethoscope, Users, UserCheck, DollarSign, Award, Calendar, CalendarDays,
  Eye, EyeOff, ImageIcon, Upload, Building2, Banknote, GraduationCap,
  FileText, Trophy, UserCircle, ChevronRight, ChevronLeft, LayoutGrid, List,
  Clock, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────── */
interface Specialty { id: number; name: string; }
interface Clinic { id: number; name: string; city: string | null; }
interface Degree { id: number; name: string; }

interface Doctor {
  id: string;
  auth_user_id: string | null;
  name: string; email: string; mobile: string | null;
  avatar_url: string | null; status: string; created_at: string;
  specialty_ids: number[]; clinic_ids: number[];
  degree_ids: number[];
  experience: number | null;
  appointment_fee: number | null; booking_fee: number | null;
  about: string | null; achievements: string[];
  is_accepting_patients: boolean;
}

type DrawerTab = "profile" | "practice" | "about" | "settings";

const TAB_LIST: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
  { key: "profile",  label: "Profile",  icon: <UserCircle className="h-4 w-4" /> },
  { key: "practice", label: "Practice", icon: <Stethoscope className="h-4 w-4" /> },
  { key: "about",    label: "About",    icon: <FileText className="h-4 w-4" /> },
  { key: "settings", label: "Settings", icon: <Award className="h-4 w-4" /> },
];

const EMPTY_FORM = {
  name: "", email: "", mobile: "", password: "", avatar: "",
  specialty_ids: [] as number[],
  clinic_ids: [] as number[],
  degree_ids: [] as number[],
  experience: "",
  appointment_fee: "", booking_fee: "",
  about: "",
  achievements: [] as string[],
  is_accepting_patients: true,
  status: "active" as "active" | "inactive",
};

/* ─── Page ───────────────────────────────────────────────────── */
export default function DoctorsPage() {
  const [doctors,     setDoctors]     = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [clinics,     setClinics]     = useState<Clinic[]>([]);
  const [degreesList, setDegreesList] = useState<Degree[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "accepting" | "not_accepting">("all");

  // Drawer
  const [isDrawerOpen,  setIsDrawerOpen]  = useState(false);
  const [drawerMode,    setDrawerMode]    = useState<"add" | "edit">("add");
  const [activeTab,     setActiveTab]     = useState<DrawerTab>("profile");
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [formData,      setFormData]      = useState(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [formError,     setFormError]     = useState("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tag inputs
  const [achievementInput, setAchievementInput] = useState("");
  const [clinicSearch,     setClinicSearch]     = useState("");
  const [specSearch,       setSpecSearch]       = useState("");
  const [degreeSearch,     setDegreeSearch]     = useState("");

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<Doctor | null>(null);
  const [successMsg,    setSuccessMsg]    = useState("");
  const [viewMode,      setViewMode]      = useState<"grid" | "list">("grid");

  // Schedule drawer
  const [scheduleDoctor,       setScheduleDoctor]       = useState<Doctor | null>(null);
  const [schedMonth,           setSchedMonth]           = useState(new Date());
  const [schedDate,            setSchedDate]            = useState<string>("");
  const [schedSlots,           setSchedSlots]           = useState<string[]>([]);
  const [schedClinicId,        setSchedClinicId]        = useState<number | null>(null);
  const [existingSchedules,    setExistingSchedules]    = useState<any[]>([]);
  const [allSchedules,         setAllSchedules]         = useState<any[]>([]);
  const [schedSubmitting,      setSchedSubmitting]      = useState(false);
  const [schedLoadingAll,      setSchedLoadingAll]      = useState(false);
  const [schedError,           setSchedError]           = useState("");
  const [schedSuccess,         setSchedSuccess]         = useState("");
  const [schedTab,             setSchedTab]             = useState<"add" | "view">("add");
  const [schedShowPast,        setSchedShowPast]        = useState(false);
  const [schedSlotFilter,      setSchedSlotFilter]      = useState("all");
  const [schedDeleteConfirmId, setSchedDeleteConfirmId] = useState<string | null>(null);
  const [schedStatusUpdating,  setSchedStatusUpdating]  = useState<string | null>(null);
  const [schedWarning,         setSchedWarning]         = useState("");
  const [schedMaxSeats,        setSchedMaxSeats]        = useState(30);

  /* ── fetch ── */
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [docRes, specRes, clinicRes, degRes] = await Promise.all([
        supabase
          .from("doctors")
          .select(`
            id, auth_user_id, name, email, mobile, avatar_url, status,
            specialty_ids, clinic_ids, degree_ids, experience,
            appointment_fee, booking_fee, about, achievements, is_accepting_patients, created_at
          `)
          .order("created_at", { ascending: false }),
        supabase.from("specialties").select("id, name").order("name"),
        supabase.from("clinics").select("id, name, city").eq("status", "active").order("name"),
        supabase.from("degrees").select("id, name").eq("status", "active").order("name"),
      ]);
      if (docRes.data)    setDoctors(docRes.data as unknown as Doctor[]);
      if (specRes.data)   setSpecialties(specRes.data as Specialty[]);
      if (clinicRes.data) setClinics(clinicRes.data as Clinic[]);
      if (degRes.data)    setDegreesList(degRes.data as Degree[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  /* ── Schedule helpers ── */
  const SESSIONS = ["Morning", "Afternoon", "Evening", "Night"] as const;
  const SESSION_EMOJI: Record<string, string> = { Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙" };

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    available:  { label: "Available",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    booked:     { label: "Booked",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    cancelled:  { label: "Cancelled",  color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  };
  const STATUS_CYCLE: Record<string, string> = { available: "booked", booked: "cancelled", cancelled: "available" };

  const openSchedule = (doc: Doctor) => {
    setScheduleDoctor(doc);
    setSchedTab("add");
    setSchedMonth(new Date());
    setSchedDate("");
    setSchedSlots([]);
    setSchedClinicId(doc.clinic_ids?.[0] ?? null);
    setSchedError("");
    setSchedSuccess("");
    setSchedWarning("");
    setSchedShowPast(false);
    setSchedSlotFilter("all");
    setSchedDeleteConfirmId(null);
    setSchedMaxSeats(30);
    fetchExistingSchedules(doc.id);
    fetchAllSchedules(doc.id);
  };

  const fetchExistingSchedules = async (doctorId: string) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${doctorId}&date_from=${todayStr}`);
      const json = await res.json();
      if (res.ok) {
        setExistingSchedules(json.data || []);
      } else {
        const msg = json.error ?? "";
        if (msg.includes("doctor_schedules") || msg.includes("relation") || msg.includes("does not exist")) {
          setSchedWarning("TABLE_MISSING");
        }
        setExistingSchedules([]);
      }
    } catch {
      setExistingSchedules([]);
    }
  };

  const fetchAllSchedules = async (doctorId: string) => {
    setSchedLoadingAll(true);
    try {
      const res = await fetch(`/api/admin/doctor-schedule?doctor_id=${doctorId}`);
      const json = await res.json();
      if (res.ok) {
        setAllSchedules(json.data || []);
      } else {
        const msg = json.error ?? "";
        if (msg.includes("doctor_schedules") || msg.includes("relation") || msg.includes("does not exist")) {
          setSchedWarning("TABLE_MISSING");
        }
        setAllSchedules([]);
      }
    } catch {
      setAllSchedules([]);
    }
    setSchedLoadingAll(false);
  };

  const toggleSchedSlot = (slot: string) =>
    setSchedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );

  const handleSaveSchedule = async () => {
    if (!scheduleDoctor) return;
    if (!schedDate)              { setSchedError("Please select a date."); return; }
    if (schedSlots.length === 0) { setSchedError("Please select at least one session."); return; }
    setSchedSubmitting(true);
    setSchedError("");
    try {
      const res = await fetch("/api/admin/doctor-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: scheduleDoctor.id,
          date: schedDate,
          slots: schedSlots,
          clinic_id: schedClinicId,
          max_seats: schedMaxSeats,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const errMsg: string = json.error || "Failed to save.";
        if (errMsg.includes("doctor_schedules") || errMsg.includes("relation") || errMsg.includes("does not exist")) {
          setSchedWarning("TABLE_MISSING");
          setSchedError("Table not found. Run the SQL migration below first.");
        } else {
          setSchedError(errMsg);
        }
        return;
      }
      const savedCount = schedSlots.length;
      if (json.warning) setSchedWarning(json.warning);
      setSchedSuccess(`${savedCount} session${savedCount > 1 ? "s" : ""} saved successfully!`);
      setSchedDate("");
      setSchedSlots([]);
      fetchExistingSchedules(scheduleDoctor.id);
      fetchAllSchedules(scheduleDoctor.id);
      setTimeout(() => setSchedSuccess(""), 4000);
    } catch (err: any) {
      setSchedError(err.message || "Failed to save schedule.");
    } finally {
      setSchedSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    setSchedDeleteConfirmId(null);
    const res = await fetch("/api/admin/doctor-schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok && scheduleDoctor) {
      fetchExistingSchedules(scheduleDoctor.id);
      fetchAllSchedules(scheduleDoctor.id);
    }
  };

  const handleUpdateScheduleStatus = async (id: string, newStatus: string) => {
    setSchedStatusUpdating(id);
    const res = await fetch("/api/admin/doctor-schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (res.ok) {
      setAllSchedules((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
      setExistingSchedules((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
    }
    setSchedStatusUpdating(null);
  };

  /* ── Calendar builder ── */
  const buildCalendarDays = (month: Date) => {
    const year = month.getFullYear();
    const mon  = month.getMonth();
    const firstDay = new Date(year, mon, 1).getDay();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return { cells, year, mon };
  };

  const formatSchedDate = (year: number, mon: number, day: number) => {
    const m = String(mon + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const scheduledDatesSet = new Set(existingSchedules.map((s) => s.date));

  const isValidImage = (v: string) => v.startsWith("data:image") || v.startsWith("http");

  const handleAvatarUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { setFormError("Please upload an image file."); return; }
    if (file.size > 3 * 1024 * 1024)    { setFormError("Image must be under 3 MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => setFormData((p) => ({ ...p, avatar: reader.result as string }));
    reader.readAsDataURL(file);
  };

  /* ── pill toggle helpers ── */
  const toggleSpecialty = (id: number) =>
    setFormData((p) => ({
      ...p,
      specialty_ids: p.specialty_ids.includes(id)
        ? p.specialty_ids.filter((s) => s !== id)
        : [...p.specialty_ids, id],
    }));

  const toggleClinic = (id: number) =>
    setFormData((p) => ({
      ...p,
      clinic_ids: p.clinic_ids.includes(id)
        ? p.clinic_ids.filter((c) => c !== id)
        : [...p.clinic_ids, id],
    }));

  const toggleDegree = (id: number) =>
    setFormData((p) => ({
      ...p,
      degree_ids: p.degree_ids.includes(id)
        ? p.degree_ids.filter((d) => d !== id)
        : [...p.degree_ids, id],
    }));

  const addAchievement = () => {
    const val = achievementInput.trim();
    if (!val) return;
    setFormData((p) => ({ ...p, achievements: [...p.achievements, val] }));
    setAchievementInput("");
  };

  const removeAchievement = (i: number) =>
    setFormData((p) => ({ ...p, achievements: p.achievements.filter((_, idx) => idx !== i) }));

  /* ── lookups ── */
  const getSpecialtyNames = (ids: number[]) =>
    specialties.filter((s) => ids?.includes(s.id)).map((s) => s.name);
  const getClinicNames = (ids: number[]) =>
    clinics.filter((c) => ids?.includes(c.id)).map((c) => c.name);
  const getDegreeNames = (ids: number[]) =>
    degreesList.filter((d) => ids?.includes(d.id)).map((d) => d.name);

  /* ── filtered list ── */
  const filtered = doctors.filter((d) => {
    const q = searchQuery.toLowerCase();
    const specNames = getSpecialtyNames(d.specialty_ids || []).join(" ").toLowerCase();
    const matchSearch =
      d.name?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      specNames.includes(q);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "accepting"     && d.is_accepting_patients) ||
      (statusFilter === "not_accepting" && !d.is_accepting_patients);
    return matchSearch && matchStatus;
  });

  const accepting = doctors.filter((d) => d.is_accepting_patients).length;

  /* ── open drawer ── */
  const openAdd = () => {
    setDrawerMode("add"); setEditingDoctor(null);
    setFormData(EMPTY_FORM); setFormError(""); setShowPassword(false);
    setActiveTab("profile"); setAchievementInput("");
    setClinicSearch(""); setSpecSearch(""); setDegreeSearch("");
    setIsDrawerOpen(true);
  };

  const openEdit = (doc: Doctor) => {
    setDrawerMode("edit"); setEditingDoctor(doc);
    setFormData({
      name:     doc.name   || "",
      email:    doc.email  || "",
      mobile:   doc.mobile || "",
      password: "",
      avatar:   isValidImage(doc.avatar_url || "") ? doc.avatar_url! : "",
      specialty_ids:   (doc.specialty_ids  || []) as number[],
      clinic_ids:      (doc.clinic_ids     || []) as number[],
      degree_ids:      (doc.degree_ids     || []) as number[],
      experience:      doc.experience?.toString() || "",
      appointment_fee: doc.appointment_fee?.toString() || "",
      booking_fee:     doc.booking_fee?.toString()     || "",
      about:           doc.about || "",
      achievements:    doc.achievements || [],
      is_accepting_patients: doc.is_accepting_patients,
      status: doc.status === "active" ? "active" : "inactive",
    });
    setFormError(""); setShowPassword(false);
    setActiveTab("profile"); setAchievementInput("");
    setClinicSearch(""); setSpecSearch(""); setDegreeSearch("");
    setIsDrawerOpen(true);
  };

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!formData.name.trim())  { setFormError("Full name is required."); setActiveTab("profile"); return; }
    if (!formData.email.trim()) { setFormError("Email is required."); setActiveTab("profile"); return; }
    if (drawerMode === "add" && !formData.password) { setFormError("Password is required."); setActiveTab("profile"); return; }

    setIsSubmitting(true); setFormError("");

    try {
      const doctorPayload = {
        specialty_ids:   formData.specialty_ids,
        clinic_ids:      formData.clinic_ids,
        degree_ids:      formData.degree_ids,
        experience:      formData.experience ? parseInt(formData.experience) : null,
        appointment_fee: formData.appointment_fee ? parseFloat(formData.appointment_fee) : null,
        booking_fee:     formData.booking_fee     ? parseFloat(formData.booking_fee)     : null,
        about:           formData.about || null,
        achievements:    formData.achievements,
        is_accepting_patients: formData.is_accepting_patients,
      };

      if (drawerMode === "add") {
        const res = await fetch("/api/admin/create-doctor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:    formData.name.trim(),
            email:   formData.email.trim(),
            mobile:  formData.mobile || null,
            password: formData.password,
            avatar:  formData.avatar || null,
            status:  formData.status,
            doctorPayload,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to add doctor.");
        setDoctors((prev) => [json.doctor as unknown as Doctor, ...prev]);
        showSuccess(`Dr. ${formData.name} added.`);

      } else if (editingDoctor) {
        const updatePayload = {
          name: formData.name.trim(),
          mobile: formData.mobile || null,
          avatar_url: formData.avatar || null,
          status: formData.status,
          ...doctorPayload,
        };
        const { error: docErr } = await supabase.from("doctors")
          .update(updatePayload).eq("id", editingDoctor.id);
        if (docErr) throw docErr;

        // Sync identity to profiles if auth_user_id exists
        if (editingDoctor.auth_user_id) {
          await supabase.from("profiles").update({
            name: formData.name.trim(),
            phone: formData.mobile || null,
            status: formData.status,
          }).eq("id", editingDoctor.auth_user_id);
        }

        // Cascade doctor name change to all existing vouchers
        if (formData.name.trim() !== editingDoctor.name) {
          // Get all appointment IDs for this doctor
          const { data: apts } = await supabase
            .from("appointments")
            .select("voucher_id")
            .eq("doctor_id", editingDoctor.id)
            .not("voucher_id", "is", null);
          const voucherIds = (apts || []).map((a: any) => a.voucher_id).filter(Boolean);
          if (voucherIds.length > 0) {
            await supabase
              .from("vouchers")
              .update({ doctor_name: formData.name.trim() })
              .in("id", voucherIds);
          }
        }

        setDoctors((prev) =>
          prev.map((d) =>
            d.id === editingDoctor.id ? { ...d, ...updatePayload } : d
          )
        );
        showSuccess(`Dr. ${formData.name} updated.`);
      }
      setIsDrawerOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      // If doctor has an auth_user_id, delete auth user (cascades to profiles)
      if (deleteConfirm.auth_user_id) {
        const res = await fetch("/api/admin/update-user", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteConfirm.auth_user_id }),
        });
        if (!res.ok) {
          const result = await res.json();
          throw new Error(result.error || "Failed to delete doctor.");
        }
      }
      // Delete doctor detail row
      await supabase.from("doctors").delete().eq("id", deleteConfirm.id);
      setDoctors((prev) => prev.filter((d) => d.id !== deleteConfirm.id));
      setDeleteConfirm(null); showSuccess("Doctor deleted.");
    } catch (err: any) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleAccepting = async (doc: Doctor) => {
    const val = !doc.is_accepting_patients;
    try {
      const { error } = await supabase.from("doctors").update({ is_accepting_patients: val }).eq("id", doc.id);
      if (error) throw error;
      setDoctors((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_accepting_patients: val } : d));
    } catch (err) { console.error(err); }
  };

  /* ── filtered search for pills ── */
  const filteredSpecs   = specialties.filter((s) =>
    s.name.toLowerCase().includes(specSearch.toLowerCase())
  );
  const filteredClinics = clinics.filter((c) =>
    c.name.toLowerCase().includes(clinicSearch.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(clinicSearch.toLowerCase())
  );
  const filteredDegrees = degreesList.filter((d) =>
    d.name.toLowerCase().includes(degreeSearch.toLowerCase())
  );

  /* ── Tab completion indicator ── */
  const tabComplete: Record<DrawerTab, boolean> = {
    profile:  !!(formData.name && formData.email),
    practice: formData.specialty_ids.length > 0,
    about:    !!(formData.about),
    settings: true,
  };

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Stethoscope className="h-8 w-8 text-cyan-600" /> Doctors Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage doctors, specialties, and availability</p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Doctor
        </Button>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          ✅ {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold">{doctors.length}</div><p className="text-xs text-muted-foreground mt-1">Total Doctors</p></div>
            <Users className="h-8 w-8 text-cyan-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-green-600">{accepting}</div><p className="text-xs text-muted-foreground mt-1">Accepting Patients</p></div>
            <UserCheck className="h-8 w-8 text-green-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold">{doctors.length - accepting}</div><p className="text-xs text-muted-foreground mt-1">Not Accepting</p></div>
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold">{specialties.length}</div><p className="text-xs text-muted-foreground mt-1">Specialties Listed</p></div>
            <Stethoscope className="h-8 w-8 text-brand-500" />
          </div>
        </CardContent></Card>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or specialty…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {([["all", "All"], ["accepting", "Accepting"], ["not_accepting", "Not Accepting"]] as const).map(([val, label]) => (
            <Button key={val} size="sm" variant={statusFilter === val ? "default" : "outline"}
              onClick={() => setStatusFilter(val)}
              className={statusFilter === val ? "bg-brand-600 hover:bg-brand-700" : ""}>
              {label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} of {doctors.length}</p>
        {/* View toggle */}
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-brand-600 text-white" : "bg-white text-muted-foreground hover:bg-gray-50"}`}
            title="Grid view"><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("list")}
            className={`p-2 transition-colors border-l ${viewMode === "list" ? "bg-brand-600 text-white" : "bg-white text-muted-foreground hover:bg-gray-50"}`}
            title="List view"><List className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-8 w-8 animate-spin text-brand-600" />
          <p className="ml-3 text-muted-foreground">Loading doctors…</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="text-center py-16 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No doctors found</p>
          {!searchQuery && <p className="text-sm mt-1">Click &ldquo;Add Doctor&rdquo; to create the first one.</p>}
        </CardContent></Card>
      ) : (
        <>
        {/* ── GRID VIEW ── */}
        {viewMode === "grid" && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const specNames   = getSpecialtyNames(doc.specialty_ids || []);
            const clinicNames = getClinicNames(doc.clinic_ids || []);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {isValidImage(doc.avatar_url || "") ? (
                        <img src={doc.avatar_url!} alt={doc.name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 font-bold text-lg">
                          {doc.name?.replace(/^Dr\.?\s*/i, "").charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-base">{doc.name || "—"}</CardTitle>
                        {(doc.degree_ids?.length > 0) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{getDegreeNames(doc.degree_ids).slice(0, 3).join(" · ")}</p>
                        )}
                        {specNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {specNames.slice(0, 2).map((n) => (
                              <span key={n} className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 font-medium">{n}</span>
                            ))}
                            {specNames.length > 2 && (
                              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">+{specNames.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">No specialty</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleToggleAccepting(doc)}
                      className={`h-3 w-3 rounded-full mt-1 flex-shrink-0 transition-colors ${doc.is_accepting_patients ? "bg-green-500 hover:bg-green-600" : "bg-red-400 hover:bg-red-500"}`}
                      title={doc.is_accepting_patients ? "Accepting — click to toggle" : "Not accepting — click to toggle"} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clinicNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {clinicNames.slice(0, 2).map((n) => (
                        <span key={n} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                          <Building2 className="h-2.5 w-2.5" />{n}
                        </span>
                      ))}
                      {clinicNames.length > 2 && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">+{clinicNames.length - 2}</span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Award className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs">{doc.experience ? `${doc.experience} yrs` : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                      <div>
                        <div className="text-xs font-semibold">{doc.appointment_fee ? `₹${doc.appointment_fee}` : "—"}</div>
                        <div className="text-[9px] text-muted-foreground">Clinic</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
                      <div>
                        <div className="text-xs font-semibold">{doc.booking_fee ? `₹${doc.booking_fee}` : "—"}</div>
                        <div className="text-[9px] text-muted-foreground">Online</div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 border-t space-y-0.5">
                    <p className="text-xs text-muted-foreground">{doc.email}</p>
                    <p className="text-xs text-muted-foreground">{doc.mobile || "No mobile"}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(doc)}>
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-brand-600 hover:text-brand-800 hover:border-brand-300" onClick={() => openSchedule(doc)}>
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => setDeleteConfirm(doc)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((doc) => {
                const specNames   = getSpecialtyNames(doc.specialty_ids || []);
                const clinicNames = getClinicNames(doc.clinic_ids || []);
                const degNames    = getDegreeNames(doc.degree_ids || []);
                return (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    {/* Avatar */}
                    {isValidImage(doc.avatar_url || "") ? (
                      <img src={doc.avatar_url!} alt={doc.name} className="h-11 w-11 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 font-bold text-base flex-shrink-0">
                        {doc.name?.replace(/^Dr\.?\s*/i, "").charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{doc.name || "—"}</span>
                        <button onClick={() => handleToggleAccepting(doc)}
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${doc.is_accepting_patients ? "bg-green-500" : "bg-red-400"}`}
                          title={doc.is_accepting_patients ? "Accepting" : "Not accepting"} />
                      </div>
                      {degNames.length > 0 && <p className="text-xs text-muted-foreground">{degNames.join(" · ")}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {specNames.map((n) => (
                          <span key={n} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">{n}</span>
                        ))}
                        {clinicNames.map((n) => (
                          <span key={n} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                            <Building2 className="h-2.5 w-2.5" />{n}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-xs">{doc.experience ? `${doc.experience} yrs` : "—"}</div>
                        <div className="text-[10px] text-muted-foreground">Exp</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-xs text-orange-600">{doc.appointment_fee ? `₹${doc.appointment_fee}` : "—"}</div>
                        <div className="text-[10px] text-muted-foreground">Clinic</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-xs text-brand-600">{doc.booking_fee ? `₹${doc.booking_fee}` : "—"}</div>
                        <div className="text-[10px] text-muted-foreground">Online</div>
                      </div>
                    </div>
                    {/* Contact */}
                    <div className="hidden md:block text-xs text-muted-foreground flex-shrink-0 text-right">
                      <p>{doc.email}</p>
                      <p>{doc.mobile || "No mobile"}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(doc)} className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openSchedule(doc)} className="h-8 w-8 p-0 text-brand-600 hover:text-brand-800 hover:bg-brand-50">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(doc)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        )}
        </>
      )}

      {/* ══════════════════════════════════════════════════
          Schedule Drawer
      ══════════════════════════════════════════════════ */}
      {scheduleDoctor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => !schedSubmitting && setScheduleDoctor(null)} />
      )}
      <div className={`fixed top-0 right-0 z-[60] h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
        scheduleDoctor ? "translate-x-0" : "translate-x-full"
      }`}>
        {scheduleDoctor && (() => {
          const { cells, year, mon } = buildCalendarDays(schedMonth);
          const todayStr = new Date().toISOString().split("T")[0];
          const docClinics = clinics.filter((c) => (scheduleDoctor.clinic_ids || []).includes(c.id));
          const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

          /* slots already scheduled for the selected date */
          const slotsOnSelectedDate = existingSchedules
            .filter((s) => s.date === schedDate)
            .map((s) => s.slot);

          /* View tab — filter & group */
          const viewSource = schedShowPast
            ? allSchedules
            : allSchedules.filter((s) => s.date >= todayStr);
          const viewFiltered = schedSlotFilter === "all"
            ? viewSource
            : viewSource.filter((s) => s.slot === schedSlotFilter);
          /* group by date */
          const grouped: Record<string, any[]> = {};
          viewFiltered.forEach((s) => {
            if (!grouped[s.date]) grouped[s.date] = [];
            grouped[s.date].push(s);
          });
          const sortedDates = Object.keys(grouped).sort((a, b) =>
            schedShowPast ? b.localeCompare(a) : a.localeCompare(b)
          );

          return (
            <>
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0 bg-gradient-to-r from-brand-600 to-cyan-600">
                <div className="flex items-center gap-3">
                  {scheduleDoctor.avatar_url?.startsWith("http") ? (
                    <img src={scheduleDoctor.avatar_url} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30" alt="" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base">
                      {scheduleDoctor.name?.replace(/^Dr\.?\s*/i, "").charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">Schedule</h2>
                    <p className="text-xs text-brand-100">{scheduleDoctor.name}</p>
                  </div>
                </div>
                <button onClick={() => !schedSubmitting && setScheduleDoctor(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── Tab Bar ── */}
              <div className="flex border-b flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
                <button onClick={() => setSchedTab("add")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    schedTab === "add"
                      ? "border-brand-600 text-brand-700 bg-white dark:bg-gray-900 dark:text-brand-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <Plus className="h-3.5 w-3.5" /> Add Schedule
                </button>
                <button onClick={() => { setSchedTab("view"); setSchedDeleteConfirmId(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    schedTab === "view"
                      ? "border-brand-600 text-brand-700 bg-white dark:bg-gray-900 dark:text-brand-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <CalendarDays className="h-3.5 w-3.5" /> View All
                  {allSchedules.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 text-[10px] font-bold">
                      {allSchedules.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto">

                {/* ═══════════ ADD TAB ═══════════ */}
                {schedTab === "add" && (
                  <div className="p-5 space-y-5">

                    {/* Calendar */}
                    <div className="rounded-xl border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border-b">
                        <button onClick={() => setSchedMonth(new Date(year, mon - 1, 1))}
                          className="p-1 rounded hover:bg-brand-100 dark:hover:bg-brand-800 transition">
                          <ChevronLeft className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                        </button>
                        <span className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                          {MONTH_NAMES[mon]} {year}
                        </span>
                        <button onClick={() => setSchedMonth(new Date(year, mon + 1, 1))}
                          className="p-1 rounded hover:bg-brand-100 dark:hover:bg-brand-800 transition">
                          <ChevronRight className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                        </button>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-7 mb-1">
                          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {cells.map((day, i) => {
                            if (day === null) return <div key={`e${i}`} />;
                            const dateStr    = formatSchedDate(year, mon, day);
                            const isToday    = dateStr === todayStr;
                            const isSelected = dateStr === schedDate;
                            const isScheduledDate = scheduledDatesSet.has(dateStr);
                            const isPast     = dateStr < todayStr;
                            return (
                              <button key={dateStr} disabled={isPast}
                                onClick={() => !isPast && setSchedDate(dateStr)}
                                className={`relative h-8 w-full rounded-lg text-xs font-medium transition-all
                                  ${isPast ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer"}
                                  ${isSelected ? "bg-brand-600 text-white hover:bg-brand-600 shadow-sm" : ""}
                                  ${isToday && !isSelected ? "ring-2 ring-brand-400 font-bold" : ""}
                                `}>
                                {day}
                                {isScheduledDate && !isSelected && (
                                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {schedDate && (
                        <div className="px-4 py-2 bg-brand-50 dark:bg-brand-900/20 border-t text-xs text-brand-700 dark:text-brand-300 font-medium flex items-center justify-between">
                          <span>{new Date(schedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                          {slotsOnSelectedDate.length > 0 && (
                            <span className="text-[10px] text-brand-600 font-semibold">{slotsOnSelectedDate.length} session{slotsOnSelectedDate.length > 1 ? "s" : ""} set</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Session Selector */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-brand-600" />Select Sessions
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {SESSIONS.map((session) => {
                          const active     = schedSlots.includes(session);
                          const alreadySet = slotsOnSelectedDate.includes(session);
                          return (
                            <button key={session} type="button" onClick={() => toggleSchedSlot(session)}
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                active
                                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm"
                                  : alreadySet
                                    ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-brand-50"
                              }`}>
                              <span className="text-xl">{SESSION_EMOJI[session] || "📅"}</span>
                              <div>
                                <div className="text-xs font-semibold">{session}</div>
                                <div className="text-[10px] text-muted-foreground">{alreadySet ? "Already set ✓" : active ? "Selected" : "Available"}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {schedSlots.length > 0 && (
                        <p className="text-xs text-muted-foreground">{schedSlots.length} session{schedSlots.length > 1 ? "s" : ""} selected</p>
                      )}

                      {/* Max Seats */}
                      <div className="space-y-1 pt-2">
                        <label className="text-xs font-semibold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-brand-600" /> Max Seats per Session
                        </label>
                        <input type="number" min={1} max={500} value={schedMaxSeats}
                          onChange={e => setSchedMaxSeats(Math.max(1, parseInt(e.target.value) || 30))}
                          className="w-28 h-9 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-sm" />
                        <p className="text-[10px] text-muted-foreground">Max appointments allowed per session</p>
                      </div>
                    </div>

                    {/* Clinic Picker */}
                    {docClinics.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-brand-600" />Select Clinic
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {docClinics.map((c) => (
                            <button key={c.id} type="button" onClick={() => setSchedClinicId(c.id)}
                              className={`px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all ${
                                schedClinicId === c.id
                                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                                  : "border-gray-200 text-muted-foreground hover:border-brand-300 dark:border-gray-700"
                              }`}>
                              {c.name}{c.city ? ` · ${c.city}` : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {(schedWarning === "TABLE_MISSING" || schedError.includes("uuid") || schedError.includes("clinic_id")) && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          Run this SQL in Supabase (SQL Editor → New Query) then retry:
                        </p>
                        <pre className="text-[10px] bg-amber-100 dark:bg-amber-900/30 rounded p-2 overflow-x-auto text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">{`-- Recreate doctor_schedules with correct types
DROP TABLE IF EXISTS doctor_schedules;
CREATE TABLE doctor_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  TEXT NOT NULL,
  date       DATE NOT NULL,
  slot       VARCHAR(20) NOT NULL,
  max_seats  INT NOT NULL DEFAULT 30,
  clinic_id  INTEGER,
  status     VARCHAR(20) DEFAULT 'available',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_doctor_date_slot UNIQUE (doctor_id, date, slot)
);
CREATE INDEX IF NOT EXISTS idx_ds_doctor_date
  ON doctor_schedules(doctor_id, date);
ALTER TABLE doctor_schedules DISABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';`}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `DROP TABLE IF EXISTS doctor_schedules;\nCREATE TABLE doctor_schedules (\n  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  doctor_id  TEXT NOT NULL,\n  date       DATE NOT NULL,\n  slot       VARCHAR(20) NOT NULL,\n  max_seats  INT NOT NULL DEFAULT 30,\n  clinic_id  INTEGER,\n  status     VARCHAR(20) DEFAULT 'available',\n  notes      TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  CONSTRAINT uq_doctor_date_slot UNIQUE (doctor_id, date, slot)\n);\nCREATE INDEX IF NOT EXISTS idx_ds_doctor_date ON doctor_schedules(doctor_id, date);\nALTER TABLE doctor_schedules DISABLE ROW LEVEL SECURITY;\nNOTIFY pgrst, 'reload schema';`
                            );
                          }}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 transition"
                        >
                          Copy SQL
                        </button>
                      </div>
                    )}
                    {schedError && !schedError.includes("uuid") && !schedError.includes("clinic_id") && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />{schedError}
                      </div>
                    )}
                    {schedSuccess && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />{schedSuccess}
                      </div>
                    )}

                    {/* Quick peek: upcoming entries for this doctor */}
                    {existingSchedules.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Next scheduled ({existingSchedules.length})
                          <button onClick={() => setSchedTab("view")}
                            className="ml-auto text-brand-600 hover:underline text-[10px]">View all →</button>
                        </p>
                        <div className="rounded-xl border divide-y overflow-hidden">
                          {existingSchedules.slice(0, 5).map((s) => {
                            const clinic = clinics.find((c) => c.id === s.clinic_id);
                            const cfg    = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.available;
                            return (
                              <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span>{SESSION_EMOJI[s.slot] ?? "📅"}</span>
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {new Date(s.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                      {" · "}{s.slot}
                                    </div>
                                    {clinic && <div className="text-[10px] text-muted-foreground truncate">{clinic.name}</div>}
                                  </div>
                                </div>
                                <span className={`ml-2 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════ VIEW TAB ═══════════ */}
                {schedTab === "view" && (
                  <div className="flex flex-col h-full">

                    {/* Filter bar */}
                    <div className="px-4 py-3 border-b space-y-2 flex-shrink-0 bg-gray-50 dark:bg-gray-800/30">
                      {/* Slot filter pills */}
                      <div className="flex gap-1.5 flex-wrap">
                        {[{ key: "all", label: "All Sessions" }, ...SESSIONS.map(s => ({ key: s, label: s }))].map((s) => (
                          <button key={s.key} onClick={() => setSchedSlotFilter(s.key)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                              schedSlotFilter === s.key
                                ? "bg-brand-600 text-white border-brand-600"
                                : "border-gray-200 text-muted-foreground hover:border-brand-300 dark:border-gray-700"
                            }`}>
                            {SESSION_EMOJI[s.key] ? `${SESSION_EMOJI[s.key]} ` : ""}{s.label}
                          </button>
                        ))}
                      </div>
                      {/* Past toggle + count */}
                      <div className="flex items-center justify-between">
                        <button onClick={() => setSchedShowPast((p) => !p)}
                          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                            schedShowPast
                              ? "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900"
                              : "border-gray-200 text-muted-foreground hover:border-gray-400 dark:border-gray-700"
                          }`}>
                          <Clock className="h-3 w-3" />
                          {schedShowPast ? "Showing All" : "Upcoming Only"}
                        </button>
                        <span className="text-[11px] text-muted-foreground">
                          {viewFiltered.length} session{viewFiltered.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* List body */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {schedLoadingAll ? (
                        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                          <Loader className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                      ) : sortedDates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                          <CalendarDays className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                          <p className="text-sm font-medium text-muted-foreground">No schedules found</p>
                          <p className="text-xs text-muted-foreground">
                            {schedShowPast ? "No schedules at all yet." : "No upcoming schedules — try enabling past view."}
                          </p>
                          <button onClick={() => setSchedTab("add")}
                            className="text-xs text-brand-600 hover:underline font-semibold">+ Add a schedule</button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sortedDates.map((date) => {
                            const entries = grouped[date];
                            const isPastDate = date < todayStr;
                            const isToday = date === todayStr;
                            return (
                              <div key={date} className="space-y-1">
                                {/* Date header */}
                                <div className="flex items-center gap-2 px-1">
                                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                    isToday ? "text-brand-600 dark:text-brand-400" :
                                    isPastDate ? "text-gray-400 dark:text-gray-500" :
                                    "text-foreground"
                                  }`}>
                                    {isToday ? "Today" : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                                  <span className="text-[10px] text-muted-foreground">{entries.length} session{entries.length > 1 ? "s" : ""}</span>
                                </div>
                                {/* Slot rows */}
                                <div className="rounded-xl border overflow-hidden divide-y">
                                  {entries.map((s) => {
                                    const clinic = clinics.find((c) => c.id === s.clinic_id);
                                    const cfg    = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.available;
                                    const isConfirming = schedDeleteConfirmId === s.id;
                                    const isUpdating   = schedStatusUpdating === s.id;

                                    return (
                                      <div key={s.id} className={`px-3 py-2.5 ${isPastDate ? "bg-gray-50/50 dark:bg-gray-800/20" : "bg-white dark:bg-gray-900"} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
                                        {isConfirming ? (
                                          /* Delete confirmation row */
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-red-600 font-medium">Delete this session?</p>
                                            <div className="flex gap-1.5">
                                              <button onClick={() => setSchedDeleteConfirmId(null)}
                                                className="px-2.5 py-1 text-[11px] rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition">
                                                Cancel
                                              </button>
                                              <button onClick={() => handleDeleteSchedule(s.id)}
                                                className="px-2.5 py-1 text-[11px] rounded-md bg-red-600 text-white hover:bg-red-700 transition">
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="text-base flex-shrink-0">{SESSION_EMOJI[s.slot] ?? "📅"}</span>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-semibold">{s.slot}</span>
                                              </div>
                                              {clinic && <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-2.5 w-2.5 flex-shrink-0" />{clinic.name}</div>}
                                            </div>
                                            {/* Status badge — click to cycle */}
                                            <button
                                              onClick={() => !isUpdating && handleUpdateScheduleStatus(s.id, STATUS_CYCLE[s.status] ?? "available")}
                                              disabled={isUpdating}
                                              title="Click to change status"
                                              className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-opacity ${cfg.color} ${isUpdating ? "opacity-50 cursor-wait" : "hover:opacity-80 cursor-pointer"}`}>
                                              {isUpdating ? <Loader className="h-2.5 w-2.5 animate-spin" /> : null}
                                              {cfg.label}
                                            </button>
                                            {/* Delete */}
                                            <button onClick={() => setSchedDeleteConfirmId(s.id)}
                                              className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 rounded transition">
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
                {schedTab === "add" ? (
                  <>
                    <Button variant="outline" onClick={() => !schedSubmitting && setScheduleDoctor(null)} disabled={schedSubmitting}>
                      Close
                    </Button>
                    <Button onClick={handleSaveSchedule} disabled={schedSubmitting || !schedDate || schedSlots.length === 0}
                      className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[140px]">
                      {schedSubmitting
                        ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</>
                        : <><CalendarDays className="h-4 w-4" /> Save Schedule</>
                      }
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => !schedSubmitting && setScheduleDoctor(null)}>
                      Close
                    </Button>
                    <Button variant="outline" onClick={() => setSchedTab("add")} className="gap-1.5 text-brand-700 border-brand-300 hover:bg-brand-50">
                      <Plus className="h-4 w-4" /> Add Schedule
                    </Button>
                  </>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h2 className="text-lg font-bold">Delete Doctor?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{deleteConfirm.name}</strong> will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <><Loader className="h-4 w-4 animate-spin mr-2" />Deleting…</> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Right Sidebar Drawer — 4-tab structure
      ══════════════════════════════════════════════════ */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => !isSubmitting && setIsDrawerOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
        isDrawerOpen ? "translate-x-0" : "translate-x-full"
      }`}>

        {/* ── Drawer Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 bg-gradient-to-r from-brand-600 to-cyan-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {drawerMode === "add" ? "Add New Doctor" : "Edit Doctor"}
              </h2>
              <p className="text-xs text-brand-100">Fill all tabs before saving</p>
            </div>
          </div>
          <button onClick={() => !isSubmitting && setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex border-b flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
          {TAB_LIST.map((t, idx) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors border-b-2 relative ${
                activeTab === t.key
                  ? "border-brand-600 text-brand-600 bg-white dark:bg-gray-900"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-gray-800"
              }`}>
              {t.icon}
              <span>{t.label}</span>
              <span className={`absolute top-1.5 right-2 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                tabComplete[t.key] && activeTab !== t.key
                  ? "bg-brand-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}>{idx + 1}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Body ── */}
        <div className="flex-1 overflow-y-auto">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border-b border-red-200 px-6 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          {/* ════ TAB 1 — PROFILE ════ */}
          {activeTab === "profile" && (
            <div className="p-6 space-y-5">
              <SectionHeading icon={<UserCircle className="h-4 w-4" />} title="Personal Information" />

              {/* Profile Photo */}
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <div
                  className="border-2 border-dashed border-brand-300 rounded-xl overflow-hidden cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900 transition"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleAvatarUpload(f); }}
                >
                  {isValidImage(formData.avatar) ? (
                    <div className="relative group">
                      <img src={formData.avatar} alt="Preview" className="w-full h-36 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm font-medium gap-2">
                        <Upload className="h-5 w-5" /> Click to replace
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                      <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-brand-500" />
                      </div>
                      <p className="text-sm font-medium text-brand-700">Click or drag photo here</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG · max 3 MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
                {isValidImage(formData.avatar) && (
                  <button type="button" onClick={() => setFormData((p) => ({ ...p, avatar: "" }))} className="text-xs text-red-500 hover:underline">
                    Remove photo
                  </button>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Dr. Ramesh Gupta" value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} disabled={isSubmitting} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" placeholder="doctor@nexadox.com" value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  disabled={isSubmitting || drawerMode === "edit"} />
                {drawerMode === "edit" && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}
              </div>

              {/* Mobile */}
              <div className="space-y-1.5">
                <Label>Mobile Number</Label>
                <Input placeholder="+91 9876543210" value={formData.mobile}
                  onChange={(e) => setFormData((p) => ({ ...p, mobile: e.target.value }))} disabled={isSubmitting} />
              </div>

              {/* Password */}
              {drawerMode === "add" && (
                <div className="space-y-1.5">
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                      disabled={isSubmitting} className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Degrees — DB-driven pill multi-select */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-purple-600" /> Degrees / Qualifications
                  </span>
                  {formData.degree_ids.length > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-semibold">{formData.degree_ids.length} selected</span>
                  )}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Filter degrees…" value={degreeSearch}
                    onChange={(e) => setDegreeSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
                {formData.degree_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-100">
                    {formData.degree_ids.map((id) => {
                      const deg = degreesList.find((x) => x.id === id);
                      return deg ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          {deg.name}
                          <button onClick={() => toggleDegree(id)} className="hover:text-purple-200 ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto py-1">
                  {filteredDegrees.map((d) => {
                    const sel = formData.degree_ids.includes(d.id);
                    return (
                      <button key={d.id} type="button" onClick={() => toggleDegree(d.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                          sel
                            ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-400 hover:text-purple-600"
                        }`}>
                        {sel && <span className="mr-1">✓</span>}{d.name}
                      </button>
                    );
                  })}
                  {filteredDegrees.length === 0 && <p className="text-xs text-muted-foreground">No degrees match.</p>}
                </div>
              </div>

              <button onClick={() => setActiveTab("practice")}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 text-sm font-medium hover:bg-brand-50 transition">
                Next: Practice Details <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ════ TAB 2 — PRACTICE ════ */}
          {activeTab === "practice" && (
            <div className="p-6 space-y-6">
              <SectionHeading icon={<Stethoscope className="h-4 w-4" />} title="Practice & Availability" />

              {/* Specialties — searchable pill grid */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-brand-600" /> Specialties
                  </span>
                  {formData.specialty_ids.length > 0 && (
                    <span className="text-xs bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 font-semibold">{formData.specialty_ids.length} selected</span>
                  )}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Filter specialties…" value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
                {formData.specialty_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100">
                    {formData.specialty_ids.map((id) => {
                      const s = specialties.find((x) => x.id === id);
                      return s ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-brand-600 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          {s.name}
                          <button onClick={() => toggleSpecialty(id)} className="hover:text-brand-200 ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto py-1">
                  {filteredSpecs.map((s) => {
                    const sel = formData.specialty_ids.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleSpecialty(s.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                          sel
                            ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600"
                        }`}>
                        {sel && <span className="mr-1">✓</span>}{s.name}
                      </button>
                    );
                  })}
                  {filteredSpecs.length === 0 && <p className="text-xs text-muted-foreground">No specialties match.</p>}
                </div>
              </div>

              {/* Clinics — searchable pill grid */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-600" /> Tagged Clinics
                  </span>
                  {formData.clinic_ids.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">{formData.clinic_ids.length} selected</span>
                  )}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search clinics by name or city…" value={clinicSearch}
                    onChange={(e) => setClinicSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
                {formData.clinic_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100">
                    {formData.clinic_ids.map((id) => {
                      const c = clinics.find((x) => x.id === id);
                      return c ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          <Building2 className="h-3 w-3" />{c.name}
                          <button onClick={() => toggleClinic(id)} className="hover:text-blue-200 ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto py-1">
                  {filteredClinics.map((c) => {
                    const sel = formData.clinic_ids.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleClinic(c.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                          sel
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                        }`}>
                        {sel && <span className="mr-1">✓</span>}{c.name}{c.city ? ` · ${c.city}` : ""}
                      </button>
                    );
                  })}
                  {filteredClinics.length === 0 && <p className="text-xs text-muted-foreground">No clinics match.</p>}
                </div>
              </div>

              {/* Experience */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-500" /> Years of Experience
                </Label>
                <Input type="number" min="0" placeholder="e.g. 10" value={formData.experience}
                  onChange={(e) => setFormData((p) => ({ ...p, experience: e.target.value }))} disabled={isSubmitting} />
              </div>

              {/* Fees */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-orange-500" /> Consultation Fees
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3 space-y-1.5 bg-orange-50/50 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900/30">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" /> Appointment Fee
                    </p>
                    <Input type="number" min="0" placeholder="₹ 500" value={formData.appointment_fee}
                      onChange={(e) => setFormData((p) => ({ ...p, appointment_fee: e.target.value }))} disabled={isSubmitting}
                      className="h-8 text-sm" />
                    <p className="text-[10px] text-muted-foreground">Collected at clinic</p>
                  </div>
                  <div className="rounded-xl border p-3 space-y-1.5 bg-brand-50/50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-900/30">
                    <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" /> Booking Fee
                    </p>
                    <Input type="number" min="0" placeholder="₹ 100" value={formData.booking_fee}
                      onChange={(e) => setFormData((p) => ({ ...p, booking_fee: e.target.value }))} disabled={isSubmitting}
                      className="h-8 text-sm" />
                    <p className="text-[10px] text-muted-foreground">Online via App</p>
                  </div>
                </div>
              </div>

              <button onClick={() => setActiveTab("about")}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition">
                Next: About &amp; Achievements <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ════ TAB 3 — ABOUT ════ */}
          {activeTab === "about" && (
            <div className="p-6 space-y-6">
              <SectionHeading icon={<FileText className="h-4 w-4" />} title="About & Achievements" />

              {/* About */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" /> About Doctor
                </Label>
                <textarea
                  rows={5}
                  placeholder="Write a short bio about the doctor — expertise, approach to patient care, specialisations…"
                  value={formData.about}
                  onChange={(e) => setFormData((p) => ({ ...p, about: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                />
                <p className="text-xs text-muted-foreground text-right">{formData.about.length} characters</p>
              </div>

              {/* Achievements — tag input */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Achievements &amp; Awards
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Best Cardiologist Award 2022 — press Enter"
                    value={achievementInput}
                    onChange={(e) => setAchievementInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAchievement(); } }}
                    disabled={isSubmitting}
                    className="flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addAchievement} disabled={isSubmitting || !achievementInput.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.achievements.length > 0 ? (
                  <div className="space-y-2 mt-1">
                    {formData.achievements.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 group">
                        <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm flex-1 leading-snug">{a}</p>
                        <button onClick={() => removeAchievement(i)}
                          className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-xl text-muted-foreground">
                    <Trophy className="h-8 w-8 mx-auto mb-1.5 opacity-30" />
                    <p className="text-xs">No achievements added yet.</p>
                  </div>
                )}
              </div>

              <button onClick={() => setActiveTab("settings")}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition">
                Next: Account Settings <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ════ TAB 4 — SETTINGS ════ */}
          {activeTab === "settings" && (
            <div className="p-6 space-y-5">
              <SectionHeading icon={<Award className="h-4 w-4" />} title="Account Settings" />

              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                <div>
                  <p className="text-sm font-semibold">Accepting Patients</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Doctor is visible and bookable in the app</p>
                </div>
                <button type="button"
                  onClick={() => setFormData((p) => ({ ...p, is_accepting_patients: !p.is_accepting_patients }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_accepting_patients ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    formData.is_accepting_patients ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              <div className="space-y-1.5">
                <Label>Account Status</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["active", "inactive"] as const).map((s) => (
                    <button key={s} type="button"
                      onClick={() => setFormData((p) => ({ ...p, status: s }))}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                        formData.status === s
                          ? s === "active"
                            ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20"
                            : "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/20"
                          : "border-gray-200 text-muted-foreground hover:border-gray-300"
                      }`}>
                      {s === "active" ? "✅ Active" : "🔴 Inactive"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
                <SummaryRow label="Name"        value={formData.name || "—"} />
                <SummaryRow label="Degrees"     value={getDegreeNames(formData.degree_ids).join(", ") || "—"} />
                <SummaryRow label="Specialties" value={getSpecialtyNames(formData.specialty_ids).join(", ") || "—"} />
                <SummaryRow label="Clinics"     value={getClinicNames(formData.clinic_ids).join(", ") || "—"} />
                <SummaryRow label="Experience"  value={formData.experience ? `${formData.experience} years` : "—"} />
                <SummaryRow label="Appt. Fee"   value={formData.appointment_fee ? `₹${formData.appointment_fee}` : "—"} />
                <SummaryRow label="Book. Fee"   value={formData.booking_fee ? `₹${formData.booking_fee}` : "—"} />
                <SummaryRow label="Achievements" value={formData.achievements.length ? `${formData.achievements.length} listed` : "—"} />
              </div>
            </div>
          )}
        </div>

        {/* ── Drawer Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={() => !isSubmitting && setIsDrawerOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[160px]">
            {isSubmitting
              ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</>
              : drawerMode === "add"
                ? <><Plus className="h-4 w-4" /> Add Doctor</>
                : "Save Changes"
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────────── */
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b">
      <span className="text-brand-600">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground flex-shrink-0 w-24">{label}</span>
      <span className="font-medium text-right text-foreground leading-snug">{value}</span>
    </div>
  );
}
