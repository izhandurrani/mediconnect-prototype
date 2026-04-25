const functions = require("firebase-functions");
const admin = require("firebase-admin");

// ─── XML Response builders ──────────────────────────────────────────────────

function xmlResponse(sayText) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Say voice="Aditi" language="en-IN">${escapeXml(sayText)}</Say>`,
    "  <Hangup/>",
    "</Response>",
  ].join("\n");
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Parse emergencyId + hospitalId from request ────────────────────────────

function parseContext(req) {
  // Try query params first (set by Exotel Url callback)
  let emergencyId = req.query?.emergencyId || req.body?.emergencyId || null;
  let hospitalId = req.query?.hospitalId || req.body?.hospitalId || null;

  // Fallback: try parsing the CustomField JSON that Exotel passes in the body
  if ((!emergencyId || !hospitalId) && req.body?.CustomField) {
    try {
      const custom = JSON.parse(req.body.CustomField);
      emergencyId = emergencyId || custom.emergencyId || null;
      hospitalId = hospitalId || custom.hospitalId || null;
    } catch (_) {
      // CustomField wasn't valid JSON — ignore
    }
  }

  return { emergencyId, hospitalId };
}

// ─── Cloud Function factory ─────────────────────────────────────────────────

function exotelWebhook(db) {
  return functions.https.onRequest(async (req, res) => {
    // Exotel sends form-encoded POST bodies
    const digits = req.body?.Digits || req.body?.digits || null;
    const { emergencyId, hospitalId } = parseContext(req);

    // Always respond with XML so Exotel doesn't retry
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "no-store");

    if (!emergencyId || !hospitalId) {
      console.warn("[exotelWebhook] Missing emergencyId or hospitalId", {
        emergencyId,
        hospitalId,
        body: req.body,
      });
      return res
        .status(200)
        .send(xmlResponse("We could not process your response. Goodbye."));
    }

    // ── Hospital pressed "1" → confirm availability ───────────────
    if (digits === "1") {
      try {
        const docRef = db.collection("emergencies").doc(emergencyId);

        await docRef.update({
          confirmed: admin.firestore.FieldValue.arrayUnion(hospitalId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `[exotelWebhook] Hospital ${hospitalId} confirmed for emergency ${emergencyId}`
        );

        return res
          .status(200)
          .send(
            xmlResponse(
              "Thank you. Your hospital has been confirmed for this emergency. The patient will be directed to you shortly."
            )
          );
      } catch (err) {
        console.error("[exotelWebhook] Firestore update failed:", err);
        return res
          .status(200)
          .send(
            xmlResponse(
              "We encountered an error saving your response. Please try again."
            )
          );
      }
    }

    // ── Hospital pressed "2" or anything else → declined ──────────
    if (digits === "2") {
      console.log(
        `[exotelWebhook] Hospital ${hospitalId} declined emergency ${emergencyId}`
      );
      return res
        .status(200)
        .send(
          xmlResponse(
            "Understood. Your hospital is marked as unavailable. Goodbye."
          )
        );
    }

    // ── No valid digit or timeout ─────────────────────────────────
    console.log(
      `[exotelWebhook] Unrecognized digit "${digits}" from hospital ${hospitalId}`
    );
    return res
      .status(200)
      .send(xmlResponse("No valid response received. Goodbye."));
  });
}

module.exports = { exotelWebhook };
