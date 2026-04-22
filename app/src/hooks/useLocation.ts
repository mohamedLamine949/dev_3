import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
  quartier?: string;
  ville?: string;
}

let _cachedLocation: UserLocation | null = null;

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(_cachedLocation);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = pos.coords;
      let quartier: string | undefined;
      let ville: string | undefined;

      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
        // Pour Bamako : district = commune, subregion = cercle, city = ville
        quartier = addr.district || addr.name || addr.street || undefined;
        ville = addr.city || addr.subregion || 'Bamako';
      } catch {
        ville = 'Bamako';
      }

      const result: UserLocation = { latitude, longitude, quartier, ville };
      _cachedLocation = result;
      setLocation(result);
    } catch {
      // silencieux si GPS indisponible
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!_cachedLocation) requestLocation();
  }, []);

  return { location, loading, permissionDenied, requestLocation };
}

/** Distance en km entre deux points (formule Haversine) */
export function getDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
