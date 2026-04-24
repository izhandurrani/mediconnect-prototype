import { useState } from "react";
import { flashModel } from "../lib/gemini";

const TRIAGE_PROMPT = (transcript, hospitals) => `
You are a medical emergency triage AI for India.

User's voice input (may be in Hindi, Marathi, or Hinglish):
"${transcript}"

Available confirmed hospitals (JSON array):
${JSON.stringify(hospitals, null, 2)}

Return ONLY a JSON object with this exact schema:
{
  "emergencyType": "cardiac" | "accident" | "newborn" | "other",
  "urgencyLevel": 1 | 2 | 3,
  "reasoning": "one sentence in English",
  "recommendedHospitalId": "<id of best hospital>",
  "recommendationReason": "one sentence explaining why — distance, ICU, scheme"
}

Rules:
- emergencyType must be one of the four values above
- recommendedHospitalId must be the id field from the hospitals array
- Keep all text concise, under 30 words per field
`;

export function useGeminiTriage() {
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function triage(transcript, hospitals) {
    if (!flashModel) {
      setError("Gemini API is not configured.");
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await flashModel.generateContent(
        TRIAGE_PROMPT(transcript, hospitals)
      );
      const text   = response.response.text();
      const parsed = JSON.parse(text);
      setResult(parsed);
      return parsed;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { triage, result, loading, error };
}
