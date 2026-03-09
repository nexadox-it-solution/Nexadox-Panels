"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  User,
  Lock,
  Bell,
  Monitor,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AttendantSettingsPage() {
  const { toast } = useToast();

  // Account Info
  const [accountInfo, setAccountInfo] = useState({
    name: "",
    email: "",
    mobile: "",
    employee_id: "",
  });

  // Password
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  // Notifications
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    sms_notifications: false,
    new_patient_alert: true,
    queue_updates: true,
    system_notifications: true,
  });

  // Check-in Settings
  const [checkInSettings, setCheckInSettings] = useState({
    auto_print_token: true,
    require_mobile_verification: false,
    enable_walk_in_registration: true,
    default_consultation_time: "15",
  });

  // Display Settings
  const [displaySettings, setDisplaySettings] = useState({
    theme: "light",
    language: "en",
    date_format: "MM/DD/YYYY",
    time_format: "12h",
  });

  const handleSaveAccount = () => {
    // TODO: Update account info in Supabase
    toast({
      title: "Account Updated",
      description: "Your account information has been updated successfully",
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.new !== passwordData.confirm) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    // TODO: Update password in Supabase
    toast({
      title: "Password Changed",
      description: "Your password has been changed successfully",
    });

    setPasswordData({ current: "", new: "", confirm: "" });
  };

  const handleSaveNotifications = () => {
    // TODO: Update notification preferences in Supabase
    toast({
      title: "Preferences Saved",
      description: "Your notification preferences have been updated",
    });
  };

  const handleSaveCheckInSettings = () => {
    // TODO: Update check-in settings in Supabase
    toast({
      title: "Settings Saved",
      description: "Your check-in settings have been updated",
    });
  };

  const handleSaveDisplaySettings = () => {
    // TODO: Update display settings in Supabase
    toast({
      title: "Settings Saved",
      description: "Your display settings have been updated",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card - Link to Profile Page */}
      <a href="/attendant/settings/profile">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              View My Profile
            </CardTitle>
            <CardDescription>
              View your professional information, assignments, and account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click here to access your complete profile with personal information, assigned clinics and doctors, and account statistics.
            </p>
          </CardContent>
        </Card>
      </a>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Full Name</Label>
              <Input
                id="account-name"
                value={accountInfo.name}
                onChange={(e) =>
                  setAccountInfo((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input
                id="account-email"
                type="email"
                value={accountInfo.email}
                onChange={(e) =>
                  setAccountInfo((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-mobile">Mobile</Label>
              <Input
                id="account-mobile"
                type="tel"
                value={accountInfo.mobile}
                onChange={(e) =>
                  setAccountInfo((prev) => ({ ...prev, mobile: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-id">Employee ID</Label>
              <Input
                id="account-id"
                value={accountInfo.employee_id}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>
          <Button onClick={handleSaveAccount} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.current}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, current: e.target.value }))
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.new}
                    onChange={(e) =>
                      setPasswordData((prev) => ({ ...prev, new: e.target.value }))
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirm}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirm: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button type="submit" className="gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.email_notifications}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    email_notifications: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">SMS Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via SMS
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.sms_notifications}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    sms_notifications: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">New Patient Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when new patients arrive
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.new_patient_alert}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    new_patient_alert: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">Queue Updates</p>
                <p className="text-sm text-muted-foreground">
                  Get notified of queue changes
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.queue_updates}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    queue_updates: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">System Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Important system updates and announcements
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.system_notifications}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    system_notifications: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>
          </div>

          <Button onClick={handleSaveNotifications} className="gap-2">
            <Save className="h-4 w-4" />
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Check-in Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Check-in Settings</CardTitle>
          <CardDescription>
            Configure check-in workflow preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">Auto-Print Tokens</p>
                <p className="text-sm text-muted-foreground">
                  Automatically print token after check-in
                </p>
              </div>
              <input
                type="checkbox"
                checked={checkInSettings.auto_print_token}
                onChange={(e) =>
                  setCheckInSettings((prev) => ({
                    ...prev,
                    auto_print_token: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">Mobile Verification</p>
                <p className="text-sm text-muted-foreground">
                  Require OTP verification during check-in
                </p>
              </div>
              <input
                type="checkbox"
                checked={checkInSettings.require_mobile_verification}
                onChange={(e) =>
                  setCheckInSettings((prev) => ({
                    ...prev,
                    require_mobile_verification: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">Walk-in Registration</p>
                <p className="text-sm text-muted-foreground">
                  Allow registration of walk-in patients
                </p>
              </div>
              <input
                type="checkbox"
                checked={checkInSettings.enable_walk_in_registration}
                onChange={(e) =>
                  setCheckInSettings((prev) => ({
                    ...prev,
                    enable_walk_in_registration: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded"
              />
            </label>

            <div className="p-3 border rounded-lg">
              <Label htmlFor="consultation-time" className="mb-2 block">
                Default Consultation Time (minutes)
              </Label>
              <Input
                id="consultation-time"
                type="number"
                value={checkInSettings.default_consultation_time}
                onChange={(e) =>
                  setCheckInSettings((prev) => ({
                    ...prev,
                    default_consultation_time: e.target.value,
                  }))
                }
                min="5"
                max="60"
                className="max-w-xs"
              />
            </div>
          </div>

          <Button onClick={handleSaveCheckInSettings} className="gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Display Settings
          </CardTitle>
          <CardDescription>
            Customize your display preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <select
                id="theme"
                value={displaySettings.theme}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, theme: e.target.value }))
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={displaySettings.language}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({
                    ...prev,
                    language: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <select
                id="date-format"
                value={displaySettings.date_format}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({
                    ...prev,
                    date_format: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-format">Time Format</Label>
              <select
                id="time-format"
                value={displaySettings.time_format}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({
                    ...prev,
                    time_format: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="12h">12 Hour</option>
                <option value="24h">24 Hour</option>
              </select>
            </div>
          </div>

          <Button onClick={handleSaveDisplaySettings} className="gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* TODO: Add two-factor authentication */}
      {/* TODO: Add session management */}
      {/* TODO: Add data export options */}
    </div>
  );
}
