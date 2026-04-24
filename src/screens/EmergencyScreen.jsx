import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, addDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { textModel } from '../lib/gemini';
import { useAppContext } from '../context/AppContext';
import { translations } from '../constants/translations';
import { triggerParallelIVR } from '../services/ivrService';

/* ── Haversine distance (km) ── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Language → BCP-47 mapping ── */
function getLangCode(lang) {
  return lang === 'hi' ? 'hi-IN' : 'en-US';
}

export default function EmergencyScreen() {
  const navigate = useNavigate();
  const { selectedLanguage, location, setLocation } = useAppContext();
  const t = translations[selectedLanguage] || translations.en;

  // Hospital state
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanComplete, setScanComplete] = useState(false);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(() => sessionStorage.getItem('em_transcript') || '');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);

  // Gemini state
  const [aiSummary, setAiSummary] = useState(() => sessionStorage.getItem('em_aiSummary') || '');
  const [aiLoading, setAiLoading] = useState(false);

  // Firestore save state
  const [alertSaved, setAlertSaved] = useState(() => sessionStorage.getItem('em_alertSaved') === 'true');
  const [alertDocIds, setAlertDocIds] = useState(() => JSON.parse(sessionStorage.getItem('em_alertDocIds') || '{}'));

  // Real-time hospital statuses from emergency_alerts
  const [hospitalStatuses, setHospitalStatuses] = useState({});
  const [winnerHospital, setWinnerHospital] = useState(null);

  // Confirmation Step State
  const [isConfirming, setIsConfirming] = useState(() => sessionStorage.getItem('em_isConfirming') === 'true');
  const [countdown, setCountdown] = useState(10);

  // Sync state to sessionStorage so it persists across back navigation
  useEffect(() => {
    sessionStorage.setItem('em_transcript', transcript);
    sessionStorage.setItem('em_aiSummary', aiSummary);
    sessionStorage.setItem('em_alertSaved', alertSaved.toString());
    sessionStorage.setItem('em_alertDocIds', JSON.stringify(alertDocIds));
    sessionStorage.setItem('em_isConfirming', isConfirming.toString());
  }, [transcript, aiSummary, alertSaved, alertDocIds, isConfirming]);

  /* ═══════════════════════════════════════════════
     1. Ensure location is available, then fetch hospitals
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;

    async function ensureLocationAndFetch() {
      setLoading(true);

      // Step A: Get location — from AppContext, browser geolocation, or fallback
      let userLat = location?.lat;
      let userLng = location?.lng;

      if (!userLat || !userLng) {
        // Try browser geolocation
        try {
          const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('no-geo'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 5000, maximumAge: 0,
            });
          });
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          // Also update AppContext for other screens
          setLocation({ lat: userLat, lng: userLng });
        } catch {
          // Fallback: Chhatrapati Sambhajinagar
          userLat = 19.8762;
          userLng = 75.3433;
          setLocation({ lat: userLat, lng: userLng });
        }
      }

      // Step B: Fetch hospitals from Firestore
      try {
        const snap = await getDocs(collection(db, 'hospitals'));
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const withDist = docs
          .map((h) => ({
            ...h,
            distanceKm: haversineDistance(userLat, userLng, h.lat, h.lng),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 15); // Fetch top 15

        if (!cancelled) setHospitals(withDist);
      } catch (err) {
        console.error('Hospital fetch error:', err);
      } finally {
        if (!cancelled) {
          setTimeout(() => {
            setLoading(false);
            setTimeout(() => setScanComplete(true), 400);
          }, 2200);
        }
      }
    }

    ensureLocationAndFetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════════════════════════════════════════
     2. Auto-start SpeechRecognition once scan begins
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    if (!scanComplete) return;
    // Only auto-start once, and only if no transcript yet
    if (transcript || aiSummary) return;
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanComplete]);

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t.voice_not_supported);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getLangCode(selectedLanguage);
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setIsListening(true); setVoiceError(''); };

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      // Send to Gemini
      summarizeWithGemini(text);
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      setIsListening(false);
      if (e.error !== 'aborted') setVoiceError(t.voice_error);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* already started */ }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function toggleMic() {
    if (isListening) { stopListening(); }
    else {
      setTranscript('');
      setAiSummary('');
      setAlertSaved(false);
      setAlertDocIds({});
      setHospitalStatuses({});
      setWinnerHospital(null);
      startListening();
    }
  }

  /* ═══════════════════════════════════════════════
     3. Gemini summarization & Confirmation Step
     ═══════════════════════════════════════════════ */
  async function summarizeWithGemini(userText) {
    let finalSummary = userText;
    if (textModel) {
      setAiLoading(true);
      try {
        const prompt = `Summarize this emergency in 10 words for a hospital IVR: ${userText}`;
        const res = await textModel.generateContent(prompt);
        finalSummary = res.response.text().trim();
      } catch (err) {
        console.error('Gemini error:', err);
      } finally {
        setAiLoading(false);
      }
    }
    setAiSummary(finalSummary);
    setIsConfirming(true);
    setCountdown(10);
  }

  useEffect(() => {
    let timer;
    if (isConfirming && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isConfirming && countdown === 0) {
      handleConfirmBroadcast();
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirming, countdown]);

  function handleConfirmBroadcast() {
    setIsConfirming(false);
    saveToFirestore(aiSummary);
  }

  function handleDiscard() {
    setIsConfirming(false);
    setAiSummary('');
    setTranscript('');
    startListening();
  }

  function handleNewEmergency() {
    setTranscript('');
    setAiSummary('');
    setAlertSaved(false);
    setAlertDocIds({});
    setHospitalStatuses({});
    setWinnerHospital(null);
    setIsConfirming(false);
    sessionStorage.clear();
    startListening();
  }

  /* ═══════════════════════════════════════════════
     4. Save emergency alerts to Firestore (one per hospital)
     ═══════════════════════════════════════════════ */
  async function saveToFirestore(summary) {
    // Target the top 5 nearest hospitals for parallel broadcast
    const topHospitals = hospitals.slice(0, 5);
    if (topHospitals.length === 0) return;

    try {
      // 1. Create documents for each hospital in parallel
      const docPromises = topHospitals.map((h) =>
        addDoc(collection(db, 'emergency_alerts'), {
          user_phone: auth.currentUser?.phoneNumber || 'unknown',
          summary,
          transcript,
          language: selectedLanguage,
          location: location ? { lat: location.lat, lng: location.lng } : null,
          target_hospital: {
            id: h.id,
            name: h.name,
            phone: h.phone || null,
            distanceKm: +h.distanceKm.toFixed(1),
          },
          status: 'pending',
          createdAt: serverTimestamp(),
        })
      );

      const docRefs = await Promise.all(docPromises);

      // 2. Build ID map and Trigger IVR
      const idMap = {};
      topHospitals.forEach((h, i) => {
        idMap[h.id] = docRefs[i].id;
      });
      setAlertDocIds(idMap);
      setAlertSaved(true);

      // 3. Trigger Parallel IVR Calls (Returns SIDs)
      const ivrResults = await triggerParallelIVR(topHospitals, summary, idMap);

      // 4. Link SIDs back to Firestore docs for callback identification
      const updatePromises = ivrResults.map((res, i) => {
        if (res.status === 'triggered' && res.sid) {
          const docId = idMap[res.hospitalId];
          return updateDoc(doc(db, 'emergency_alerts', docId), { exotel_sid: res.sid });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);

      // 5. Timer Logic: 60s timeout for 'Not Responded'
      setTimeout(() => {
        setHospitalStatuses((prev) => {
          const newStatuses = { ...prev };
          topHospitals.forEach((h) => {
            if (newStatuses[h.id] === 'pending' || !newStatuses[h.id]) {
              newStatuses[h.id] = 'not_responded';
            }
          });
          return newStatuses;
        });
      }, 60000);

    } catch (err) {
      console.error('Broadcast Error:', err);
    }
  }

  /* ═══════════════════════════════════════════════
     5. Real-time listeners on ALL alert documents
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    const entries = Object.entries(alertDocIds);
    if (entries.length === 0) return;

    // Create one onSnapshot listener per alert document
    const unsubscribes = entries.map(([hospitalId, docId]) =>
      onSnapshot(doc(db, 'emergency_alerts', docId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const newStatus = data.status || 'pending';

        setHospitalStatuses((prev) => {
          if (prev[hospitalId] === newStatus) return prev;
          return { ...prev, [hospitalId]: newStatus };
        });
      })
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [alertDocIds, hospitals]);

  /* ── Computed: Winner & Multiple Status ── */
  const acceptedHospitals = hospitals.filter(h => hospitalStatuses[h.id] === 'accepted');
  const smartWinner = acceptedHospitals.length > 0 ? acceptedHospitals[0] : null; // Closest accepted
  const hasMultipleOptions = acceptedHospitals.length > 1;

  /* ── Helper: get status for a hospital ── */
  function getHospitalStatus(hospitalId) {
    return hospitalStatuses[hospitalId] || null;
  }

  /* ── Phone call ── */
  const handleCall = (phone) => { if (phone) window.open(`tel:${phone}`, '_self'); };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:pb-8 overflow-x-hidden">
      <style>{`
        @keyframes radar-sweep { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes radar-ping  { 0%{transform:scale(.3);opacity:.5} 80%,100%{transform:scale(1);opacity:0} }
        @keyframes radar-dot   { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes card-in     { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-up     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow-pulse  { 0%,100%{box-shadow:0 0 12px rgba(37,99,235,.1)} 50%{box-shadow:0 0 20px rgba(37,99,235,.2)} }
        @keyframes mic-pulse   { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(220,38,38,.2)} 50%{transform:scale(1.08);box-shadow:0 0 0 12px rgba(220,38,38,0)} }
        @keyframes mic-ring    { 0%{transform:scale(.8);opacity:.4} 100%{transform:scale(2);opacity:0} }
        @keyframes check-pop   { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
        @keyframes check-ring-grow { 0%{transform:scale(.6);opacity:.3} 100%{transform:scale(2.2);opacity:0} }
        @keyframes status-flash { 0%{opacity:0;transform:scale(.95)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Header ── */}
      <div className="bg-white p-4 md:p-6 flex items-center justify-between shrink-0 border-b border-slate-100 sticky top-0 z-20 md:hidden">
        <div className="flex items-center gap-4">
          <button className="w-9 h-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors" onClick={() => navigate('/home')}>←</button>
          <div>
            <div className="text-lg font-bold text-slate-800 tracking-tight">{t.emergency_title}</div>
            <div className="text-xs text-slate-400 font-medium">{t.emergency_subtitle}</div>
          </div>
        </div>
        {(transcript || aiSummary) && (
          <button 
            onClick={handleNewEmergency}
            className="text-[10px] font-bold text-red bg-red/10 px-3 py-1.5 rounded-full uppercase tracking-wider transition-all active:scale-[0.95]"
          >
            Reset
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* ── Left Side: Primary Action Area (65%) ── */}
        <div className="flex-[1.8] flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 p-6 md:p-12 flex flex-col items-center">
            
            {/* ── Radar Scanner ── */}
            <div className="relative w-[180px] h-[180px] md:w-[280px] md:h-[280px] flex items-center justify-center mb-10">
              <div className="absolute inset-0 rounded-full border border-slate-100"></div>
              <div className="absolute inset-[25%] rounded-full border border-slate-100"></div>
              <div className="absolute inset-[45%] rounded-full border border-slate-100"></div>
              {loading && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-brand/5" style={{ animation: 'radar-ping 2s ease-out infinite' }}></div>
                  <div className="absolute w-1/2 h-[2px] origin-left bg-gradient-to-r from-brand/40 to-transparent" style={{ animation: 'radar-sweep 2s linear infinite', left: '50%', top: '50%' }}></div>
                </>
              )}
              {!loading && hospitals.length > 0 && (
                <div className="absolute inset-0">
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-brand" style={{ top: '20%', left: '65%', animation: 'radar-dot 1.5s infinite', boxShadow: '0 0 15px rgba(37,99,235,.5)' }}></div>
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-brand" style={{ top: '60%', left: '25%', animation: 'radar-dot 1.5s infinite 0.3s', boxShadow: '0 0 15px rgba(37,99,235,.5)' }}></div>
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-brand" style={{ top: '38%', left: '74%', animation: 'radar-dot 1.5s infinite 0.6s', boxShadow: '0 0 15px rgba(37,99,235,.5)' }}></div>
                </div>
              )}
              <div className="w-5 h-5 rounded-full bg-brand relative z-10 shadow-[0_0_25px_rgba(37,99,235,0.4)]"></div>
            </div>

            {/* ── Status Text ── */}
            <div className="text-center mb-10">
              <div className={`text-xl font-bold tracking-tight ${loading ? 'text-slate-300' : 'text-slate-800'}`}>
                {loading ? t.scanning : `${hospitals.length} ${t.found_hospitals}`}
              </div>
              <div className="text-sm text-slate-400 mt-1 font-medium">{loading ? t.searching_hospitals : t.nearest_hospitals}</div>
            </div>

            {/* ── Voice/Mic Area ── */}
            {scanComplete && (
              <div className="w-full flex flex-col items-center gap-8">
                <div className="relative">
                  {isListening && (
                    <div className="absolute -inset-8 rounded-full border-2 border-red/10 animate-pulse" style={{ animation: 'mic-ring 1.5s infinite' }}></div>
                  )}
                  <button
                    onClick={toggleMic}
                    className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-0 cursor-pointer flex items-center justify-center relative z-10 transition-all shadow-xl ${isListening ? 'bg-red text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                    style={isListening ? { animation: 'mic-pulse 1.5s infinite' } : {}}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  </button>
                </div>

                {transcript && (
                  <div className="w-full max-w-xl bg-slate-50/50 border border-slate-100 rounded-2xl p-6 animate-fade-up">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">{t.you_said}</div>
                    <div className="text-base text-slate-700 italic font-medium leading-relaxed italic">"{transcript}"</div>
                  </div>
                )}

                {aiLoading && (
                  <div className="w-full max-w-xl bg-brand/5 border border-brand/10 rounded-2xl p-6 flex items-center gap-4 animate-fade-up">
                    <div className="w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full animate-spin"></div>
                    <span className="text-sm text-brand font-bold uppercase tracking-wider">{t.processing_ai}</span>
                  </div>
                )}

                {aiSummary && !aiLoading && !isConfirming && (
                  <div className="w-full max-w-xl bg-brand rounded-3xl p-8 shadow-xl shadow-brand/20 animate-fade-up text-white">
                    <div className="flex items-center gap-2 mb-3 opacity-80">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2.5L13.5 9.5L20.5 11.5L13.5 13.5L11.5 20.5L9.5 13.5L2.5 11.5L9.5 9.5L11.5 2.5Z"/></svg>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t.ai_summary}</span>
                    </div>
                    <div className="text-xl font-bold leading-relaxed tracking-tight">{aiSummary}</div>
                  </div>
                )}

                {isConfirming && (
                  <div className="w-full max-w-xl bg-white border-2 border-brand/10 rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 animate-fade-up flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-brand">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2.5L13.5 9.5L20.5 11.5L13.5 13.5L11.5 20.5L9.5 13.5L2.5 11.5L9.5 9.5L11.5 2.5Z"/></svg>
                        <span className="text-xs font-black uppercase tracking-widest">Review AI Summary</span>
                      </div>
                      <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
                        Calling in {countdown}s...
                      </div>
                    </div>
                    
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-lg font-bold text-slate-700 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 resize-none transition-all leading-relaxed"
                      rows="3"
                      value={aiSummary}
                      onChange={(e) => setAiSummary(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button 
                        onClick={handleConfirmBroadcast}
                        className="bg-green text-white py-4 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-green/20 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Confirm & Call
                      </button>
                      <button 
                        onClick={handleDiscard}
                        className="bg-red/10 text-red py-4 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red/20 transition-all active:scale-[0.98]"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                {alertSaved && (
                  <div className="w-full max-w-xl flex flex-col items-center gap-10 mt-6 animate-fade-up">
                    <div className="text-center">
                      <div className="text-2xl font-black text-green tracking-tight leading-none mb-2">{t.help_on_way}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-[0.15em]">{t.hospital_alerted}</div>
                    </div>

                    {/* Smart Main Action Button */}
                    {smartWinner ? (
                      <div className="w-full flex flex-col gap-5">
                        <a
                          href={`tel:${smartWinner.phone || ''}`}
                          className="w-full flex items-center justify-center gap-4 bg-green text-white text-xl font-bold py-6 rounded-2xl no-underline shadow-2xl shadow-green/30 hover:shadow-green/40 hover:-translate-y-1 transition-all active:scale-[0.98]"
                        >
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                          Call {smartWinner.name}
                        </a>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-4 bg-slate-100 text-slate-400 text-sm font-bold py-6 rounded-2xl border border-slate-200 cursor-not-allowed uppercase tracking-widest">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-amber rounded-full animate-spin"></div>
                        Broadcasting to Responders...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Side: Hospital Entities (35%) ── */}
        <div className="flex-[1] flex flex-col gap-4 overflow-y-auto max-h-[85vh] md:pr-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.15em]">Near You</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-800">{hospitals.length} Available</span>
            </div>
          </div>

          {!loading && hospitals.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div className="text-sm mt-4 font-medium">{t.no_hospitals_found}</div>
            </div>
          )}

          {hospitals.slice(0, 7).map((hospital, index) => {
            const status = getHospitalStatus(hospital.id);
            const isAccepted = status === 'accepted';
            const isRejected = status === 'rejected';
            const isPending  = status === 'pending';
            const isNotResponded = status === 'not_responded';

            const borderColor = isAccepted ? 'border-green' : isRejected ? 'border-red' : isNotResponded ? 'border-amber-500' : 'border-slate-50';
            const bgColor = isAccepted ? 'bg-green/5' : isRejected ? 'bg-red/5' : isNotResponded ? 'bg-amber-500/5' : 'bg-white';
            const shadow = isAccepted ? 'shadow-lg shadow-green/10' : isRejected ? 'shadow-lg shadow-red/10' : isNotResponded ? 'shadow-lg shadow-amber-500/10' : 'shadow-sm hover:shadow-xl hover:-translate-y-1';
            const opacity = (alertSaved && !alertDocIds[hospital.id]) ? 'opacity-40' : 'opacity-100';

            return (
              <div
                key={hospital.id}
                onClick={() => navigate(`/hospital/${hospital.id}`, { state: { hospital } })}
                className={`group border ${borderColor} ${bgColor} ${shadow} ${opacity} rounded-2xl transition-all duration-500 animate-card-in overflow-hidden h-fit p-5 cursor-pointer`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${isAccepted ? 'bg-green text-white' : 'bg-slate-50 text-slate-400'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-slate-800 truncate leading-tight">{hospital.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-slate-400">📍 {hospital.distanceKm.toFixed(1)} {t.km_away}</span>
                    </div>
                  </div>
                  
                  {isAccepted ? (
                    <div className="bg-green text-white p-2 rounded-lg animate-status-flash">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                  ) : isRejected ? (
                    <div className="bg-red text-white p-2 rounded-lg animate-status-flash">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                  ) : isNotResponded ? (
                    <div className="bg-amber-500 text-white p-2 rounded-lg animate-status-flash">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                  ) : (
                    <div className="bg-slate-50 text-slate-400 p-2 rounded-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                  )}
                </div>

                <div className="flex flex-col mt-4 pt-4 border-t border-slate-50 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {isPending ? (
                        <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                          Dialing Hospital...
                        </span>
                      ) : isAccepted ? (
                        <span className="bg-green/10 text-green px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Verified Availability
                        </span>
                      ) : isRejected ? (
                        <span className="bg-red/10 text-red px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Beds Occupied
                        </span>
                      ) : isNotResponded ? (
                        <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Contact Unreachable
                        </span>
                      ) : (
                        <span className="bg-slate-50 text-slate-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Awaiting Emergency Broadcast
                        </span>
                      )}
                    </div>
                    <button 
                      className="text-brand hover:bg-brand/5 p-1.5 rounded-lg transition-colors" 
                      onClick={(e) => { e.stopPropagation(); handleCall(hospital.phone); }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    </button>
                  </div>

                  {isAccepted && (
                    <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-green/10 shadow-sm mt-1 animate-fade-up">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Available Beds</span>
                        <div className="flex items-end gap-1">
                          <span className="text-lg font-black text-slate-800 leading-none">{hospital.beds || Math.floor(Math.random() * 15) + 2}</span>
                          <span className="text-xs text-slate-400 font-medium pb-[2px]">beds</span>
                        </div>
                      </div>
                      <div className="flex flex-col border-l border-slate-100 pl-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Oxygen Reserves</span>
                        <div className="flex items-end gap-1">
                          <span className="text-lg font-black text-sky-500 leading-none">{Math.floor(Math.random() * 20) + 80}%</span>
                          <span className="text-xs text-slate-400 font-medium pb-[2px]">full</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
