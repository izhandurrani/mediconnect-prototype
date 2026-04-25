/**
 * ivrService.js
 * Handles parallel IVR triggers for emergency hospital alerts.
 * 
 * When triggering a call via Exotel, the `Url` parameter tells Exotel
 * which endpoint to hit for the initial ExoML. We pass the alertId as
 * a query param so the ExoML endpoint can fetch the right patient summary.
 */

const EXOTEL_SID = import.meta.env.VITE_EXOTEL_SID;
const EXOTEL_TOKEN = import.meta.env.VITE_EXOTEL_TOKEN;
const EXOTEL_SUBDOMAIN = import.meta.env.VITE_EXOTEL_SUBDOMAIN || 'api.exotel.com';
const EXOTEL_CALLER_ID = import.meta.env.VITE_EXOTEL_CALLER_ID;
const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || window.location.origin;

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
    return [];
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
      // ── Real Exotel API call ─────────────────────────────
      // The `Url` parameter tells Exotel to fetch ExoML from our endpoint,
      // passing the alertId so it can look up the patient's voice summary.
      if (EXOTEL_SID && EXOTEL_TOKEN && EXOTEL_CALLER_ID) {
        const exomlUrl = `${APP_BASE_URL}/api/exotel-exoml?alertId=${encodeURIComponent(alertId)}`;

        const response = await fetch(
          `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${EXOTEL_SID}:${EXOTEL_TOKEN}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: EXOTEL_CALLER_ID,
              To: hospitalPhone,
              CallerId: EXOTEL_CALLER_ID,
              Url: exomlUrl,
              // StatusCallback can be added for call-level events
            }).toString(),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Exotel API Error for ${hospital.name}:`, errorText);
          return { hospitalId: hospital.id, status: 'failed', error: errorText };
        }

        const data = await response.json();
        const sid = data?.Call?.Sid || data?.sid;
        console.log(`✅ IVR triggered for: ${hospital.name} | Sid: ${sid}`);
        return { hospitalId: hospital.id, status: 'triggered', sid };
      }

      // ── Simulation mode (no Exotel credentials) ──────────
      console.log(`🧪 [SIMULATION] No Exotel credentials. Mocking IVR for: ${hospital.name}`);
      const mockSid = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      return new Promise((resolve) => {
        setTimeout(() => {
          console.log(`✅ [SIM] IVR Request mocked for: ${hospital.name} | Sid: ${mockSid}`);
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
