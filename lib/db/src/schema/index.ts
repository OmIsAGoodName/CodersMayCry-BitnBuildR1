import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";

// PostgreSQL table for global database
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  customerName: text("customer_name"),
  phoneNumber: text("phone_number"),
  itemName: text("item_name"),
  quantity: integer("quantity"),
  amount: integer("amount"),
  dueDate: text("due_date"),
  notes: text("notes"),
  rawParsed: json("raw_parsed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;