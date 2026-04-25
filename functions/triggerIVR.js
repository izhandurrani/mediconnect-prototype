const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

const MAX_HOSPITALS = 10;

function getExotelConfig() {
  var sid = process.env.EXOTEL_SID || "";
  var token = process.env.EXOTEL_TOKEN || "";
  var callerId = process.env.EXOTEL_CALLER_ID || "";
  var webhookUrl = process.env.EXOTEL_WEBHOOK_URL || "";

  if (!sid || !token || !callerId) {
    return null;
  }

  return { sid, token, callerId, webhookUrl };
}

function getExomlBaseUrl() {
  var explicit = process.env.EXOML_BASE_URL || "";

  if (explicit) {
    return explicit;
  }

  var projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";

  if (projectId) {
    return "https://us-central1-" + projectId + ".cloudfunctions.net/exoml";
  }

  return "";
}

async function queryHospitals(db, emergencyData) {
  var scheme = emergencyData.scheme || null;

  var query = db.collection("hospitals");

  var snapshot;

  try {
    snapshot = await query.get();
  } catch (queryError) {
    return { hospitals: [], error: "Hospital query failed: " + queryError.message };
  }

  if (snapshot.empty) {
    return { hospitals: [], error: "No hospitals found in collection" };
  }

  var allHospitals = [];

  snapshot.forEach(function (doc) {
    allHospitals.push({ id: doc.id, ...doc.data() });
  });

  var filtered = allHospitals.filter(function (h) {
    if (!h.phone) {
      return false;
    }

    if (!scheme) {
      return true;
    }

    if (Array.isArray(h.schemes)) {
      if (h.schemes.includes(scheme) || h.schemes.includes("no")) {
        return true;
      }
      return false;
    }

    return true;
  });

  var limited = filtered.slice(0, MAX_HOSPITALS);

  return { hospitals: limited, error: null };
}

async function callSingleHospital(config, hospital, emergencyId, exomlBaseUrl) {
  var sid = config.sid;
  var token = config.token;
  var callerId = config.callerId;
  var webhookUrl = config.webhookUrl;

  var customField = JSON.stringify({
    emergencyId: emergencyId,
    hospitalId: hospital.id,
  });

  var exotelApiUrl = "https://api.exotel.com/v1/Accounts/" + sid + "/Calls/connect.json";

  var params = new URLSearchParams();
  params.append("From", hospital.phone);
  params.append("To", callerId);
  params.append("CallerId", callerId);
  params.append("CustomField", customField);

  if (exomlBaseUrl) {
    var dynamicUrl =
      exomlBaseUrl +
      "?emergencyId=" + encodeURIComponent(emergencyId) +
      "&hospitalId=" + encodeURIComponent(hospital.id);

    params.append("Url", dynamicUrl);
  }

  if (webhookUrl) {
    params.append("StatusCallback", webhookUrl);
  }

  var response = await axios.post(exotelApiUrl, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    auth: {
      username: sid,
      password: token,
    },
    timeout: 15000,
  });

  var callSid =
    response.data && response.data.Call && response.data.Call.Sid
      ? response.data.Call.Sid
      : null;

  return {
    hospitalId: hospital.id,
    hospitalName: hospital.name || "Unknown",
    status: "initiated",
    callSid: callSid,
    error: null,
  };
}

async function callAllHospitals(config, hospitals, emergencyId, exomlBaseUrl) {
  var promises = hospitals.map(function (hospital) {
    return callSingleHospital(config, hospital, emergencyId, exomlBaseUrl).catch(
      function (err) {
        return {
          hospitalId: hospital.id,
          hospitalName: hospital.name || "Unknown",
          status: "failed",
          callSid: null,
          error: err.message || "Unknown call error",
        };
      }
    );
  });

  var results;

  try {
    var settled = await Promise.allSettled(promises);

    results = settled.map(function (outcome) {
      if (outcome.status === "fulfilled") {
        return outcome.value;
      }
      return {
        hospitalId: "unknown",
        hospitalName: "unknown",
        status: "failed",
        callSid: null,
        error: outcome.reason ? outcome.reason.message : "Promise rejected",
      };
    });
  } catch (settledError) {
    results = [];
  }

  return results;
}

function buildTriggerIVR(db) {
  return functions.firestore
    .document("emergencies/{emergencyId}")
    .onCreate(async function (snap, context) {
      var emergencyId = context.params.emergencyId;
      var docRef = db.collection("emergencies").doc(emergencyId);

      var emergencyData;

      try {
        emergencyData = snap.data();
      } catch (readError) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Failed to read emergency data: " + readError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      if (!emergencyData) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Emergency data is null",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var config = getExotelConfig();

      if (!config) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Exotel credentials not configured in environment",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var exomlBaseUrl = getExomlBaseUrl();

      if (!exomlBaseUrl) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "ExoML base URL not resolvable. Set EXOML_BASE_URL or GCLOUD_PROJECT.",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var hospitalResult;

      try {
        hospitalResult = await queryHospitals(db, emergencyData);
      } catch (queryError) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Hospital query threw: " + queryError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      if (!hospitalResult.hospitals || hospitalResult.hospitals.length === 0) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: hospitalResult.error || "No eligible hospitals found",
            hospitalsContacted: [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var hospitals = hospitalResult.hospitals;
      var hospitalIds = hospitals.map(function (h) {
        return h.id;
      });

      try {
        await docRef.update({
          hospitalsContacted: hospitalIds,
          status: "calling",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Failed to update calling status: " + updateError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var callResults;

      try {
        callResults = await callAllHospitals(config, hospitals, emergencyId, exomlBaseUrl);
      } catch (callError) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Call execution threw: " + callError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
        return null;
      }

      var successCount = callResults.filter(function (r) {
        return r.status === "initiated";
      }).length;

      var failCount = callResults.filter(function (r) {
        return r.status === "failed";
      }).length;

      var callSids = {};
      callResults.forEach(function (r) {
        if (r.callSid && r.hospitalId) {
          callSids[r.hospitalId] = r.callSid;
        }
      });

      try {
        await docRef.update({
          ivrStatus: failCount === callResults.length ? "all_failed" : "calls_initiated",
          ivrResults: {
            total: callResults.length,
            success: successCount,
            failed: failCount,
            callSids: callSids,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (finalUpdateError) {
        try {
          await docRef.update({
            ivrStatus: "error",
            ivrError: "Final status update failed: " + finalUpdateError.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_e) {
          // Silent
        }
      }

      return null;
    });
}

module.exports = { buildTriggerIVR, queryHospitals, callAllHospitals };
