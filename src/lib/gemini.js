import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Only initialize if API key is present to avoid crashing during UI development
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Gemini 2.5 Flash — structured triage + hospital ranking (JSON output)
export const flashModel = genAI ? genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",  // structured JSON output
  },
}) : null;

// Gemini 2.5 Flash — plain text generation (for voice summarization)
export const textModel = genAI ? genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "text/plain",
  },
}) : null;

