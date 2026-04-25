const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const { triageTranscript, FALLBACK_RESPONSE } = require("./geminiTriage");
const { buildTriggerIVR } = require("./triggerIVR");
const { buildExoMLEndpoint } = require("./exomlFunction");

exports.onEmergencyTriage = functions.firestore
  .document("emergencies/{emergencyId}")
  .onCreate(async function (snap, context) {
    const emergencyId = context.params.emergencyId;
    const docRef = db.collection("emergencies").doc(emergencyId);

    let data;

    try {
      data = snap.data();
    } catch (readError) {
      try {
        await docRef.update({
          status: "error",
          error: "Failed to read document data: " + readError.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_e) {
        // Silent
      }
      return null;
    }

    if (!data) {
      try {
        await docRef.update({
          status: "error",
          error: "Document data is null",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_e) {
        // Silent
      }
      return null;
    }

    var transcript = data.transcript;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      try {
        await docRef.update({
          type: FALLBACK_RESPONSE.type,
          severity: FALLBACK_RESPONSE.severity,
          ttsMessage: FALLBACK_RESPONSE.ttsMessage,
          status: "error",
          error: "Missing or empty transcript field",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_e) {
        // Silent
      }
      return null;
    }

    let result;

    try {
      result = await triageTranscript(transcript);
    } catch (triageError) {
      try {
        await docRef.update({
          type: FALLBACK_RESPONSE.type,
          severity: FALLBACK_RESPONSE.severity,
          ttsMessage: FALLBACK_RESPONSE.ttsMessage,
          status: "error",
          error: "Triage function threw: " + triageError.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_e) {
        // Silent
      }
      return null;
    }

    if (!result || !result.data) {
      try {
        await docRef.update({
          type: FALLBACK_RESPONSE.type,
          severity: FALLBACK_RESPONSE.severity,
          ttsMessage: FALLBACK_RESPONSE.ttsMessage,
          status: "error",
          error: "Triage returned null result",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_e) {
        // Silent
      }
      return null;
    }

    var triageData = result.data;
    var updatePayload = {
      type: triageData.type || FALLBACK_RESPONSE.type,
      severity: triageData.severity || FALLBACK_RESPONSE.severity,
      ttsMessage: triageData.ttsMessage || FALLBACK_RESPONSE.ttsMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (result.success) {
      updatePayload.status = "triaged";
      updatePayload.error = null;
    } else {
      updatePayload.status = "error";
      updatePayload.error = result.error || "Unknown triage error";
    }

    try {
      await docRef.update(updatePayload);
    } catch (writeError) {
      try {
        await docRef.set(
          {
            status: "error",
            error: "Firestore write failed: " + writeError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (_e) {
        // Silent
      }
    }

    return null;
  });

exports.onEmergencyIVR = buildTriggerIVR(db);

exports.exoml = buildExoMLEndpoint(db);
