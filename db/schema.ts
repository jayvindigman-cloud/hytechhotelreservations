import { pgTable, serial, text, integer, numeric, boolean, date, timestamp, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const rooms = pgTable("room_types", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  name: text().notNull().unique(),
  category: text().notNull(),
  price: numeric({ precision: 10, scale: 2 }).notNull(),
  capacity: integer().notNull(),
  total_units: integer().notNull().default(1),
  is_active: boolean().notNull().default(true),
  image: text(), bed: text(), description: text(),
}, (table) => [
  check("room_price_positive", sql`${table.price} >= 0`),
  check("room_capacity_positive", sql`${table.capacity} > 0`),
  check("room_inventory_nonnegative", sql`${table.total_units} >= 0`),
]);

export const reservations = pgTable("reservations", {
  id: serial().primaryKey(),
  code: text("reservation_code").notNull().unique(),
  accountId: text("account_id").notNull(),
  requestKey: text("request_key").notNull(),
  roomId: integer("room_type_id").notNull().references(() => rooms.id),
  guestName: text("guest_name").notNull(),
  email: text().notNull(), phone: text().notNull(),
  checkIn: date("check_in").notNull(), checkOut: date("check_out").notNull(),
  actualCheckOut: date("actual_check_out"),
  guests: integer().notNull(), guestNames: jsonb("guest_names").notNull().default([]),
  nights: integer().notNull(), totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), paymentReference: text("payment_reference"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),
  status: text().notNull().default("Pending"), roomNumber: text("room_number"),
  voucherCode: text("voucher_code"), discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  extras: jsonb("extras_snapshot").notNull().default([]), notes: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("reservation_availability").on(table.roomId, table.checkIn, table.checkOut),
  index("reservation_account").on(table.accountId, table.requestKey),
  check("reservation_dates_valid", sql`${table.checkOut} > ${table.checkIn}`),
]);

export const extras = pgTable("hotel_extras", {
  id: serial().primaryKey(), name: text().notNull(), description: text().notNull().default(""),
  price: numeric({ precision: 10, scale: 2 }).notNull(), unit: text().notNull(),
  active: boolean("is_active").notNull().default(true),
});

export const vouchers = pgTable("vouchers", {
  id: serial().primaryKey(), code: text().notNull().unique(),
  discountType: text("discount_type").notNull(), discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  validUntil: date("valid_until"), isActive: boolean("is_active").notNull().default(true),
});

export const menu = pgTable("menu_items", {
  id: serial().primaryKey(), title: text().notNull().unique(), category: text().notNull(),
  price: numeric({ precision: 10, scale: 2 }).notNull(), image: text(), desc: text("description").notNull().default(""),
  availability: text().notNull().default("available"),
});

export const orders = pgTable("food_orders", {
  id: serial().primaryKey(), code: text("order_code").notNull().unique(),
  accountId: text("account_id").notNull(), guestName: text("guest_name").notNull(),
  email: text().notNull(), phone: text().notNull(), roomNumber: text("room_number"),
  items: jsonb().notNull(), totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text(), status: text().notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  servedAt: timestamp("served_at", { withTimezone: true }),
});

export const profiles = pgTable("guest_directory_profiles", {
  uid: text().primaryKey(), email: text().notNull().unique(), name: text().notNull(), photoURL: text("photo_url"),
});

export const reviews = pgTable("stay_reviews", {
  reservationId: integer("reservation_id").primaryKey().references(() => reservations.id, { onDelete: "cascade" }),
  uid: text().notNull(), name: text().notNull(), hotelRating: integer("hotel_rating").notNull(),
  serviceRating: integer("service_rating").notNull(), comment: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
