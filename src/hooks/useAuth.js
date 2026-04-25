import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// ── Human-readable error map ────────────────────────────────────────────────
const SIGNUP_ERRORS = {
  "auth/email-already-in-use": "This email is already registered. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
};

const SIGNIN_ERRORS = {
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes.",
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Listen for auth state changes on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Sign Up (Email + Password) ──────────────────────────────────
  async function signUp(name, email, phone, password) {
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Set displayName on the Firebase Auth profile
      await updateProfile(credential.user, { displayName: name });

      // Create Firestore user document
      await setDoc(doc(db, "users", credential.user.uid), {
        name,
        email,
        phone,
        language: "mr",
        scheme: "mj",
        createdAt: serverTimestamp(),
        fcmToken: null,
      });

      return credential.user;
    } catch (err) {
      const msg = SIGNUP_ERRORS[err.code] || "Something went wrong. Please try again.";
      setAuthError(msg);
      throw err;
    }
  }

  // ── Sign In (Email + Password) ──────────────────────────────────
  async function signIn(email, password) {
    setAuthError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return credential.user;
    } catch (err) {
      const msg = SIGNIN_ERRORS[err.code] || "Sign in failed. Please try again.";
      setAuthError(msg);
      throw err;
    }
  }

  // ── Google OAuth ────────────────────────────────────────────────
  async function signInWithGoogle() {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Only create Firestore doc if it doesn't exist yet (first-time Google user)
      const userDocRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          name: result.user.displayName || "",
          email: result.user.email || "",
          phone: "",
          language: "mr",
          scheme: "mj",
          createdAt: serverTimestamp(),
          fcmToken: null,
        });
      }

      return result.user;
    } catch (err) {
      // User closed the popup — not an error
      if (err.code === "auth/popup-closed-by-user") return null;
      const msg = "Google sign-in failed. Please try again.";
      setAuthError(msg);
      throw err;
    }
  }

  // ── Logout ──────────────────────────────────────────────────────
  async function logout() {
    setAuthError(null);
    await signOut(auth);
  }

  return { user, loading, authError, signUp, signIn, signInWithGoogle, logout };
}
