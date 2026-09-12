import { supabase, CloudOrder } from '@/lib/supabase';
import { Order, OfflineStorage } from '@/lib/storage/offlineDb';

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
    id: 'mut_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
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
    amount: Number(order.amount) || 0,
    paid_amount: Number(order.paidAmount) || 0,
    due_date: order.dueDate || new Date().toISOString().slice(0, 10),
    status: order.status || 'new',
    items: Array.isArray(order.items) ? order.items : [],
    notes: (order as any).notes || (order.rawMessage ? ('[Voice/Chat Intake]: ' + order.rawMessage) : ''),
    needs_clarification: order.needsClarification || false,
    source: (order as any).source || 'counter',
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: order.updatedAt || new Date().toISOString(),
    version: Number(order.version || 1),
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
    dueDate: cloud.due_date || new Date().toISOString().slice(0, 10),
    status: (cloud.status || 'new') as any,
    items: Array.isArray(cloud.items) ? cloud.items : [{ description: 'Order Item', quantity: 1, attributes: {} }],
    referencesPriorOrder: false,
    confidence: 1,
    needsClarification: Boolean(cloud.needs_clarification),
    rawMessage: cloud.notes || '',
    createdAt: cloud.created_at || new Date().toISOString(),
    updatedAt: cloud.updated_at || new Date().toISOString(),
    version: Number(cloud.version) || 1,
    deviceId: 'cloud-sync',
    pendingSync: false,
    fieldHlc: {},
  };
}

// Flush pending offline mutations to Supabase
export async function flushPendingMutations(orgId: string): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
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
          console.warn('Upsert error in flush:', error);
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
    } catch (e) {
      console.warn('Mutation execution error:', e);
      remaining.push(mut);
    }
  }

  savePendingQueue(remaining);
  return synced;
}

// Pull latest changes from Supabase
export async function pullCloudOrders(orgId: string): Promise<Order[] | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

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

// Bi-directional sync: flush mutations, pull latest, merge, and save to local storage
export async function syncStoreOrders(orgId: string, localOrders?: Order[]): Promise<Order[] | null> {
  if (!orgId) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  try {
    // 1. Flush any queued offline actions
    await flushPendingMutations(orgId);

    // 2. Fetch all cloud orders for this store
    const cloudOrders = await pullCloudOrders(orgId);
    if (!cloudOrders) return null;

    // 3. Merge cloud orders with local orders (conflict resolution by updatedAt / version)
    const local = localOrders || OfflineStorage.getOrdersSync();
    const mergedMap = new Map<string, Order>();

    // Put all cloud orders in map
    for (const co of cloudOrders) {
      mergedMap.set(co.id, co);
    }

    // For any local order not yet in cloud or newer than cloud, keep local and push to cloud
    for (const lo of local) {
      const co = mergedMap.get(lo.id);
      if (!co) {
        // Local order hasn't synced to cloud yet -> push to cloud
        mergedMap.set(lo.id, lo);
        try {
          await supabase.from('orders').upsert(orderToCloud(lo, orgId));
        } catch {}
      } else {
        // Both exist: choose latest timestamp
        const loTime = new Date(lo.updatedAt || lo.createdAt || 0).getTime();
        const coTime = new Date(co.updatedAt || co.createdAt || 0).getTime();
        if (loTime > coTime) {
          mergedMap.set(lo.id, lo);
          try {
            await supabase.from('orders').upsert(orderToCloud(lo, orgId));
          } catch {}
        }
      }
    }

    const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });

    // Persist to IndexedDB & LocalStorage
    await OfflineStorage.bulkUpsertOrders(mergedList);
    return mergedList;
  } catch (err) {
    console.warn('Sync store orders failed:', err);
    return null;
  }
}
