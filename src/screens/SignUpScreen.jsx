import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import ErrorBanner from "../components/ErrorBanner";
import PasswordInput from "../components/PasswordInput";
import LoadingSpinner from "../components/LoadingSpinner";

// ── Validation helpers ──────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9]{10,13}$/;

function validate(name, email, phone, password) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = "Name must be at least 2 characters.";
  if (!email || !EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";
  if (!phone || !PHONE_RE.test(phone.replace(/\s/g, ""))) errors.phone = "Enter a valid phone number (10–13 digits).";
  if (!password || password.length < 6) errors.password = "Password must be at least 6 characters.";
  return errors;
}

export default function SignUpScreen() {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, authError } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [bannerError, setBannerError] = useState(null);

  // Sync hook error to banner
  const displayError = bannerError || authError;

  async function handleSubmit(e) {
    e.preventDefault();
    setBannerError(null);

    // Client-side validation
    const errors = validate(name, email, phone, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await signUp(name.trim(), email.trim(), phone.replace(/\s/g, ""), password);
      navigate("/language");
    } catch {
      // authError is set by the hook; also surface it as banner
      setBannerError(null); // hook already sets authError
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogle() {
    setBannerError(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) navigate("/language");
    } catch {
      // hook sets authError
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex-1 px-5 pt-10 pb-6 flex flex-col gap-0 bg-white min-h-[580px]">

      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-[38px] h-[38px] bg-brand rounded-xl flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="9" y="3" width="2" height="14" rx="1" fill="white" />
            <rect x="3" y="9" width="14" height="2" rx="1" fill="white" />
          </svg>
        </div>
        <div className="text-[18px] font-extrabold text-text">MediConnect</div>
      </div>

      {/* Heading */}
      <div className="text-[22px] font-bold text-text mb-1">Create account</div>
      <div className="text-[13px] text-text2 mb-5">Join MediConnect to access emergency services</div>

      {/* Error Banner */}
      <ErrorBanner message={displayError} onDismiss={() => setBannerError(null)} />

      <form onSubmit={handleSubmit} noValidate>

        {/* Full name */}
        <div className="mb-[14px]">
          <div className="text-[12px] font-semibold text-text2 mb-[5px]">Full name</div>
          <input
            className={`w-full p-[11px_12px] border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white ${fieldErrors.name ? 'border-red-400' : 'border-border'}`}
            placeholder="Rahul Sharma"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
          {fieldErrors.name && <div className="text-[11px] text-red-500 mt-1 font-medium">{fieldErrors.name}</div>}
        </div>

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

        {/* Phone */}
        <div className="mb-[14px]">
          <div className="text-[12px] font-semibold text-text2 mb-[5px]">Phone number</div>
          <input
            className={`w-full p-[11px_12px] border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white ${fieldErrors.phone ? 'border-red-400' : 'border-border'}`}
            placeholder="+91 98765 43210"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isLoading}
          />
          <div className="text-[10px] text-text3 mt-1">Stored in your profile — not used for login</div>
          {fieldErrors.phone && <div className="text-[11px] text-red-500 mt-1 font-medium">{fieldErrors.phone}</div>}
        </div>

        {/* Password */}
        <PasswordInput
          label="Password"
          placeholder="Min. 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          error={fieldErrors.password}
        />

        {/* Submit */}
        <button
          type="submit"
          className="w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer mb-[10px] tracking-wide disabled:opacity-70 mt-[14px] flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? <LoadingSpinner size="sm" /> : "Create Account"}
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

      {/* Link to Sign In */}
      <div className="text-center text-[12px] text-text2 mt-4">
        Already have an account?{" "}
        <span
          className="text-brand2 font-semibold cursor-pointer"
          onClick={() => navigate("/")}
        >
          Sign in
        </span>
      </div>
    </div>
  );
}
