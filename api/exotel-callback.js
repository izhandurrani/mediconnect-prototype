/**
 * api/exotel-callback.js
 * 
 * Serverless function to handle IVR digit responses from Exotel.
 * 
 * Flow:
 *   1. The hospital staff presses a digit during the IVR call.
 *   2. Exotel POSTs the digit + CallSid to this endpoint.
 *   3. We find the matching emergency_alerts document in Firestore.
 *   4. Update the document status:
 *        1 → "accepted"  (hospital has beds)
 *        2 → "rejected"  (hospital is full)
 *   5. Return ExoML with a confirmation <Say> and <Hangup/>.
 *      (Returning valid ExoML is important — Exotel needs XML, not JSON.)
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Exotel sends data as application/x-www-form-urlencoded by default
  const digits = req.body?.digits || req.body?.Digits;
  const callSid = req.body?.CallSid;
  const from = req.body?.From;

  console.log(`📞 IVR Callback Received | CallSid: ${callSid} | Digits: ${digits} | From: ${from}`);

  if (!callSid) {
    const errorExoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Missing call information.</Say>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(errorExoml);
  }

  try {
    // ── 1. Find the alert document by CallSid ────────────────
    const alertsRef = db.collection('emergency_alerts');
    let docId = null;

    // Primary: Search by exotel_sid
    const snapshot = await alertsRef.where('exotel_sid', '==', callSid).limit(1).get();

    if (!snapshot.empty) {
      docId = snapshot.docs[0].id;
    } else if (from) {
      // Fallback: Search by hospital phone for pending alerts
      console.warn(`⚠️ No alert found for CallSid: ${callSid}. Trying phone fallback...`);
      const phoneSnapshot = await alertsRef
        .where('target_hospital.phone', '==', from)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (!phoneSnapshot.empty) {
        docId = phoneSnapshot.docs[0].id;
      }
    }

    if (!docId) {
      console.error(`❌ No alert found for CallSid=${callSid}, From=${from}`);
      const notFoundExoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We could not find the emergency alert. Thank you for responding.</Say>
  <Hangup/>
</Response>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(200).send(notFoundExoml);
    }

    // ── 2. Update the alert status ───────────────────────────
    const newStatus = digits === '1' ? 'accepted' : digits === '2' ? 'rejected' : 'pending';

    console.log(`✨ Updating Alert ${docId} → status: ${newStatus}`);

    await db.collection('emergency_alerts').doc(docId).update({
      status: newStatus,
      respondedAt: new Date(),
      ivr_digits: digits,
    });

    // ── 3. Return confirmation ExoML ─────────────────────────
    let confirmationMessage;
    if (newStatus === 'accepted') {
      confirmationMessage =
        'Thank you. Your hospital has been confirmed as available. ' +
        'The patient is being directed to your facility. Please prepare for arrival.';
    } else if (newStatus === 'rejected') {
      confirmationMessage =
        'Understood. Your hospital has been marked as full. ' +
        'We will route the patient to the next available facility. Thank you.';
    } else {
      confirmationMessage =
        'We did not recognize your input. The alert remains pending. Goodbye.';
    }

    const responseExoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Aditi" language="en-IN">
    ${escapeXml(confirmationMessage)}
  </Say>
  <Hangup/>
</Response>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(responseExoml);

  } catch (error) {
    console.error('❌ Callback Error:', error);

    const errorExoml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred while processing your response. Please try again.</Say>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(errorExoml);
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
