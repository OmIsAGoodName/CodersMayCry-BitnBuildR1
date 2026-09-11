import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, localDb, ordersTable, type Order as DbOrder } from "@workspace/db";

const router = Router();

// Use local DB for this session if available, otherwise use global DB
const activeDb = localDb ?? db;

const itemSchema = z.object({
  description: z.string().default(""),
  quantity: z.number().int().min(1).default(1),
  attributes: z.record(z.string(), z.string()).default({}),
});

const orderSchema = z.object({
  id: z.string().optional(),
  customer: z.string().default(""),
  phone: z.string().default(""),
  items: z.array(itemSchema).default([]),
  dueDate: z.string().default(""),
  amount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  status: z.enum(["new", "in_progress", "ready", "completed", "cancelled"]).default("new"),
  referencesPriorOrder: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.8),
  needsClarification: z.boolean().default(false),
  rawMessage: z.string().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().int().min(0).default(1),
  deviceId: z.string().optional(),
  pendingSync: z.boolean().default(false),
});

const parseRawParsed = (value: Record<string, unknown> | null | undefined) => {
  if (!value) return {} as Record<string, unknown>;
  try {
    return value as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
};

const serializeOrder = (row: DbOrder) => {
  const raw = parseRawParsed(row.rawParsed as Record<string, unknown> | null | undefined);
  const safeItems = Array.isArray(raw.items)
    ? raw.items.map((item) => {
        const entry = (item ?? {}) as Record<string, unknown>;
        return {
          description: typeof entry.description === "string" ? entry.description : String(row.itemName ?? row.message ?? "Customer order"),
          quantity: typeof entry.quantity === "number" ? entry.quantity : Number(row.quantity ?? 1),
          attributes: entry.attributes && typeof entry.attributes === "object" ? (entry.attributes as Record<string, string>) : {},
        };
      })
    : [{
        description: row.itemName ?? row.message ?? "Customer order",
        quantity: Number(row.quantity ?? 1),
        attributes: {},
      }];

  return {
    id: String(row.id),
    customer: String(raw.customer ?? row.customerName ?? ""),
    phone: String(raw.phone ?? row.phoneNumber ?? ""),
    items: safeItems,
    dueDate: String(raw.dueDate ?? row.dueDate ?? ""),
    amount: Number(raw.amount ?? row.amount ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    status: String(raw.status ?? "new") as "new" | "in_progress" | "ready" | "completed" | "cancelled",
    referencesPriorOrder: Boolean(raw.referencesPriorOrder ?? false),
    confidence: Number(raw.confidence ?? 0.8),
    needsClarification: Boolean(raw.needsClarification ?? false),
    rawMessage: String(raw.rawMessage ?? row.message ?? ""),
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    version: Number(raw.version ?? 1),
    deviceId: String(raw.deviceId ?? "db"),
    pendingSync: Boolean(raw.pendingSync ?? false),
  };
};

const toDbRow = (payload: z.infer<typeof orderSchema>) => {
  const safeItems = payload.items.length ? payload.items : [{ description: payload.customer || "Customer order", quantity: 1, attributes: {} }];
  const message = payload.rawMessage || safeItems.map((item) => `${item.quantity} × ${item.description}`).join(", ") || "Customer order";

  return {
    message,
    customerName: payload.customer || null,
    phoneNumber: payload.phone || null,
    itemName: safeItems[0]?.description || null,
    quantity: safeItems[0]?.quantity ?? 1,
    amount: Number(payload.amount ?? 0),
    dueDate: payload.dueDate || null,
    notes: payload.needsClarification ? "Needs clarification" : null,
    rawParsed: {
      customer: payload.customer,
      phone: payload.phone,
      items: safeItems,
      dueDate: payload.dueDate,
      amount: payload.amount,
      paidAmount: payload.paidAmount,
      status: payload.status,
      referencesPriorOrder: payload.referencesPriorOrder,
      confidence: payload.confidence,
      needsClarification: payload.needsClarification,
      rawMessage: payload.rawMessage,
      version: payload.version,
      deviceId: payload.deviceId ?? "db",
      pendingSync: payload.pendingSync ?? false,
    },
  };
};

router.get("/orders", async (_req: Request, res: Response) => {
  try {
    const orders = await activeDb.select().from(ordersTable);
    const serialized = orders.map(serializeOrder);
    res.json(serialized);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/orders", async (req: Request, res: Response) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid order data",
        details: parsed.error.flatten(),
      });
    }

    const dbRow = toDbRow(parsed.data);
    const result = await activeDb.insert(ordersTable).values(dbRow).returning();
    
    if (!result[0]) {
      return res.status(500).json({ error: "Failed to create order" });
    }

    res.status(201).json(serializeOrder(result[0]));
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.put("/orders/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = orderSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid order data",
        details: parsed.error.flatten(),
      });
    }

    const dbRow = toDbRow(parsed.data);
    const result = await activeDb
      .update(ordersTable)
      .set(dbRow)
      .where(eq(ordersTable.id, Number(id)))
      .returning();

    if (!result[0]) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(serializeOrder(result[0]));
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

router.delete("/orders/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await activeDb
      .delete(ordersTable)
      .where(eq(ordersTable.id, Number(id)))
      .returning();

    if (!result[0]) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ success: true, deleted: serializeOrder(result[0]) });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
