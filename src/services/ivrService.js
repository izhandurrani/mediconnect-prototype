/**
 * ivrService.js
 * Handles parallel IVR triggers for emergency hospital alerts.
 */

const EXOTEL_SID = import.meta.env.VITE_EXOTEL_SID;
const EXOTEL_TOKEN = import.meta.env.VITE_EXOTEL_TOKEN;
const EXOTEL_API_URL = import.meta.env.VITE_EXOTEL_API_URL || 'https://api.exotel.com/v1/Accounts';

/**
 * Triggers parallel IVR calls to a list of hospitals.
 * @param {Array} hospitals - List of hospital objects to call.
 * @param {string} aiSummary - The emergency summary to be converted to speech/read out.
 * @param {Object} alertIds - Map of hospitalId -> Firestore alertDocId.
 */
export async function triggerParallelIVR(hospitals, aiSummary, alertIds) {
  console.log('🚀 Initializing Parallel IVR Broadcast...');
  console.log(`📝 Message: "${aiSummary}"`);

  if (!hospitals || hospitals.length === 0) {
    console.warn('⚠️ No hospitals provided for IVR trigger.');
    return;
  }

  const callPromises = hospitals.map(async (hospital) => {
    const alertId = alertIds[hospital.id];
    const hospitalPhone = hospital.phone;

    if (!hospitalPhone) {
      console.error(`❌ Missing phone number for hospital: ${hospital.name}`);
      return { hospitalId: hospital.id, status: 'error', error: 'Missing phone' };
    }

    console.log(`📞 Triggering IVR for: ${hospital.name} (${hospitalPhone}) | AlertID: ${alertId}`);

    try {
      // In a real implementation:
      // const response = await fetch(...)
      // const data = await response.json();
      // const exotelSid = data.Call.Sid;
      
      // Simulation: Link the CallSid (mocked) to the Firestore doc
      const mockSid = `sid_${Math.random().toString(36).substr(2, 9)}`;
      
      // Crucial: Update the Firestore doc with the SID so the callback can find it
      // import { doc, updateDoc } from 'firebase/firestore';
      // import { db } from '../lib/firebase';
      // await updateDoc(doc(db, 'emergency_alerts', alertId), { exotel_sid: mockSid });

      return new Promise((resolve) => {
        setTimeout(() => {
          console.log(`✅ IVR Request Successful for: ${hospital.name} | Sid: ${mockSid}`);
          resolve({ hospitalId: hospital.id, status: 'triggered', sid: mockSid });
        }, 500);
      });

    } catch (error) {
      console.error(`❌ IVR Failed for ${hospital.name}:`, error);
      return { hospitalId: hospital.id, status: 'failed', error: error.message };
    }
  });

  try {
    const results = await Promise.all(callPromises);
    console.log('🏁 All parallel IVR requests processed.', results);
    return results;
  } catch (error) {
    console.error('🔥 Critical error in Parallel IVR logic:', error);
    throw error;
  }
}
