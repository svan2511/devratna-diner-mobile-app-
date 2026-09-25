
/**
 * API base URL resolution.
 * - EXPO_PUBLIC_API_URL wins when set (highest priority).
 * - Android emulator: 10.0.2.2, everything else (iOS sim / web): localhost.
 */
// function defaultBaseUrl(): string {
//   if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
//   if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api/v1';
//   return 'http://127.0.0.1:8000/api/v1';
// }

export const API_BASE_URL = 'http://10.35.185.212:8000/api/v1';

export type ApiUser = {
  id: number;
  name: string | null;
  phone: string;
  phone_verified: boolean;
  is_profile_complete: boolean;
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
};

export type ApiMenuCategory = {
  key: string;
  label: string;
  items: ApiMenuItem[];
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
    status: string;
    items: Array<{ id: number; name: string; portion: string; qty: number; unit: number }>;
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

export type ApiHistoryOrder = {
  id: number;
  subtotal: number;
  total: number;
  status: string;
  fulfillment_status?: string | null;
  kitchen_note?: string | null;
  failure_reason: string | null;
  items: Array<{ id: number; name: string; portion: string; qty: number; unit: number }>;
  delivery_address: string | null;
  created_at: string | null;
  paid_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
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

async function getPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
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
  logout(token: string) {
    return postJson<null>('/auth/logout', {}, token);
  },
  menu() {
    return getPublic<ApiMenuCategory[]>('/menu');
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
};
