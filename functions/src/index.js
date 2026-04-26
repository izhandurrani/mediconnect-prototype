const admin = require("firebase-admin");

// ─── Initialize Firebase Admin (uses default credentials in Cloud Functions) ──
admin.initializeApp();

const db = admin.firestore();

// ─── Cloud Function exports ─────────────────────────────────────────────────

// 1. Firestore onCreate: query nearby hospitals → call each via Twilio IVR
const { triggerIVR } = require("./triggerIVR");
exports.triggerIVR = triggerIVR;

// 2. HTTPS webhook: Twilio calls this after hospital presses a digit
const { twilioWebhook } = require("./twilioWebhook");
exports.twilioWebhook = twilioWebhook;

// 3. Firestore onUpdate: send FCM push to selected hospital
const { sendHospitalAlert } = require("./sendFCM");
exports.sendHospitalAlert = sendHospitalAlert(db);
