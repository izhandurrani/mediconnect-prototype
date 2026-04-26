import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import HospitalCard from '../components/HospitalCard';
import LoadingSpinner from '../components/LoadingSpinner';

/* ── Haversine distance (km) ── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyHospitalsScreen() {
  const navigate = useNavigate();
  const {
    location,
    setLocation,
    activeScheme,
    selectedLanguage,
    emergencyType,
    setEmergencyId,
    setSelectedHospital,
  } = useAppContext();

  const { createEmergency } = useEmergency();

  // ── Local state ──
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Phase: "browse" → "calling"
  const [phase, setPhase] = useState('browse');
  const [callingEmergencyId, setCallingEmergencyId] = useState(null);
  const [startingCall, setStartingCall] = useState(false);

  // Live emergency doc (for calling phase)
  const [emergencyDoc, setEmergencyDoc] = useState(null);

  // ── Get GPS location ──
  useEffect(() => {
    if (location?.lat && location?.lng) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation({ lat: 19.8762, lng: 75.3433 }), // Aurangabad fallback
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocation({ lat: 19.8762, lng: 75.3433 });
    }
  }, [location, setLocation]);

  // ── Fetch hospitals from Firestore ──
  useEffect(() => {
    if (!location?.lat || !location?.lng) return;

    async function fetchHospitals() {
      setLoading(true);
      setError('');
      try {
        const snap = await getDocs(collection(db, 'hospitals'));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter: Aurangabad + has phone + isActive
        const filtered = all.filter((h) => {
          if (!h.lat || !h.lng || !h.phone) return false;
          if (h.isActive === false) return false;
          return true;
        });

        // Calculate distance
        const withDist = filtered.map((h) => ({
          ...h,
          distanceKm: haversineDistance(location.lat, location.lng, h.lat, h.lng),
        }));

        // Sort by distance, cap at 10km
        withDist.sort((a, b) => a.distanceKm - b.distanceKm);
        const nearby = withDist.filter((h) => h.distanceKm <= 15); // slightly wider for Aurangabad spread

        setHospitals(nearby);
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        setError('Failed to load hospitals. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchHospitals();
  }, [location]);

  // ── Listen to emergency doc when in calling phase ──
  useEffect(() => {
    if (!callingEmergencyId) return;

    const unsub = onSnapshot(
      doc(db, 'emergencies', callingEmergencyId),
      (snap) => {
        if (snap.exists()) {
          setEmergencyDoc({ id: snap.id, ...snap.data() });
        }
      }
    );

    return unsub;
  }, [callingEmergencyId]);

  // ── Start calling all hospitals ──
  async function handleStartCalling() {
    if (startingCall) return;
    setStartingCall(true);
    setError('');

    try {
      const userId = auth.currentUser?.uid || 'anonymous';
      const lat = location?.lat || 19.8762;
      const lng = location?.lng || 75.3433;

      // Create emergency document → triggers triggerIVR Cloud Function
      const id = await createEmergency({
        userId,
        type: emergencyType || 'voice',
        lat,
        lng,
        scheme: activeScheme,
        language: selectedLanguage,
      });

      setEmergencyId(id);
      setCallingEmergencyId(id);
      setPhase('calling');
    } catch (err) {
      console.error('Failed to start emergency:', err);
      setError('Failed to start calling. Please try again.');
    } finally {
      setStartingCall(false);
    }
  }

  // ── Derive per-hospital status from emergency doc ──
  const contactedIds = emergencyDoc?.hospitalsContacted || [];
  const ivrResponses = emergencyDoc?.ivrResponses || {};
  const confirmedIds = emergencyDoc?.confirmed || [];

  function getHospitalStatus(hospitalId) {
    if (phase === 'browse') return 'nearby';

    // Check ivrResponses map first (set by twilioWebhook)
    if (ivrResponses[hospitalId]?.status === 'confirmed') return 'confirmed';
    if (ivrResponses[hospitalId]?.status === 'rejected') return 'rejected';

    // Fallback: check confirmed array
    if (confirmedIds.includes(hospitalId)) return 'confirmed';

    // If in contactedIds → calling
    if (contactedIds.includes(hospitalId)) return 'calling';

    // If calling phase but this hospital wasn't contacted
    return 'no_response';
  }

  // Counts for the calling phase header
  const statusCounts = useMemo(() => {
    if (phase === 'browse') return null;
    const displayIds = contactedIds.length > 0 ? contactedIds : hospitals.map((h) => h.id);
    let confirmed = 0, calling = 0, rejected = 0, noResponse = 0;

    displayIds.forEach((id) => {
      const s = getHospitalStatus(id);
      if (s === 'confirmed') confirmed++;
      else if (s === 'calling') calling++;
      else if (s === 'rejected') rejected++;
      else noResponse++;
    });

    return { confirmed, calling, rejected, noResponse, total: displayIds.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, contactedIds, ivrResponses, confirmedIds, hospitals]);

  // ── Select a confirmed hospital ──
  function handleSelectHospital(hospital) {
    setSelectedHospital(hospital);
    navigate('/detail');
  }

  // ── Render ──
  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <style>{`
        @keyframes card-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
        }
        @keyframes card-pop {
          0% { transform: scale(0.97); }
          50% { transform: scale(1.01); }
          100% { transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hospital-card-calling { animation: card-pulse 2s ease-in-out infinite; }
        .hospital-card-confirmed { animation: card-pop 0.4s ease-out forwards; }
      `}</style>

      {/* ── Header ── */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate(phase === 'calling' ? -1 : '/home')}
          className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors border-none cursor-pointer"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="text-lg font-bold text-slate-800 tracking-tight">
            {phase === 'browse' ? 'Nearby Hospitals' : 'Calling Hospitals'}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {phase === 'browse'
              ? `${hospitals.length} hospitals found · ${emergencyType || 'Emergency'}`
              : statusCounts
                ? `${statusCounts.confirmed} confirmed · ${statusCounts.calling} calling · ${statusCounts.rejected + statusCounts.noResponse} pending`
                : 'Initiating calls...'}
          </div>
        </div>
        {phase === 'calling' && (
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-red animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Status Counters (calling phase only) ── */}
      {phase === 'calling' && statusCounts && (
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex gap-3 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-100">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[11px] font-bold text-green-700">{statusCounts.confirmed} Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-700">{statusCounts.calling} Calling</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[11px] font-bold text-red-600">{statusCounts.rejected} Rejected</span>
          </div>
        </div>
      )}

      {/* ── Hospital List ── */}
      <div className="flex-1 overflow-y-auto pb-32">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse">
                <div className="h-5 bg-slate-100 rounded-full w-2/3 mb-3" />
                <div className="h-3 bg-slate-50 rounded-full w-1/3 mb-2" />
                <div className="flex gap-2">
                  <div className="h-5 bg-slate-50 rounded-full w-12" />
                  <div className="h-5 bg-slate-50 rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="text-sm text-red-500 font-bold mt-4">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-xs font-bold px-4 py-2 bg-slate-100 rounded-full border-none cursor-pointer text-slate-600"
            >
              Retry
            </button>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="text-sm text-slate-400 font-medium mt-4">
              No hospitals found in your area
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Try expanding your search radius
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {/* In calling phase, show contacted hospitals first, then others */}
            {(phase === 'calling' && contactedIds.length > 0
              ? [
                  // Contacted hospitals (sorted: confirmed first, then calling, then rejected)
                  ...contactedIds
                    .map((id) => hospitals.find((h) => h.id === id))
                    .filter(Boolean)
                    .sort((a, b) => {
                      const order = { confirmed: 0, calling: 1, rejected: 2, no_response: 3 };
                      return (order[getHospitalStatus(a.id)] || 3) - (order[getHospitalStatus(b.id)] || 3);
                    }),
                ]
              : hospitals
            ).map((h, i) => (
              <div
                key={h.id}
                style={phase === 'browse' ? { animation: `fade-up 0.3s ease-out ${i * 0.05}s both` } : undefined}
              >
                <HospitalCard
                  hospital={h}
                  status={getHospitalStatus(h.id)}
                  onClick={
                    phase === 'browse'
                      ? () => navigate(`/hospital/${h.id}`, { state: { hospital: h } })
                      : getHospitalStatus(h.id) === 'confirmed'
                        ? () => handleSelectHospital(h)
                        : undefined
                  }
                  showDistance={true}
                />
              </div>
            ))}

            {/* "Waiting for Cloud Function" message during early calling phase */}
            {phase === 'calling' && contactedIds.length === 0 && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">
                  Cloud Function is initiating calls to hospitals...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Action Button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        {phase === 'browse' ? (
          <button
            onClick={handleStartCalling}
            disabled={startingCall || hospitals.length === 0}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white border-none rounded-2xl text-base font-bold cursor-pointer flex items-center justify-center gap-3 shadow-xl shadow-red-500/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startingCall ? (
              <>
                <LoadingSpinner size="sm" />
                Starting calls...
              </>
            ) : (
              <>
                <span className="text-xl">🚨</span>
                Start Calling All {hospitals.length} Hospitals
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => navigate('/hospitals')}
            className="w-full py-4 bg-brand text-white border-none rounded-2xl text-base font-bold cursor-pointer flex items-center justify-center gap-3 shadow-xl shadow-brand/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97]"
          >
            {statusCounts?.confirmed > 0 && (
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">
                {statusCounts.confirmed}
              </span>
            )}
            See Results Now →
          </button>
        )}
      </div>
    </div>
  );
}
