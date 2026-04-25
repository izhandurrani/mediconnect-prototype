import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import { useHospitals } from '../hooks/useHospitals';
import { useGeminiTriage } from '../hooks/useGeminiTriage';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HospitalsScreen() {
  const navigate = useNavigate();
  const {
    emergencyId, location, activeSchemes,
    setSelectedHospital, voiceTranscript,
  } = useAppContext();

  // Live emergency data
  const { emergency } = useEmergency(emergencyId);
  const confirmedIds = emergency?.confirmed || [];
  const emergencyType = emergency?.type || null;

  // Real-time hospital list from geohash query (no scheme filter — all nearby hospitals)
  const hospitals = useHospitals(location, 10, emergencyType);

  // Filter state
  const [filter, setFilter] = useState('all');

  // Triage — run once when we have confirmed hospitals
  const confirmedHospitals = useMemo(
    () => hospitals.filter((h) => confirmedIds.includes(h.id)),
    [hospitals, confirmedIds]
  );

  const { triage, result: triageResult, loading: triageLoading, error: triageError } = useGeminiTriage();
  const [triageRan, setTriageRan] = useState(false);

  useEffect(() => {
    if (!triageRan && confirmedHospitals.length > 0 && voiceTranscript) {
      setTriageRan(true);
      triage(voiceTranscript, confirmedHospitals);
    }
  }, [confirmedHospitals, voiceTranscript, triageRan, triage]);

  // Filter logic
  const filteredHospitals = useMemo(() => {
    let list = hospitals;
    if (filter === 'confirmed') {
      list = list.filter((h) => confirmedIds.includes(h.id));
    } else if (filter === 'scheme') {
      list = list.filter((h) => {
        const hs = h.schemes || [];
        return activeSchemes.some((s) => hs.includes(s));
      });
    } else if (filter === 'nearest') {
      list = list.filter((h) => h.distanceKm <= 5);
    }
    return list;
  }, [hospitals, filter, confirmedIds, activeSchemes]);

  const filters = [
    { key: 'all', label: 'All Hospitals' },
    { key: 'confirmed', label: `Confirmed (${confirmedIds.length})` },
    { key: 'nearest', label: 'Within 5 km' },
    { key: 'scheme', label: 'My Schemes' },
  ];

  function handleSelectHospital(hospital) {
    setSelectedHospital(hospital);
    navigate('/detail');
  }

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
          <div className="text-xs text-slate-400 font-medium">{hospitals.length} nearby facilities</div>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      {triageResult && (
        <div className="mx-4 mt-3 bg-brand rounded-2xl p-4 shadow-lg shadow-brand/20 text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2.5L13.5 9.5L20.5 11.5L13.5 13.5L11.5 20.5L9.5 13.5L2.5 11.5L9.5 9.5L11.5 2.5Z"/></svg>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">AI Recommendation</span>
          </div>
          <div className="text-sm font-bold">{triageResult.recommendationReason}</div>
          {triageResult.recommendedHospitalId && (
            <button
              onClick={() => {
                const rec = hospitals.find((h) => h.id === triageResult.recommendedHospitalId);
                if (rec) handleSelectHospital(rec);
              }}
              className="mt-3 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full border border-white/30 cursor-pointer hover:bg-white/30 transition-all"
            >
              Go to recommended →
            </button>
          )}
        </div>
      )}
      {triageLoading && (
        <div className="mx-4 mt-3 bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-center gap-3">
          <LoadingSpinner size="sm" color="border-brand" />
          <span className="text-xs text-brand font-bold">AI analyzing hospitals...</span>
        </div>
      )}
      {triageError && !triageLoading && !triageResult && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          <span className="text-xs text-amber-700 font-medium">AI recommendation unavailable — browse hospitals manually below</span>
        </div>
      )}

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
        {hospitals.length === 0 ? (
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
              const isConfirmed = confirmedIds.includes(h.id);
              const isRecommended = triageResult?.recommendedHospitalId === h.id;
              const isGovt = h.name?.toLowerCase().includes('govt') || h.name?.toLowerCase().includes('government') || h.name?.toLowerCase().includes('civil');
              const hospitalSchemes = h.schemes || [];
              const hasICU = h.capabilities?.icu;
              const hasCardiac = h.capabilities?.cardiac;
              const hasNICU = h.capabilities?.nicu;

              return (
                <div
                  key={h.id}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden group ${
                    isRecommended ? 'border-brand ring-2 ring-brand/10' :
                    isConfirmed ? 'border-green' : 'border-slate-100'
                  }`}
                  onClick={() => handleSelectHospital(h)}
                >
                  {/* Top Row */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-brand transition-colors truncate">{h.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-medium">
                          {h.distanceKm} km · ~{Math.max(2, Math.round(h.distanceKm * 2.5))} min ETA · {h.city || 'Maharashtra'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isRecommended && (
                          <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-brand/10 text-brand uppercase tracking-wider">
                            ✦ AI Pick
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-green/10 text-green uppercase tracking-wider">
                            ✓ Confirmed
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full shrink-0 uppercase tracking-wider ${
                          isGovt ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                        }`}>
                          {isGovt ? 'Govt.' : 'Private'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green"></span>
                        <span className="text-[10px] text-green font-bold">Open 24/7</span>
                      </div>
                    </div>
                  </div>

                  {/* Facility Tags from real data */}
                  <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {hasICU && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">ICU</span>
                    )}
                    {hasCardiac && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">Cardiac</span>
                    )}
                    {hasNICU && (
                      <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 uppercase tracking-wider">NICU</span>
                    )}
                  </div>

                  {/* Accepted schemes — informational only, no filtering */}
                  {hospitalSchemes.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="text-[9px] font-semibold text-slate-400 mb-1.5">Accepted schemes:</div>
                      <div className="flex gap-2 flex-wrap">
                        {hospitalSchemes.map((s) => (
                          <span key={s} className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-brand/5 text-brand uppercase tracking-wider">
                            {s === 'ab' ? 'Ayushman Bharat' : s === 'mj' ? 'MJPJAY' : s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 font-medium">Tap to select</span>
                    <span className="text-[10px] font-bold text-brand group-hover:underline uppercase tracking-wider">
                      Select Hospital →
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
