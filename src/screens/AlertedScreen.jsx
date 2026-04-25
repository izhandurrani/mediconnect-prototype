import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

export default function AlertedScreen() {
  const navigate = useNavigate();
  const {
    emergencyId, selectedHospital, emergencyType, activeScheme, location,
  } = useAppContext();

  const { selectHospital } = useEmergency(emergencyId);
  const { navigateTo, getDistanceETA } = useGoogleMaps();

  const [eta, setEta] = useState(null);
  const alertedRef = useRef(false);

  // ── On mount: call selectHospital (triggers FCM Cloud Function) ──
  useEffect(() => {
    if (!alertedRef.current && selectedHospital?.id && emergencyId) {
      alertedRef.current = true;
      selectHospital(selectedHospital.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospital?.id, emergencyId]);

  // ── Get real ETA ────────────────────────────────────────────────
  useEffect(() => {
    if (!location?.lat || !selectedHospital?.lat) return;

    getDistanceETA(location.lat, location.lng, selectedHospital.lat, selectedHospital.lng)
      .then((result) => setEta(result))
      .catch(() => {
        // Fallback: estimate from distanceKm
        const dist = selectedHospital.distanceKm || 5;
        setEta({ distanceKm: dist, durationMin: Math.max(2, Math.round(dist * 2.5)) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, selectedHospital?.lat]);

  const schemeName = activeScheme === 'mj' ? 'MJPJAY' : activeScheme === 'ab' ? 'Ayushman Bharat' : '';

  function handleNavigate() {
    if (selectedHospital?.lat && selectedHospital?.lng) {
      navigateTo(selectedHospital.lat, selectedHospital.lng, selectedHospital.name || 'Hospital');
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC]">
      <style>{`
        @keyframes check-pop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
        @keyframes ring-grow { 0%{transform:scale(.6);opacity:.3} 100%{transform:scale(2.5);opacity:0} }
        @keyframes fade-up   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">

        {/* Success animation */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-green/20" style={{ animation: 'ring-grow 2s ease-out infinite' }}></div>
          <div className="absolute inset-4 rounded-full border-2 border-green/10" style={{ animation: 'ring-grow 2s ease-out infinite 0.5s' }}></div>
          <div
            className="w-20 h-20 rounded-full bg-green flex items-center justify-center shadow-xl shadow-green/30 relative z-10"
            style={{ animation: 'check-pop 0.6s ease-out forwards' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center" style={{ animation: 'fade-up 0.5s ease-out 0.3s both' }}>
          <div className="text-2xl font-black text-slate-800 tracking-tight">Hospital Alerted!</div>
          <div className="text-sm text-slate-400 mt-2 font-medium max-w-sm mx-auto">
            {selectedHospital?.name || 'The hospital'} has been notified of your arrival. They are preparing for your emergency.
          </div>
        </div>

        {/* Info Cards */}
        <div className="w-full max-w-md flex flex-col gap-3" style={{ animation: 'fade-up 0.5s ease-out 0.5s both' }}>

          {/* Hospital */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">Selected Hospital</div>
            <div className="text-lg font-bold text-slate-800">{selectedHospital?.name || 'Hospital'}</div>
            {selectedHospital?.city && (
              <div className="text-xs text-slate-400 mt-1">{selectedHospital.city}, Maharashtra</div>
            )}
          </div>

          {/* Emergency Type */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Emergency Type</div>
              <div className="text-sm font-bold text-slate-800 capitalize">{emergencyType || 'Medical'}</div>
            </div>
            {schemeName && (
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-brand/5 text-brand">
                {schemeName}
              </span>
            )}
          </div>

          {/* ETA */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">Estimated Time of Arrival</div>
            {eta ? (
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-brand leading-none">~{eta.durationMin}</span>
                <span className="text-sm text-slate-400 font-medium pb-0.5">minutes</span>
                <span className="text-xs text-slate-300 ml-auto">({eta.distanceKm} km)</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400">Calculating...</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full max-w-md flex flex-col gap-3 mt-2" style={{ animation: 'fade-up 0.5s ease-out 0.7s both' }}>
          <button
            onClick={handleNavigate}
            className="w-full bg-brand text-white py-4 rounded-2xl text-base font-bold shadow-xl shadow-brand/20 border-none cursor-pointer flex items-center justify-center gap-3 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Navigate to Hospital
          </button>

          {selectedHospital?.phone && (
            <a
              href={`tel:${selectedHospital.phone}`}
              className="w-full bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 no-underline active:scale-[0.97] transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563EB">
                <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              Call {selectedHospital.name}
            </a>
          )}

          <button
            onClick={() => navigate('/home')}
            className="text-xs text-slate-400 font-medium py-2 bg-transparent border-none cursor-pointer hover:text-slate-600"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
