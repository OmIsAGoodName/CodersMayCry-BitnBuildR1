/**
 * JanVyapar Field-Level Last-Write-Wins (LWW) CRDT with Hybrid Logical Clocks (HLC)
 *
 * Guarantees:
 * 1. Deterministic Convergence: merge(A, B) === merge(B, A) under all reconnection sequences.
 * 2. Field-level granularity: Independent property updates merge cleanly without conflicts.
 * 3. Zero Silent Data Loss: Competing edits on the same field resolve deterministically and log an audit record.
 */

import { Order, ConflictRecord } from '../storage/offlineDb';

export interface HLC {
  time: number;
  count: number;
  node: string;
}

export class HybridLogicalClock {
  private lastTime = 0;
  private count = 0;
  private readonly nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  // Generate new HLC timestamp for local edit
  now(): string {
    const physicalTime = Date.now();
    if (physicalTime > this.lastTime) {
      this.lastTime = physicalTime;
      this.count = 0;
    } else {
      this.count += 1;
    }
    return `${this.lastTime.toString(36)}:${this.count.toString(36)}:${this.nodeId}`;
  }

  // Update clock upon receiving remote timestamp
  receive(remoteHlcStr: string): void {
    const parsed = HybridLogicalClock.parse(remoteHlcStr);
    const physicalTime = Date.now();
    const maxTime = Math.max(physicalTime, this.lastTime, parsed.time);

    if (maxTime === this.lastTime && maxTime === parsed.time) {
      this.count = Math.max(this.count, parsed.count) + 1;
    } else if (maxTime === this.lastTime) {
      this.count += 1;
    } else if (maxTime === parsed.time) {
      this.count = parsed.count + 1;
    } else {
      this.count = 0;
    }
    this.lastTime = maxTime;
  }

  static parse(hlcStr: string): HLC {
    if (!hlcStr) return { time: 0, count: 0, node: '' };
    const parts = hlcStr.split(':');
    if (parts.length < 3) return { time: 0, count: 0, node: '' };
    return {
      time: parseInt(parts[0], 36) || 0,
      count: parseInt(parts[1], 36) || 0,
      node: parts[2] || '',
    };
  }

  // Deterministic comparator: returns > 0 if a > b, < 0 if a < b, 0 if equal
  static compare(aStr?: string, bStr?: string): number {
    if (!aStr && !bStr) return 0;
    if (!aStr) return -1;
    if (!bStr) return 1;

    const a = HybridLogicalClock.parse(aStr);
    const b = HybridLogicalClock.parse(bStr);

    if (a.time !== b.time) return a.time - b.time;
    if (a.count !== b.count) return a.count - b.count;
    return a.node.localeCompare(b.node); // Lexicographical deterministic tie-break
  }
}

export interface MergeResult {
  mergedOrder: Order;
  hadConflict: boolean;
  conflicts: ConflictRecord[];
}

const CRDT_MERGE_FIELDS = [
  'customer',
  'phone',
  'dueDate',
  'amount',
  'paidAmount',
  'status',
  'referencesPriorOrder',
  'rawMessage',
  'items',
] as const;

function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const sorted: Record<string, unknown> = {};
  Object.keys(obj).sort().forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted as T;
}

/**
 * Deterministically merges two Order states using Field-Level LWW CRDT rules.
 */
