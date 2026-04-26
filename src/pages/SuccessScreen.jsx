import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function SuccessScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    hospitalName = 'Hospital',
    hospitalPhone,
    hospitalLat,
    hospitalLng,
    emergencyId,
  } = location.state || {};

  function handleNavigateToHospital() {
    if (hospitalLat && hospitalLng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${hospitalLat},${hospitalLng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-green-50/30">
      <style>{`
        @keyframes check-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ring-grow {
          0% { transform: scale(0.6); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">

        {/* Success animation */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border-2 border-green-500/20"
            style={{ animation: 'ring-grow 2s ease-out infinite' }}
          />
          <div
            className="absolute inset-4 rounded-full border-2 border-green-500/10"
            style={{ animation: 'ring-grow 2s ease-out infinite 0.5s' }}
          />
          <div
            className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30 relative z-10"
            style={{ animation: 'check-pop 0.6s ease-out forwards' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center animate-fade-up">
          <div className="text-2xl font-black text-slate-800 tracking-tight">Hospital Alerted!</div>
          <div className="text-sm text-slate-400 mt-2 font-medium max-w-sm mx-auto leading-relaxed">
            <span className="font-bold text-green-600">{hospitalName}</span> has been notified of your arrival.
            They are preparing for your emergency.
          </div>
        </div>

        {/* Info card */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-5 shadow-sm animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">Selected Hospital</div>
          <div className="text-lg font-bold text-slate-800">{hospitalName}</div>
          {emergencyId && (
            <div className="text-[10px] text-slate-300 mt-1 font-mono">
              Emergency ID: {emergencyId.slice(0, 8)}...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          {/* Google Maps */}
          <button
            onClick={handleNavigateToHospital}
            className="w-full bg-brand text-white py-4 rounded-2xl text-base font-bold shadow-xl shadow-brand/20 border-none cursor-pointer flex items-center justify-center gap-3 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            Open in Google Maps →
          </button>

          {/* Call hospital directly */}
          {hospitalPhone && (
            <a
              href={`tel:${hospitalPhone}`}
              className="w-full bg-white text-slate-700 border border-slate-200 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 no-underline active:scale-[0.97] transition-transform"
            >
              📞 Call {hospitalName}
            </a>
          )}

          {/* 108 ambulance */}
          <a
            href="tel:108"
            className="w-full bg-red-50 text-red-600 border border-red-200 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 no-underline active:scale-[0.97] transition-transform"
          >
            🚑 Also call 108 for ambulance transport
          </a>

          {/* Home */}
          <button
            onClick={() => navigate('/home')}
            className="text-xs text-slate-400 font-medium py-2 bg-transparent border-none cursor-pointer hover:text-slate-600 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
