import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../hooks/useAuth";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { sendOTP, verifyOTP, loading } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("PHONE"); // "PHONE" or "OTP"
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendOTP = async () => {
    if (!phoneNumber) {
      setError("Please enter a valid phone number.");
      return;
    }
    
    setIsProcessing(true);
    setError("");
    try {
      // Assuming phone number should have +91 prefix for India
      const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
      await sendOTP(formattedPhone);
      setStep("OTP");
    } catch (err) {
      setError(err.message || "Failed to send OTP. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError("Please enter the OTP.");
      return;
    }

    setIsProcessing(true);
    setError("");
    try {
      await verifyOTP(otp);
      navigate('/language');
    } catch (err) {
      setError(err.message || "Invalid OTP. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 px-5 pt-12 pb-6 flex flex-col gap-0 bg-white min-h-[580px]">
      <div className="flex items-center gap-2.5 mb-7">
        <div className="w-9.5 h-9.5 bg-brand rounded-xl flex items-center justify-center shrink-0 w-[38px] h-[38px]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="9" y="3" width="2" height="14" rx="1" fill="white" />
            <rect x="3" y="9" width="14" height="2" rx="1" fill="white" />
          </svg>
        </div>
        <div className="text-[18px] font-extrabold text-text">MediConnect</div>
      </div>
      
      <div className="text-[20px] font-bold text-text mb-1">Welcome back</div>
      <div className="text-[13px] text-text2 mb-[22px]">Sign in to access emergency services</div>

      {error && (
        <div className="mb-4 p-3 bg-red-l text-red text-xs rounded-lg">
          {error}
        </div>
      )}

      {step === "PHONE" ? (
        <>
          <div className="mb-[14px]">
            <div className="text-[12px] font-semibold text-text2 mb-[5px]">Phone number</div>
            <input 
              className="w-full p-[11px_12px] border border-border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white"
              placeholder="+91 98765 43210" 
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          
          <button 
            className="w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer mb-[10px] tracking-wide disabled:opacity-70 mt-[14px]"
            onClick={handleSendOTP}
            disabled={isProcessing}
          >
            {isProcessing ? "Sending OTP..." : "Continue"}
          </button>
          
          <div className="flex items-center gap-2.5 my-[14px] text-[12px] text-text3 before:content-[''] before:flex-1 before:h-[1px] before:bg-border after:content-[''] after:flex-1 after:h-[1px] after:bg-border">
            or
          </div>
          
          <button className="w-full p-[11px] bg-white border border-border rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold text-text cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M15.5 8.2c0-.6-.1-1.2-.2-1.7H8v3.2h4.2c-.2.9-.7 1.7-1.5 2.2v1.8h2.4c1.4-1.3 2.4-3.2 2.4-5.5z" fill="#4285F4" />
              <path d="M8 16c2.2 0 4-.7 5.3-2L11 12.2c-.7.5-1.6.8-2.9.8-2.2 0-4.1-1.5-4.7-3.5H1.3v1.9C2.6 14.1 5.1 16 8 16z" fill="#34A853" />
              <path d="M3.3 9.5c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V4H1.3C.5 5.5 0 7.2 0 9c0 1.8.5 3.5 1.3 5l2-1.5z" fill="#FBBC05" />
              <path d="M8 3.2c1.2 0 2.3.4 3.2 1.3L13.5 2C12 .8 10.2 0 8 0 5.1 0 2.6 1.9 1.3 4.7l2 1.5c.6-1.9 2.5-3 4.7-3z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          
          <div className="text-center text-[12px] text-text2 mt-4">
            Don't have an account? <span className="text-brand2 font-semibold cursor-pointer">Sign up</span>
          </div>
        </>
      ) : (
        <>
          <div className="mb-[14px]">
            <div className="text-[12px] font-semibold text-text2 mb-[5px]">Enter OTP</div>
            <input 
              className="w-full p-[11px_12px] border border-border rounded-xl text-[13px] text-text bg-gray outline-none focus:border-brand2 focus:bg-white tracking-[0.5em] text-center font-bold"
              placeholder="••••••" 
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          
          <button 
            className="w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer mb-[10px] tracking-wide disabled:opacity-70 mt-[14px]"
            onClick={handleVerifyOTP}
            disabled={isProcessing}
          >
            {isProcessing ? "Verifying..." : "Verify OTP & Login"}
          </button>
          
          <div className="text-center text-[12px] text-text2 mt-4">
            Didn't receive the code? <span className="text-brand2 font-semibold cursor-pointer" onClick={() => setStep("PHONE")}>Try again</span>
          </div>
        </>
      )}

      {/* Invisible Recaptcha Container required for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
