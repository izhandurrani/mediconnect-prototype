import { useState, useEffect } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export function useAuth() {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [confirmResult, setConfirmResult] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Step 1: Send OTP
  async function sendOTP(phoneNumber) {
    // phoneNumber format: "+919876543210"
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",   // empty <div id="recaptcha-container"> in LoginScreen
        { size: "invisible" }
      );
    }
    const result = await signInWithPhoneNumber(
      auth, phoneNumber, window.recaptchaVerifier
    );
    setConfirmResult(result);
    return result;
  }

  // Step 2: Verify OTP
  async function verifyOTP(otp) {
    if (!confirmResult) throw new Error("No OTP sent yet");
    const credential = await confirmResult.confirm(otp);
    return credential.user;
  }

  return { user, loading, sendOTP, verifyOTP };
}
