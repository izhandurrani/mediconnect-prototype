const functions = require("firebase-functions");
const admin = require("firebase-admin");

var FALLBACK_TTS = "Emergency reported. Please confirm hospital availability.";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExoML(ttsMessage, callbackUrl) {
  var safeMessage = escapeXml(ttsMessage);
  var safeCallback = escapeXml(callbackUrl);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    '  <GetDigits action="' + safeCallback + '" timeout="10" numDigits="1" retries="2">',
    '    <Say voice="Aditi" language="en-IN">',
    "      " + safeMessage,
    "    </Say>",
    '    <Say voice="Aditi" language="en-IN">',
    "      Press 1 if your hospital is available. Press 2 if not available.",
    "    </Say>",
    "  </GetDigits>",
    '  <Say voice="Aditi" language="en-IN">',
    "    No response received. Goodbye.",
    "  </Say>",
    "  <Hangup/>",
    "</Response>",
  ].join("\n");
}

function buildErrorExoML() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    '  <Say voice="Aditi" language="en-IN">',
    "    We are experiencing a temporary issue. Please try again later.",
    "  </Say>",
    "  <Hangup/>",
    "</Response>",
  ].join("\n");
}

function buildExoMLEndpoint(db) {
  return functions.https.onRequest(async function (req, res) {
    var emergencyId = req.query.emergencyId || null;
    var hospitalId = req.query.hospitalId || null;

    if (!emergencyId) {
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.status(200).send(buildErrorExoML());
      return;
    }

    var ttsMessage = FALLBACK_TTS;

    try {
      var docSnap = await db.collection("emergencies").doc(emergencyId).get();

      if (docSnap.exists) {
        var data = docSnap.data();

        if (data.ttsMessage && typeof data.ttsMessage === "string" && data.ttsMessage.trim()) {
          ttsMessage = data.ttsMessage.trim();
        }
      }
    } catch (readError) {
      // Use fallback message, do not crash
    }

    var callbackUrl = "";
    var webhookUrl = process.env.EXOTEL_WEBHOOK_URL || "";

    if (webhookUrl) {
      callbackUrl = webhookUrl;
    } else {
      var projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";

      if (projectId) {
        callbackUrl =
          "https://us-central1-" +
          projectId +
          ".cloudfunctions.net/exotelCallback" +
          "?emergencyId=" +
          encodeURIComponent(emergencyId) +
          (hospitalId ? "&hospitalId=" + encodeURIComponent(hospitalId) : "");
      }
    }

    if (callbackUrl && emergencyId) {
      if (callbackUrl.indexOf("?") === -1) {
        callbackUrl +=
          "?emergencyId=" + encodeURIComponent(emergencyId) +
          (hospitalId ? "&hospitalId=" + encodeURIComponent(hospitalId) : "");
      } else if (callbackUrl.indexOf("emergencyId") === -1) {
        callbackUrl +=
          "&emergencyId=" + encodeURIComponent(emergencyId) +
          (hospitalId ? "&hospitalId=" + encodeURIComponent(hospitalId) : "");
      }
    }

    var xml = buildExoML(ttsMessage, callbackUrl);

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "no-store");
    res.status(200).send(xml);
  });
}

module.exports = { buildExoMLEndpoint, FALLBACK_TTS };
