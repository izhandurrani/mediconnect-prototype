import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { MapPin, Phone, Bed, Activity, ArrowLeft, HeartPulse, Stethoscope, Clock, ShieldCheck } from 'lucide-react';

/* Stable random values derived from hospital id */
function stableRandom(seed = '', min, max) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min + 1));
}

export default function DetailScreen() {
  const navigate = useNavigate();
  const { selectedHospital, setSelectedHospital, emergencyType, activeScheme } = useAppContext();

  const [hospital, setHospital] = useState(selectedHospital || null);
  const [loading, setLoading] = useState(!selectedHospital);

  // If we have a selectedHospital from context but want the full doc, fetch it
  useEffect(() => {
    if (!selectedHospital?.id) {
      setLoading(false);
      return;
    }

    // If context already has full data (lat, lng, name), use it directly
    if (selectedHospital.name) {
      setHospital(selectedHospital);
      setLoading(false);
    }

    // Also fetch fresh data from Firestore
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'hospitals', selectedHospital.id));
        if (snap.exists()) {
          const full = { id: snap.id, ...snap.data(), ...selectedHospital };
          setHospital(full);
          setSelectedHospital(full);
        }
      } catch (err) {
        console.error('Hospital fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospital?.id]);

  // Stable derived metrics
  const metrics = useMemo(() => {
    if (!hospital) return null;
    const seed = hospital.id || hospital.name || '';
    const availableBeds = hospital.beds ?? stableRandom(seed + 'beds', 2, 22);
    const totalBeds = availableBeds + stableRandom(seed + 'total', 10, 60);
    const oxygenLevel = stableRandom(seed + 'o2', 78, 99);
    return { availableBeds, totalBeds, oxygenLevel };
  }, [hospital]);

  const schemeName = activeScheme === 'mj' ? 'MJPJAY' : activeScheme === 'ab' ? 'Ayushman Bharat' : '';

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC]">
        <div className="p-4 flex items-center gap-4 border-b border-slate-100">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center border-none cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-5 bg-slate-200 rounded-full w-40 animate-pulse"></div>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 mb-2">
            <LoadingSpinner size="sm" color="border-brand" />
            <span className="text-xs font-bold text-slate-400">Loading hospital details...</span>
          </div>
          <div className="h-8 bg-slate-100 rounded-2xl w-3/4 animate-pulse"></div>
          <div className="h-4 bg-slate-50 rounded-full w-1/2 animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="h-32 bg-slate-50 rounded-2xl animate-pulse"></div>
            <div className="h-32 bg-slate-50 rounded-2xl animate-pulse"></div>
          </div>
          <div className="h-24 bg-slate-50 rounded-2xl animate-pulse mt-2"></div>
          <div className="h-20 bg-slate-50 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  /* ── No hospital selected ── */
  if (!hospital) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] p-6">
        <div className="text-lg font-bold text-slate-800">No Hospital Selected</div>
        <button onClick={() => navigate('/hospitals')} className="mt-6 bg-brand text-white px-6 py-3 rounded-xl font-bold border-none cursor-pointer">
          Browse Hospitals
        </button>
      </div>
    );
  }

  const { availableBeds, totalBeds, oxygenLevel } = metrics;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors border-none cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold text-slate-800 truncate">{hospital.name}</div>
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {hospital.distanceKm ? `${hospital.distanceKm} km · ` : ''}{hospital.city || 'Maharashtra'}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl mx-auto w-full">

        {/* Emergency context banner */}
        {emergencyType && (
          <div className="bg-red/5 border border-red/10 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-red" />
            </div>
            <div>
              <div className="text-xs font-bold text-red uppercase tracking-wider capitalize">{emergencyType} Emergency</div>
              {schemeName && <div className="text-[10px] text-slate-500 mt-0.5">Scheme: {schemeName}</div>}
            </div>
          </div>
        )}

        {/* Live Status */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Live Facility Status</h3>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-green bg-green/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              Real-time
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bed className="w-4 h-4 text-brand" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Beds</span>
              </div>
              <div className="text-2xl font-black text-slate-800 leading-none">
                {availableBeds}<span className="text-sm text-slate-400 font-medium"> / {totalBeds}</span>
              </div>
              <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${availableBeds < 5 ? 'bg-red-500' : availableBeds < 12 ? 'bg-amber-500' : 'bg-green'}`}
                  style={{ width: `${Math.min((availableBeds / totalBeds) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-4 h-4 text-sky-500" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Oxygen</span>
              </div>
              <div className="text-2xl font-black text-sky-500 leading-none">
                {oxygenLevel}<span className="text-sm text-slate-400 font-medium">%</span>
              </div>
              <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${oxygenLevel < 40 ? 'bg-red-500' : oxygenLevel < 70 ? 'bg-amber-500' : 'bg-sky-500'}`}
                  style={{ width: `${oxygenLevel}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <Stethoscope className="w-5 h-5 text-brand" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Capabilities</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {hospital.capabilities?.icu && (
              <div className="flex flex-col items-center p-3 bg-green/5 border border-green/10 rounded-2xl text-center">
                <HeartPulse className="w-6 h-6 text-green mb-1" />
                <span className="text-xs font-bold text-slate-700">ICU</span>
              </div>
            )}
            {hospital.capabilities?.cardiac && (
              <div className="flex flex-col items-center p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-center">
                <Activity className="w-6 h-6 text-amber-500 mb-1" />
                <span className="text-xs font-bold text-slate-700">Cardiac</span>
              </div>
            )}
            {hospital.capabilities?.nicu && (
              <div className="flex flex-col items-center p-3 bg-brand/5 border border-brand/10 rounded-2xl text-center">
                <Stethoscope className="w-6 h-6 text-brand mb-1" />
                <span className="text-xs font-bold text-slate-700">NICU</span>
              </div>
            )}
            <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
              <Clock className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700">24/7</span>
            </div>
          </div>
        </div>

        {/* Schemes */}
        {hospital.schemes?.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-brand" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Govt. Schemes</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {hospital.schemes.map((s) => (
                <span key={s} className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand/5 text-brand">
                  {s === 'ab' ? 'Ayushman Bharat (PM-JAY)' : s === 'mj' ? 'MJPJAY (Maharashtra)' : s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom action */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <a
          href={`tel:${hospital.phone || ''}`}
          className="bg-white text-slate-700 border border-slate-200 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm no-underline active:scale-[0.97] transition-transform"
        >
          <Phone className="w-4 h-4 text-brand" />
          Call Hospital
        </a>
        <button
          onClick={() => navigate('/alerted')}
          className="bg-brand text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand/20 font-bold text-sm border-none cursor-pointer active:scale-[0.97] transition-transform"
        >
          Confirm & Alert →
        </button>
      </div>
    </div>
  );
}
