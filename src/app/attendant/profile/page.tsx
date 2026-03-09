"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Award,
  Edit,
  Save,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AttendantProfilePage() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // TODO: Fetch attendant profile from Supabase
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    mobile: "",
    employee_id: "",
    join_date: "2024-01-15",
    department: "Front Desk",
    shift: "Morning (8:00 AM - 4:00 PM)",
  });

  // TODO: Fetch performance stats from Supabase
  const stats = {
    total_check_ins: 1234,
    total_tokens: 1234,
    avg_check_in_time: "2m",
    patient_satisfaction: 4.8,
    months_worked: 3,
  };

  const handleSave = async () => {
    // TODO: Update profile in Supabase
    toast({
      title: "Profile Updated",
      description: "Your profile has been updated successfully",
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage your profile information
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your basic profile details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-3xl font-bold">
                    {profile.name.charAt(0)}
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90">
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, name: e.target.value }))
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, email: e.target.value }))
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="mobile"
                      type="tel"
                      value={profile.mobile}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, mobile: e.target.value }))
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input
                    id="employee_id"
                    value={profile.employee_id}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={profile.department}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="join_date">Join Date</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="join_date"
                      value={new Date(profile.join_date).toLocaleDateString()}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shift">Work Shift</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="shift"
                      value={profile.shift}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Work Schedule</CardTitle>
              <CardDescription>Your weekly work schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { day: "Monday", time: "8:00 AM - 4:00 PM", active: true },
                  { day: "Tuesday", time: "8:00 AM - 4:00 PM", active: true },
                  { day: "Wednesday", time: "8:00 AM - 4:00 PM", active: true },
                  { day: "Thursday", time: "8:00 AM - 4:00 PM", active: true },
                  { day: "Friday", time: "8:00 AM - 4:00 PM", active: true },
                  { day: "Saturday", time: "Off", active: false },
                  { day: "Sunday", time: "Off", active: false },
                ].map((schedule) => (
                  <div
                    key={schedule.day}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      schedule.active
                        ? "bg-green-50 dark:bg-green-900/10 border-green-200"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200"
                    }`}
                  >
                    <span className="font-medium">{schedule.day}</span>
                    <span className="text-sm text-muted-foreground">
                      {schedule.time}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-600" />
                Performance Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-lg text-white">
                <p className="text-sm opacity-90">Total Check-ins</p>
                <p className="text-4xl font-bold mt-1">
                  {stats.total_check_ins.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    Tokens Issued
                  </span>
                  <span className="font-semibold">
                    {stats.total_tokens.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    Avg Check-in Time
                  </span>
                  <span className="font-semibold">{stats.avg_check_in_time}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    Patient Satisfaction
                  </span>
                  <span className="font-semibold flex items-center gap-1">
                    {stats.patient_satisfaction}
                    <span className="text-yellow-500">★</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    Months Worked
                  </span>
                  <span className="font-semibold">{stats.months_worked}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">100 Check-ins</p>
                  <p className="text-xs text-muted-foreground">
                    Reached first milestone
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Quick Service</p>
                  <p className="text-xs text-muted-foreground">
                    Under 2min avg check-in
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Perfect Month</p>
                  <p className="text-xs text-muted-foreground">
                    No complaints in January
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TODO: Add profile image upload functionality */}
      {/* TODO: Add leave request section */}
      {/* TODO: Add attendance history */}
    </div>
  );
}
