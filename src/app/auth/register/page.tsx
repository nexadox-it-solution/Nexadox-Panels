"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Sign up user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            mobile: formData.mobile,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create/upsert profile in profiles table (SSoT for identity)
        // Note: handle_new_user() trigger may auto-create this, so upsert to be safe
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          name: formData.name,
          email: formData.email,
          phone: formData.mobile,
          role: "patient",
          status: "active",
        }, { onConflict: "id" });

        if (profileError) throw profileError;

        // Create patient detail record
        const { error: patientError } = await supabase.from("patients").insert({
          user_id: data.user.id,
          name: formData.name,
          email: formData.email,
          phone: formData.mobile,
        });

        if (patientError) {
          console.warn("Patient detail insert failed (may already exist):", patientError.message);
        }

        // Backward compat: insert into users table (non-fatal)
        try {
          await supabase.from("users").insert({
            name: formData.name,
            email: formData.email,
            mobile: formData.mobile,
            role: "patient",
            status: "active",
            auth_user_id: data.user.id,
          });
        } catch (_) { /* old table, non-fatal */ }

        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account.",
        });

        // Redirect to login
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold text-primary">Nexadox</span>
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Sign up to book appointments and manage health records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                name="mobile"
                type="tel"
                placeholder="+1234567890"
                value={formData.mobile}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary">
              ← Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
