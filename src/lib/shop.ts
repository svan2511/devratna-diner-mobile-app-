/**
 * Shop geofence + minimum order (must match backend config/services.php).
 *
 * Override the pin with your EXACT shop location in
 * DevRatnaMobileApp/.env (restart `expo start` after editing):
 *   EXPO_PUBLIC_SHOP_LAT=30.xxxxxx
 *   EXPO_PUBLIC_SHOP_LNG=78.xxxxxx
 * Get it from Google Maps → long-press the shop → coordinates.
 */
export const SHOP = {
  name: 'Dev Ratna Diner',
  lat: Number(process.env.EXPO_PUBLIC_SHOP_LAT ?? 30.2710150),
  lng: Number(process.env.EXPO_PUBLIC_SHOP_LNG ?? 77.9926317),
  /** Delivery radius in metres — condition 1. */
  radiusM: 1000,
  /** Minimum food bill in rupees (delivery extra) — condition 2. */
  minOrder: 500,
  /** Fixed delivery charge in rupees — applied to every order. */
  deliveryCharge: 40,
};

/** Display label — 1000 => "1 km", 500 => "500m". */
export function radiusLabel(): string {
  if (SHOP.radiusM >= 1000 && SHOP.radiusM % 1000 === 0) return `${SHOP.radiusM / 1000} km`;
  if (SHOP.radiusM >= 1000) return `${(SHOP.radiusM / 1000).toFixed(1)} km`;
  return `${SHOP.radiusM}m`;
}

/** Haversine distance in metres between two lat/lng points. */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earth = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}
