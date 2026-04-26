import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { selectHospitalForEmergency } from '../firebase/emergencyHelpers';

export default function ResultsScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    emergencyId,
    hospitals = [],
    emergencyType = 'other',
  } = location.state || {};

  const [alerts, setAlerts] = useState({});
  const [selecting, setSelecting] = useState(null);

  // ── Keep listening to emergency_alerts for late confirmations ──
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
        };
      });
      setAlerts(updated);
    });

    return unsub;
  }, [emergencyId]);

  // ── Derive confirmed hospitals ──
  const confirmedHospitals = hospitals.filter(
    (h) => alerts[h.id]?.status === 'confirmed'
  );

  // ── Select a hospital → update Firestore → navigate to success ──
  async function handleSelect(hospital) {
    if (selecting) return;
    setSelecting(hospital.id);

    try {
      await selectHospitalForEmergency(emergencyId, hospital.id);
      navigate('/success', {
        state: {
          hospitalName: hospital.name,
          hospitalPhone: hospital.phone,
          hospitalLat: hospital.lat,
          hospitalLng: hospital.lng,
          emergencyId,
        },
      });
    } catch (err) {
      console.error('Hospital selection failed:', err);
      setSelecting(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors border-none cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">Confirmed Hospitals</div>
          <div className="text-[11px] text-slate-400 font-medium">
            {confirmedHospitals.length} hospital{confirmedHospitals.length !== 1 ? 's' : ''} ready to receive you
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">

        {confirmedHospitals.length > 0 ? (
          /* ── Confirmed hospital cards ── */
          <div className="p-4 flex flex-col gap-3">
            {confirmedHospitals.map((h) => {
              const isGovt =
                h.name?.toLowerCase().includes('govt') ||
                h.name?.toLowerCase().includes('government') ||
                h.name?.toLowerCase().includes('civil');

              const activeCaps = Object.entries(h.capabilities || {}).filter(([, v]) => v);

              return (
                <div
                  key={h.id}
                  className="bg-white rounded-2xl border-2 border-green-300 p-5 shadow-sm animate-fade-up"
                >
                  {/* Name row */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800">{h.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#94A3B8">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {h.distanceKm} km · ~{Math.max(2, Math.round(h.distanceKm * 2.5))} min · {isGovt ? 'Govt.' : 'Private'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {activeCaps.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3 ml-11">
                      {activeCaps.map(([key]) => {
                        const labels = { icu: 'ICU', cardiac: 'Cardiac', nicu: 'NICU', trauma: 'Trauma', emergency24x7: '24/7' };
                        return (
                          <span key={key} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            {labels[key] || key}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Select button */}
                  <button
                    onClick={() => handleSelect(h)}
                    disabled={selecting === h.id}
                    className="w-full mt-4 py-3 bg-green-500 text-white border-none rounded-xl text-sm font-bold cursor-pointer shadow-lg shadow-green-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {selecting === h.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Selecting...
                      </>
                    ) : (
                      'Select This Hospital →'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-slate-800">No Confirmations Yet</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                Hospitals are still being called. Go back to see live status, or call 108 for ambulance.
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-sm mt-2">
              <button
                onClick={() => navigate(-1)}
                className="w-full py-3 bg-brand text-white border-none rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-[0.97]"
              >
                ← Go Back to Calling
              </button>
              <a
                href="tel:108"
                className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold no-underline flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                📞 Call 108 for Ambulance
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
