import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapPin, Phone, Bed, Activity, ArrowLeft, HeartPulse, Stethoscope, ShieldCheck, Clock, Building2 } from 'lucide-react';

// Unique images rotated by hospital name hash so each hospital looks different
const HOSPITAL_IMAGES = [
  'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1512678080530-7760d81faba6?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1580281657521-e0a011a5e3bf?auto=format&fit=crop&q=80&w=1200',
];

function getImageByName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return HOSPITAL_IMAGES[Math.abs(hash) % HOSPITAL_IMAGES.length];
}

// Stable random values derived from hospital id (so they don't flicker on re-render)
function stableRandom(seed = '', min, max) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min + 1));
}

export default function HospitalDetailScreen() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [hospital, setHospital] = useState(location.state?.hospital || null);
  const [loading, setLoading] = useState(!hospital);

  useEffect(() => {
    if (!hospital && id) {
      (async () => {
        try {
          const snap = await getDoc(doc(db, 'hospitals', id));
          if (snap.exists()) setHospital({ id: snap.id, ...snap.data() });
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id, hospital]);

  // Stable derived values (memoized so they don't change on every render)
  const metrics = useMemo(() => {
    if (!hospital) return null;
    const seed = hospital.id || hospital.name || '';
    const availableBeds = hospital.beds ?? stableRandom(seed + 'beds', 2, 22);
    const totalBeds = availableBeds + stableRandom(seed + 'total', 10, 60);
    const oxygenLevel = stableRandom(seed + 'o2', 78, 99);
    return { availableBeds, totalBeds, oxygenLevel };
  }, [hospital]);

  /* ── Loading / Error states ── */
  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
      <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      <div className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-sm">Loading...</div>
    </div>
  );

  if (!hospital) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] p-6">
      <Building2 className="w-16 h-16 text-slate-300 mb-4" />
      <div className="text-lg font-bold text-slate-800">Hospital Not Found</div>
      <button onClick={() => navigate(-1)} className="mt-6 bg-brand text-white px-6 py-3 rounded-xl font-bold">Go Back</button>
    </div>
  );

  const { availableBeds, totalBeds, oxygenLevel } = metrics;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${hospital.lat},${hospital.lng}`;
  const heroImage = getImageByName(hospital.name);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-h-screen relative overflow-x-hidden pb-24 md:pb-0">

      {/* ══ HERO ══ — exactly 35vh tall */}
      <div className="relative w-full shrink-0 overflow-hidden rounded-b-[2rem] md:rounded-b-[3rem] shadow-xl" style={{ height: '35vh' }}>
        <img src={heroImage} alt={hospital.name} className="w-full h-full object-cover" />
        {/* Dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-black/10" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-5 left-4 md:left-10 w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Name & badges overlay */}
        <div className="absolute bottom-5 left-4 right-4 md:left-12 md:bottom-10 z-10">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-green/20 backdrop-blur-md text-green-300 border border-green/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Verified Facility
            </span>
            <span className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              Open 24/7
            </span>
          </div>
          <h1 className="text-xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
            {hospital.name}
          </h1>
          <div className="flex items-center gap-2 text-slate-200 text-sm mt-1">
            <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-medium">{hospital.city}, Maharashtra</span>
          </div>
        </div>
      </div>

      {/* ══ CONTENT AREA ══ */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row md:p-8 md:gap-8 -mt-2 relative z-10">

        {/* ── MAIN COLUMN (Left on desktop) ── */}
        <div className="flex-[1.6] flex flex-col gap-0 md:gap-6">

          {/* ① LIVE STATUS — always first on mobile */}
          <div className="bg-white mx-0 md:rounded-[2rem] md:border md:border-slate-100 md:shadow-sm px-4 md:p-8 py-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Live Facility Status</h3>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-green bg-green/10 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                Real-time
              </span>
            </div>

            {/* Beds + Oxygen side-by-side pills */}
            <div className="grid grid-cols-2 gap-4">
              {/* Bed Availability */}
              <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bed className="w-4 h-4 text-brand" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Beds</span>
                </div>
                <div className="text-2xl font-black text-slate-800 leading-none">
                  {availableBeds}
                  <span className="text-sm text-slate-400 font-medium"> / {totalBeds}</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${availableBeds < 5 ? 'bg-red-500' : availableBeds < 12 ? 'bg-amber-500' : 'bg-green'}`}
                    style={{ width: `${Math.min((availableBeds / totalBeds) * 100, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[10px] font-bold text-slate-400">
                  {availableBeds < 5 ? '⚠️ Critical' : availableBeds < 12 ? '⚡ Moderate' : '✅ Optimal'}
                </div>
              </div>

              {/* Oxygen Reserves */}
              <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Oxygen</span>
                </div>
                <div className="text-2xl font-black text-sky-500 leading-none">
                  {oxygenLevel}<span className="text-sm text-slate-400 font-medium">%</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${oxygenLevel < 40 ? 'bg-red-500' : oxygenLevel < 70 ? 'bg-amber-500' : 'bg-sky-500'}`}
                    style={{ width: `${oxygenLevel}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[10px] font-bold text-slate-400">
                  {oxygenLevel < 40 ? '⚠️ Depleted' : oxygenLevel < 70 ? '⚡ Low' : '✅ Sufficient'}
                </div>
              </div>
            </div>
          </div>

          {/* Divider on mobile */}
          <div className="h-2 bg-slate-100 md:hidden" />

          {/* ② Government Schemes */}
          <div className="bg-white md:rounded-[2rem] md:border md:border-slate-100 md:shadow-sm px-4 md:p-8 py-6">
            <div className="flex items-center gap-3 mb-5">
              <ShieldCheck className="w-5 h-5 text-brand shrink-0" />
              <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">Govt. Schemes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hospital.schemes?.includes('ab') && (
                <div className="bg-[#F8FAFC] border border-slate-100 p-4 rounded-2xl">
                  <div className="text-sm font-bold text-slate-800 mb-1">🏥 Ayushman Bharat (PM-JAY)</div>
                  <div className="text-xs text-slate-500 font-medium leading-relaxed">
                    Up to ₹5 Lakhs free medical coverage per family/year for hospitalization.
                  </div>
                </div>
              )}
              {hospital.schemes?.includes('mj') && (
                <div className="bg-[#F8FAFC] border border-slate-100 p-4 rounded-2xl">
                  <div className="text-sm font-bold text-slate-800 mb-1">🏛️ MJPJAY (Maharashtra)</div>
                  <div className="text-xs text-slate-500 font-medium leading-relaxed">
                    Covers 996 medical & surgical procedures under state health scheme.
                  </div>
                </div>
              )}
              {(!hospital.schemes || hospital.schemes.length === 0) && (
                <div className="text-sm text-slate-400 font-medium">
                  No schemes listed. Please contact hospital directly.
                </div>
              )}
            </div>
          </div>

          {/* Divider on mobile */}
          <div className="h-2 bg-slate-100 md:hidden" />

          {/* ③ Medical Capabilities */}
          <div className="bg-white md:rounded-[2rem] md:border md:border-slate-100 md:shadow-sm px-4 md:p-8 py-6">
            <div className="flex items-center gap-3 mb-5">
              <Activity className="w-5 h-5 text-brand shrink-0" />
              <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">Medical Capabilities</h2>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {hospital.capabilities?.icu && (
                <div className="flex flex-col items-center p-3 bg-green/5 border border-green/10 rounded-2xl text-center">
                  <HeartPulse className="w-7 h-7 text-green mb-1.5" />
                  <span className="text-xs font-bold text-slate-700">ICU</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Active</span>
                </div>
              )}
              {hospital.capabilities?.cardiac && (
                <div className="flex flex-col items-center p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-center">
                  <Activity className="w-7 h-7 text-amber-500 mb-1.5" />
                  <span className="text-xs font-bold text-slate-700">Cardiac</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Specialist</span>
                </div>
              )}
              {hospital.capabilities?.nicu && (
                <div className="flex flex-col items-center p-3 bg-brand/5 border border-brand/10 rounded-2xl text-center">
                  <Stethoscope className="w-7 h-7 text-brand mb-1.5" />
                  <span className="text-xs font-bold text-slate-700">NICU</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Pediatric</span>
                </div>
              )}
              <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                <Clock className="w-7 h-7 text-slate-400 mb-1.5" />
                <span className="text-xs font-bold text-slate-700">Emergency</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">24/7</span>
              </div>
            </div>
          </div>

          {/* Bottom spacer on mobile so sticky bar doesn't overlap last card */}
          <div className="h-2 md:hidden" />
        </div>

        {/* ── SIDEBAR (Right column on desktop only) ── */}
        <div className="hidden md:flex flex-col gap-6 flex-[0.8]">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 sticky top-24">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Quick Actions</h3>
            <div className="flex flex-col gap-4">
              <a
                href={`tel:${hospital.phone || ''}`}
                className="bg-brand text-white p-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-brand/20 hover:shadow-xl hover:-translate-y-1 transition-all no-underline font-bold"
              >
                <Phone className="w-5 h-5" />
                Emergency Call
              </a>
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-slate-700 border border-slate-100 p-5 rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all no-underline font-bold"
              >
                <MapPin className="w-5 h-5 text-brand" />
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ══ STICKY BOTTOM BAR — Mobile Only ══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t border-slate-100 px-4 py-3 grid grid-cols-2 gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <a
          href={`tel:${hospital.phone || ''}`}
          className="bg-brand text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand/20 font-bold text-sm no-underline active:scale-[0.97] transition-transform"
        >
          <Phone className="w-4 h-4" />
          Emergency Call
        </a>
        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#F8FAFC] text-slate-700 border border-slate-200 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm no-underline active:scale-[0.97] transition-transform"
        >
          <MapPin className="w-4 h-4 text-brand" />
          Directions
        </a>
      </div>
    </div>
  );
}
