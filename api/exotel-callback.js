/**
 * api/exotel-callback.js
 * Serverless function to handle IVR responses from Exotel.
 * 
 * Logic:
 * 1. Exotel sends a POST request with 'Digits' and 'CallSid'.
 * 2. We find the matching document in 'emergency_alerts'.
 * 3. Update status: 1 -> accepted, 2 -> rejected.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Note: In a real production environment, you would use environment variables
// for the service account key. For now, we assume the environment is configured.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Exotel sends data as application/x-www-form-urlencoded by default
  const { Digits, CallSid, From } = req.body;

  console.log(`📞 IVR Callback Received | CallSid: ${CallSid} | Digits: ${Digits} | From: ${From}`);

  if (!CallSid) {
    return res.status(400).send('Missing CallSid');
  }

  try {
    // 1. Find the alert document. 
    // Usually, we store the CallSid in the document when we first trigger the call.
    // If we didn't store it, we might need to find by hospital phone or a custom 'id' passed in the URL.
    
    const alertsRef = db.collection('emergency_alerts');
    const snapshot = await alertsRef.where('exotel_sid', '==', CallSid).limit(1).get();

    if (snapshot.empty) {
      console.warn(`⚠️ No alert found for CallSid: ${CallSid}`);
      // Fallback: Try searching by hospital phone if Sid isn't indexed yet
      const phoneSnapshot = await alertsRef.where('target_hospital.phone', '==', From).where('status', '==', 'pending').get();
      
      if (phoneSnapshot.empty) {
        return res.status(404).send('Alert not found');
      }
      
      // Update the first pending one found for this phone
      const doc = phoneSnapshot.docs[0];
      await updateStatus(doc.id, Digits);
    } else {
      const docId = snapshot.docs[0].id;
      await updateStatus(docId, Digits);
    }

    // Exotel expects an HTTP 200 response to acknowledge the callback
    return res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Callback Error:', error);
    return res.status(500).send('Internal Server Error');
  }
}

async function updateStatus(docId, digits) {
  let newStatus = 'pending';
  if (digits === '1') newStatus = 'accepted';
  if (digits === '2') newStatus = 'rejected';

  console.log(`✨ Updating Alert ${docId} to status: ${newStatus}`);
  
  await db.collection('emergency_alerts').doc(docId).update({
    status: newStatus,
    respondedAt: new Date(),
    ivr_digits: digits
  });
}
