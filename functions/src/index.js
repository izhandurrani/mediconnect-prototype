const admin = require("firebase-admin");
const functions = require("firebase-functions");

// ─── Initialize Firebase Admin (uses default credentials in Cloud Functions) ──
admin.initializeApp();

const db = admin.firestore();

// ─── Cloud Function exports ─────────────────────────────────────────────────

// 1. Firestore onCreate: query nearby hospitals → call each via Exotel IVR
const { triggerIVR } = require("./triggerIVR");
exports.triggerIVR = triggerIVR(db);

// 2. HTTPS webhook: Exotel calls this after hospital presses a digit
const { exotelWebhook } = require("./exotelWebhook");
exports.exotelWebhook = exotelWebhook(db);

// 3. Firestore onUpdate: send FCM push to selected hospital
const { sendHospitalAlert } = require("./sendFCM");
exports.sendHospitalAlert = sendHospitalAlert(db);
