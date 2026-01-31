"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Check, X } from "lucide-react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/Label";
import { signUpWithEmail, signInWithSocial } from "@/lib/auth-client";
import { toast } from "@/lib/utils/toast";

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Form validation
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;

    let score = 0;
    let label = "";
    let color = "";

    if (passedChecks === 0) {
      score = 0;
      label = "";
      color = "";
    } else if (passedChecks <= 2) {
      score = 25;
      label = "Weak";
      color = "bg-red-500";
    } else if (passedChecks === 3) {
      score = 50;
      label = "Fair";
      color = "bg-orange-500";
    } else if (passedChecks === 4) {
      score = 75;
      label = "Good";
      color = "bg-yellow-500";
    } else {
      score = 100;
      label = "Strong";
      color = "bg-green-500";
    }

    return { score, label, color, checks };
  };

  const passwordStrength = calculatePasswordStrength(password);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (passwordStrength.score < 50) {
      newErrors.password = "Please choose a stronger password";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!acceptTerms) {
      newErrors.terms = "You must accept the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUpWithEmail(email, password, name);

      if (result.error) {
        toast.error(result.error.message || "Failed to create account");

        // Handle specific errors
        if (result.error.message?.includes("email")) {
          setErrors({ email: "This email is already registered" });
        }
        return;
      }

      toast.success(
        "Account created! An admin will review and activate your account shortly.",
      );
      router.push("/dashboard");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error("Registration error:", error);
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Create an account
        </h1>
        <p className="text-gray-600">Start your journey with Paoyo Nepal</p>
      </div>

      {/* Social sign-up */}
      <div className="mb-6">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogleSignIn}
          isLoading={isGoogleLoading}
          disabled={isLoading}
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

      {/* Registration form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" required>
            Full name
          </Label>
          <div className="relative">
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              error={errors.name}
              disabled={isLoading}
              className="pl-10"
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

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
              disabled={isLoading}
              className="pl-10"
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div>
          <Label htmlFor="password" required>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors({ ...errors, password: undefined });
              }}
              error={errors.password}
              disabled={isLoading}
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

          {/* Password strength indicator */}
          {password && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
                {passwordStrength.label && (
                  <span className="text-xs font-medium text-gray-600">
                    {passwordStrength.label}
                  </span>
                )}
              </div>

              {/* Password requirements */}
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div
                  className={`flex items-center gap-1 ${passwordStrength.checks.length ? "text-green-600" : "text-gray-400"}`}
                >
                  {passwordStrength.checks.length ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  <span>8+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? "text-green-600" : "text-gray-400"}`}
                >
                  {passwordStrength.checks.uppercase ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  <span>Uppercase</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? "text-green-600" : "text-gray-400"}`}
                >
                  {passwordStrength.checks.lowercase ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  <span>Lowercase</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${passwordStrength.checks.number ? "text-green-600" : "text-gray-400"}`}
                >
                  {passwordStrength.checks.number ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  <span>Number</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${passwordStrength.checks.special ? "text-green-600" : "text-gray-400"}`}
                >
                  {passwordStrength.checks.special ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  <span>Special char</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword" required>
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: undefined });
              }}
              error={errors.confirmPassword}
              disabled={isLoading}
              className="pl-10 pr-10"
            />
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-start">
            <input
              id="acceptTerms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (errors.terms) setErrors({ ...errors, terms: undefined });
              }}
              disabled={isLoading}
              className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            />
            <label
              htmlFor="acceptTerms"
              className="ml-2 text-sm text-gray-700 cursor-pointer"
            >
              I agree to the{" "}
              <Link
                href="/terms"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
          {errors.terms && (
            <p className="mt-1 text-sm text-red-600">{errors.terms}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={isGoogleLoading}
        >
          Create account
        </Button>
      </form>

      {/* Sign in link */}
      <p className="text-center text-sm text-gray-600 mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
