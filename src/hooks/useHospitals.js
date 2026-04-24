import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { db } from "../lib/firebase";

export function useHospitals(center, radiusKm, emergencyType, scheme) {
  // center = { lat, lng }
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    if (!center) return;

    const bounds = geohashQueryBounds(
      [center.lat, center.lng],
      radiusKm * 1000  // metres
    );

    const queries = bounds.map((b) =>
      query(
        collection(db, "hospitals"),
        where("geohash", ">=", b[0]),
        where("geohash", "<=", b[1])
      )
    );

    const allDocs = new Map();
    const unsubs = queries.map((q) =>
      onSnapshot(q, (snap) => {
        snap.docs.forEach((doc) => {
          const d = { id: doc.id, ...doc.data() };
          const dist = distanceBetween([d.lat, d.lng], [center.lat, center.lng]);
          // Apply filters
          if (dist <= radiusKm &&
              (!scheme || scheme === "no" || d.schemes?.includes(scheme))) {
            allDocs.set(doc.id, { ...d, distanceKm: dist.toFixed(1) });
          }
        });
        setHospitals(
          [...allDocs.values()].sort((a, b) => a.distanceKm - b.distanceKm)
        );
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [center?.lat, center?.lng, radiusKm, scheme]);

  return hospitals;
}
