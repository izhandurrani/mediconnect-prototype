/**
 * api/exotel-exoml.js
 * 
 * Dynamic ExoML Generator for Exotel IVR.
 * 
 * Flow:
 *   1. Exotel connects a call to a hospital and hits this endpoint.
 *   2. We look up the patient's emergency alert from Firestore
 *      (via ?alertId= query param or the CallSid from Exotel's POST body).
 *   3. We read the AI-generated voice summary from the alert document.
 *   4. We return an ExoML response:
 *        - <Say> tag reads out the emergency summary to the hospital staff.
 *        - <GetDigits> waits for confirmation input:
 *            Press 1 → Hospital available (beds/resources ready)
 *            Press 2 → Hospital full (no capacity)
 *   5. Exotel posts the pressed digits to our callback endpoint.
 * 
 * Exotel App URL:  https://<your-domain>/api/exotel-exoml?alertId=<FIRESTORE_DOC_ID>
 * Callback URL:    https://<your-domain>/api/exotel-callback
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin Init (singleton) ──────────────────────────
if (!getApps().length) {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();

// ── Host detection for callback URL ──────────────────────────
function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// ── XML helper ───────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Main Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Exotel typically sends GET for the initial applet fetch,
  // but we also support POST in case of passthrough configurations.
  const alertId = req.query?.alertId || req.body?.alertId;
  const callSid = req.body?.CallSid || req.query?.CallSid;

  console.log(`📞 ExoML Request | alertId: ${alertId} | CallSid: ${callSid}`);

  try {
    // ── 1. Resolve the emergency alert document ──────────────
    let alertDoc = null;

    if (alertId) {
      // Primary path: alertId passed as query parameter
      const docSnap = await db.collection('emergency_alerts').doc(alertId).get();
      if (docSnap.exists) {
        alertDoc = { id: docSnap.id, ...docSnap.data() };
      }
    }

    if (!alertDoc && callSid) {
      // Fallback: look up by exotel_sid
      const snapshot = await db
        .collection('emergency_alerts')
        .where('exotel_sid', '==', callSid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        alertDoc = { id: doc.id, ...doc.data() };
      }
    }

    // ── 2. Build the voice message ───────────────────────────
    let voiceMessage;
    let language = 'en'; // default

    if (alertDoc) {
      language = alertDoc.language || 'en';

      // Use the AI summary (concise), falling back to the raw transcript
      const summary = alertDoc.summary || alertDoc.transcript || '';
      const hospitalName = alertDoc.target_hospital?.name || 'Hospital';
      const distance = alertDoc.target_hospital?.distanceKm
        ? `${alertDoc.target_hospital.distanceKm} kilometers away`
        : 'nearby';

      if (language === 'hi') {
        voiceMessage =
          `ये MediConnect इमरजेंसी अलर्ट है। ` +
          `${hospitalName} के लिए संदेश: ` +
          `मरीज़ ${distance} है। ` +
          `स्थिति: ${summary}। ` +
          `अगर बेड उपलब्ध है तो 1 दबाएं। अगर अस्पताल भरा हुआ है तो 2 दबाएं।`;
      } else {
        voiceMessage =
          `This is a MediConnect emergency alert. ` +
          `Message for ${hospitalName}: ` +
          `Patient is ${distance}. ` +
          `Condition: ${summary}. ` +
          `Press 1 if beds are available. Press 2 if the hospital is full.`;
      }
    } else {
      // No matching alert found — play a generic fallback
      console.warn(`⚠️ No alert found for alertId=${alertId}, CallSid=${callSid}`);
      voiceMessage =
        `This is a MediConnect emergency alert. ` +
        `We could not load the patient details at this time. ` +
        `Press 1 if beds are available. Press 2 if the hospital is full.`;
    }

    // ── 3. Build the callback URL ────────────────────────────
    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/exotel-callback`;

    // ── 4. Generate ExoML ────────────────────────────────────
    const exoml = buildExoML(voiceMessage, callbackUrl, language);

    // ── 5. Send the response ─────────────────────────────────
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(exoml);

  } catch (error) {
    console.error('❌ ExoML Generation Error:', error);

    // Even on error, return valid ExoML so Exotel doesn't hang the call
    const fallbackExoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We are experiencing a temporary issue. Please try again later.</Say>
  <Hangup/>
</Response>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(fallbackExoml);
  }
}

/**
 * Builds the ExoML XML document.
 * 
 * Structure:
 *   <Response>
 *     <GetDigits action="<callbackUrl>" timeout="10" numDigits="1" retries="2">
 *       <Say voice="..." language="...">
 *         ...emergency summary + instructions...
 *       </Say>
 *     </GetDigits>
 *     <!-- Fallback if no digits pressed after retries -->
 *     <Say>No response received. The alert has been marked as not responded. Goodbye.</Say>
 *     <Hangup/>
 *   </Response>
 *
 * @param {string} message - The TTS message to read to the hospital
 * @param {string} callbackUrl - The URL Exotel will POST digit responses to
 * @param {string} language - 'en' or 'hi'
 * @returns {string} ExoML XML string
 */
function buildExoML(message, callbackUrl, language = 'en') {
  // Exotel TTS voice/language mapping
  const voiceName = language === 'hi' ? 'Aditi' : 'Aditi';
  const langCode = language === 'hi' ? 'hi-IN' : 'en-IN';

  const escapedMessage = escapeXml(message);
  const escapedCallbackUrl = escapeXml(callbackUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits action="${escapedCallbackUrl}" timeout="10" numDigits="1" retries="2">
    <Say voice="${voiceName}" language="${langCode}">
      ${escapedMessage}
    </Say>
  </GetDigits>
  <Say voice="${voiceName}" language="${langCode}">
    No response received. The alert will be marked as not responded. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
}
