"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Lock,
  Bell,
  Shield,
  Mail,
  Phone,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Account Settings
  const [accountData, setAccountData] = useState({
    name: "John Agent",
    email: "john.agent@example.com",
    mobile: "+1 234-567-8900",
  });

  // Password Change
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    bookingConfirmations: true,
    paymentAlerts: true,
    lowBalanceAlerts: true,
    monthlyReports: true,
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginAlerts: true,
  });

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement account update with Supabase
    toast({
      title: "Success",
      description: "Account information updated successfully.",
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implement password change with Supabase
    toast({
      title: "Success",
      description: "Password changed successfully.",
    });

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleNotificationUpdate = async () => {
    // TODO: Implement notification settings update
    toast({
      title: "Success",
      description: "Notification preferences updated.",
    });
  };

  const handleSecurityUpdate = async () => {
    // TODO: Implement security settings update
    toast({
      title: "Success",
      description: "Security settings updated.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Account Information</CardTitle>
          </div>
          <CardDescription>
            Update your personal account details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccountUpdate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={accountData.name}
                  onChange={(e) =>
                    setAccountData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={accountData.email}
                  onChange={(e) =>
                    setAccountData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={accountData.mobile}
                  onChange={(e) =>
                    setAccountData((prev) => ({ ...prev, mobile: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
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
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <Button type="submit" className="gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    emailNotifications: !prev.emailNotifications,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.emailNotifications
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.emailNotifications
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via SMS
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    smsNotifications: !prev.smsNotifications,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.smsNotifications
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.smsNotifications
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Booking Confirmations</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when a booking is confirmed
                </p>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    bookingConfirmations: !prev.bookingConfirmations,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.bookingConfirmations
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.bookingConfirmations
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Payment Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified about commission payments
                </p>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    paymentAlerts: !prev.paymentAlerts,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.paymentAlerts
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.paymentAlerts
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Low Balance Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when wallet balance is low
                </p>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    lowBalanceAlerts: !prev.lowBalanceAlerts,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.lowBalanceAlerts
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.lowBalanceAlerts
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">Monthly Reports</p>
                <p className="text-sm text-muted-foreground">
                  Receive monthly performance reports
                </p>
              </div>
              <button
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    monthlyReports: !prev.monthlyReports,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationSettings.monthlyReports
                    ? "bg-primary"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationSettings.monthlyReports
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <Button onClick={handleNotificationUpdate} className="gap-2">
              <Save className="h-4 w-4" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Security Settings</CardTitle>
          </div>
          <CardDescription>
            Manage your account security preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <button
                onClick={() =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    twoFactorAuth: !prev.twoFactorAuth,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  securitySettings.twoFactorAuth ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    securitySettings.twoFactorAuth
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">Login Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone logs into your account
                </p>
              </div>
              <button
                onClick={() =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    loginAlerts: !prev.loginAlerts,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  securitySettings.loginAlerts ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    securitySettings.loginAlerts
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <Button onClick={handleSecurityUpdate} className="gap-2">
              <Save className="h-4 w-4" />
              Save Security Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
              Deactivate Account
            </Button>
            <p className="text-xs text-muted-foreground">
              Once you deactivate your account, you will lose access to all your data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* TODO: Add session management (active devices) */}
      {/* TODO: Add activity log */}
      {/* TODO: Add account export functionality */}
    </div>
  );
}
