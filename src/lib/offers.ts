import type { ApiOffer } from '@/lib/api';

export type PricedLine = {
  id: number;
  qty: number;
  unit: number;
  category: string;
};

export type PickedOffer = {
  offer: ApiOffer;
  discount: number;
  freeItemId: number | null;
  freeItemName: string | null;
};

function offerLive(o: ApiOffer, now: number): boolean {
  if (o.starts_at && new Date(o.starts_at).getTime() > now) return false;
  if (o.ends_at && new Date(o.ends_at).getTime() < now) return false;
  return true;
}

function matches(o: ApiOffer, l: PricedLine): boolean {
  if (o.target_type === 'category') return l.category === (o.target_value ?? '');
  if (o.target_type === 'item') return l.id === Number(o.target_value);
  return true;
}

/**
 * Client mirror of backend OfferEngine — bill PREVIEW ke liye.
 * Final hisaab hamesha server karta hai (placeOrder response authoritative).
 */

/** Sale-timer digits — 01:59:33, ek ghante se kam ho to 14:56. */
export function formatTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}export function pickBestOffer(offers: ApiOffer[], lines: PricedLine[], subtotal: number): PickedOffer | null {
  if (lines.length === 0 || subtotal <= 0) return null;
  const now = Date.now();
  let best: PickedOffer | null = null;
  let bestBenefit = 0;
  for (const o of offers) {
    if (!offerLive(o, now)) continue;
    if (subtotal < (o.min_order ?? 0)) continue;
    const eligible = lines.filter((l) => matches(o, l));
    if (eligible.length === 0) continue;
    const eligibleSum = eligible.reduce((s, l) => s + l.unit * l.qty, 0);
    const eligibleQty = eligible.reduce((s, l) => s + l.qty, 0);
    // "Buy 2" jaisi shart — qty kam ho to offer nahi (server mirror).
    if (eligibleQty < Math.max(1, o.min_qty ?? 1)) continue;
    const discount =
      o.discount_type === 'percent'
        ? Math.floor((eligibleSum * Math.min(90, Math.max(0, o.discount_value))) / 100)
        : o.discount_type === 'flat'
          ? o.discount_scope === 'item'
            ? Math.min(o.discount_value * eligibleQty, eligibleSum)
            : Math.min(o.discount_value, eligibleSum)
          : 0;
    const freeValue = o.free_item_id ? (o.free_item_price ?? 0) : 0;
    if (discount <= 0 && !o.free_item_id) continue;
    if (discount + freeValue > bestBenefit) {
      bestBenefit = discount + freeValue;
      best = {
        offer: o,
        discount,
        freeItemId: o.free_item_id,
        freeItemName: o.free_item_name,
      };
    }
  }
  return best;
}
