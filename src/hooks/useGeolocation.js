import { useState, useEffect, useCallback, useRef } from 'react';

/* ── Fallback coordinates (Chhatrapati Sambhajinagar / Aurangabad) ── */
const FALLBACK_COORDS = { lat: 19.8762, lng: 75.3433 };
const FALLBACK_TIMEOUT_MS = 6000;

/**
 * useGeolocation — Production-ready geolocation hook.
 *
 * Features:
 * - Permission pre-check via navigator.permissions
 * - Settled guard (handles browsers that never call callbacks)
 * - Automatic fallback after timeout
 * - Handles all 3 error codes distinctly
 * - Works on HTTP localhost (fallback) and HTTPS (real GPS)
 * - Returns permission status for UI branching
 *
 * @param {{ autoFetch?: boolean }} options
 * @returns {{
 *   coords: { lat: number, lng: number } | null,
 *   loading: boolean,
 *   error: string | null,
 *   isApproximate: boolean,
 *   permissionState: string,
 *   refetch: () => void
 * }}
 */
export function useGeolocation({ autoFetch = true } = {}) {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('unknown');
  const [isApproximate, setIsApproximate] = useState(false);

  const settledRef = useRef(false);
  const timeoutRef = useRef(null);

  // ── Check permission status (non-blocking) ──────────────────────
  useEffect(() => {
    if (!navigator.permissions) {
      setPermissionState('unknown');
      return;
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        setPermissionState(result.state);

        // Listen for changes (user toggles in Settings)
        result.onchange = () => {
          setPermissionState(result.state);
        };
      })
      .catch(() => {
        setPermissionState('unknown');
      });
  }, []);

  // ── Core fetch function ─────────────────────────────────────────
  const fetchLocation = useCallback(() => {
    settledRef.current = false;
    setLoading(true);
    setError(null);
    setIsApproximate(false);

    const settle = (result) => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearTimeout(timeoutRef.current);
      setLoading(false);

      if (result.success) {
        setCoords(result.coords);
        setIsApproximate(result.approximate || false);
        if (result.error) setError(result.error);
      } else {
        setError(result.error);
        // Always provide fallback coords even on error
        setCoords({ ...FALLBACK_COORDS });
        setIsApproximate(true);
      }
    };

    // ── Fallback timer ──
    // Catches the case where neither success nor error callback fires
    timeoutRef.current = setTimeout(() => {
      console.warn('[Geolocation] Timeout — neither callback fired');
      settle({
        success: true,
        coords: { ...FALLBACK_COORDS },
        approximate: true,
        error: 'Location request timed out',
      });
    }, FALLBACK_TIMEOUT_MS);

    // ── Check support ──
    if (!navigator.geolocation) {
      settle({
        success: true,
        coords: { ...FALLBACK_COORDS },
        approximate: true,
        error: 'Geolocation not supported',
      });
      setPermissionState('unsupported');
      return;
    }

    // ── Request position ──
    navigator.geolocation.getCurrentPosition(
      // Success
      (position) => {
        settle({
          success: true,
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          approximate: false,
        });
      },
      // Error
      (err) => {
        console.warn('[Geolocation] Error:', err.code, err.message);

        switch (err.code) {
          case 1: // PERMISSION_DENIED
            setPermissionState('denied');
            settle({
              success: false,
              error: 'Location permission denied',
            });
            break;

          case 2: // POSITION_UNAVAILABLE
            settle({
              success: true,
              coords: { ...FALLBACK_COORDS },
              approximate: true,
              error: 'Location hardware unavailable',
            });
            break;

          case 3: // TIMEOUT
            // Retry once with lower accuracy before falling back
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                settle({
                  success: true,
                  coords: {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  },
                  approximate: false,
                });
              },
              () => {
                settle({
                  success: true,
                  coords: { ...FALLBACK_COORDS },
                  approximate: true,
                  error: 'Location timed out',
                });
              },
              {
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 600000,
              }
            );
            break;

          default:
            settle({
              success: true,
              coords: { ...FALLBACK_COORDS },
              approximate: true,
              error: err.message,
            });
        }
      },
      // Options
      {
        enableHighAccuracy: false,  // WiFi/cell = fast + works indoors
        timeout: 4000,              // 4s covers WiFi + cell fix
        maximumAge: 300000,         // Accept 5-min-old cached position
      }
    );
  }, []);

  // ── Auto-fetch on mount ──
  useEffect(() => {
    if (autoFetch) {
      fetchLocation();
    }
    return () => {
      clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    coords,
    loading,
    error,
    isApproximate,
    permissionState,
    refetch: fetchLocation,
  };
}
