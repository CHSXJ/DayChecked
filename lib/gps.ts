const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine formula — returns distance in meters between two lat/lng points.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Returns true if employee is within the store's allowed radius.
 */
export function isWithinRadius(
  empLat: number,
  empLng: number,
  storeLat: number,
  storeLng: number,
  radiusMeters: number
): boolean {
  const distance = haversineDistance(empLat, empLng, storeLat, storeLng);
  return distance <= radiusMeters;
}

/**
 * Gets current position as a Promise — rejects with a descriptive message.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("เบราว์เซอร์ไม่รองรับ GPS"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          reject(new Error("กรุณาอนุญาตการเข้าถึง GPS ในเบราว์เซอร์"));
          break;
        case err.POSITION_UNAVAILABLE:
          reject(new Error("ไม่สามารถระบุตำแหน่งได้ในขณะนี้"));
          break;
        case err.TIMEOUT:
          reject(new Error("GPS หมดเวลา กรุณาลองใหม่"));
          break;
        default:
          reject(new Error("เกิดข้อผิดพลาด GPS"));
      }
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}
