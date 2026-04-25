import { useState, useRef, useCallback, useEffect } from "react";
import { GEMINI_MULTIMODAL_URL } from "../lib/gemini";

/**
 * LANGUAGE → Web Speech API lang code mapping.
 * "mix" is a Hinglish fallback that uses Hindi recognition.
 */
const LANG_MAP = {
  mr: "mr-IN",
  hi: "hi-IN",
  en: "en-IN",
  mix: "hi-IN",
};

/**
 * useGeminiVoice
 *
 * Primary path  → Web Speech API (SpeechRecognition)
 * Fallback path → MediaRecorder → base64 audio → Gemini multimodal REST
 *
 * Exports: transcript, listening, startListening(languageCode), stopListening()
 */
export function useGeminiVoice() {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening]   = useState(false);

  const recognitionRef = useRef(null);
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const streamRef      = useRef(null);
  const usingFallback  = useRef(false);

  // ─── Cleanup on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Detect SpeechRecognition support ────────────────────────────
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  // ─── PRIMARY: Web Speech API ─────────────────────────────────────
  function startWebSpeech(langCode) {
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.lang            = LANG_MAP[langCode] || "en-IN";
    recognition.interimResults  = true;
    recognition.continuous      = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }
      setTranscript(finalText);
    };

    recognition.onerror = (event) => {
      console.warn("[useGeminiVoice] SpeechRecognition error:", event.error);
      // On "not-allowed" or "no-speech", don't auto-fallback
      if (event.error === "not-allowed") {
        setListening(false);
        return;
      }
    };

    recognition.onend = () => {
      // Only mark as stopped if we didn't explicitly restart
      if (!usingFallback.current) {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }

  // ─── FALLBACK: MediaRecorder → Gemini multimodal REST ────────────
  async function startMediaRecorderFallback(langCode) {
    if (!GEMINI_MULTIMODAL_URL) {
      console.error("[useGeminiVoice] No Gemini API key configured for fallback.");
      setListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Convert captured audio to base64
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const base64Audio = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        // Send to Gemini multimodal endpoint for transcription
        try {
          const langLabel = LANG_MAP[langCode] || "en-IN";
          const response = await fetch(GEMINI_MULTIMODAL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Transcribe this audio. The speaker is using language code: ${langLabel}. Return ONLY the transcription text, nothing else.`,
                    },
                    {
                      inlineData: {
                        mimeType: "audio/webm",
                        data: base64Audio,
                      },
                    },
                  ],
                },
              ],
            }),
          });

          const json = await response.json();
          const text =
            json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          setTranscript(text.trim());
        } catch (err) {
          console.error("[useGeminiVoice] Gemini transcription failed:", err);
        }

        // Cleanup stream tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setListening(false);
      };

      recorderRef.current = recorder;
      recorder.start();
      usingFallback.current = true;
    } catch (err) {
      console.error("[useGeminiVoice] Microphone access denied:", err);
      setListening(false);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────
  const startListening = useCallback(
    (languageCode = "en") => {
      // Reset previous state
      setTranscript("");
      setListening(true);
      usingFallback.current = false;

      // Try Web Speech API first
      const webSpeechOK = startWebSpeech(languageCode);
      if (!webSpeechOK) {
        // Fallback to MediaRecorder + Gemini
        startMediaRecorderFallback(languageCode);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [SpeechRecognition]
  );

  const stopListening = useCallback(() => {
    // Stop Web Speech API
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        /* already stopped */
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder fallback
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
      recorderRef.current = null;
      return; // onstop handler will set listening=false & cleanup
    }

    // Cleanup any open stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setListening(false);
  }, []);

  return { transcript, listening, startListening, stopListening };
}
