const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const twilio = require("twilio");
const { geohashQueryBounds, distanceBetween } = require("geofire-common");

// ─── Constants ──────────────────────────────────────────────────────────────
const RADIUS_KM = 10;
const MAX_HOSPITALS = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Query /hospitals within RADIUS_KM of the emergency location using geohash
 * bounds, then filter by real distance.
 */
async function queryNearbyHospitals(db, lat, lng) {
  const center = [lat, lng];
  const radiusMeters = RADIUS_KM * 1000;
  const bounds = geohashQueryBounds(center, radiusMeters);

  // Run one Firestore query per geohash bound range (in parallel)
  const queryPromises = bounds.map((b) => {
    return db
      .collection("hospitals")
      .orderBy("geohash")
      .startAt(b[0])
      .endAt(b[1])
      .get();
  });

  const snapshots = await Promise.all(queryPromises);

  // Merge, deduplicate, filter
  const seen = new Set();
  const hospitals = [];

  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      const data = doc.data();
      if (!data.lat || !data.lng) continue;

      // Actual distance check (geohash bounds are approximate rectangles)
      const distKm = distanceBetween([data.lat, data.lng], center);
      if (distKm > RADIUS_KM) continue;

      // Must have a phone number to call
      if (!data.phone && !data.exotelNumber) continue;

      hospitals.push({
        id: doc.id,
        ...data,
        distanceKm: Math.round(distKm * 10) / 10,
      });
    }
  }

  // Sort by distance, cap at MAX_HOSPITALS
  hospitals.sort((a, b) => a.distanceKm - b.distanceKm);
  return hospitals.slice(0, MAX_HOSPITALS);
}

/**
 * Place a single Twilio IVR call to one hospital.
 */
async function callHospital(twilioClient, twilioPhone, webhookUrl, hospital, emergencyId) {
  const phoneNumber = hospital.phone || hospital.exotelNumber;
  if (!phoneNumber) {
    console.log(`No phone for hospital ${hospital.id}`);
    return { success: false, hospitalId: hospital.id };
  }

  const emergencyTypeLabel = {
    cardiac: "cardiac yani dil ka",
    accident: "accident ya trauma ka",
    newborn: "naye bachche ka",
    other: "medical"
  };

  try {
    const call = await twilioClient.calls.create({
      to: phoneNumber,
      from: twilioPhone,
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="Polly.Aditi" language="hi-IN">
            Namaste. Yeh MediConnect ki taraf se 
            emergency alert hai. Aapke paas ek 
            ${emergencyTypeLabel[hospital.emergencyType] || "medical"} 
            emergency patient aa raha hai. 
            Agar aap patient le sakte hain 
            to abhi 1 dabayein. 
            Nahi le sakte to 2 dabayein.
          </Say>
          <Gather 
            numDigits="1" 
            action="${webhookUrl}?emergencyId=${emergencyId}&amp;hospitalId=${hospital.id}"
            method="POST"
            timeout="15">
          </Gather>
          <Say voice="Polly.Aditi" language="hi-IN">
            Koi jawab nahi aaya. Dhanyavaad.
          </Say>
        </Response>`,
      timeout: 30,
    });

    console.log(`Call placed to ${hospital.name}: ${call.sid}`);
    return { success: true, hospitalId: hospital.id, callSid: call.sid };
  } catch (err) {
    console.error(`Call failed for ${hospital.name}:`, err.message);
    return { success: false, hospitalId: hospital.id, error: err.message };
  }
}

// ─── Cloud Function (v2 syntax) ─────────────────────────────────────────────

exports.triggerIVR = onDocumentCreated("emergencies/{emergencyId}", async (event) => {
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  const db = admin.firestore();
  const emergencyId = event.params.emergencyId;
  const docRef = db.collection("emergencies").doc(emergencyId);
  const data = event.data.data();

  if (!data) {
    await docRef.update({
      ivrStatus: "error",
      ivrError: "Emergency data is null",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  // ── 1. Validate Twilio credentials ──────────────────────────
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !fromPhone) {
    await docRef.update({
      ivrStatus: "error",
      ivrError: "Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  // ── 2. Geohash radius query for nearby hospitals ────────────
  const lat = data.userLat || data.lat;
  const lng = data.userLng || data.lng;

  if (!lat || !lng) {
    await docRef.update({
      ivrStatus: "error",
      ivrError: "Emergency missing lat/lng coordinates",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  let hospitals;
  try {
    hospitals = await queryNearbyHospitals(db, lat, lng);
  } catch (err) {
    await docRef.update({
      ivrStatus: "error",
      ivrError: "Hospital query failed: " + err.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  if (hospitals.length === 0) {
    await docRef.update({
      ivrStatus: "error",
      ivrError: "No eligible hospitals found within " + RADIUS_KM + " km",
      hospitalsContacted: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }

  // ── 3. Update emergency doc with contacted hospital IDs ─────
  const hospitalIds = hospitals.map((h) => h.id);

  await docRef.update({
    hospitalsContacted: hospitalIds,
    status: "calling",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── 4. Call each hospital via Twilio (parallel) ─────────────
  const results = await Promise.allSettled(
    hospitals.map((hospital) =>
      callHospital(twilioClient, fromPhone, webhookUrl, hospital, emergencyId).catch((err) => ({
        hospitalId: hospital.id,
        hospitalName: hospital.name || "Unknown",
        status: "failed",
        callSid: null,
        error: err.message,
      }))
    )
  );

  // Collect outcomes
  const callResults = results.map((outcome) => {
    if (outcome.status === "fulfilled") return outcome.value;
    return {
      hospitalId: "unknown",
      hospitalName: "unknown",
      status: "failed",
      callSid: null,
      error: outcome.reason?.message || "Promise rejected",
    };
  });

  const successCount = callResults.filter((r) => r.success === true).length;
  const failCount = callResults.filter((r) => r.success === false).length;

  // Build callSid map for tracking
  const callSids = {};
  callResults.forEach((r) => {
    if (r.callSid && r.hospitalId) {
      callSids[r.hospitalId] = r.callSid;
    }
  });

  await docRef.update({
    ivrStatus: failCount === callResults.length ? "all_failed" : "calls_initiated",
    ivrResults: {
      total: callResults.length,
      success: successCount,
      failed: failCount,
      callSids,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return null;
});

module.exports = { triggerIVR: exports.triggerIVR, queryNearbyHospitals };
