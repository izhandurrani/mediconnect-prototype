import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Language config ── */
const LANGUAGES = [
  { id: 'mr', label: '🇮🇳 Marathi', bcp: 'mr-IN' },
  { id: 'hi', label: 'हिंदी Hindi', bcp: 'hi-IN' },
  { id: 'en', label: 'English', bcp: 'en-IN' },
  { id: 'mix', label: 'Hinglish', bcp: 'hi-IN' },
];

/* ── Emergency type keywords ── */
const KEYWORD_MAP = {
  cardiac: [
    'chest pain', 'heart attack', 'dard', 'seene mein dard', 'seene me dard',
    'heart', 'cardiac', 'dil', 'behosh', 'unconscious', 'chhati mein dard',
    'chhati me dard', 'heart band', 'dil ka daura', 'dil band', 'saans',
    'breathing', 'sajha', 'chhaati', 'chest', 'pain',
  ],
  accident: [
    'accident', 'crash', 'girna', 'gir gaya', 'chot', 'injury', 'blood',
    'khoon', 'fracture', 'toot gaya', 'tut gaya', 'sadak', 'road',
    'gaadi', 'car', 'bike', 'truck', 'hadsa', 'takkar', 'lagi', 'lag gayi',
    'ghav', 'wound', 'broken', 'toota',
  ],
  newborn: [
    'baby', 'bachha', 'bachcha', 'baccha', 'nicu', 'premature', 'delivery',
    'prasav', 'navchajanma', 'born', 'birth', 'newborn', 'navjat',
    'janam', 'pet dard', 'labour', 'labor', 'pregnant',
  ],
};

/* ── Emergency type display config ── */
const TYPE_CONFIG = {
  cardiac: { emoji: '🫀', label: 'CARDIAC', needs: 'ICU + Cardiac Unit', color: 'text-red-600' },
  accident: { emoji: '🚑', label: 'ACCIDENT', needs: 'Trauma + Surgery', color: 'text-orange-600' },
  newborn: { emoji: '👶', label: 'NEWBORN', needs: 'NICU', color: 'text-blue-600' },
  other: { emoji: '🏥', label: 'MEDICAL', needs: 'Emergency 24/7', color: 'text-slate-600' },
};

/**
 * Detect emergency type from transcript using keyword matching.
 * Returns { type, confidence }.
 */
function detectEmergencyType(transcript) {
  const lower = transcript.toLowerCase();
  const scores = { cardiac: 0, accident: 0, newborn: 0 };

  for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[type]++;
      }
    }
  }

  const maxScore = Math.max(scores.cardiac, scores.accident, scores.newborn);

  if (maxScore === 0) {
    return { type: 'other', confidence: 'low' };
  }

  const winner = Object.entries(scores).find(([, v]) => v === maxScore)[0];
  const confidence = maxScore >= 3 ? 'high' : maxScore >= 2 ? 'medium' : 'low';

  return { type: winner, confidence };
}

