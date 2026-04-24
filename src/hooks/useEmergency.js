import { useState, useEffect } from "react";
import { collection, addDoc, doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useEmergency() {
  const [emergencyId, setEmergencyId] = useState(null);
  const [emergency, setEmergency]     = useState(null);

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
