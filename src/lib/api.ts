
/**
 * API base URL resolution.
 * - EXPO_PUBLIC_API_URL wins when set (highest priority).
 * - Android emulator: 10.0.2.2, everything else (iOS sim / web): localhost.
 */
// Local testing: EXPO_PUBLIC_API_URL set ho to wahi (bundle time pe inline hota hai).
// Production build me EXPO_PUBLIC_API_URL set karo, warna Render production URL lagega.
const envBase = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const API_BASE_URL =
  envBase !== '' ? envBase : 'https://devratna-apis.onrender.com/api/v1';

export type ApiUser = {
  id: number;
  name: string | null;
  phone: string;
  default_address: string | null;
  phone_verified: boolean;
  is_profile_complete: boolean;
  is_rider?: boolean;
};

export type ApiMenuItem = {
  id: number;
  name: string;
  description: string | null;
  price_label: string;
  price_value: number;
  half_price?: number | null;
  mid_price?: number | null;
  full_price?: number | null;
  veg: boolean;
  bestseller: boolean;
  is_available?: boolean | null;
  image_key?: string | null;
};

export type ApiShopStatus = {
  shop_open: boolean;
  min_order: number;
  delivery_charge: number;
  radius_m: number;
  delivery_mode: 'fixed' | 'distance';
  delivery_base: number;
  delivery_free_m: number;
  delivery_per_500m: number;
};

export type ApiMenuCategory = {
  key: string;
  label: string;
  items: ApiMenuItem[];
};

export type ApiOffer = {
  id: number;
  name: string;
  description: string | null;
  target_type: 'all' | 'category' | 'item';
  target_value: string | null;
  discount_type: 'none' | 'percent' | 'flat';
  discount_value: number;
  discount_scope: 'order' | 'item';
  free_item_id: number | null;
  free_item_name: string | null;
  free_item_price: number;
  min_order: number;
  min_qty: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type ApiBanner = {
  id: number;
  title: string;
  subtitle: string | null;
  pill_text: string | null;
  target: string | null;
  theme: string;
  sort_order: number;
  offer_name: string | null;
  offer_ends_at: string | null;
};

export type ApiOrderLine = {
  id: number;
  portion: 'quarter' | 'half' | 'medium' | 'full' | 'single';
  qty: number;
};

export type ApiPlacedOrder = {
  order: {
    id: number;
    total: number;
    discount?: number;
    offer_name?: string | null;
    status: string;
    items: Array<{ id: number; name: string; portion: string; qty: number; unit: number; free?: boolean }>;
  };
  razorpay: {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
  };
};

export type ApiVerifiedOrder = {
  order: { id: number; total: number; status: string };
};

export type ApiRiderLocation = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  recorded_at: string | null;
  age_seconds: number | null;
  is_stale: boolean;
};

export type ApiRiderProfile = {
  id: number;
  user_id: number;
  name: string | null;
  phone: string | null;
  vehicle_type: string;
  vehicle_number: string | null;
  is_active: boolean;
  is_online: boolean;
  last_location: ApiRiderLocation | null;
};

export type ApiRiderOrder = {
  id: number;
  status: string;
  fulfillment_status: string;
  items: Array<{ id: number; name: string; portion: string; qty: number; unit: number; free?: boolean }>;
  total: number;
  delivery_address: string | null;
  kitchen_note: string | null;
  customer: { name: string | null; phone: string | null } | null;
  customer_lat: number | null;
  customer_lng: number | null;
  distance_m: number | null;
  maps_url: string | null;
  rider_assigned_at: string | null;
  rider_accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  rider_location: ApiRiderLocation | null;
  created_at: string | null;
};

export type ApiRiderAssignments = {
  rider: ApiRiderProfile;
  shop: { lat: number; lng: number };
  active_order: ApiRiderOrder | null;
  history: ApiRiderOrder[];
};

export type ApiHistoryOrder = {
  id: number;
  subtotal: number;
  discount?: number;
  offer_name?: string | null;
  total: number;
  status: string;
  fulfillment_status?: string | null;
  kitchen_note?: string | null;
  failure_reason: string | null;
  items: Array<{ id: number; name: string; portion: string; qty: number; unit: number; free?: boolean }>;
  delivery_address: string | null;
  rider?: {
    name: string | null;
    phone: string | null;
    vehicle_type?: string;
    vehicle_number?: string | null;
  } | null;
  rider_assigned_at?: string | null;
  rider_accepted_at?: string | null;
  picked_up_at?: string | null;
  created_at: string | null;
  paid_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
};

