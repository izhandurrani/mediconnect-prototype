import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import ErrorBanner from '../components/ErrorBanner';

export default function CallingScreen() {
  const navigate = useNavigate();
  const { emergencyId, emergencyType } = useAppContext();

  // Live emergency doc via onSnapshot
  const { emergency } = useEmergency(emergencyId);

  // Hospital name cache (id → { name, phone })
  const [hospitalMap, setHospitalMap] = useState({});

  // 30-second countdown
  const [secondsLeft, setSecondsLeft] = useState(30);

  // No-hospitals warning (shows after 5s if hospitalsContacted is still empty)
  const [noHospitalsWarning, setNoHospitalsWarning] = useState(false);

  // ── Countdown timer → auto-advance ──────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/hospitals');
      return;
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, navigate]);

  // ── 5-second timeout: warn if no hospitals contacted ────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((emergency?.hospitalsContacted || []).length === 0) {
        setNoHospitalsWarning(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [emergency?.hospitalsContacted]);

  // Clear warning once hospitals start appearing
  useEffect(() => {
    if ((emergency?.hospitalsContacted || []).length > 0) {
      setNoHospitalsWarning(false);
    }
  }, [emergency?.hospitalsContacted]);

  // ── Fetch hospital docs for names when hospitalsContacted changes ──
  useEffect(() => {
    const ids = emergency?.hospitalsContacted || [];
    if (ids.length === 0) return;

    // Only fetch IDs we haven't cached yet
    const missing = ids.filter((id) => !hospitalMap[id]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map((id) =>
        getDoc(doc(db, 'hospitals', id))
          .then((snap) => (snap.exists() ? { id, ...snap.data() } : { id, name: 'Hospital' }))
          .catch(() => ({ id, name: 'Hospital' }))
      )
    ).then((results) => {
      setHospitalMap((prev) => {
        const next = { ...prev };
        results.forEach((h) => {
          next[h.id] = { name: h.name || 'Hospital', phone: h.phone || '' };
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergency?.hospitalsContacted]);

  // ── Derive display hospitals with live status ───────────────────
  const contactedIds = emergency?.hospitalsContacted || [];
  const confirmedIds = emergency?.confirmed || [];

  const displayHospitals = contactedIds.map((id) => {
    const info = hospitalMap[id] || { name: 'Loading...' };
    let status = 'waiting';
    if (confirmedIds.includes(id)) status = 'confirmed';
    else if (contactedIds.includes(id)) status = 'calling';
    return { id, name: info.name, status };
  });



  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Red header */}
      <div className="bg-red p-[14px_16px] flex items-center gap-[10px] shrink-0">
        <div className="text-white ml-[6px]">
          <div className="text-[15px] font-bold">Contacting hospitals</div>
          <div className="text-[11px] opacity-80 capitalize">
            {emergencyType || 'Emergency'} · 10km radius
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-[24px_24px_0] gap-[16px]">

        {/* Pulse Animation */}
        <div className="w-[80px] h-[80px] relative flex items-center justify-center my-4">
          <div className="absolute w-[80px] h-[80px] rounded-full border-[2px] border-red/30 animate-[ping_1.5s_ease-out_infinite]"></div>
          <div className="absolute w-[60px] h-[60px] rounded-full border-[2px] border-red/50 animate-[ping_1.5s_ease-out_infinite_0.3s]"></div>
          <div className="absolute w-[40px] h-[40px] rounded-full border-[2px] border-red/70 animate-[ping_1.5s_ease-out_infinite_0.6s]"></div>
          <div className="w-[40px] h-[40px] rounded-full bg-red flex items-center justify-center relative z-10">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3h3l1.5 3.75-2.25 1.5c1.1 2.25 3 4.15 5.25 5.25l1.5-2.25L16 13v3a2 2 0 01-2 2C5.2 18 0 12.8 0 5a2 2 0 012-2h1z" fill="white" opacity=".9" />
            </svg>
          </div>
        </div>

        <div className="text-[16px] font-bold text-text">Calling hospitals simultaneously</div>
        <div className="text-[12px] text-text2 text-center leading-[1.5]">
          {contactedIds.length > 0
          ? `${contactedIds.length} hospitals being contacted. Waiting for responses (${secondsLeft}s)`
          : `Initiating IVR broadcast... (${secondsLeft}s)`
        }
        </div>

        {/* No-hospitals warning */}
        {noHospitalsWarning && (
          <div className="w-full">
            <ErrorBanner
              message="No hospitals found in your area yet. The system will continue trying. You may also call 108 for ambulance assistance."
              onDismiss={() => setNoHospitalsWarning(false)}
            />
          </div>
        )}

        {/* Hospital list — real data */}
        <div className="w-full flex flex-col gap-[6px] mt-[4px]">
          {displayHospitals.length > 0 ? (
            displayHospitals.map((h) => (
              <div key={h.id} className="flex items-center gap-[10px] p-[8px_12px] bg-gray rounded-xl">
                <div className={`w-[8px] h-[8px] rounded-full shrink-0 ${
                  h.status === 'confirmed' ? 'bg-green' :
                  h.status === 'calling' ? 'bg-amber animate-pulse' : 'bg-border'
                }`}></div>
                <div className="text-[12px] font-semibold text-text flex-1 truncate">{h.name}</div>
                <div className={`text-[10px] font-semibold ${
                  h.status === 'confirmed' ? 'text-green' :
                  h.status === 'calling' ? 'text-amber' : 'text-text3'
                }`}>
                  {h.status === 'confirmed' ? 'Confirmed ✓' :
                   h.status === 'calling' ? 'Calling...' : 'Waiting...'}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-brand rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-medium">Waiting for Cloud Function to initiate calls...</span>
            </div>
          )}
        </div>

        {/* Countdown progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / 30) * 100}%` }}
          ></div>
        </div>

        <button
          className="mt-[10px] w-full p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer"
          onClick={() => navigate('/hospitals')}
        >
          See results now →
        </button>
      </div>
    </div>
  );
}
