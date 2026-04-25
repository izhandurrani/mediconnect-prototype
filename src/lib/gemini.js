import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Guard: don't crash during local dev if key is absent
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Primary model for triage + hospital ranking.
 * responseMimeType "application/json" tells the model to emit clean JSON
 * without markdown fences, making JSON.parse() reliable.
 */
export const flashModel = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    })
  : null;

/**
 * Plain-text model — voice summarization, narrative responses, etc.
 */
export const textModel = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "text/plain",
      },
    })
  : null;

/**
 * Low-level REST base URL for multimodal (audio blob) requests.
 * Used by useGeminiVoice when the Web Speech API is unavailable.
 */
export const GEMINI_MULTIMODAL_URL = apiKey
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  : null;
