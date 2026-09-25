import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { findItem, type MenuItem } from '@/data/menu';

/** Dish portion — 'single' = fixed-price dish.
 *  3-tier dishes: Quarter (smallest) / Half (middle) / Full (largest).
 *  2-tier dishes: Half / Full. 'medium' = purane versions compat (middle tier). */
export type Portion = 'quarter' | 'half' | 'medium' | 'full' | 'single';

export type CartLine = { item: MenuItem; portion: Portion; qty: number; unit: number };

/** Billable price for an item + portion (mirrors backend OrderController mapping). */
export function unitPrice(item: MenuItem, portion: Portion): number {
  if (portion === 'full' && item.fullPrice != null) return item.fullPrice;
  if (portion === 'half' && item.midPrice != null) return item.midPrice;
  if (portion === 'medium' && item.midPrice != null) return item.midPrice;
  return item.halfPrice;
}

export function portionLabel(portion: Portion): string {
  if (portion === 'quarter') return 'Quarter';
  if (portion === 'half') return 'Half';
  if (portion === 'medium') return 'Half';
  if (portion === 'full') return 'Full';
  return '';
}

type CartState = {
  lines: CartLine[];
  count: number;
  total: number;
  qtyOf: (id: number, portion?: Portion) => number;
  add: (item: MenuItem, portion?: Portion) => void;
  remove: (id: number, portion?: Portion) => void;
  /** Poori line ek baar me hatao (stale/unavailable dishes ke liye). */
  removeLine: (id: number, portion?: Portion) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

const keyOf = (id: number, portion: Portion) => `${id}:${portion}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const add = useCallback((item: MenuItem, portion: Portion = 'single') => {
    if (unitPrice(item, portion) <= 0) return;
    const key = keyOf(item.id, portion);
    setQtyMap((m) => ({ ...m, [key]: (m[key] ?? 0) + 1 }));
  }, []);

  const remove = useCallback((id: number, portion: Portion = 'single') => {
    const key = keyOf(id, portion);
    setQtyMap((m) => {
      const next = { ...m };
      const q = (next[key] ?? 0) - 1;
      if (q <= 0) delete next[key];
      else next[key] = q;
      return next;
    });
  }, []);

  const clear = useCallback(() => setQtyMap({}), []);

  const removeLine = useCallback((id: number, portion: Portion = 'single') => {
    const key = keyOf(id, portion);
    setQtyMap((m) => {
      if (!(key in m)) return m;
      const next = { ...m };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo<CartState>(() => {
    const lines: CartLine[] = [];
    for (const [key, qty] of Object.entries(qtyMap)) {
      const sep = key.lastIndexOf(':');
      const item = findItem(Number(key.slice(0, sep)));
      const portion = key.slice(sep + 1) as Portion;
      if (item && qty > 0) lines.push({ item, portion, qty, unit: unitPrice(item, portion) });
    }
    lines.sort(
      (a, b) => a.item.name.localeCompare(b.item.name) || a.portion.localeCompare(b.portion),
    );
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const total = lines.reduce((s, l) => s + l.qty * l.unit, 0);
    const qtyOf = (id: number, portion: Portion = 'single') => qtyMap[keyOf(id, portion)] ?? 0;
    return { lines, count, total, qtyOf, add, remove, removeLine, clear };
  }, [qtyMap, add, remove, removeLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