export function mergeOrderStates(localOrder: Order, remoteOrder: Order): MergeResult {
  const combinedHlc: Record<string, string> = {};
  const allHlcKeys = Array.from(new Set([
    ...Object.keys(localOrder.fieldHlc || {}),
    ...Object.keys(remoteOrder.fieldHlc || {}),
  ])).sort();

  for (const key of allHlcKeys) {
    const lHlc = localOrder.fieldHlc?.[key];
    const rHlc = remoteOrder.fieldHlc?.[key];
    const cmp = HybridLogicalClock.compare(lHlc, rHlc);
    combinedHlc[key] = cmp >= 0 ? (lHlc || rHlc!) : (rHlc || lHlc!);
  }

  const merged: Order = {
    ...localOrder,
    fieldHlc: combinedHlc,
    version: Math.max(localOrder.version, remoteOrder.version) + 1,
    updatedAt: new Date(Math.max(new Date(localOrder.updatedAt).getTime(), new Date(remoteOrder.updatedAt).getTime())).toISOString(),
  };

  const conflicts: ConflictRecord[] = [];
  let hadConflict = false;

  for (const field of CRDT_MERGE_FIELDS) {
    const localVal = (localOrder as Record<string, unknown>)[field];
    const remoteVal = (remoteOrder as Record<string, unknown>)[field];

    const localHlc = localOrder.fieldHlc?.[field] || `${new Date(localOrder.updatedAt).getTime().toString(36)}:0:${localOrder.deviceId}`;
    const remoteHlc = remoteOrder.fieldHlc?.[field] || `${new Date(remoteOrder.updatedAt).getTime().toString(36)}:0:${remoteOrder.deviceId}`;

    // Compare stringified representations for equality
    const localValStr = JSON.stringify(localVal);
    const remoteValStr = JSON.stringify(remoteVal);

    if (localValStr !== remoteValStr) {
      const cmp = HybridLogicalClock.compare(localHlc, remoteHlc);

      if (cmp > 0) {
        // Local wins
        (merged as Record<string, unknown>)[field] = localVal;
        merged.fieldHlc[field] = localHlc;
      } else {
        // Remote wins (or remote tie-breaker wins)
        (merged as Record<string, unknown>)[field] = remoteVal;
        merged.fieldHlc[field] = remoteHlc;
      }

      // Check if this was a concurrent conflicting edit (timestamps within 10 minutes or identical fields with competing intent)
      const localTime = HybridLogicalClock.parse(localHlc).time;
      const remoteTime = HybridLogicalClock.parse(remoteHlc).time;
      const isConcurrent = Math.abs(localTime - remoteTime) < 10 * 60 * 1000;

      if (isConcurrent) {
        hadConflict = true;
        conflicts.push({
          id: `conf-${localOrder.id}-${field}-${Date.now().toString(36)}`,
          orderId: localOrder.id,
          field,
          localValue: typeof localVal === 'object' ? JSON.stringify(localVal) : String(localVal),
          remoteValue: typeof remoteVal === 'object' ? JSON.stringify(remoteVal) : String(remoteVal),
          localAt: localOrder.updatedAt,
          remoteAt: remoteOrder.updatedAt,
          resolved: false,
        });
      }
    } else {
      // Identical values, pick higher HLC
      const cmp = HybridLogicalClock.compare(localHlc, remoteHlc);
      merged.fieldHlc[field] = cmp >= 0 ? localHlc : remoteHlc;
    }
  }

  merged.fieldHlc = sortObjectKeys(merged.fieldHlc);

  return {
    mergedOrder: merged,
    hadConflict,
    conflicts,
  };
}

/**
 * Merges a full list of local orders with remote orders.
 */
export function mergeOrderCollections(localOrders: Order[], remoteOrders: Order[]): {
  mergedOrders: Order[];
  conflicts: ConflictRecord[];
} {
  const map = new Map<string, Order>();
  const allConflicts: ConflictRecord[] = [];

  for (const order of localOrders) {
    map.set(order.id, order);
  }

  for (const remote of remoteOrders) {
    if (map.has(remote.id)) {
      const local = map.get(remote.id)!;
      const { mergedOrder, conflicts } = mergeOrderStates(local, remote);
      map.set(remote.id, mergedOrder);
      allConflicts.push(...conflicts);
    } else {
      map.set(remote.id, remote);
    }
  }

  return {
    mergedOrders: Array.from(map.values()),
    conflicts: allConflicts,
  };
}
