import { supabase, CloudOrder } from '@/lib/supabase';
import { Order } from '@/lib/types';

export interface PendingMutation {
  id: string;
  orderId: string;
  action: 'upsert' | 'delete';
  payload?: any;
  timestamp: number;
}

const QUEUE_KEY = 'vendora_pending_mutations';
const LAST_SYNC_KEY = 'vendora_last_cloud_sync';

export function getPendingQueue(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingQueue(queue: PendingMutation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function enqueueMutation(action: 'upsert' | 'delete', orderId: string, payload?: any) {
  const queue = getPendingQueue();
  // Deduplicate existing pending action for the same order
  const filtered = queue.filter((m) => m.orderId !== orderId);
  filtered.push({
    id: mut__,
    orderId,
    action,
    payload,
    timestamp: Date.now(),
  });
  savePendingQueue(filtered);
}

export function clearPendingMutation(orderId: string) {
  const queue = getPendingQueue().filter((m) => m.orderId !== orderId);
  savePendingQueue(queue);
}

// Convert local Order into CloudOrder format
export function orderToCloud(order: Order, orgId: string, updatedBy = 'operator'): CloudOrder {
  return {
    id: order.id,
    org_id: orgId,
    customer: order.customer || '',
    phone: order.phone || '',
    amount: order.amount || 0,
    paid_amount: order.paidAmount || 0,
    due_date: order.dueDate,
    status: order.status,
    items: order.items || [],
    notes: order.notes || '',
    needs_clarification: order.needsClarification || false,
    source: order.source || 'counter',
    created_at: order.createdAt,
    updated_at: order.updatedAt || new Date().toISOString(),
    version: (order.version || 1) + 1,
    updated_by: updatedBy,
  };
}

// Convert CloudOrder from Supabase into local Order format
export function cloudToOrder(cloud: any): Order {
  return {
    id: cloud.id,
    customer: cloud.customer || '',
    phone: cloud.phone || '',
    amount: Number(cloud.amount) || 0,
    paidAmount: Number(cloud.paid_amount) || 0,
    dueDate: cloud.due_date,
    status: cloud.status,
    items: Array.isArray(cloud.items) ? cloud.items : [],
    notes: cloud.notes || '',
    needsClarification: Boolean(cloud.needs_clarification),
    source: cloud.source || 'counter',
    createdAt: cloud.created_at || new Date().toISOString(),
    updatedAt: cloud.updated_at || new Date().toISOString(),
    version: Number(cloud.version) || 1,
    history: [],
  };
}

// Flush pending offline mutations to Supabase
export async function flushPendingMutations(orgId: string): Promise<number> {
  if (!navigator.onLine) return 0;
  const queue = getPendingQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: PendingMutation[] = [];

  for (const mut of queue) {
    try {
      if (mut.action === 'upsert' && mut.payload) {
        const cloudRecord = orderToCloud(mut.payload, orgId);
        const { error } = await supabase.from('orders').upsert(cloudRecord);
        if (!error) {
          synced++;
        } else {
          remaining.push(mut);
        }
      } else if (mut.action === 'delete') {
        const { error } = await supabase.from('orders').delete().eq('id', mut.orderId).eq('org_id', orgId);
        if (!error) {
          synced++;
        } else {
          remaining.push(mut);
        }
      }
    } catch {
      remaining.push(mut);
    }
  }

  savePendingQueue(remaining);
  return synced;
}

// Pull latest changes from Supabase and merge
export async function pullCloudOrders(orgId: string): Promise<Order[] | null> {
  if (!navigator.onLine) return null;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase pull error (using local storage):', error.message);
      return null;
    }

    if (data && Array.isArray(data)) {
      return data.map(cloudToOrder);
    }
  } catch (err) {
    console.warn('Failed to reach Supabase (operating offline):', err);
  }

  return null;
}