export default function VoiceInputScreen() {
  const navigate = useNavigate();

  const [language, setLanguage] = useState('hi');
  const [phase, setPhase] = useState('ready'); // ready | listening | processing | detected
  const [transcript, setTranscript] = useState('');
  const [detected, setDetected] = useState(null); // { type, confidence }
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  const recognitionRef = useRef(null);

  // ── Get GPS on mount ──
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 19.8762, lng: 75.3433 }),
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setUserLocation({ lat: 19.8762, lng: 75.3433 });
    }
  }, []);

  // ── Start listening ──
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
    }

    const recognition = new SpeechRecognition();
    const langConfig = LANGUAGES.find((l) => l.id === language);
    recognition.lang = langConfig?.bcp || 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setPhase('listening');
      setError('');
    };

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
    };

    recognition.onend = () => {
      setPhase('processing');

      // Small delay for UX, then detect
      setTimeout(() => {
        const currentTranscript = document.querySelector('[data-transcript]')?.textContent || '';
        if (currentTranscript.trim()) {
          const result = detectEmergencyType(currentTranscript);
          setDetected(result);
          setPhase('detected');
        } else {
          setPhase('ready');
        }
      }, 800);
    };

    recognition.onerror = (event) => {
      setPhase('ready');
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permission.');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Tap the mic and speak clearly.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language]);

  // Process transcript when it changes and listening ends
  useEffect(() => {
    if (phase === 'processing' && transcript.trim()) {
      const result = detectEmergencyType(transcript);
      setDetected(result);
      setPhase('detected');
    }
  }, [phase, transcript]);

  // ── Mic button tap ──
  function handleMicTap() {
    if (phase === 'listening') {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    } else {
      setTranscript('');
      setDetected(null);
      setError('');
      startListening();
    }
  }

  // ── Reset ──
  function handleReset() {
    setTranscript('');
    setDetected(null);
    setPhase('ready');
    setError('');
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* noop */ }
    }
  }

  // ── Navigate to nearby hospitals ──
  function handleCallHospitals() {
    if (!detected || !userLocation) return;
    navigate('/nearby', {
      state: {
        emergencyType: detected.type,
        transcript,
        userLocation,
        language,
      },
    });
  }

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
      }
    };
  }, []);

  const typeConfig = detected ? TYPE_CONFIG[detected.type] : null;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-red-600 via-red-700 to-red-900">

      {/* ── Header ── */}
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white border-none cursor-pointer text-sm backdrop-blur-sm"
        >
          ←
        </button>
        <div className="text-white">
          <div className="text-base font-bold">Describe the Emergency</div>
          <div className="text-[11px] opacity-70">Speak in your language</div>
        </div>
      </div>

      {/* ── Language Selector ── */}
      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => {
              setLanguage(lang.id);
              if (phase === 'detected') handleReset();
            }}
            className={`text-xs font-bold px-4 py-2 rounded-full border whitespace-nowrap cursor-pointer transition-all ${
              language === lang.id
                ? 'bg-white text-red-700 border-white shadow-lg'
                : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* Mic Button */}
        {phase !== 'detected' && (
          <div className="relative flex items-center justify-center">
            {phase === 'listening' && (
              <>
                <div className="absolute w-32 h-32 rounded-full border-2 border-white/20 animate-mic-ring" />
                <div className="absolute w-32 h-32 rounded-full border-2 border-white/10 animate-mic-ring-delay" />
              </>
            )}

            <button
              onClick={handleMicTap}
              disabled={phase === 'processing'}
              className={`w-32 h-32 rounded-full border-0 cursor-pointer flex items-center justify-center relative z-10 transition-all ${
                phase === 'listening'
                  ? 'bg-white text-red-600 shadow-2xl animate-mic-pulse'
                  : phase === 'processing'
                    ? 'bg-white/30 text-white/60 cursor-wait'
                    : 'bg-white/20 text-white hover:bg-white/30 active:scale-95'
              }`}
            >
              {phase === 'processing' ? (
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Status text */}
        <div className="text-center">
          {phase === 'ready' && (
            <div className="text-white/70 text-sm font-medium">Tap microphone and speak</div>
          )}
          {phase === 'listening' && (
            <div className="text-white text-sm font-bold animate-pulse">Listening... speak now</div>
          )}
          {phase === 'processing' && (
            <div className="text-white/70 text-sm font-medium">Understanding your emergency...</div>
          )}
        </div>

        {/* Live transcript (hidden data attribute for detection) */}
        {transcript && phase !== 'detected' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 w-full max-w-sm border border-white/10">
            <div data-transcript className="text-white/90 text-sm italic text-center leading-relaxed">
              "{transcript}"
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 w-full max-w-sm border border-white/20">
            <div className="text-white/90 text-xs text-center font-medium">{error}</div>
          </div>
        )}

        {/* ── DETECTED RESULT CARD ── */}
        {phase === 'detected' && typeConfig && (
          <div className="w-full max-w-sm animate-fade-up">
            {/* Transcript */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/15 mb-4">
              <div className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                🎤 You said:
              </div>
              <div data-transcript className="text-white text-sm italic leading-relaxed">
                "{transcript}"
              </div>
            </div>

            {/* Detected type */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <div className="text-center">
                <div className="text-4xl mb-2">{typeConfig.emoji}</div>
                <div className={`text-xl font-black tracking-tight ${typeConfig.color}`}>
                  {typeConfig.label}
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">Emergency</div>
                <div className="text-xs text-slate-400 font-medium mt-2">
                  Needs: {typeConfig.needs}
                </div>
                {detected.confidence !== 'high' && (
                  <div className="text-[10px] text-amber-600 bg-amber-50 rounded-full px-3 py-1 inline-block mt-2 font-bold">
                    Confidence: {detected.confidence}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 mt-5">
              <button
                onClick={handleReset}
                className="w-full py-3 bg-white/15 text-white border border-white/25 rounded-xl text-sm font-bold cursor-pointer hover:bg-white/25 transition-all active:scale-[0.97] backdrop-blur-sm"
              >
                🔄 Reset — Agar Galat Hua
              </button>

              <button
                onClick={handleCallHospitals}
                disabled={!userLocation}
                className="w-full py-4 bg-white text-red-700 border-none rounded-xl text-base font-black cursor-pointer shadow-2xl hover:shadow-3xl hover:-translate-y-0.5 transition-all active:scale-[0.97] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <span className="text-xl">🚨</span>
                Call Top 5 Hospitals →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom helper text ── */}
      {phase === 'ready' && (
        <div className="p-6 text-center">
          <div className="text-white/40 text-[11px] leading-relaxed">
            Speak in Marathi, Hindi or English. Say what happened — chest pain, accident, baby emergency, etc.
          </div>
        </div>
      )}
    </div>
  );
}
