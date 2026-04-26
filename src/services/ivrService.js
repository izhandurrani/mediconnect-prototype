/**
 * ivrService.js
 *
 * DEPRECATED — IVR calls are now handled entirely by Cloud Functions:
 *   - triggerIVR: fires on emergencies/{id} onCreate → calls hospitals via Twilio
 *   - twilioWebhook: receives Twilio digit callbacks → updates Firestore
 *
 * The frontend only needs to:
 *   1. Create an emergency document (useEmergency hook)
 *   2. Listen to it via onSnapshot for real-time status updates
 *
 * This file is kept as a no-op stub so existing imports don't break.
 */

export async function triggerParallelIVR() {
  console.warn(
    '[ivrService] triggerParallelIVR is deprecated. ' +
    'IVR calls are now triggered server-side by Cloud Functions.'
  );
  return [];
}