export type ApiOrderTracking = {
  order: ApiHistoryOrder;
  shop: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  rider: {
    id: number;
    name: string | null;
    phone: string | null;
    vehicle_type: string;
    vehicle_number: string | null;
    is_online: boolean;
  } | null;
  rider_location: ApiRiderLocation | null;
  distance_to_customer_m: number | null;
  eta_minutes: number | null;
  is_stale: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

/** Thrown when the server rejects the token (401/419) — DB wipe, expiry, revoke. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'SessionExpiredError';
  }
}

async function postJson<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.status === 401 || res.status === 419) throw new SessionExpiredError();
  if (!res.ok || !json?.success) {
    const fallback =
      res.status === 422 ? 'Please check the details.' : `Request failed (${res.status}).`;
    const lines: string[] = [json?.message ?? fallback];
    if (json?.errors) {
      for (const group of Object.values(json.errors)) lines.push(...group);
    }
    // Laravel repeats the first error inside `message` — show each line once.
    const unique = lines.filter((line, i) => line.length > 0 && lines.indexOf(line) === i);
    throw new Error(unique.join('\n'));
  }
  return json.data as T;
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.status === 401 || res.status === 419) throw new SessionExpiredError();
  if (!res.ok || !json?.success) throw new Error(json?.message ?? 'Could not load data.');
  return json.data as T;
}

async function putJson<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.status === 401 || res.status === 419) throw new SessionExpiredError();
  if (!res.ok || !json?.success) {
    const fallback = `Request failed (${res.status}).`;
    const lines: string[] = [json?.message ?? fallback];
    if (json?.errors) {
      for (const group of Object.values(json.errors)) lines.push(...group);
    }
    const unique = lines.filter((line, i) => line.length > 0 && lines.indexOf(line) === i);
    throw new Error(unique.join('\n'));
  }
  return json.data as T;
}

async function getPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    // Polling pe stale cached response na mile — naya offer turant dikhe.
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json?.success)
    throw new Error(json?.message ?? 'Could not load data. Please try again.');
  return json.data as T;
}

export const api = {
  requestOtp(phone: string) {
    return postJson<{ expires_in_seconds: number; resend_available_in: number; dev_otp?: string }>(
      '/auth/request-otp',
      { phone },
    );
  },
  verifyOtp(phone: string, otp: string, name?: string) {
    return postJson<{ user: ApiUser; token: string; token_type: string; is_new: boolean }>(
      '/auth/verify-otp',
      name ? { phone, otp, name } : { phone, otp },
    );
  },
  me(token: string) {
    return getJson<{ user: ApiUser }>('/auth/me', token);
  },
  updateProfile(token: string, body: { name?: string; default_address?: string | null }) {
    return putJson<{ user: ApiUser }>('/auth/profile', body, token);
  },
  logout(token: string) {
    return postJson<null>('/auth/logout', {}, token);
  },
  menu() {
    return getPublic<ApiMenuCategory[]>('/menu');
  },
  offers() {
    return getPublic<ApiOffer[]>('/offers');
  },
  banners() {
    return getPublic<ApiBanner[]>('/banners');
  },
  shopStatus() {
    return getPublic<ApiShopStatus>('/shop-status');
  },
  orders(token: string) {
    return getJson<ApiHistoryOrder[]>('/orders', token);
  },
  placeOrder(
    token: string,
    body: { items: ApiOrderLine[]; lat: number; lng: number; address: string | null },
  ) {
    return postJson<ApiPlacedOrder>('/orders', body, token);
  },
  verifyOrder(
    token: string,
    body: {
      order_id: number;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    return postJson<ApiVerifiedOrder>('/orders/verify', body, token);
  },
  failOrder(token: string, body: { order_id: number; reason: string; code?: string }) {
    return postJson<unknown>('/orders/fail', body, token);
  },
  pushToken(token: string, body: { token: string; platform?: string }) {
    return postJson<null>('/push-token', body, token);
  },
  trackOrder(token: string, orderId: number) {
    return getJson<ApiOrderTracking>(`/orders/${orderId}/tracking`, token);
  },
  riderAssignments(token: string) {
    return getJson<ApiRiderAssignments>('/rider/assignments', token);
  },
  setRiderAvailability(token: string, isOnline: boolean) {
    return postJson<{ rider: ApiRiderProfile }>('/rider/availability', { is_online: isOnline }, token);
  },
  acceptRide(token: string, orderId: number) {
    return postJson<{ order: ApiRiderOrder }>(`/rider/orders/${orderId}/accept`, {}, token);
  },
  pickupRide(token: string, orderId: number) {
    return postJson<{ order: ApiRiderOrder }>(`/rider/orders/${orderId}/pickup`, {}, token);
  },
  deliverRide(token: string, orderId: number) {
    return postJson<{ order: ApiRiderOrder }>(`/rider/orders/${orderId}/deliver`, {}, token);
  },
  sendRiderLocation(
    token: string,
    orderId: number,
    body: { latitude: number; longitude: number; accuracy_m?: number | null },
  ) {
    return postJson<{ location: ApiRiderLocation }>(`/rider/orders/${orderId}/location`, body, token);
  },
};
