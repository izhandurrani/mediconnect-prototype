import { useState, useRef, useCallback, useEffect } from "react";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Detect iOS (iPhone / iPad / iPod).
 */
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * useGoogleMaps
 *
 * Loads the Google Maps JavaScript SDK via a <script> tag (once).
 * Provides helpers for navigation deep-links, distance/ETA estimates,
 * and getting the user's current geolocation.
 *
 * Exports: ready, navigateTo, getDistanceETA, getUserLocation
 */
export function useGoogleMaps() {
  const [ready, setReady] = useState(
    typeof window !== "undefined" && !!window.google?.maps
  );
  const loadingRef = useRef(false);

  // ─── Load Maps JS SDK via <script> tag (idempotent) ──────────────
  useEffect(() => {
    // Already loaded
    if (window.google?.maps) {
      setReady(true);
      return;
    }

    // Already loading from another instance
    if (loadingRef.current) return;
    if (!MAPS_API_KEY) {
      console.warn("[useGoogleMaps] VITE_GOOGLE_MAPS_API_KEY is not set.");
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setReady(true));
      return;
    }

    loadingRef.current = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setReady(true);
      loadingRef.current = false;
    };

    script.onerror = () => {
      console.error("[useGoogleMaps] Failed to load Google Maps JS SDK.");
      loadingRef.current = false;
    };

    document.head.appendChild(script);
  }, []);

  // ─── navigateTo ──────────────────────────────────────────────────
  // Deep-links to Apple Maps on iOS, Google Maps on Android/desktop.
  const navigateTo = useCallback((lat, lng, label = "Destination") => {
    const encodedLabel = encodeURIComponent(label);

    if (isIOS()) {
      // Apple Maps deep link
      window.open(
        `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&t=m&q=${encodedLabel}`,
        "_blank"
      );
    } else {
      // Google Maps deep link (works on Android + desktop)
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`,
        "_blank"
      );
    }
  }, []);

  // ─── getDistanceETA ──────────────────────────────────────────────
  // Returns { distanceKm, durationMin } using the Distance Matrix API.
  // Falls back to straight-line distance if the SDK isn't ready.
  const getDistanceETA = useCallback(
    (originLat, originLng, destLat, destLng) => {
      return new Promise((resolve, reject) => {
        // Straight-line fallback using the Geometry library
        if (!window.google?.maps?.geometry) {
          const R = 6371;
          const dLat = ((destLat - originLat) * Math.PI) / 180;
          const dLng = ((destLng - originLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((originLat * Math.PI) / 180) *
              Math.cos((destLat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distKm = Math.round(R * c * 10) / 10;
          resolve({
            distanceKm: distKm,
            durationMin: Math.round(distKm * 2.5), // rough estimate at ~24 km/h city speed
          });
          return;
        }

        // Use Distance Matrix Service for accurate road distance
        const service = new window.google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [
              new window.google.maps.LatLng(originLat, originLng),
            ],
            destinations: [
              new window.google.maps.LatLng(destLat, destLng),
            ],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC,
          },
          (response, status) => {
            if (
              status === "OK" &&
              response.rows[0]?.elements[0]?.status === "OK"
            ) {
              const el = response.rows[0].elements[0];
              resolve({
                distanceKm:
                  Math.round((el.distance.value / 1000) * 10) / 10,
                durationMin: Math.round(el.duration.value / 60),
              });
            } else {
              reject(
                new Error(`Distance Matrix error: ${status}`)
              );
            }
          }
        );
      });
    },
    []
  );

  // ─── getUserLocation ─────────────────────────────────────────────
  // Returns a Promise<{ lat, lng }> from the browser Geolocation API.
  const getUserLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  }, []);

  return { ready, navigateTo, getDistanceETA, getUserLocation };
}
