import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { db } from "../lib/firebase";

export function useHospitals(center, radiusKm, emergencyType) {
  const [hospitals, setHospitals] = useState([]);
  const bucketsRef = useRef(new Map());

  const lat = center ? center.lat : null;
  const lng = center ? center.lng : null;

  const aggregate = useCallback(
    function () {
      if (lat === null || lng === null) {
        setHospitals([]);
        return;
      }

      var merged = new Map();

      bucketsRef.current.forEach(function (bucketMap) {
        bucketMap.forEach(function (hospital, id) {
          if (!merged.has(id)) {
            merged.set(id, hospital);
          }
        });
      });

      var byName = new Map();

      merged.forEach(function (h) {
        var key = (h.name || "").trim().toLowerCase();

        if (!key) {
          byName.set(h.id, h);
          return;
        }

        var existing = byName.get(key);

        if (!existing || h.distanceKm < existing.distanceKm) {
          byName.set(key, h);
        }
      });

      var list = [];

      byName.forEach(function (h) {
        list.push(h);
      });

      list.sort(function (a, b) {
        return a.distanceKm - b.distanceKm;
      });

      setHospitals(list);
    },
    [lat, lng]
  );

  useEffect(
    function () {
      if (lat === null || lng === null) {
        setHospitals([]);
        return;
      }

      bucketsRef.current = new Map();

      var bounds = geohashQueryBounds([lat, lng], radiusKm * 1000);

      var unsubs = bounds.map(function (b, index) {
        var bucketKey = index;

        bucketsRef.current.set(bucketKey, new Map());

        var q = query(
          collection(db, "hospitals"),
          where("geohash", ">=", b[0]),
          where("geohash", "<=", b[1])
        );

        return onSnapshot(q, function (snap) {
          var bucketMap = new Map();

          snap.docs.forEach(function (doc) {
            var data = doc.data();
            var d = { id: doc.id, ...data };

            var dist = distanceBetween([d.lat, d.lng], [lat, lng]);

            if (dist > radiusKm) {
              return;
            }

            d.distanceKm = Math.round(dist * 10) / 10;

            bucketMap.set(doc.id, d);
          });

          bucketsRef.current.set(bucketKey, bucketMap);

          aggregate();
        });
      });

      return function () {
        unsubs.forEach(function (u) {
          u();
        });
        bucketsRef.current = new Map();
      };
    },
    [lat, lng, radiusKm, aggregate]
  );

  return hospitals;
}
