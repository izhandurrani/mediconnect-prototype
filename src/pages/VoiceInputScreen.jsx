import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ambulance,
  ArrowLeft,
  Baby,
  CheckCircle2,
  HeartPulse,
  Hospital,
  Languages,
  MapPin,
  Mic,
  RotateCcw,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const EMERGENCY_TYPES = [
  {
    id: 'cardiac',
    label: 'Cardiac / Heart',
    description: 'Chest pain, heart attack, breathing issue',
    Icon: HeartPulse,
    keywords: [
      'chest',
      'heart',
      'cardiac',
      'dil',
      'seene',
      'dard',
      'heart attack',
      'heartattack',
      'dil ka dora',
      'हार्ट',
      'अटैक',
      'हृदय',
    ],
  },
  {
    id: 'accident',
    label: 'Accident / Trauma',
    description: 'Crash, injury, fracture, heavy bleeding',
    Icon: Ambulance,
    keywords: [
      'accident',
      'injury',
      'trauma',
      'chot',
      'girna',
      'takkar',
      'road',
      'traffic',
      'gir gaya',
      'fracture',
    ],
  },
  {
    id: 'newborn',
    label: 'Newborn / Maternity',
    description: 'Delivery, pregnancy, newborn or NICU need',
    Icon: Baby,
    keywords: [
      'baby',
      'newborn',
      'delivery',
      'bachcha',
      'prasav',
      'pregnant',
      'birth',
      'labour',
      'pains',
      'nicu',
    ],
  },
  {
    id: 'other',
    label: 'Other Emergency',
    description: 'Any urgent medical condition',
    Icon: Hospital,
    keywords: [],
  },
];

const OTHER_EMERGENCIES = [
  {
    id: 'stroke',
    label: 'Stroke',
    keywords: ['stroke', 'brain', 'paralysis', 'laqwa', 'face drooping', 'arm weak', 'speech', 'bol nahi pa raha'],
  },
  {
    id: 'allergic',
    label: 'Severe Allergic Reaction',
    keywords: ['allergy', 'allergic', 'rash', 'reaction', 'swelling', 'hives', 'anaphylaxis', 'khujli'],
  },
  {
    id: 'asthma',
    label: 'Severe Asthma Attack',
    keywords: ['asthma', 'breathe', 'breathing', 'saans', 'oxygen', 'inhaler', 'chest tight', 'suffocating', 'dama'],
  },
  {
    id: 'dehydration',
    label: 'Dehydration / Sunstroke',
    keywords: ['dehydration', 'sunstroke', 'heat', 'vomiting', 'diarrhea', 'loose motion', 'garmi', 'ulti'],
  },
  {
    id: 'bleeding',
    label: 'Severe Bleeding',
    keywords: ['blood', 'bleeding', 'khoon', 'cut', 'wound', 'hemorrhage', 'nahi ruk raha', 'bahut khoon'],
  },
  {
    id: 'poisoning',
    label: 'Poisoning / Overdose',
    keywords: ['poison', 'poisoning', 'overdose', 'zeher', 'tablet', 'medicine', 'chemical', 'drug'],
  },
  {
    id: 'seizure',
    label: 'Seizures / Fits',
    keywords: ['seizure', 'fit', 'epilepsy', 'fits', 'convulsion', 'mirgi', 'kaamp raha', 'jhatke', 'unconscious'],
  },
  {
    id: 'diabetic',
    label: 'Diabetic Emergency',
    keywords: ['diabetes', 'diabetic', 'sugar', 'insulin', 'low sugar', 'high sugar', 'madhumeh', 'behosh', 'shaking'],
  },
];

function detectEmergencyType(text) {
  const lower = text.toLowerCase();

  for (const type of EMERGENCY_TYPES) {
    if (type.id === 'other') continue;
    if (type.keywords.some((keyword) => lower.includes(keyword))) {
      return { mainType: type.id, otherType: null };
    }
  }

  for (const other of OTHER_EMERGENCIES) {
    if (other.keywords.some((keyword) => lower.includes(keyword))) {
      return { mainType: 'other', otherType: other.id };
    }
  }

  return { mainType: null, otherType: null };
}

