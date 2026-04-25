import { useState, useEffect } from "react";
import { collection, addDoc, doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useEmergency(externalId = null) {
  const [emergencyId, setEmergencyId] = useState(externalId);
  const [emergency, setEmergency]     = useState(null);

  // Sync when parent provides/changes the ID (e.g. CallingScreen reads from context)
  useEffect(() => {
    if (externalId && externalId !== emergencyId) setEmergencyId(externalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalId]);

  // Create a new emergency document (triggers Cloud Function via onWrite)
  async function createEmergency({ userId, type, lat, lng, scheme, language }) {
    const ref = await addDoc(collection(db, "emergencies"), {
      userId, type, scheme, language,
      userLat: lat,
      userLng: lng,
      status: "calling",
      hospitalsContacted: [],
      confirmed: [],
      selectedHospital: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setEmergencyId(ref.id);
    return ref.id;
  }

  // Select a hospital (triggers FCM Cloud Function via onWrite)
  async function selectHospital(hospitalId) {
    if (!emergencyId) return;
    await updateDoc(doc(db, "emergencies", emergencyId), {
      selectedHospital: hospitalId,
      status: "navigating",
      updatedAt: serverTimestamp(),
    });
  }

  // Real-time listener — CallingScreen and HospitalsScreen both use this
  useEffect(() => {
    if (!emergencyId) return;
    const unsub = onSnapshot(doc(db, "emergencies", emergencyId), (snap) => {
      if (snap.exists()) setEmergency({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [emergencyId]);

  return { emergencyId, emergency, createEmergency, selectHospital };
}
