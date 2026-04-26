const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Twilio Gather webhook — called when a hospital presses a digit during IVR.
 *
 * Updates the emergency document's `ivrResponses` map with per-hospital status
 * so the frontend can show real-time calling/confirmed/rejected cards.
 *
 * Also maintains the legacy `confirmed[]` array for backward compatibility.
 */
exports.twilioWebhook = onRequest(async (req, res) => {
  const { emergencyId, hospitalId } = req.query;
  const digits = req.body.Digits || null;

  console.log(
    `[twilioWebhook] emergency=${emergencyId}, hospital=${hospitalId}, digits=${digits}`
  );

  // ── Missing params → hang up immediately ──────────────────────
  if (!emergencyId || !hospitalId) {
    res.set("Content-Type", "text/xml");
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`
    );
  }

  const db = admin.firestore();
  const docRef = db.collection("emergencies").doc(emergencyId);

  try {
    if (digits === "1") {
      // ── Hospital CONFIRMED ──────────────────────────────────────
      await docRef.update({
        [`ivrResponses.${hospitalId}`]: {
          status: "confirmed",
          digit: digits,
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        confirmed: admin.firestore.FieldValue.arrayUnion(hospitalId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Also update emergency_alerts subcollection / collection
      await db
        .collection("emergency_alerts")
        .doc(`${emergencyId}_${hospitalId}`)
        .set(
          {
            emergencyId,
            hospitalId,
            status: "confirmed",
            digit: digits,
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      console.log(
        `[twilioWebhook] ✅ Hospital ${hospitalId} CONFIRMED for emergency ${emergencyId}`
      );

      res.set("Content-Type", "text/xml");
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">
    Bahut shukriya. Patient aapke hospital ki taraf aa raha hai. Tayaar rahein.
  </Say>
  <Hangup/>
</Response>`);
    } else {
      // ── Hospital REJECTED (pressed 2, or any other digit) ───────
      await docRef.update({
        [`ivrResponses.${hospitalId}`]: {
          status: "rejected",
          digit: digits,
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db
        .collection("emergency_alerts")
        .doc(`${emergencyId}_${hospitalId}`)
        .set(
          {
            emergencyId,
            hospitalId,
            status: "rejected",
            digit: digits,
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      console.log(
        `[twilioWebhook] ❌ Hospital ${hospitalId} REJECTED emergency ${emergencyId} (digit=${digits})`
      );

      res.set("Content-Type", "text/xml");
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">
    Samajh liya. Dhanyavaad.
  </Say>
  <Hangup/>
</Response>`);
    }
  } catch (err) {
    console.error("[twilioWebhook] Firestore update failed:", err);
    res.set("Content-Type", "text/xml");
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`
    );
  }
});
