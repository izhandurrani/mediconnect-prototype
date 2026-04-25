const functions = require("firebase-functions");
const admin = require("firebase-admin");

// ─── Cloud Function factory ─────────────────────────────────────────────────

/**
 * Firestore onUpdate trigger on /emergencies/{emergencyId}.
 *
 * Fires ONLY when `selectedHospital` transitions from null/undefined to a
 * non-null value (i.e., the patient picked a hospital). Fetches the hospital
 * doc, reads its `fcmToken`, and sends a high-priority FCM push notification
 * so the hospital's device alerts immediately.
 */
function sendHospitalAlert(db) {
  return functions.firestore
    .document("emergencies/{emergencyId}")
    .onUpdate(async (change, context) => {
      const emergencyId = context.params.emergencyId;
      const before = change.before.data();
      const after = change.after.data();

      // ── Guard: only fire when selectedHospital flips null → value ──
      const prevHospital = before?.selectedHospital || null;
      const newHospital = after?.selectedHospital || null;

      if (!newHospital || prevHospital === newHospital) {
        // No change in selectedHospital, or it was already set — skip
        return null;
      }

      // ── Fetch the selected hospital document ──────────────────────
      let hospitalDoc;
      try {
        hospitalDoc = await db.collection("hospitals").doc(newHospital).get();
      } catch (err) {
        console.error(
          `[sendHospitalAlert] Failed to fetch hospital ${newHospital}:`,
          err
        );
        return null;
      }

      if (!hospitalDoc.exists) {
        console.warn(
          `[sendHospitalAlert] Hospital doc ${newHospital} not found`
        );
        return null;
      }

      const hospital = hospitalDoc.data();
      const fcmToken = hospital.fcmToken || null;

      if (!fcmToken) {
        console.warn(
          `[sendHospitalAlert] Hospital ${newHospital} has no fcmToken`
        );
        return null;
      }

      // ── Build and send FCM message ────────────────────────────────
      const emergencyType = after.type || "medical";
      const patientScheme = after.scheme || "unknown";

      const message = {
        token: fcmToken,
        notification: {
          title: `INCOMING: ${emergencyType} patient`,
          body: `Emergency #${emergencyId.slice(0, 6)} — Scheme: ${patientScheme}. Patient is being navigated to your hospital.`,
        },
        data: {
          emergencyId,
          hospitalId: newHospital,
          type: emergencyType,
          scheme: patientScheme,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "emergency",
            sound: "emergency_alert",
            priority: "max",
            defaultVibrateTimings: true,
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "emergency_alert.caf",
              "content-available": 1,
            },
          },
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            icon: "/icons/icon-192.png",
            vibrate: [200, 100, 200],
            requireInteraction: true,
          },
        },
      };

      try {
        const response = await admin.messaging().send(message);
        console.log(
          `[sendHospitalAlert] FCM sent to hospital ${newHospital} for emergency ${emergencyId}:`,
          response
        );

        // Record notification status on the emergency doc
        await db.collection("emergencies").doc(emergencyId).update({
          fcmSent: true,
          fcmSentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(
          `[sendHospitalAlert] FCM send failed for hospital ${newHospital}:`,
          err
        );

        await db.collection("emergencies").doc(emergencyId).update({
          fcmSent: false,
          fcmError: err.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return null;
    });
}

module.exports = { sendHospitalAlert };