export default function VoiceInputScreen() {
  const navigate = useNavigate();
  const {
    voiceTranscript,
    setVoiceTranscript,
    englishTranscript,
    setEnglishTranscript,
    location,
    activeScheme,
    setEmergencyType,
  } = useAppContext();

  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedOther, setSelectedOther] = useState(null);
  const [typedText, setTypedText] = useState('');
  const [micDenied, setMicDenied] = useState(false);
  const [listening, setListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [detectedType, setDetectedType] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const gridRef = useRef(null);

  const langCode = selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  const hasTranscript = !!(englishTranscript || voiceTranscript);
  const canProceed = !!(selectedType || englishTranscript || typedText);
  const selectedEmergency = EMERGENCY_TYPES.find((type) => type.id === selectedType);
  const selectedOtherLabel = OTHER_EMERGENCIES.find((type) => type.id === selectedOther)?.label;
  const selectedLabel = selectedOtherLabel || selectedEmergency?.label;
  const locationReady = !!(location?.lat && location?.lng);
  const locationText = locationReady
    ? location.isApproximate
      ? 'Using approximate location'
      : 'Location ready'
    : 'Detecting location';

  const applyDetection = useCallback((text) => {
    const { mainType, otherType } = detectEmergencyType(text);
    if (!mainType) return;

    setDetectedType(mainType);
    setSelectedType(mainType);
    if (otherType) setSelectedOther(otherType);

    setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  const translateToEnglish = useCallback(async (text) => {
    setTranslating(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setEnglishTranscript(text);
        applyDetection(text);
        return;
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Translate to English in one sentence, keep medical terms accurate. Return ONLY the translation, nothing else: "${text}"`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await res.json();
      const translated = data.candidates?.[0]?.content?.parts?.[0]?.text || text;
      const trimmed = translated.trim();
      setEnglishTranscript(trimmed);
      applyDetection(trimmed);
    } catch {
      setEnglishTranscript(text);
      applyDetection(text);
    } finally {
      setTranslating(false);
    }
  }, [applyDetection, setEnglishTranscript]);

  const processTranscript = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (selectedLanguage === 'hi') {
      translateToEnglish(trimmed);
    } else {
      setEnglishTranscript(trimmed);
      applyDetection(trimmed);
    }
  }, [applyDetection, selectedLanguage, setEnglishTranscript, translateToEnglish]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicDenied(true);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Already stopped.
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langCode;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      transcriptRef.current = text;
      setVoiceTranscript(text);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setMicDenied(true);
      }
    };
    recognition.onend = () => {
      setListening(false);
      processTranscript(transcriptRef.current);
    };

    recognitionRef.current = recognition;
    transcriptRef.current = '';
    recognition.start();
  }, [langCode, processTranscript, setVoiceTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Already stopped.
        }
      }
    };
  }, []);

  function handleReset() {
    setVoiceTranscript('');
    setEnglishTranscript('');
    setSelectedType(null);
    setSelectedOther(null);
    setDetectedType(null);
    setListening(false);
    setTranslating(false);
    setTypedText('');
    transcriptRef.current = '';
    setTimeout(() => startListening(), 300);
  }

  function handleTypedSubmit() {
    const text = typedText.trim();
    if (!text) return;

    setVoiceTranscript(text);
    processTranscript(text);
  }

  function handleContinue() {
    const finalType = selectedOther || selectedType || 'voice';
    const transcript = englishTranscript || typedText || voiceTranscript;

    setEmergencyType(finalType);
    setVoiceTranscript(transcript);

    navigate('/nearby', {
      state: {
        emergencyType: finalType,
        transcript,
        userLocation: location,
        language: selectedLanguage,
        scheme: activeScheme,
      },
    });
  }

  return (
    <div className="min-h-screen flex-1 bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl">
              Describe the Emergency
            </h1>
            <p className="m-0 mt-1 text-sm font-medium text-slate-500">
              Speak or type what happened
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-28">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <Languages className="h-4 w-4" />
                Language
              </div>
              <div className="grid grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1">
                {[
                  { id: 'hi', label: 'Hindi' },
                  { id: 'en', label: 'English' },
                ].map((language) => (
                  <button
                    key={language.id}
                    onClick={() => {
                      setSelectedLanguage(language.id);
                      if (language.id !== selectedLanguage && hasTranscript) {
                        handleReset();
                      }
                    }}
                    className={`rounded-full px-5 py-2 text-sm font-black transition-all ${
                      selectedLanguage === language.id
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
            </div>

            {!micDenied && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative flex items-center justify-center">
                  {listening && (
                    <>
                      <div className="animate-mic-ring absolute h-24 w-24 rounded-full border-2 border-red-200" />
                      <div className="animate-mic-ring-delay absolute h-24 w-24 rounded-full border-2 border-red-100" />
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (listening) {
                        try {
                          recognitionRef.current?.stop();
                        } catch {
                          // Already stopped.
                        }
                      } else {
                        startListening();
                      }
                    }}
                    disabled={translating}
                    className={`relative z-10 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 transition-all sm:h-28 sm:w-28 ${
                      listening
                        ? 'animate-mic-pulse border-red-300 bg-red-600 text-white shadow-2xl shadow-red-600/25'
                        : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95'
                    } ${translating ? 'cursor-not-allowed opacity-50' : ''}`}
                    aria-label={listening ? 'Stop listening' : 'Start listening'}
                  >
                    <Mic className="h-10 w-10" />
                  </button>
                </div>

                <div className="text-center">
                  <p className="m-0 text-base font-black text-slate-700">
                    {listening ? 'Listening...' : 'Tap microphone and speak'}
                  </p>
                  <p className="m-0 mt-1 text-xs font-medium text-slate-400">
                    Hindi and English are supported
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5">
              <textarea
                placeholder={"Or type the emergency here...\ne.g. My father has chest pain and is unconscious"}
                className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-red-300 focus:bg-white"
                rows={3}
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
                onBlur={handleTypedSubmit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleTypedSubmit();
                  }
                }}
              />
              {micDenied && (
                <button
                  onClick={() => {
                    setMicDenied(false);
                    startListening();
                  }}
                  className="mt-2 flex items-center gap-1.5 border-none bg-transparent text-xs font-bold text-slate-500"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Try microphone again
                </button>
              )}
            </div>

            {(voiceTranscript || englishTranscript || translating) && (
              <div className="animate-fade-up mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Emergency Details
                  </p>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Record again
                  </button>
                </div>

                {voiceTranscript && (
                  <div className="mb-3">
                    <div className="text-[11px] font-bold text-slate-400">You said</div>
                    <div className="mt-1 text-base font-bold text-slate-800">"{voiceTranscript}"</div>
                  </div>
                )}

                {translating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
                    <p className="m-0 text-sm font-bold text-slate-500">Understanding emergency...</p>
                  </div>
                ) : englishTranscript && englishTranscript !== voiceTranscript ? (
                  <div>
                    <div className="text-[11px] font-bold text-slate-400">Meaning</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">"{englishTranscript}"</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div ref={gridRef} className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Select Emergency Type
              </p>
              {selectedLabel && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-600">
                  {selectedLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EMERGENCY_TYPES.map((type) => {
                const Icon = type.Icon;
                const selected = selectedType === type.id;
                const detected = detectedType === type.id;

                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedType(type.id);
                      if (type.id !== 'other') setSelectedOther(null);
                    }}
                    className={`group flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                      selected
                        ? 'border-red-300 bg-red-50 shadow-lg shadow-red-600/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      selected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-red-600'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{type.label}</span>
                        {detected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Detected
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">
                        {type.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType === 'other' && (
            <div className="animate-fade-up mt-5">
              <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Select Specific Emergency
              </p>
              <div className="grid grid-cols-2 gap-2">
                {OTHER_EMERGENCIES.map((other) => (
                  <button
                    key={other.id}
                    onClick={() => setSelectedOther(other.id)}
                    className={`rounded-xl border p-3 text-left text-xs font-bold transition-all active:scale-95 ${
                      selectedOther === other.id
                        ? 'border-red-300 bg-red-50 text-red-600 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {other.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className={`mb-3 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${
              locationReady
                ? 'border-green-100 bg-green-50 text-green-700'
                : 'border-amber-100 bg-amber-50 text-amber-700'
            }`}>
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{locationText}</span>
            </div>

            {canProceed && (
              <button
                onClick={handleContinue}
                className="animate-fade-up flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-none bg-red-600 py-4 text-base font-black text-white shadow-xl shadow-red-600/20 transition-all hover:-translate-y-0.5 hover:bg-red-700 active:scale-[0.98]"
              >
                Find {selectedLabel ? `${selectedLabel.toLowerCase()} hospitals` : 'nearest hospitals'}
                <span aria-hidden="true">-&gt;</span>
              </button>
            )}

            <p className="m-0 mt-4 text-center text-xs font-medium leading-relaxed text-slate-400">
              In a life-threatening emergency, call 108 immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
