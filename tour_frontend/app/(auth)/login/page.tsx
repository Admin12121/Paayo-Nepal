"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, KeyRound, Fingerprint } from "lucide-react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Checkbox from "@/components/ui/checkbox";
import {
  signInWithEmail,
  signInWithSocial,
  signInWithPasskey,
  verifyTwoFactor,
} from "@/lib/auth-client";
import { toast } from "@/lib/utils/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [is2FALoading, setIs2FALoading] = useState(false);

  // Form validation
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    totpCode?: string;
  }>({});

  // Check if passkeys are supported (after hydration to avoid mismatch)
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  useEffect(() => {
    setIsPasskeySupported(
      typeof window !== "undefined" && window.PublicKeyCredential !== undefined,
    );
  }, []);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!requires2FA && !password) {
      newErrors.password = "Password is required";
    } else if (!requires2FA && password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (requires2FA && !totpCode) {
      newErrors.totpCode = "Verification code is required";
    } else if (requires2FA && totpCode.length !== 6) {
      newErrors.totpCode = "Code must be 6 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // If 2FA is required, verify the TOTP code
    if (requires2FA) {
      setIs2FALoading(true);
      try {
        const result = await verifyTwoFactor(totpCode);

        if (result.error) {
          toast.error(result.error.message || "Invalid verification code");
          setErrors({ totpCode: "Invalid verification code" });
          return;
        }

        toast.success("Login successful!");
        router.push("/dashboard");
      } catch (error) {
        toast.error("Failed to verify code. Please try again.");
        console.error("2FA verification error:", error);
      } finally {
        setIs2FALoading(false);
      }
      return;
    }

    // Initial sign in
    setIsLoading(true);
    try {
      const result = await signInWithEmail(email, password);

      if (result.error) {
        // Check if 2FA is required
        if (
          result.error.message?.includes("2FA") ||
          result.error.message?.includes("two-factor")
        ) {
          setRequires2FA(true);
          toast.info("Please enter your 2FA code");
          return;
        }

        toast.error(result.error.message || "Invalid email or password");
        setErrors({
          email: "Invalid email or password",
          password: "Invalid email or password",
        });
        return;
      }

      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred. Please try again.";
      toast.error(message);
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithSocial("google");
      // The redirect happens automatically
    } catch (error) {
      toast.error("Failed to sign in with Google");
      console.error("Google sign-in error:", error);
      setIsGoogleLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    if (!isPasskeySupported) {
      toast.error("Passkeys are not supported in your browser");
      return;
    }

    setIsPasskeyLoading(true);
    try {
      const result = await signInWithPasskey();

      if (result.error) {
        toast.error(result.error.message || "Failed to sign in with passkey");
        return;
      }

      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error) {
      toast.error("Failed to sign in with passkey");
      console.error("Passkey sign-in error:", error);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
        <p className="text-gray-600">Sign in to your account to continue</p>
      </div>

      {/* Social sign-in */}
      <div className="space-y-3 mb-6">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isLoading || is2FALoading || isPasskeyLoading}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        {isPasskeySupported && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handlePasskeySignIn}
            isLoading={isPasskeyLoading}
            disabled={isLoading || is2FALoading || isGoogleLoading}
          >
            <Fingerprint className="w-5 h-5 mr-2" />
            Sign in with Passkey
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" required>
            Email address
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              error={errors.email}
              disabled={isLoading || is2FALoading || requires2FA}
              className="pl-10"
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {!requires2FA && (
          <div>
            <Label htmlFor="password" required>
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors({ ...errors, password: undefined });
                }}
                error={errors.password}
                disabled={isLoading || is2FALoading}
                className="pl-10 pr-10"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* 2FA Code Input */}
        {requires2FA && (
          <div>
            <Label htmlFor="totpCode" required>
              Two-Factor Authentication Code
            </Label>
            <div className="relative">
              <Input
                id="totpCode"
                type="text"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTotpCode(value);
                  if (errors.totpCode)
                    setErrors({ ...errors, totpCode: undefined });
                }}
                error={errors.totpCode}
                disabled={is2FALoading}
                className="pl-10 text-center text-lg tracking-widest"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        )}

        {!requires2FA && (
          <div className="flex items-center justify-between">
            <Checkbox
              id="rememberMe"
              label="Remember me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading || is2FALoading}
          disabled={isGoogleLoading || isPasskeyLoading}
        >
          {requires2FA ? "Verify Code" : "Sign in"}
        </Button>

        {requires2FA && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setRequires2FA(false);
              setTotpCode("");
              setErrors({});
            }}
            disabled={is2FALoading}
          >
            Back to login
          </Button>
        )}
      </form>

      {/* Sign up link */}
      <p className="text-center text-sm text-gray-600 mt-6">
        Don't have an account?{" "}
        <Link
          href="/register"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
