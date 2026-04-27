import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useEmergency } from '../hooks/useEmergency';
import { useGeolocation } from '../hooks/useGeolocation';
import { auth } from '../lib/firebase';
import LoadingSpinner from '../components/LoadingSpinner';

/* ── Language → BCP-47 mapping for Web Speech API ── */
const LANG_BCP = { mr: 'mr-IN', hi: 'hi-IN', en: 'en-IN', mix: 'hi-IN' };

export default function EmergencyScreen() {
  const navigate = useNavigate();
  const {
    selectedLanguage, activeScheme, location, setLocation,
    setEmergencyId, setEmergencyType,
    voiceTranscript, setVoiceTranscript,
    englishTranscript, setEnglishTranscript,
  } = useAppContext();

  const { createEmergency } = useEmergency();

  // Centralized geolocation hook (handles all edge cases)
  const { coords: geoCoords } = useGeolocation();

  // Local state
  const [listening, setListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  // ── Web Speech API ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = LANG_BCP[selectedLanguage] || 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setVoiceTranscript(result);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      setListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permission.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLanguage, setVoiceTranscript]);

  // ── Auto-start mic on mount (only if no existing transcript) ──
  useEffect(() => {
    if (!voiceTranscript && !englishTranscript) {
      const timer = setTimeout(() => startListening(), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Translate to English via Gemini after speech ends ──
  useEffect(() => {
    if (!voiceTranscript || listening) return;
    // If already have english transcript for this voice transcript, skip
    if (englishTranscript) return;

    if (selectedLanguage === 'en') {
      setEnglishTranscript(voiceTranscript);
      return;
    }

    // Translate via Gemini
    setTranslating(true);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setEnglishTranscript(voiceTranscript);
      setTranslating(false);
      return;
    }

    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate this to English in one sentence, keep medical terms accurate: ${voiceTranscript}`,
            }],
          }],
        }),
      }
    )
      .then((res) => res.json())
      .then((data) => {
        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text || voiceTranscript;
        setEnglishTranscript(translated.trim());
      })
      .catch(() => {
        // Fallback: show raw transcript
        setEnglishTranscript(voiceTranscript);
      })
      .finally(() => setTranslating(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceTranscript, listening]);

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  function toggleMic() {
    if (listening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    } else {
      startListening();
    }
  }

  // ── Reset / Re-record ───────────────────────────────────────────────────────
  function handleReset() {
    setVoiceTranscript('');
    setEnglishTranscript('');
    setListening(false);
    setTranslating(false);
    setError('');
    setTimeout(() => startListening(), 300);
  }

  // ── "Finding hospitals" → get location → create emergency → navigate ────────
  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      // 1. Get location from hook (always populated — real or fallback)
      const loc = geoCoords || { lat: 19.8762, lng: 75.3433 };
      setLocation(loc);

      // 2. Store in context
      setEmergencyType(null); // voice-based, no type grid

      // 3. Create emergency document (triggers Cloud Functions)
      const userId = auth.currentUser?.uid || 'anonymous';
      const id = await createEmergency({
        userId,
        type: 'voice',
        lat: loc.lat,
        lng: loc.lng,
        scheme: activeScheme,
        language: selectedLanguage,
      });
      setEmergencyId(id);

      // 4. Navigate
      navigate('/calling');
    } catch (err) {
      console.error('Emergency creation failed:', err);
      setError('Failed to create emergency. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-white pb-0 overflow-x-hidden">
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220,38,38,0.3); }
          50% { transform: scale(1.06); box-shadow: 0 0 0 18px rgba(220,38,38,0); }
        }
        @keyframes mic-ring {
          0% { transform: scale(0.85); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="bg-red p-[14px_16px] flex items-center gap-[10px] shrink-0">
        <button
          className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white border-none cursor-pointer text-sm"
          onClick={() => navigate('/home')}
        >
          ←
        </button>
        <div className="text-white ml-[2px]">
          <div className="text-[15px] font-bold">Emergency</div>
          <div className="text-[11px] opacity-80">Voice-activated hospital search</div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-28 gap-6">

        {/* Title */}
        <div className="text-center">
          <div className="text-[22px] font-bold text-slate-800 tracking-tight leading-tight">
            Hospitals found near you
          </div>
          <div className="text-[13px] text-slate-400 mt-1.5 font-medium">
            Describe your emergency
          </div>
        </div>

        {/* ── Mic button ── */}
        <div className="relative flex items-center justify-center mt-4 mb-2">
          {/* Expanding rings while listening */}
          {listening && (
            <>
              <div
                className="absolute w-24 h-24 rounded-full border-2 border-red/20"
                style={{ animation: 'mic-ring 1.8s ease-out infinite' }}
              />
              <div
                className="absolute w-24 h-24 rounded-full border-2 border-red/10"
                style={{ animation: 'mic-ring 1.8s ease-out infinite 0.6s' }}
              />
            </>
          )}

          <button
            onClick={toggleMic}
            disabled={submitting}
            className={`w-24 h-24 rounded-full border-0 cursor-pointer flex items-center justify-center relative z-10 transition-all shadow-xl ${
              listening
                ? 'bg-red text-white shadow-red/30'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
            } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={listening ? { animation: 'mic-pulse 1.5s ease-in-out infinite' } : {}}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>

        {/* Status text */}
        <div className="text-[13px] font-medium text-center">
          {listening ? (
            <span className="text-red">Listening to your emergency...</span>
          ) : voiceTranscript && !englishTranscript ? (
            <span className="text-slate-400">Processing...</span>
          ) : englishTranscript ? (
            <span className="text-slate-400">Tap to speak again</span>
          ) : (
            <span className="text-slate-400">Tap the microphone to start</span>
          )}
        </div>

        {/* ── Translating indicator ── */}
        {translating && (
          <div className="flex items-center gap-3 bg-brand/5 border border-brand/10 rounded-2xl px-5 py-3">
            <LoadingSpinner size="sm" color="border-brand" />
            <span className="text-xs text-brand font-bold">Translating to English...</span>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-xs text-red-600 font-medium flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-0 shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* ── YOU SAID card ── */}
        {englishTranscript && (
          <div
            className="w-full max-w-md bg-slate-50/70 border border-slate-100 rounded-2xl p-6"
            style={{ animation: 'fade-up 0.4s ease-out' }}
          >
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">
              You said
            </div>
            <div className="text-[15px] text-slate-700 italic font-medium leading-relaxed">
              "{englishTranscript}"
            </div>
          </div>
        )}

        {/* ── Reset button ── */}
        {englishTranscript && (
          <button
            onClick={handleReset}
            disabled={submitting}
            className="text-[12px] font-semibold text-slate-500 border border-slate-200 rounded-full px-4 py-1.5 bg-transparent cursor-pointer hover:border-slate-300 hover:text-slate-700 transition-all disabled:opacity-50"
          >
            🔄 Record again
          </button>
        )}

        {/* ── Finding hospitals button ── */}
        {englishTranscript && (
          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full max-w-md p-[14px] bg-brand text-white border-none rounded-xl text-[14px] font-bold cursor-pointer tracking-wide disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-brand/20 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.97]"
            style={{ animation: 'fade-up 0.4s ease-out 0.1s both' }}
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" />
                Finding hospitals...
              </>
            ) : (
              'Finding hospitals →'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
