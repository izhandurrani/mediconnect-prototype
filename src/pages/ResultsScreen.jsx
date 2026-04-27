import { useState, useEffect } from 'react';
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
  } = location.state || {};

  const [alerts, setAlerts] = useState({});
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [sendingPreAlert, setSendingPreAlert] = useState(null);
  const [showPreAlertModal, setShowPreAlertModal] = useState(false);
  const [alertedHospital, setAlertedHospital] = useState(null);

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

  function handleSelect(hospital) {
    setSelectedHospitalId((current) => (current === hospital.id ? null : hospital.id));
  }

  // ── Send pre-alert only after explicit confirmation ──
  async function handleSendPreAlert(hospital) {
    if (sendingPreAlert) return;
    setSendingPreAlert(hospital.id);

    try {
      await selectHospitalForEmergency(emergencyId, hospital.id);
      setAlertedHospital(hospital);
      setShowPreAlertModal(true);
    } catch (err) {
      console.error('Pre-alert failed:', err);
    } finally {
      setSendingPreAlert(null);
    }
  }

  function handleContinueToNavigation() {
    if (!alertedHospital) return;

    navigate('/success', {
      state: {
        hospitalName: alertedHospital.name,
        hospitalPhone: alertedHospital.phone,
        hospitalLat: alertedHospital.lat,
        hospitalLng: alertedHospital.lng,
        emergencyId,
      },
    });
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
              const isExpanded = selectedHospitalId === h.id;

              return (
                <div
                  key={h.id}
                  className={`bg-white rounded-2xl border-2 p-5 shadow-sm animate-fade-up transition-all ${
                    isExpanded ? 'border-green-500 shadow-lg shadow-green-500/10' : 'border-green-300'
                  }`}
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

                  {!isExpanded ? (
                    <button
                      onClick={() => handleSelect(h)}
                      className="w-full mt-4 py-3 bg-green-500 text-white border-none rounded-xl text-sm font-bold cursor-pointer shadow-lg shadow-green-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                    >
                      Select This Hospital →
                    </button>
                  ) : (
                    <div className="mt-4 ml-11 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Selected Hospital
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-800">
                        Review and send pre-alert before navigation.
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">
                          {h.distanceKm} km away
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">
                          ~{Math.max(2, Math.round(h.distanceKm * 2.5))} min travel
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">
                          {isGovt ? 'Government hospital' : 'Private hospital'}
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">
                          {h.phone ? h.phone : 'Phone available on arrival'}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        {h.phone && (
                          <a
                            href={`tel:${h.phone}`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 no-underline transition-transform active:scale-[0.98]"
                          >
                            Call Hospital
                          </a>
                        )}
                        <button
                          onClick={() => handleSendPreAlert(h)}
                          disabled={sendingPreAlert === h.id}
                          className="w-full rounded-xl border-none bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-all active:scale-[0.98] disabled:opacity-60"
                        >
                          {sendingPreAlert === h.id ? 'Sending Pre-Alert...' : 'Send Pre-Alert'}
                        </button>
                        <button
                          onClick={() => setSelectedHospitalId(null)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-white"
                        >
                          Choose Another Hospital
                        </button>
                      </div>
                    </div>
                  )}
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

      {showPreAlertModal && alertedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="mt-4 text-center">
              <div className="text-xl font-black text-slate-800">Pre Alert sent to hospital</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-500">
                {alertedHospital.name} has been notified. You can continue to navigation now.
              </div>
            </div>

            <button
              onClick={handleContinueToNavigation}
              className="mt-6 w-full rounded-2xl border-none bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-transform active:scale-[0.98]"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
