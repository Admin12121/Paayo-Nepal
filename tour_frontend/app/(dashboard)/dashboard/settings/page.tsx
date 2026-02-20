"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Fingerprint,
  Key,
  Copy,
  CheckCircle2,
  Trash2,
  Plus,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardCard from "@/components/dashboard/DashboardCard";
import {
  useSession,
  enableTwoFactor,
  disableTwoFactor,
  registerPasskey,
  listPasskeys,
  deletePasskey,
} from "@/lib/auth-client";
import { toast } from "@/lib/utils/toast";

interface Passkey {
  id: string;
  name: string;
  createdAt: Date | string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "2fa" | "passkeys"
  >("profile");

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrCode, setTotpQrCode] = useState("");
  const [totpVerificationCode, setTotpVerificationCode] = useState("");
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  // Passkeys state
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isPasskeysLoading, setIsPasskeysLoading] = useState(false);
  const [deletePasskeyDialog, setDeletePasskeyDialog] = useState<{
    open: boolean;
    passkey: Passkey | null;
  }>({ open: false, passkey: null });

  // Check if passkeys are supported
  const isPasskeySupported =
    typeof window !== "undefined" && window.PublicKeyCredential !== undefined;

  // Load user data
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
      // Check if 2FA is enabled (you may need to adjust this based on your session structure)
      setIs2FAEnabled((session.user as any).twoFactorEnabled || false);
    }
  }, [session]);

  // Load passkeys
  useEffect(() => {
    if (activeTab === "passkeys" && isPasskeySupported) {
      loadPasskeys();
    }
  }, [activeTab]);

  const loadPasskeys = async () => {
    setIsPasskeysLoading(true);
    try {
      const result = await listPasskeys();
      if (result.data) {
        setPasskeys(result.data as Passkey[]);
      }
    } catch (error) {
      toast.error("Failed to load passkeys");
      console.error("Load passkeys error:", error);
    } finally {
      setIsPasskeysLoading(false);
    }
  };

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);

    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Profile update error:", error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsPasswordLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to change password");
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      toast.error("Failed to change password. Check your current password.");
      console.error("Password change error:", error);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setIs2FALoading(true);
    try {
      const result = await enableTwoFactor();

      if (result.error) {
        toast.error("Failed to enable 2FA");
        return;
      }

      // The result should contain the secret and QR code
      if (result.data) {
        setTotpSecret((result.data as any).secret);
        setTotpQrCode((result.data as any).qrCode);
        setShowTotpSetup(true);
      }
    } catch (error) {
      toast.error("Failed to enable 2FA");
      console.error("Enable 2FA error:", error);
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleVerify2FA = async (e: FormEvent) => {
    e.preventDefault();

    if (totpVerificationCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setIs2FALoading(true);
    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpVerificationCode }),
      });

      if (!response.ok) {
        throw new Error("Invalid verification code");
      }

      toast.success("2FA enabled successfully");
      setIs2FAEnabled(true);
      setShowTotpSetup(false);
      setTotpVerificationCode("");
    } catch (error) {
      toast.error("Invalid verification code");
      console.error("Verify 2FA error:", error);
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleDisable2FA = async (e: FormEvent) => {
    e.preventDefault();

    setIs2FALoading(true);
    try {
      const result = await disableTwoFactor(disablePassword);

      if (result.error) {
        toast.error("Failed to disable 2FA. Check your password.");
        return;
      }

      toast.success("2FA disabled successfully");
      setIs2FAEnabled(false);
      setShowDisable2FA(false);
      setDisablePassword("");
    } catch (error) {
      toast.error("Failed to disable 2FA");
      console.error("Disable 2FA error:", error);
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleAddPasskey = async () => {
    setIsPasskeysLoading(true);
    try {
      const result = await registerPasskey();

      if (result.error) {
        toast.error("Failed to register passkey");
        return;
      }

      toast.success("Passkey registered successfully");
      loadPasskeys();
    } catch (error) {
      toast.error("Failed to register passkey");
      console.error("Register passkey error:", error);
    } finally {
      setIsPasskeysLoading(false);
    }
  };

  const handleDeletePasskey = async () => {
    if (!deletePasskeyDialog.passkey) return;

    try {
      const result = await deletePasskey(deletePasskeyDialog.passkey.id);

      if (result.error) {
        toast.error("Failed to delete passkey");
        return;
      }

      toast.success("Passkey deleted successfully");
      setDeletePasskeyDialog({ open: false, passkey: null });
      loadPasskeys();
    } catch (error) {
      toast.error("Failed to delete passkey");
      console.error("Delete passkey error:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isPending) {
    return <LoadingSpinner />;
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account and security settings
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "profile" | "security" | "2fa" | "passkeys")
        }
        className="mb-6"
      >
        <div className="border-b border-gray-200">
          <TabsList
            variant="line"
            className="h-auto gap-8 rounded-none bg-transparent p-0"
          >
            <TabsTrigger
              value="profile"
              className="h-auto rounded-none px-1 py-4 text-sm font-medium data-[state=active]:text-blue-600"
            >
              <User className="mr-2 inline h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="h-auto rounded-none px-1 py-4 text-sm font-medium data-[state=active]:text-blue-600"
            >
              <Lock className="mr-2 inline h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="2fa"
              className="h-auto rounded-none px-1 py-4 text-sm font-medium data-[state=active]:text-blue-600"
            >
              <Shield className="mr-2 inline h-4 w-4" />
              Two-Factor Auth
            </TabsTrigger>
            <TabsTrigger
              value="passkeys"
              className="h-auto rounded-none px-1 py-4 text-sm font-medium data-[state=active]:text-blue-600"
            >
              <Fingerprint className="mr-2 inline h-4 w-4" />
              Passkeys
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <DashboardCard className="max-w-2xl" contentClassName="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Profile Information
          </h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <Label htmlFor="name" required>
                Full Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  disabled={isProfileLoading}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <Label htmlFor="email" required>
                Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isProfileLoading}
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <Button type="submit" isLoading={isProfileLoading}>
              Save Changes
            </Button>
          </form>
        </DashboardCard>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <DashboardCard className="max-w-2xl" contentClassName="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" required>
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isPasswordLoading}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 p-0 text-gray-400 hover:bg-transparent hover:text-gray-600"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" required>
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isPasswordLoading}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 p-0 text-gray-400 hover:bg-transparent hover:text-gray-600"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmNewPassword" required>
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmNewPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isPasswordLoading}
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 p-0 text-gray-400 hover:bg-transparent hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" isLoading={isPasswordLoading}>
              Update Password
            </Button>
          </form>
        </DashboardCard>
      )}

      {/* 2FA Tab */}
      {activeTab === "2fa" && (
        <DashboardCard className="max-w-2xl" contentClassName="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Two-Factor Authentication
              </h2>
              <p className="text-gray-600 text-sm">
                Add an extra layer of security to your account
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                is2FAEnabled
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {is2FAEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>

          {!is2FAEnabled && !showTotpSetup && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">
                      Enhance your account security
                    </h3>
                    <p className="text-sm text-blue-800">
                      Two-factor authentication adds an extra layer of security
                      by requiring a code from your authenticator app in
                      addition to your password.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={handleEnable2FA} isLoading={is2FALoading}>
                <Shield className="w-4 h-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
          )}

          {showTotpSetup && (
            <div>
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-4">
                  Step 1: Scan QR Code
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app (Google
                  Authenticator, Authy, etc.)
                </p>
                {totpQrCode && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={totpQrCode}
                      alt="2FA QR Code"
                      className="border-2 border-gray-200 rounded-lg"
                    />
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Secret Key</p>
                      <code className="text-sm font-mono text-gray-900">
                        {totpSecret}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(totpSecret)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleVerify2FA}>
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-4">
                    Step 2: Enter Verification Code
                  </h3>
                  <Label htmlFor="totpVerificationCode" required>
                    6-Digit Code
                  </Label>
                  <div className="relative">
                    <Input
                      id="totpVerificationCode"
                      type="text"
                      placeholder="000000"
                      value={totpVerificationCode}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setTotpVerificationCode(value);
                      }}
                      className="pl-10 text-center text-lg tracking-widest"
                      maxLength={6}
                      disabled={is2FALoading}
                    />
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" isLoading={is2FALoading}>
                    Verify and Enable
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowTotpSetup(false);
                      setTotpVerificationCode("");
                    }}
                    disabled={is2FALoading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {is2FAEnabled && !showDisable2FA && (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-green-900 mb-1">
                      2FA is active
                    </h3>
                    <p className="text-sm text-green-800">
                      Your account is protected with two-factor authentication.
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="danger" onClick={() => setShowDisable2FA(true)}>
                Disable 2FA
              </Button>
            </div>
          )}

          {showDisable2FA && (
            <form onSubmit={handleDisable2FA}>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  To disable two-factor authentication, please enter your
                  password.
                </p>
                <Label htmlFor="disablePassword" required>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="disablePassword"
                    type="password"
                    placeholder="Enter your password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="pl-10"
                    disabled={is2FALoading}
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" variant="danger" isLoading={is2FALoading}>
                  Disable 2FA
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowDisable2FA(false);
                    setDisablePassword("");
                  }}
                  disabled={is2FALoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DashboardCard>
      )}

      {/* Passkeys Tab */}
      {activeTab === "passkeys" && (
        <DashboardCard className="max-w-2xl" contentClassName="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Passkeys
              </h2>
              <p className="text-gray-600 text-sm">
                Sign in quickly and securely with biometric authentication
              </p>
            </div>
          </div>

          {!isPasskeySupported && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-900 mb-1">
                    Passkeys not supported
                  </h3>
                  <p className="text-sm text-yellow-800">
                    Your browser doesn't support passkeys. Please use a modern
                    browser like Chrome, Safari, or Edge.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPasskeySupported && (
            <>
              <div className="mb-6">
                <Button
                  onClick={handleAddPasskey}
                  isLoading={isPasskeysLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Passkey
                </Button>
              </div>

              {isPasskeysLoading && passkeys.length === 0 ? (
                <LoadingSpinner />
              ) : passkeys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Key className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No passkeys registered yet</p>
                  <p className="text-sm mt-1">
                    Add a passkey to sign in more securely
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Fingerprint className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {passkey.name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Added{" "}
                            {new Date(passkey.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeletePasskeyDialog({ open: true, passkey })
                        }
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DashboardCard>
      )}

      {/* Delete Passkey Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletePasskeyDialog.open}
        onClose={() => setDeletePasskeyDialog({ open: false, passkey: null })}
        onConfirm={handleDeletePasskey}
        title="Delete Passkey"
        message={`Are you sure you want to delete this passkey? You won't be able to use it to sign in anymore.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
