import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import ErrorBanner from "../components/ErrorBanner";
import PasswordInput from "../components/PasswordInput";
import LoadingSpinner from "../components/LoadingSpinner";

// ── Validation ──────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [bannerError, setBannerError] = useState(null);
  const [resetSent, setResetSent] = useState(false);

  const displayError = bannerError || authError;

  // Determine if user has completed onboarding (language set in Firestore)
  async function routeAfterAuth(user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().language) {
        navigate("/home");
      } else {
        navigate("/language");
      }
    } catch {
      navigate("/language");
    }
  }

  // ── Email / Password Sign In ────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setBannerError(null);
    setResetSent(false);

    const errors = {};
    if (!email || !EMAIL_RE.test(email)) errors.email = "Please enter a valid email.";
    if (!password) errors.password = "Please enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      await routeAfterAuth(user);
    } catch {
      // authError is set by the hook
    } finally {
      setIsLoading(false);
    }
  }

  // ── Google OAuth ────────────────────────────────────────────────
  async function handleGoogle() {
    setBannerError(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) await routeAfterAuth(user);
    } catch {
      // hook sets authError
    } finally {
      setIsLoading(false);
    }
  }

  // ── Forgot Password ────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email || !EMAIL_RE.test(email)) {
      setFieldErrors({ email: "Enter your email above first." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setBannerError(null);
    } catch {
      setBannerError("Could not send reset email. Check the address and try again.");
    }
  }

  return (
    <div className="flex-1 px-5 pt-12 pb-6 flex flex-col gap-0 bg-white min-h-[580px]">

      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 mb-7">
        <img
          src="/icons/icon-192.png"
          alt="MediConnect"
          className="w-10 h-10 rounded-xl object-contain"
        />
        <div className="text-[18px] font-extrabold text-text">MediConnect</div>
      </div>

      {/* Heading */}
      <div className="text-[20px] font-bold text-text mb-1">Welcome back</div>
      <div className="text-[13px] text-text2 mb-[22px]">Sign in to access emergency services</div>

      {/* Error Banner */}
      <ErrorBanner message={displayError} onDismiss={() => setBannerError(null)} />

      {/* Reset success toast */}
      {resetSent && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          Reset link sent to your email
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* Email */}
        <div className="mb-[14px]">
          <div className="text-[12px] font-semibold text-text2 mb-[5px]">Email</div>
          <input
            className={`w-full p-[11px_12px] border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white ${fieldErrors.email ? 'border-red-400' : 'border-border'}`}
            placeholder="rahul@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          {fieldErrors.email && <div className="text-[11px] text-red-500 mt-1 font-medium">{fieldErrors.email}</div>}
        </div>

        {/* Password */}
        <PasswordInput
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          error={fieldErrors.password}
        />

        {/* Forgot password */}
        <div className="flex justify-end mb-2 -mt-2">
          <button
            type="button"
            className="text-[11px] text-brand2 font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline"
            onClick={handleForgotPassword}
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer mb-[10px] tracking-wide disabled:opacity-70 mt-[10px] flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner size="sm" /> : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-2.5 my-[14px] text-[12px] text-text3 before:content-[''] before:flex-1 before:h-[1px] before:bg-border after:content-[''] after:flex-1 after:h-[1px] after:bg-border">
        or
      </div>

      {/* Google */}
      <button
        className="w-full p-[11px] bg-white border border-border rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold text-text cursor-pointer disabled:opacity-70"
        onClick={handleGoogle}
        disabled={isLoading}
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M15.5 8.2c0-.6-.1-1.2-.2-1.7H8v3.2h4.2c-.2.9-.7 1.7-1.5 2.2v1.8h2.4c1.4-1.3 2.4-3.2 2.4-5.5z" fill="#4285F4" />
          <path d="M8 16c2.2 0 4-.7 5.3-2L11 12.2c-.7.5-1.6.8-2.9.8-2.2 0-4.1-1.5-4.7-3.5H1.3v1.9C2.6 14.1 5.1 16 8 16z" fill="#34A853" />
          <path d="M3.3 9.5c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V4H1.3C.5 5.5 0 7.2 0 9c0 1.8.5 3.5 1.3 5l2-1.5z" fill="#FBBC05" />
          <path d="M8 3.2c1.2 0 2.3.4 3.2 1.3L13.5 2C12 .8 10.2 0 8 0 5.1 0 2.6 1.9 1.3 4.7l2 1.5c.6-1.9 2.5-3 4.7-3z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      {/* Link to Sign Up */}
      <div className="text-center text-[12px] text-text2 mt-4">
        Don't have an account?{" "}
        <span
          className="text-brand2 font-semibold cursor-pointer"
          onClick={() => navigate("/signup")}
        >
          Sign up
        </span>
      </div>
    </div>
  );
}
