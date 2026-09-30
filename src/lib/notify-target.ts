/**
 * Notification-tap routing target — cold start pe (app band thi) home
 * mount hone tak pending rakhta hai, phir consume ho jata hai.
 */
export type OrdersTabTarget = 'active' | 'past';

let pendingOrdersTab: OrdersTabTarget | null = null;

export function setPendingOrdersTab(tab: OrdersTabTarget): void {
  pendingOrdersTab = tab;
}

export function consumePendingOrdersTab(): OrdersTabTarget | null {
  const t = pendingOrdersTab;
  pendingOrdersTab = null;
  return t;
}

/**
 * Push payload (backend: {type, order_id, fulfillment_status?}) se
 * relatable tab — delivered/cancelled seedha Past me.
 */
export function ordersTabFromPushData(data: Record<string, unknown> | null | undefined): OrdersTabTarget {
  const f = data?.fulfillment_status;
  return f === 'delivered' || f === 'cancelled' ? 'past' : 'active';
}

/** Sirf order-related notification pe react karo. */
export function isOrderPush(data: Record<string, unknown> | null | undefined): boolean {
  return typeof data?.type === 'string' && data.type.startsWith('order');
}
