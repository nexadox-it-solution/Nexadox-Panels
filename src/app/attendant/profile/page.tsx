"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Mail, Phone, Calendar, Building2,
  Loader, AlertCircle, Award, Clock, CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  role: string;
  status: string;
  created_at: string;
}

export default function AttendantProfilePage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [clinics, setClinics] = useState<{ id: number; name: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Not authenticated");

        const { data: profileData, error: profileError } = await supabase
          .from("profiles").select("*").eq("id", authUser.id).single();
        if (profileError) throw profileError;
        setUser(profileData);

        let attProfile: any = null;
        const { data: attByProfile } = await supabase
          .from("attendants").select("*").eq("profile_id", profileData.id).single();
        if (attByProfile) {
          attProfile = attByProfile;
        } else {
          const { data: attByUser } = await supabase
            .from("attendants").select("*").eq("user_id", profileData.id).single();
          attProfile = attByUser;
        }

        if (attProfile?.assigned_clinic_ids?.length > 0) {
          const { data } = await supabase.from("clinics").select("id, name").in("id", attProfile.assigned_clinic_ids);
          setClinics(data || []);
        }
        if (attProfile?.assigned_doctors?.length > 0) {
          const { data } = await supabase.from("doctors").select("id, name").in("id", attProfile.assigned_doctors);
          setDoctors(data || []);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast({ title: "Error", description: "Failed to load profile data", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const daysWorked = user?.created_at
    ? Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <User className="h-8 w-8 text-brand-600" /> My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View your professional information and assignments</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="md:col-span-2 lg:col-span-1 border-0 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold">{user?.name}</h3>
                <p className="text-sm text-blue-100 mt-1">Clinic Attendant</p>
                <div className="mt-4 pt-4 border-t border-white/20 text-xs text-blue-100">
                  Member for {daysWorked > 0 ? `${daysWorked} days` : "recently joined"}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="text-sm text-muted-foreground">Active Status</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">Active</p>
                <p className="text-xs text-muted-foreground mt-2">Account is verified</p>
              </CardContent>
            </Card>

            <Card className="border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-muted-foreground">Clinics Assigned</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{clinics.length}</p>
                <p className="text-xs text-muted-foreground mt-2">Currently managing</p>
              </CardContent>
            </Card>

            <Card className="border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Doctors Assigned</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">{doctors.length}</p>
                <p className="text-xs text-muted-foreground mt-2">In your network</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-600" /> Professional Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Account Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-semibold">Active</p>
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                  <p className="font-semibold">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Email Status</p>
                  <p className="font-semibold text-green-600">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your registered account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> Full Name</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user?.name || "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> Email Address</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user?.email || "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> Phone Number</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user?.phone || "Not provided"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Account Created</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4" /> Account Status</label>
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">{user?.status || "Active"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Assigned Clinics</CardTitle>
                <CardDescription>You are responsible for these clinics</CardDescription>
              </CardHeader>
              <CardContent>
                {clinics.length > 0 ? (
                  <div className="space-y-2">
                    {clinics.map(clinic => (
                      <div key={clinic.id} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">{clinic.name}</p>
                          <p className="text-xs text-muted-foreground">Clinic ID: {clinic.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No clinics assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Assigned Doctors</CardTitle>
                <CardDescription>Doctors you support in check-in</CardDescription>
              </CardHeader>
              <CardContent>
                {doctors.length > 0 ? (
                  <div className="space-y-2">
                    {doctors.map(doctor => (
                      <div key={doctor.id} className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <User className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-sm">{doctor.name}</p>
                          <p className="text-xs text-muted-foreground">Doctor ID: {doctor.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No doctors assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Need Changes to Your Assignments?</CardTitle>
              <CardDescription>Contact your clinic administrator to update assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you need to change your assigned clinics or doctors, please reach out to your clinic administrator. They can update your assignments from the admin panel.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
