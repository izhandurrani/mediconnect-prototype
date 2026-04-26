import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import ErrorBanner from '../components/ErrorBanner';

/* ── Status → visual config ── */
const STATUS_CONFIG = {
  calling: {
    label: 'Calling...',
    dotClass: 'bg-amber animate-pulse',
    textClass: 'text-amber',
    borderClass: '',
    icon: '📞',
  },
  confirmed: {
    label: 'Confirmed ✓',
    dotClass: 'bg-green',
    textClass: 'text-green',
    borderClass: 'border-green bg-green/5',
    icon: '✅',
  },
  rejected: {
    label: 'Rejected ✕',
    dotClass: 'bg-red',
    textClass: 'text-red',
    borderClass: 'border-red/30 bg-red/5',
    icon: '❌',
  },
  no_answer: {
    label: 'No Answer',
    dotClass: 'bg-slate-300',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-200 bg-slate-50',
    icon: '⏳',
  },
  waiting: {
    label: 'Waiting...',
    dotClass: 'bg-slate-200 animate-pulse',
    textClass: 'text-slate-400',
    borderClass: '',
    icon: '⏳',
  },
};

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

  // ── Derive per-hospital status from ivrResponses map ────────────
  const contactedIds = emergency?.hospitalsContacted || [];
  const confirmedIds = emergency?.confirmed || [];
  const ivrResponses = emergency?.ivrResponses || {};

  const displayHospitals = contactedIds.map((id) => {
    const info = hospitalMap[id] || { name: 'Loading...' };

    // Priority: ivrResponses map (set by webhook) → confirmed array → calling
    let status = 'calling';
    if (ivrResponses[id]?.status) {
      status = ivrResponses[id].status; // "confirmed" | "rejected"
    } else if (confirmedIds.includes(id)) {
      status = 'confirmed';
    }

    return { id, name: info.name, status };
  });

  // Counts
  const confirmedCount = displayHospitals.filter((h) => h.status === 'confirmed').length;
  const rejectedCount = displayHospitals.filter((h) => h.status === 'rejected').length;
  const callingCount = displayHospitals.filter((h) => h.status === 'calling').length;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <style>{`
        @keyframes card-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.15); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
        }
        @keyframes card-confirm {
          0% { transform: scale(0.97); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .card-calling { animation: card-pulse 2s ease-in-out infinite; }
        .card-confirmed { animation: card-confirm 0.4s ease-out forwards; }
      `}</style>

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
          ? `${contactedIds.length} hospitals contacted · ${confirmedCount} confirmed · ${callingCount} calling (${secondsLeft}s)`
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

        {/* Hospital list — real-time status cards */}
        <div className="w-full flex flex-col gap-[8px] mt-[4px]">
          {displayHospitals.length > 0 ? (
            displayHospitals.map((h) => {
              const config = STATUS_CONFIG[h.status] || STATUS_CONFIG.waiting;
              const cardClass =
                h.status === 'calling' ? 'card-calling' :
                h.status === 'confirmed' ? 'card-confirmed' : '';

              return (
                <div
                  key={h.id}
                  className={`flex items-center gap-[12px] p-[12px_14px] bg-white rounded-xl border transition-all duration-300 ${config.borderClass || 'border-slate-100'} ${cardClass}`}
                >
                  {/* Status dot */}
                  <div className={`w-[10px] h-[10px] rounded-full shrink-0 transition-colors duration-300 ${config.dotClass}`}></div>

                  {/* Hospital name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text truncate">{h.name}</div>
                  </div>

                  {/* Status badge */}
                  <div className={`text-[11px] font-bold shrink-0 transition-colors duration-300 ${config.textClass}`}>
                    {config.label}
                  </div>
                </div>
              );
            })
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
