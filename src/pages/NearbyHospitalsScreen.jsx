import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';

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

/* ── Capability filter per emergency type ── */
function matchesType(hospital, emergencyType) {
  const caps = hospital.capabilities || {};
  switch (emergencyType) {
    case 'cardiac':
      return caps.cardiac === true || caps.icu === true;
    case 'accident':
      return caps.trauma === true;
    case 'newborn':
      return caps.nicu === true;
    case 'other':
    default:
      return caps.emergency24x7 === true;
  }
}

/* ── Subtitle for emergency type ── */
function getSubtitle(type, scheme) {
  const schemeName = scheme === 'ab' ? 'Ayushman Bharat' : scheme === 'mj' ? 'MJPJAY' : 'All Schemes';
  switch (type) {
    case 'cardiac': return `ICU + Cardiac · ${schemeName} · 10km`;
    case 'accident': return `Trauma + Surgery · ${schemeName} · 10km`;
    case 'newborn': return `NICU · ${schemeName} · 10km`;
    default: return `Emergency 24/7 · ${schemeName} · 10km`;
  }
}

/* ── Capability display config ── */
const CAP_CHIPS = {
  icu: { label: 'ICU', color: 'bg-red-50 text-red-600' },
  cardiac: { label: 'Cardiac', color: 'bg-amber-50 text-amber-600' },
  nicu: { label: 'NICU', color: 'bg-blue-50 text-blue-600' },
  trauma: { label: 'Trauma', color: 'bg-purple-50 text-purple-600' },
  emergency24x7: { label: '24/7', color: 'bg-green-50 text-green-600' },
};

const SCHEME_BADGES = {
  ab: { label: 'Ayushman Bharat', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  mj: { label: 'MJPJAY', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

export default function NearbyHospitalsScreen() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { location: contextLocation, activeScheme } = useAppContext();

  const {
    emergencyType = 'other',
    transcript = '',
    userLocation: routeUserLocation,
    language = 'en',
    scheme: routeScheme,
  } = routeLocation.state || {};

  const userLocation = routeUserLocation || contextLocation;
  const scheme = routeScheme || activeScheme || 'mj';

  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Fetch + filter + sort hospitals ──
  useEffect(() => {
    if (!userLocation?.lat || !userLocation?.lng) {
      setError('Location not available. Please go back and try again.');
      setLoading(false);
      return;
    }

    async function fetchHospitals() {
      setLoading(true);
      setError('');

      try {
        const snap = await getDocs(collection(db, 'hospitals'));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter: has location + phone + is active
        const valid = all.filter((h) => h.lat && h.lng && h.phone && h.isActive !== false);

        // Calculate distance
        const withDist = valid.map((h) => ({
          ...h,
          distanceKm: Math.round(
            haversineDistance(userLocation.lat, userLocation.lng, h.lat, h.lng) * 10
          ) / 10,
        }));

        // Filter by capability match
        const capable = withDist.filter((h) => matchesType(h, emergencyType));

        // Sort by distance
        capable.sort((a, b) => a.distanceKm - b.distanceKm);

        // Top 5
        const top5 = capable.slice(0, 5);

        // If fewer than 5 capable hospitals, fill from remaining by distance
        if (top5.length < 5) {
          const usedIds = new Set(top5.map((h) => h.id));
          const others = withDist
            .filter((h) => !usedIds.has(h.id))
            .sort((a, b) => a.distanceKm - b.distanceKm);
          while (top5.length < 5 && others.length > 0) {
            top5.push(others.shift());
          }
        }

        setHospitals(top5);
      } catch (err) {
        console.error('Hospital fetch error:', err);
        setError('Failed to load hospitals. Check your connection.');
      } finally {
        setLoading(false);
      }
    }

    fetchHospitals();
  }, [userLocation, emergencyType]);

  // ── Navigate to calling screen ──
  function handleStartCalling() {
    navigate('/calling', {
      state: {
        hospitals,
        emergencyType,
        userLocation,
        transcript,
        language,
        scheme,
      },
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate('/voice')}
          className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors border-none cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">Top 5 Hospitals Nearby</div>
          <div className="text-[11px] text-slate-400 font-medium">{getSubtitle(emergencyType, scheme)}</div>
        </div>
      </div>

      {/* ── Emergency type badge ── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <div className="text-xl">
            {emergencyType === 'cardiac' ? '🫀' : emergencyType === 'accident' ? '🚑' : emergencyType === 'newborn' ? '👶' : '🏥'}
          </div>
          <div>
            <div className="text-xs font-bold text-red-700 uppercase tracking-wider capitalize">{emergencyType} Emergency</div>
            {transcript && (
              <div className="text-[10px] text-red-400 mt-0.5 truncate max-w-[250px]">
                "{transcript}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hospital List ── */}
      <div className="flex-1 overflow-y-auto pb-28">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-100 rounded-full w-2/3 mb-2" />
                    <div className="h-3 bg-slate-50 rounded-full w-1/3" />
                  </div>
                </div>
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
              onClick={() => navigate('/voice')}
              className="mt-4 text-xs font-bold px-4 py-2 bg-slate-100 rounded-full border-none cursor-pointer text-slate-600"
            >
              ← Go Back
            </button>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="text-4xl mb-4">😔</div>
            <div className="text-sm text-slate-500 font-bold">No hospitals found</div>
            <div className="text-xs text-slate-400 mt-1">No hospitals match your emergency type nearby</div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {hospitals.map((h, index) => {
              const isGovt =
                h.name?.toLowerCase().includes('govt') ||
                h.name?.toLowerCase().includes('government') ||
                h.name?.toLowerCase().includes('civil');

              const activeCaps = Object.entries(h.capabilities || {}).filter(([, v]) => v);
              const schemes = h.schemes || [];

              return (
                <div
                  key={h.id}
                  className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm hover:shadow-md transition-all animate-fade-up"
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  {/* Row 1: Rank + Name + Type badge */}
                  <div className="flex items-start gap-3">
                    {/* Rank circle */}
                    <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-black shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 leading-snug">{h.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {h.distanceKm} km · ~{Math.max(2, Math.round(h.distanceKm * 2.5))} min
                        </span>
                      </div>
                    </div>

                    {/* Govt/Private badge */}
                    <span
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                        isGovt ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {isGovt ? 'GOVT' : 'PRIVATE'}
                    </span>
                  </div>

                  {/* Row 2: Capabilities */}
                  {activeCaps.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {activeCaps.map(([key]) => {
                        const cap = CAP_CHIPS[key];
                        if (!cap) return null;
                        return (
                          <span key={key} className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${cap.color}`}>
                            {cap.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Row 3: Scheme badges */}
                  {schemes.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {schemes.map((s) => {
                        const badge = SCHEME_BADGES[s];
                        if (!badge) return null;
                        return (
                          <span key={s} className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom CTA ── */}
      {hospitals.length > 0 && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <button
            onClick={handleStartCalling}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white border-none rounded-2xl text-base font-bold cursor-pointer flex items-center justify-center gap-3 shadow-xl shadow-red-500/25 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-[0.97]"
          >
            <span className="text-xl">🚨</span>
            Call Top {hospitals.length} Hospitals
          </button>
        </div>
      )}
    </div>
  );
}
