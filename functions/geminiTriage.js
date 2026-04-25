const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require("firebase-functions");

const VALID_TYPES = ["cardiac", "accident", "newborn", "other"];
const VALID_SEVERITIES = ["low", "medium", "high"];

const FALLBACK_RESPONSE = {
  type: "other",
  severity: "medium",
  ttsMessage: "Emergency reported. Sending details to nearest hospital now.",
};

const SYSTEM_PROMPT = [
  "You are an emergency medical triage AI.",
  "Analyze the patient transcript and return ONLY a raw JSON object.",
  "No markdown, no code fences, no explanation, no extra text.",
  "",
  "Required JSON format:",
  "{",
  '  "type": "cardiac | accident | newborn | other",',
  '  "severity": "low | medium | high",',
  '  "ttsMessage": "short IVR message under 20 words"',
  "}",
  "",
  "Rules:",
  "- type MUST be exactly one of: cardiac, accident, newborn, other",
  "- severity MUST be exactly one of: low, medium, high",
  "- ttsMessage MUST be under 20 words, suitable for text-to-speech IVR playback",
  "- Do NOT wrap in markdown or code fences",
  "- Return ONLY the JSON object, absolutely nothing else",
].join("\n");

function sanitizeJsonString(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return cleaned.substring(firstBrace, lastBrace + 1);
}

function validateTriageData(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = VALID_TYPES.includes(data.type) ? data.type : "other";
  const severity = VALID_SEVERITIES.includes(data.severity)
    ? data.severity
    : "medium";

  let ttsMessage =
    typeof data.ttsMessage === "string" && data.ttsMessage.trim().length > 0
      ? data.ttsMessage.trim()
      : FALLBACK_RESPONSE.ttsMessage;

  const wordCount = ttsMessage.split(/\s+/).length;
  if (wordCount > 20) {
    ttsMessage = ttsMessage.split(/\s+/).slice(0, 20).join(" ");
  }

  return { type, severity, ttsMessage };
}

async function triageTranscript(transcript) {
  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error: "Empty or invalid transcript",
    };
  }

  const apiKey = functions.config().gemini
    ? functions.config().gemini.api_key
    : null;

  if (!apiKey) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error:
        "Gemini API key not configured. Run: firebase functions:config:set gemini.api_key=YOUR_KEY",
    };
  }

  let genAI;
  let model;

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
  } catch (initError) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error: "Gemini init failed: " + initError.message,
    };
  }

  let rawText;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: "Patient transcript: " + transcript.trim() },
    ]);

    const response = result.response;

    if (!response) {
      return {
        success: false,
        data: FALLBACK_RESPONSE,
        error: "Empty response from Gemini",
      };
    }

    rawText = response.text();
  } catch (apiError) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error: "Gemini API call failed: " + apiError.message,
    };
  }

  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error: "Gemini returned empty text",
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(rawText.trim());
  } catch (_firstParseError) {
    const sanitized = sanitizeJsonString(rawText);

    if (!sanitized) {
      return {
        success: false,
        data: FALLBACK_RESPONSE,
        error: "Could not extract JSON from Gemini response",
      };
    }

    try {
      parsed = JSON.parse(sanitized);
    } catch (_secondParseError) {
      return {
        success: false,
        data: FALLBACK_RESPONSE,
        error: "JSON parse failed after sanitization",
      };
    }
  }

  const validated = validateTriageData(parsed);

  if (!validated) {
    return {
      success: false,
      data: FALLBACK_RESPONSE,
      error: "Validation failed on parsed data",
    };
  }

  return { success: true, data: validated, error: null };
}

module.exports = { triageTranscript, FALLBACK_RESPONSE };
