import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

/**
 * Creates the emergency + emergency_alerts documents and returns the emergencyId.
 *
 * Flow:
 *   1. Create /emergencies/{id} — triggers triggerIVR Cloud Function
 *   2. Create /emergency_alerts/{emergencyId}_{hospitalId} for each hospital
 *   3. Return emergencyId
 *
 * @param {string}   type         - "cardiac"|"accident"|"newborn"|"other"
 * @param {Object[]} hospitals    - Top 5 hospital objects (must have .id, .name)
 * @param {{ lat: number, lng: number }} userLocation
 * @param {string}   scheme       - "mj"|"ab"|"none"
 * @param {string}   language     - "mr"|"hi"|"en"|"mix"
 * @returns {Promise<string>} emergencyId
 */
export async function startEmergency(type, hospitals, userLocation, scheme, language) {
  const userId = auth.currentUser?.uid || 'anonymous';
  const hospitalIds = hospitals.map((h) => h.id);

  // 1. Create the emergency document
  const emergencyRef = await addDoc(collection(db, 'emergencies'), {
    userId,
    type,
    scheme: scheme || 'none',
    language: language || 'en',
    status: 'calling',
    userLat: userLocation.lat,
    userLng: userLocation.lng,
    hospitalsContacted: hospitalIds,
    confirmed: [],
    selectedHospital: null,
    ivrResponses: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const emergencyId = emergencyRef.id;

  // 2. Create emergency_alerts for each hospital (status: "calling")
  //    Document ID format matches what twilioWebhook uses: {emergencyId}_{hospitalId}
  const alertPromises = hospitals.map((hospital) =>
    setDoc(doc(db, 'emergency_alerts', `${emergencyId}_${hospital.id}`), {
      emergencyId,
      hospitalId: hospital.id,
      hospitalName: hospital.name || 'Hospital',
      status: 'calling',
      calledAt: serverTimestamp(),
      respondedAt: null,
    })
  );

  await Promise.all(alertPromises);

  console.log(
    `[startEmergency] Created emergency ${emergencyId} with ${hospitals.length} alerts`
  );

  return emergencyId;
}

/**
 * Updates the emergency doc when user selects a confirmed hospital.
 * Triggers sendHospitalAlert Cloud Function via onUpdate.
 */
export async function selectHospitalForEmergency(emergencyId, hospitalId) {
  await updateDoc(doc(db, 'emergencies', emergencyId), {
    selectedHospital: hospitalId,
    status: 'navigating',
    updatedAt: serverTimestamp(),
  });
}
