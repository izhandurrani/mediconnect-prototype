const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { geohashQueryBounds, distanceBetween } = require("geofire-common");

// ─── Constants ──────────────────────────────────────────────────────────────
const RADIUS_KM = 10;
const MAX_HOSPITALS = 10;
const CALL_TIME_LIMIT = 30;

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
 * Place a single Exotel IVR call to one hospital.
 */
async function callHospital(config, hospital, emergencyId) {
  const { sid, token, callerId, appletUrl } = config;

  const customField = JSON.stringify({
    emergencyId,
    hospitalId: hospital.id,
  });

  const url = `https://api.exotel.com/v1/Accounts/${sid}/Calls/connect.json`;

  const params = new URLSearchParams();
  params.append("From", hospital.exotelNumber || hospital.phone);
  params.append("To", callerId);
  params.append("CallerId", callerId);
  params.append("CustomField", customField);
  params.append("TimeLimit", String(CALL_TIME_LIMIT));

  if (appletUrl) {
    // Append context so the ExoML applet knows which emergency/hospital
    const dynamicUrl =
      appletUrl +
      "?emergencyId=" + encodeURIComponent(emergencyId) +
      "&hospitalId=" + encodeURIComponent(hospital.id);
    params.append("Url", dynamicUrl);
  }

  const response = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: { username: sid, password: token },
    timeout: 15000,
  });

  return {
    hospitalId: hospital.id,
    hospitalName: hospital.name || "Unknown",
    status: "initiated",
    callSid: response.data?.Call?.Sid || null,
  };
}

// ─── Cloud Function factory ─────────────────────────────────────────────────

function triggerIVR(db) {
  return functions.firestore
    .document("emergencies/{emergencyId}")
    .onCreate(async (snap, context) => {
      const emergencyId = context.params.emergencyId;
      const docRef = db.collection("emergencies").doc(emergencyId);
      const data = snap.data();

      if (!data) {
        await docRef.update({
          ivrStatus: "error",
          ivrError: "Emergency data is null",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // ── 1. Read Exotel config from env ──────────────────────────
      const sid = process.env.EXOTEL_SID;
      const token = process.env.EXOTEL_TOKEN;
      const callerId = process.env.EXOTEL_CALLER_ID;
      const appletUrl = process.env.EXOTEL_APPLET_URL || "";

      if (!sid || !token || !callerId) {
        await docRef.update({
          ivrStatus: "error",
          ivrError: "Exotel credentials not configured (EXOTEL_SID / EXOTEL_TOKEN / EXOTEL_CALLER_ID)",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      const config = { sid, token, callerId, appletUrl };

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

      // ── 4. Call each hospital via Exotel (parallel) ─────────────
      const results = await Promise.allSettled(
        hospitals.map((hospital) =>
          callHospital(config, hospital, emergencyId).catch((err) => ({
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

      const successCount = callResults.filter((r) => r.status === "initiated").length;
      const failCount = callResults.filter((r) => r.status === "failed").length;

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
}

module.exports = { triggerIVR, queryNearbyHospitals };
