import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { startEmergency } from '../firebase/emergencyHelpers';

export default function CallingScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    hospitals = [],
    emergencyType = 'other',
    userLocation,
    language = 'en',
    scheme = 'mj',
  } = location.state || {};

  const [emergencyId, setEmergencyId] = useState(null);
  const [alerts, setAlerts] = useState({}); // hospitalId → { status, hospitalName, ... }
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  const didStartRef = useRef(false);

  // ── On mount: start emergency (create docs, trigger IVR) ──
  useEffect(() => {
    if (didStartRef.current || !userLocation || hospitals.length === 0) return;
    didStartRef.current = true;

    async function initEmergency() {
      setStarting(true);
      try {
        const id = await startEmergency(
          emergencyType,
          hospitals,
          userLocation,
          scheme,
          language
        );
        setEmergencyId(id);
      } catch (err) {
        console.error('startEmergency failed:', err);
        setError('Failed to start emergency calls. Please go back and try again.');
      } finally {
        setStarting(false);
      }
    }

    initEmergency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen to emergency_alerts in real-time ──
  useEffect(() => {
    if (!emergencyId) return;

    const q = query(
      collection(db, 'emergency_alerts'),
      where('emergencyId', '==', emergencyId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const updated = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        updated[data.hospitalId] = {
          status: data.status || 'calling',
          hospitalName: data.hospitalName || 'Hospital',
          respondedAt: data.respondedAt,
        };
      });
      setAlerts(updated);
    });

    return unsub;
  }, [emergencyId]);

  // ── Derive status for each hospital ──
  function getStatus(hospitalId) {
    return alerts[hospitalId]?.status || 'calling';
  }

  // ── Counts ──
  const counts = useMemo(() => {
    let confirmed = 0, calling = 0, rejected = 0;
    hospitals.forEach((h) => {
      const s = getStatus(h.id);
      if (s === 'confirmed') confirmed++;
      else if (s === 'rejected') rejected++;
      else calling++;
    });
    return { confirmed, calling, rejected };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitals, alerts]);

  // ── Navigate to results ──
  function handleSeeResults() {
    navigate('/results', {
      state: { emergencyId, hospitals, emergencyType },
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-red-600 p-4 flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center border-none cursor-pointer text-sm backdrop-blur-sm"
        >
          ←
        </button>
        <div className="text-white flex-1">
          <div className="text-base font-bold">Calling {hospitals.length} Hospitals</div>
          <div className="text-[11px] opacity-70 capitalize">{emergencyType} Emergency</div>
        </div>
        <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
      </div>

      {/* ── Status Counters ── */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-100 shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[11px] font-bold text-green-700">✅ {counts.confirmed} confirmed</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-dot" />
          <span className="text-[11px] font-bold text-amber-700">📞 {counts.calling} calling</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[11px] font-bold text-red-600">❌ {counts.rejected} no answer</span>
        </div>
      </div>

      {/* ── Phone pulse animation ── */}
      <div className="flex items-center justify-center py-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute w-16 h-16 rounded-full border-2 border-red-300/30 animate-ping" />
          <div className="absolute w-12 h-12 rounded-full border-2 border-red-400/50 animate-ping" style={{ animationDelay: '0.3s' }} />
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center relative z-10 shadow-lg shadow-red-500/30" style={{ animation: 'phone-pulse 1.5s ease-in-out infinite' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3h3l1.5 3.75-2.25 1.5c1.1 2.25 3 4.15 5.25 5.25l1.5-2.25L16 13v3a2 2 0 01-2 2C5.2 18 0 12.8 0 5a2 2 0 012-2h1z" fill="white" opacity=".9" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          <div className="text-xs text-red-600 font-medium text-center">{error}</div>
        </div>
      )}

      {/* ── Hospital cards ── */}
      <div className="flex-1 overflow-y-auto pb-28 px-4">
        {starting ? (
          <div className="flex items-center justify-center gap-3 p-6">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
            <span className="text-sm text-slate-400 font-medium">Initiating calls...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hospitals.map((h) => {
              const status = getStatus(h.id);
              return <CallingCard key={h.id} hospital={h} status={status} />;
            })}
          </div>
        )}
      </div>

      {/* ── Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleSeeResults}
          disabled={starting}
          className="w-full py-4 bg-brand text-white border-none rounded-2xl text-base font-bold cursor-pointer flex items-center justify-center gap-3 shadow-xl shadow-brand/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97] disabled:opacity-50"
        >
          {counts.confirmed > 0 && (
            <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
              {counts.confirmed}
            </span>
          )}
          See Results →
        </button>
      </div>
    </div>
  );
}

/* ── CallingCard sub-component ── */
function CallingCard({ hospital, status }) {
  const isGovt =
    hospital.name?.toLowerCase().includes('govt') ||
    hospital.name?.toLowerCase().includes('government') ||
    hospital.name?.toLowerCase().includes('civil');

  const config = {
    calling: {
      cardClass: 'animate-pulse-border border-amber-400 bg-amber-50/30',
      dotClass: 'bg-amber-400 animate-pulse-dot',
      label: 'Calling...',
      labelClass: 'text-amber-600',
    },
    confirmed: {
      cardClass: 'border-2 border-green-400 bg-green-50/50 animate-confirm-pop',
      dotClass: 'bg-green-500',
      label: '✓ Confirmed',
      labelClass: 'text-green-600',
    },
    rejected: {
      cardClass: 'border-2 border-red-300 bg-red-50/30',
      dotClass: 'bg-red-400',
      label: '✗ No Answer',
      labelClass: 'text-red-500',
    },
  }[status] || {
    cardClass: 'border-2 border-slate-200 bg-slate-50/50',
    dotClass: 'bg-slate-300',
    label: 'Waiting...',
    labelClass: 'text-slate-400',
  };

  return (
    <div className={`rounded-2xl p-4 transition-all duration-300 ${config.cardClass}`}>
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={`w-3 h-3 rounded-full shrink-0 ${config.dotClass}`} />

        {/* Name + distance */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{hospital.name}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            {hospital.distanceKm} km · {isGovt ? 'Govt.' : 'Private'}
          </div>
        </div>

        {/* Status label */}
        <div className={`text-xs font-bold shrink-0 ${config.labelClass}`}>
          {config.label}
        </div>
      </div>
    </div>
  );
}
