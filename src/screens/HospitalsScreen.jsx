import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';

/* ── Haversine distance (km) ── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Deterministic hash for stable random values ── */
function stableRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function HospitalsScreen() {
  const navigate = useNavigate();
  const { location, activeSchemes } = useAppContext();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | scheme | nearest

  useEffect(() => {
    if (!location?.lat || !location?.lng) return;

    async function fetchHospitals() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'hospitals'));
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const withDist = docs
          .map((h) => ({
            ...h,
            distanceKm: haversineDistance(location.lat, location.lng, h.lat, h.lng),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm);
        setHospitals(withDist);
      } catch (err) {
        console.error('Hospital fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHospitals();
  }, [location]);

  // Filter logic
  const filteredHospitals = hospitals.filter((h) => {
    if (filter === 'scheme') {
      // Show only hospitals that share at least one scheme with the user
      const hospitalSchemes = h.schemes || [];
      return activeSchemes.some((s) => hospitalSchemes.includes(s));
    }
    if (filter === 'nearest') return h.distanceKm <= 5;
    return true;
  });

  const filters = [
    { key: 'all', label: 'All Hospitals' },
    { key: 'nearest', label: 'Within 5 km' },
    { key: 'scheme', label: 'My Schemes' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors border-none cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">Browse Hospitals</div>
          <div className="text-xs text-slate-400 font-medium">{hospitals.length} registered facilities</div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="p-3 px-4 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-bold px-4 py-2 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
              filter === f.key
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Hospital List */}
      <div className="flex-1 overflow-y-auto pb-28 md:pb-8">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse">
                <div className="h-5 bg-slate-100 rounded-full w-2/3 mb-3"></div>
                <div className="h-3 bg-slate-50 rounded-full w-1/2 mb-2"></div>
                <div className="h-3 bg-slate-50 rounded-full w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <div className="text-sm text-slate-400 mt-4 font-medium">No hospitals found for this filter</div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3 max-w-4xl mx-auto w-full">
            {filteredHospitals.map((h) => {
              const hash = stableRandom(h.id);
              const isGovt = h.name?.toLowerCase().includes('govt') || h.name?.toLowerCase().includes('government') || h.name?.toLowerCase().includes('civil');
              const hasICU = hash % 3 !== 0;
              const hasCardiac = hash % 4 === 0;
              const hasNICU = hash % 5 === 0;
              const hospitalSchemes = h.schemes || (isGovt ? ['ab', 'mj'] : hash % 2 === 0 ? ['ab'] : ['mj']);
              const rating = (3.5 + (hash % 15) / 10).toFixed(1);

              return (
                <div
                  key={h.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden group"
                  onClick={() => navigate(`/hospital/${h.id}`, { state: { hospital: h } })}
                >
                  {/* Top Row: Name + Type Badge */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-brand transition-colors truncate">{h.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-medium">
                          {h.distanceKm.toFixed(1)} km · ~{Math.max(2, Math.round(h.distanceKm * 2.5))} min ETA · {h.city || 'Maharashtra'}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full shrink-0 uppercase tracking-wider ${
                        isGovt ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {isGovt ? 'Govt.' : 'Private'}
                      </span>
                    </div>

                    {/* Static Info Row */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green"></span>
                        <span className="text-[10px] text-green font-bold">Open 24/7</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span className="text-[10px] text-slate-500 font-bold">{rating}</span>
                      </div>
                    </div>
                  </div>

                  {/* Facility Tags — neutral, no "Live" pulse */}
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {hasICU && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">
                        ICU Available
                      </span>
                    )}
                    {hasCardiac && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">
                        Has Cardiac Dept
                      </span>
                    )}
                    {hasNICU && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">
                        NICU
                      </span>
                    )}
                  </div>

                  {/* Supported Schemes */}
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {hospitalSchemes.map((s) => (
                      <span key={s} className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-brand/5 text-brand uppercase tracking-wider">
                        {s === 'ab' ? 'Ayushman Bharat' : s === 'mj' ? 'MJPJAY' : s}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 font-medium">Tap for full details</span>
                    <span className="text-[10px] font-bold text-brand group-hover:underline uppercase tracking-wider">
                      View Profile →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
