import express from "express";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, gt, ne, or, isNull, sql, getTableColumns } from "drizzle-orm";
import { db } from "../../db/index.ts";
import * as tables from "../../db/schema.ts";
import guestFeatures from "../../backend/guest-features.js";
import { roomDescriptions } from "../../src/data/hotelCatalog.js";
import menuData from "../../src/data/menu.json" with { type: "json" };
import { availableUnits, discountCents, ensure, hotelToday, HttpError, priceExtras, text, validDate, validateBooking } from "./booking.mjs";

// Preserve the existing accounts and their server-verified admin roles.
const { account, admin, privateList } = guestFeatures;
const { rooms, reservations, extras, vouchers, menu, orders, profiles, reviews } = tables;
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "180kb" }));
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const code = (prefix) => prefix + "-" + randomBytes(6).toString("hex").toUpperCase();
const id = (req) => { const value = Number(req.params.id ?? req.params.reservationId); ensure(Number.isSafeInteger(value) && value > 0, "Invalid record."); return value; };
const active = ["Pending", "Confirmed"];

// Only the public room/menu catalog is seeded. Guest records always live in Postgres.
let catalogReady;
async function seedCatalog() {
  await db.transaction(async (tx) => {
    const [existingRoom] = await tx.select({ id: rooms.id }).from(rooms).limit(1);
    if (!existingRoom) await tx.insert(rooms).values(roomDescriptions.map((room) => ({
      ...room, price: String(room.price), slug: room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    }))).onConflictDoNothing();
    const [existingMenu] = await tx.select({ id: menu.id }).from(menu).limit(1);
    if (!existingMenu && menuData.length) await tx.insert(menu).values(menuData.map((item) => ({
      title: item.title, category: item.category, price: String(Number(String(item.price).match(/[\d,.]+/)[0].replaceAll(",", ""))), image: item.image, desc: item.desc || "",
    }))).onConflictDoNothing();
  });
}
app.use("/api", (_req, _res, next) => {
  catalogReady ??= seedCatalog().catch((error) => { catalogReady = undefined; throw error; });
  catalogReady.then(() => next(), next);
});

const serialize = (row) => row && ({ ...row,
  status: row.actualCheckOut ? "Checked out" : row.status,
  createdEpoch: row.createdAt ? new Date(row.createdAt).getTime() / 1000 : undefined,
});
async function bookingRows(connection = db, condition) {
  return (await connection.select({ ...getTableColumns(reservations), roomType: rooms.name })
    .from(reservations).innerJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(condition).orderBy(desc(reservations.createdAt), desc(reservations.id))).map(serialize);
}
async function getBooking(recordId, connection = db) {
  const [record] = await bookingRows(connection, eq(reservations.id, recordId));
  ensure(record, "Reservation not found.", 404);
  return record;
}
async function lockRooms(tx, roomIds) {
  return tx.select().from(rooms).where(inArray(rooms.id, roomIds)).orderBy(asc(rooms.id)).for("update");
}
async function checkAvailability(tx, room, checkIn, checkOut, quantity, excludeId) {
  const stays = await tx.select().from(reservations).where(and(
    eq(reservations.roomId, room.id), inArray(reservations.status, active),
    lt(reservations.checkIn, checkOut), gt(sql`coalesce(${reservations.actualCheckOut}, ${reservations.checkOut})`, checkIn),
    excludeId ? ne(reservations.id, excludeId) : undefined,
  ));
  ensure(availableUnits(room.total_units, stays, checkIn, checkOut) >= quantity, room.name + " does not have enough rooms for those dates. Choose different dates or fewer rooms.", 409);
}
async function getVoucher(connection, value) {
  if (!value) return null;
  const [voucher] = await connection.select().from(vouchers).where(and(
    eq(vouchers.code, String(value).trim().toUpperCase()), eq(vouchers.isActive, true),
    or(isNull(vouchers.validUntil), sql`${vouchers.validUntil} >= ${hotelToday()}`),
  ));
  ensure(voucher, "This discount code is not valid.");
  return voucher;
}
function owner(req, res, next) {
  if (typeof req.body.email === "string" && req.body.email.trim().toLowerCase() === req.account.email.toLowerCase()) return next();
  return admin(req, res, next);
}

app.get("/api/rooms", route(async (req, res) => {
  res.json(await db.select().from(rooms).where(req.query.all === "1" ? undefined : eq(rooms.is_active, true)).orderBy(asc(rooms.price)));
}));
app.get("/api/rooms/availability", route(async (req, res) => {
  ensure(text(req.query.room, 100) && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || ""), "Enter a room and month in YYYY-MM format.");
  const [room] = await db.select().from(rooms).where(and(eq(rooms.name, req.query.room), eq(rooms.is_active, true)));
  ensure(room, "Room type not found.", 404);
  const start = req.query.month + "-01";
  const last = new Date(start + "T00:00:00Z"); last.setUTCMonth(last.getUTCMonth() + 1);
  const end = last.toISOString().slice(0, 10);
  const stays = await db.select().from(reservations).where(and(eq(reservations.roomId, room.id), inArray(reservations.status, active), lt(reservations.checkIn, end), gt(reservations.checkOut, start)));
  const nights = {}, availableRooms = {};
  for (const day = new Date(start); day < last; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, 10);
    const nextDay = new Date(+day + 86400000).toISOString().slice(0, 10);
    availableRooms[key] = availableUnits(room.total_units, stays, key, nextDay);
    nights[key] = availableRooms[key] > 0;
  }
  res.json({ nights, availableRooms, totalRooms: room.total_units });
}));

app.get("/api/reservations", account, privateList, route(async (req, res) => {
  res.json(await bookingRows(db, req.query.email === undefined ? undefined : eq(reservations.email, req.account.email.toLowerCase())));
}));
app.post("/api/reservations", account, owner, route(async (req, res) => {
  const body = req.body;
  const { rooms: selections, extras: extraSelections, nights } = validateBooking(body);
  const requestKey = req.get("Idempotency-Key") || randomBytes(16).toString("hex");
  ensure(/^[A-Za-z0-9-]{16,100}$/.test(requestKey), "Invalid booking request. Reopen the form and try again.");
  const saved = await db.transaction(async (tx) => {
    // Serializing the same request makes a retry return its original receipts.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${req.account.localId + ":" + requestKey}, 0))`);
    const prior = await bookingRows(tx, and(eq(reservations.accountId, req.account.localId), eq(reservations.requestKey, requestKey)));
    if (prior.length) return prior;
    const catalog = await tx.select().from(rooms).where(inArray(rooms.name, selections.map((item) => item.roomType))).orderBy(asc(rooms.id)).for("update");
    for (const selected of selections) {
      const room = catalog.find((item) => item.name === selected.roomType);
      ensure(room?.is_active && selected.guests <= room.capacity, "A room is unavailable or exceeds its guest capacity.", 409);
    }
    for (const room of catalog) {
      const quantity = selections.filter((item) => item.roomType === room.name).reduce((sum, item) => sum + item.quantity, 0);
      await checkAvailability(tx, room, body.checkIn, body.checkOut, quantity);
    }
    const extraCatalog = extraSelections.length ? await tx.select().from(extras).where(inArray(extras.id, extraSelections.map((item) => item.id))).for("share") : [];
    const voucher = await getVoucher(tx, body.voucherCode);
    const subtotal = selections.reduce((sum, item) => sum + Math.round(Number(catalog.find((room) => room.name === item.roomType).price) * 100) * nights * item.quantity, 0);
    let discountRemaining = discountCents(voucher, subtotal);
    const values = [];
    for (const selection of selections) {
      const room = catalog.find((item) => item.name === selection.roomType);
      const priced = priceExtras(extraCatalog, extraSelections, nights, selection.guests);
      const base = Math.round(Number(room.price) * 100) * nights;
      const extraCents = priced.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
      for (let unit = 0; unit < selection.quantity; unit++) {
        const discount = Math.min(base, discountRemaining); discountRemaining -= discount;
        values.push({ code: code("RES"), accountId: req.account.localId, requestKey, roomId: room.id,
          guestName: body.guestName.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.replace(/[\s-]/g, ""),
          checkIn: body.checkIn, checkOut: body.checkOut, guests: selection.guests, guestNames: selection.guestNames, nights,
          totalAmount: ((base - discount + extraCents) / 100).toFixed(2), paymentMethod: body.paymentMethod,
          paymentReference: body.paymentMethod === "GCash" ? body.paymentReference.trim() : null,
          voucherCode: voucher?.code, discountAmount: (discount / 100).toFixed(2), extras: priced, notes: body.notes?.trim() || null,
        });
      }
    }
    const total = values.reduce((sum, item) => sum + Math.round(Number(item.totalAmount) * 100), 0);
    ensure(body.expectedTotal === undefined || Math.round(body.expectedTotal * 100) === total, "Room or service prices changed. Reopen the booking to review current prices before submitting.", 409);
    const inserted = await tx.insert(reservations).values(values).returning({ id: reservations.id });
    return bookingRows(tx, inArray(reservations.id, inserted.map((item) => item.id)));
  });
  res.status(201).json({ id: saved[0].id, code: saved[0].code, reservation: saved[0], reservations: saved });
}));

app.patch("/api/reservations/:id/status", account, admin, route(async (req, res) => {
  const recordId = id(req);
  const { status, roomNumber, expectedStatus } = req.body;
  ensure(["Pending", "Confirmed", "Cancelled"].includes(status), "Invalid booking status.");
  const updated = await db.transaction(async (tx) => {
    const initial = await getBooking(recordId, tx);
    const [room] = await lockRooms(tx, [initial.roomId]);
    const current = await getBooking(recordId, tx);
    ensure(current.roomId === room.id && !current.actualCheckOut && (!expectedStatus || current.status === expectedStatus), "This reservation changed. Refresh and try again.", 409);
    let assigned = null;
    if (active.includes(status)) await checkAvailability(tx, room, current.checkIn, current.checkOut, 1, recordId);
    if (status === "Confirmed") {
      ensure(text(roomNumber, 20), "Enter the assigned room number.");
      assigned = roomNumber.trim();
      // All assignments of the same physical room serialize across room types.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"room:" + assigned.toLowerCase()}, 0))`);
      const conflicting = await tx.select({ id: reservations.id }).from(reservations).where(and(
        eq(sql`lower(${reservations.roomNumber})`, assigned.toLowerCase()), eq(reservations.status, "Confirmed"), ne(reservations.id, recordId),
        lt(reservations.checkIn, current.checkOut), gt(sql`coalesce(${reservations.actualCheckOut}, ${reservations.checkOut})`, current.checkIn),
      ));
      ensure(!conflicting.length, "This room number is already assigned for those dates.", 409);
    }
    await tx.update(reservations).set({ status, roomNumber: assigned }).where(eq(reservations.id, recordId));
    return getBooking(recordId, tx);
  });
  res.json({ message: "Reservation updated.", reservation: updated });
}));

app.patch("/api/reservations/:id/payment", account, admin, route(async (req, res) => {
  ensure(["Unpaid", "Paid"].includes(req.body.paymentStatus), "Choose Paid or Unpaid.");
  const result = await db.update(reservations).set({ paymentStatus: req.body.paymentStatus }).where(eq(reservations.id, id(req))).returning();
  ensure(result.length, "Reservation not found.", 404);
  res.json({ message: "Payment updated." });
}));
app.patch("/api/reservations/:id/early-checkout", account, admin, route(async (req, res) => {
  const recordId = id(req), today = hotelToday();
  const result = await db.update(reservations).set({ actualCheckOut: today }).where(and(
    eq(reservations.id, recordId), eq(reservations.status, "Confirmed"), isNull(reservations.actualCheckOut),
    sql`${reservations.checkIn} <= ${today}`, gt(reservations.checkOut, today),
  )).returning();
  ensure(result.length, "This booking is not eligible for early checkout.", 409);
  res.json({ message: "Early checkout recorded.", reservation: await getBooking(recordId) });
}));
app.delete("/api/reservations/:id", account, admin, route(async (req, res) => {
  const result = await db.delete(reservations).where(eq(reservations.id, id(req))).returning();
  ensure(result.length, "Reservation not found.", 404);
  res.json({ message: "Reservation deleted." });
}));
app.patch("/api/guest/reservations/:id/cancel", account, route(async (req, res) => {
  ensure(req.account.emailVerified, "Verify your email before managing reservations.", 403);
  const result = await db.update(reservations).set({ status: "Cancelled" }).where(and(
    eq(reservations.id, id(req)), eq(reservations.email, req.account.email.toLowerCase()), inArray(reservations.status, active),
    eq(reservations.paymentStatus, "Unpaid"), eq(reservations.paymentMethod, "Cash"), isNull(reservations.actualCheckOut),
    gt(reservations.checkIn, hotelToday()),
  )).returning();
  ensure(result.length, "This reservation cannot be cancelled online. Contact the hotel.", 409);
  res.json({ message: "Reservation cancelled." });
}));

app.put("/api/reservations/:id", account, admin, route(async (req, res) => {
  const recordId = id(req), body = req.body;
  ensure(text(body.guestName, 100) && text(body.email, 150) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) && text(body.phone, 30), "Enter valid guest contact details.");
  ensure(validDate(body.checkIn) && validDate(body.checkOut) && body.checkOut > body.checkIn, "Choose valid stay dates.");
  ensure(["Pending", "Confirmed", "Cancelled"].includes(body.status), "Choose a valid status.");
  const total = Number(body.totalAmount);
  ensure(Number.isFinite(total) && total >= 0 && total <= 99999999, "Enter a valid total amount.");
  await db.transaction(async (tx) => {
    const initial = await getBooking(recordId, tx);
    const [destination] = await tx.select().from(rooms).where(eq(rooms.name, body.roomType));
    ensure(destination, "Room type not found.", 404);
    const locked = await lockRooms(tx, [...new Set([initial.roomId, destination.id])]);
    const current = await getBooking(recordId, tx);
    ensure(!current.actualCheckOut && current.roomId === initial.roomId, "This booking changed or has checked out. Refresh and try again.", 409);
    const room = locked.find((item) => item.id === destination.id);
    ensure(current.guests <= room.capacity, "This room cannot accommodate all guests.");
    let assigned = body.roomNumber?.trim() || null;
    if (active.includes(body.status)) await checkAvailability(tx, room, body.checkIn, body.checkOut, 1, recordId);
    if (body.status === "Confirmed") {
      ensure(text(assigned, 20), "Enter the assigned room number.");
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"room:" + assigned.toLowerCase()}, 0))`);
      const conflicts = await tx.select({ id: reservations.id }).from(reservations).where(and(
        eq(sql`lower(${reservations.roomNumber})`, assigned.toLowerCase()), eq(reservations.status, "Confirmed"), ne(reservations.id, recordId),
        lt(reservations.checkIn, body.checkOut), gt(sql`coalesce(${reservations.actualCheckOut}, ${reservations.checkOut})`, body.checkIn),
      ));
      ensure(!conflicts.length, "This room number is already assigned for those dates.", 409);
    } else assigned = null;
    await tx.update(reservations).set({
      guestName: body.guestName.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(), roomId: room.id,
      checkIn: body.checkIn, checkOut: body.checkOut, nights: Math.round((Date.parse(body.checkOut) - Date.parse(body.checkIn)) / 86400000),
      totalAmount: total.toFixed(2), status: body.status, roomNumber: assigned,
    }).where(eq(reservations.id, recordId));
  });
  res.json({ message: "Reservation updated.", reservation: await getBooking(recordId) });
}));

app.get("/api/extras", route(async (_req, res) => res.json(await db.select().from(extras).where(eq(extras.active, true)).orderBy(asc(extras.name)))));
app.get("/api/admin/extras", account, admin, route(async (_req, res) => res.json(await db.select().from(extras).orderBy(asc(extras.name)))));
const saveExtra = route(async (req, res) => {
  const { name, description, price, unit, active: enabled } = req.body;
  ensure(text(name, 100) && text(description, 1000, false) && Number.isFinite(price) && price >= 0 && price <= 999999 && ["night", "stay", "guest", "item"].includes(unit) && typeof enabled === "boolean", "Enter valid extra service details.");
  const values = { name: name.trim(), description: description.trim(), price: price.toFixed(2), unit, active: enabled };
  const result = req.params.id ? await db.update(extras).set(values).where(eq(extras.id, id(req))).returning() : await db.insert(extras).values(values).returning();
  ensure(result.length, "Extra service not found.", 404);
  res.status(req.params.id ? 200 : 201).json(result[0]);
});
app.post("/api/admin/extras", account, admin, saveExtra);
app.put("/api/admin/extras/:id", account, admin, saveExtra);

app.get("/api/vouchers/check", route(async (req, res) => {
  ensure(text(req.query.code, 40), "Enter a discount code.");
  res.json(await getVoucher(db, req.query.code));
}));
app.get("/api/vouchers", account, admin, route(async (_req, res) => res.json(await db.select().from(vouchers).orderBy(desc(vouchers.id)))));
app.post("/api/vouchers", account, admin, route(async (req, res) => {
  const { code: value, discountType, discountValue, validUntil } = req.body;
  ensure(text(value, 40) && ["fixed", "percent"].includes(discountType) && Number.isFinite(discountValue) && discountValue > 0 && discountValue <= (discountType === "percent" ? 100 : 99999999) && (!validUntil || validDate(validUntil)), "Enter valid discount details.");
  const [result] = await db.insert(vouchers).values({ code: value.trim().toUpperCase(), discountType, discountValue: discountValue.toFixed(2), validUntil: validUntil || null }).returning();
  res.status(201).json(result);
}));
app.patch("/api/vouchers/:id", account, admin, route(async (req, res) => {
  ensure(typeof req.body.isActive === "boolean", "Choose a valid voucher status.");
  const result = await db.update(vouchers).set({ isActive: req.body.isActive }).where(eq(vouchers.id, id(req))).returning();
  ensure(result.length, "Voucher not found.", 404); res.json({ message: "Voucher updated." });
}));
app.delete("/api/vouchers/:id", account, admin, route(async (req, res) => {
  const result = await db.delete(vouchers).where(eq(vouchers.id, id(req))).returning();
  ensure(result.length, "Voucher not found.", 404); res.json({ message: "Voucher deleted." });
}));

const saveRoom = route(async (req, res) => {
  const { name, category, price, capacity, totalUnits, isActive, image, bed, description } = req.body;
  ensure(text(name, 100) && text(category, 30) && Number.isFinite(price) && price >= 0 && price <= 99999999 && Number.isInteger(capacity) && capacity > 0 && capacity <= 255 && Number.isInteger(totalUnits) && totalUnits >= 0 && totalUnits <= 65535, "Enter valid room details.");
  ensure(!image || (text(image, 2048) && image.startsWith("https://")), "Photos must use HTTPS.");
  ensure((!bed || text(bed, 100)) && (!description || text(description, 1000)), "Enter valid room details.");
  const values = { name: name.trim(), category: category.trim(), price: price.toFixed(2), capacity, total_units: totalUnits, is_active: isActive !== false, image: image || null, bed: bed || null, description: description || null };
  const result = await db.transaction(async (tx) => {
    if (req.params.id) {
      await lockRooms(tx, [id(req)]);
      return tx.update(rooms).set(values).where(eq(rooms.id, id(req))).returning();
    }
    return tx.insert(rooms).values({ ...values, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + randomBytes(4).toString("hex") }).returning();
  });
  ensure(result.length, "Room not found.", 404); res.status(req.params.id ? 200 : 201).json(result[0]);
});
app.post("/api/rooms", account, admin, saveRoom);
app.put("/api/rooms/:id", account, admin, saveRoom);

app.get("/api/menu", route(async (_req, res) => res.json(await db.select().from(menu).orderBy(asc(menu.id)))));
const saveMenu = route(async (req, res) => {
  const { title, category, price, image, desc: description, availability } = req.body;
  ensure(text(title, 120) && text(category, 45) && text(description, 1000, false) && Number.isFinite(price) && price > 0 && price <= 99999999 && ["available", "out_of_stock", "unavailable"].includes(availability) && (!image || (text(image, 2048) && image.startsWith("https://"))), "Enter valid menu details and an HTTPS photo URL.");
  const values = { title: title.trim(), category: category.trim(), price: price.toFixed(2), image: image || null, desc: description.trim(), availability };
  const result = req.params.id ? await db.update(menu).set(values).where(eq(menu.id, id(req))).returning() : await db.insert(menu).values(values).returning();
  ensure(result.length, "Menu item not found.", 404); res.status(req.params.id ? 200 : 201).json(result[0]);
});
app.post("/api/menu", account, admin, saveMenu);
app.put("/api/menu/:id", account, admin, saveMenu);
app.patch("/api/menu/:id/availability", account, admin, route(async (req, res) => {
  ensure(["available", "out_of_stock", "unavailable"].includes(req.body.availability), "Choose a valid availability status.");
  const result = await db.update(menu).set({ availability: req.body.availability }).where(eq(menu.id, id(req))).returning();
  ensure(result.length, "Menu item not found.", 404); res.json({ message: "Availability updated." });
}));

app.get("/api/orders", account, privateList, route(async (req, res) => {
  res.json(await db.select().from(orders).where(req.query.email === undefined ? undefined : eq(orders.email, req.account.email.toLowerCase())).orderBy(desc(orders.createdAt), desc(orders.id)));
}));
app.post("/api/orders", account, owner, route(async (req, res) => {
  const body = req.body;
  ensure(text(body.guestName, 120) && text(body.email, 160) && text(body.phone, 30), "Enter your name, email and contact number.");
  ensure(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 50 && body.items.every((item) => item && Number.isSafeInteger(item.id) && item.id > 0 && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 50), "Choose valid menu items and quantities.");
  ensure(new Set(body.items.map((item) => item.id)).size === body.items.length, "Choose each menu item only once.");
  const result = await db.transaction(async (tx) => {
    const catalog = await tx.select().from(menu).where(inArray(menu.id, body.items.map((item) => item.id))).orderBy(asc(menu.id)).for("share");
    const items = body.items.map(({ id: itemId, qty }) => {
      const item = catalog.find((entry) => entry.id === itemId);
      ensure(item?.availability === "available", "An item is unavailable. Review your order.", 409);
      return { id: item.id, title: item.title, image: item.image, price: Number(item.price), qty };
    });
    const cents = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
    ensure(body.expectedTotal === undefined || Math.round(body.expectedTotal * 100) === cents, "Menu prices changed. Review your order.", 409);
    const [saved] = await tx.insert(orders).values({ code: code("ORD"), accountId: req.account.localId,
      guestName: body.guestName.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(),
      roomNumber: String(body.roomNumber || "").slice(0, 30) || null, items, totalAmount: (cents / 100).toFixed(2), notes: String(body.notes || "").slice(0, 2000) || null,
    }).returning();
    return saved;
  });
  res.status(201).json(result);
}));
app.patch("/api/orders/:id/status", account, admin, route(async (req, res) => {
  const { status } = req.body;
  ensure(["Pending", "Preparing", "Served", "Cancelled"].includes(status), "Invalid order status.");
  const result = await db.update(orders).set({ status, ...(status === "Served" ? { servedAt: new Date() } : {}) }).where(and(
    eq(orders.id, id(req)), or(inArray(orders.status, ["Pending", "Preparing"]), eq(orders.status, status)),
  )).returning();
  ensure(result.length, "This order is closed or no longer exists.", 409); res.json({ message: "Order updated." });
}));
app.patch("/api/guest/orders/:id/cancel", account, route(async (req, res) => {
  ensure(req.account.emailVerified, "Verify your email before managing orders.", 403);
  const result = await db.update(orders).set({ status: "Cancelled" }).where(and(eq(orders.id, id(req)), eq(orders.email, req.account.email.toLowerCase()), eq(orders.status, "Pending"))).returning();
  ensure(result.length, "This order cannot be cancelled online.", 409); res.json({ message: "Food order cancelled." });
}));

app.put("/api/guest/directory-profile", account, route(async (req, res) => {
  ensure(req.account.emailVerified, "Verify your email before updating your directory profile.", 403);
  const { name, photoURL = "" } = req.body;
  ensure(text(name, 100) && typeof photoURL === "string" && (!photoURL || (photoURL.length <= 120000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photoURL)) || (photoURL.length <= 2048 && photoURL.startsWith("https://"))), "Enter valid profile details.");
  const values = { uid: req.account.localId, email: req.account.email.toLowerCase(), name: name.trim(), photoURL };
  await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.uid, set: values }); res.sendStatus(204);
}));
app.get("/api/admin/client-profile", account, admin, route(async (req, res) => {
  ensure(text(req.query.email, 160), "Enter a client email.");
  const email = req.query.email.trim().toLowerCase();
  const [profile] = await db.select().from(profiles).where(eq(profiles.email, email));
  const food = await db.select().from(orders).where(eq(orders.email, email)).orderBy(desc(orders.createdAt));
  res.json({ profile: profile || null, orders: food.map((item) => ({ ...item, total: item.totalAmount })) });
}));
app.get("/api/admin/notifications", account, admin, route(async (_req, res) => {
  const [bookings, food] = await Promise.all([
    db.select({ id: reservations.id, code: reservations.code, guestName: reservations.guestName, createdAt: reservations.createdAt }).from(reservations).orderBy(desc(reservations.createdAt)).limit(30),
    db.select({ id: orders.id, code: orders.code, guestName: orders.guestName, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.createdAt)).limit(30),
  ]);
  res.json([...bookings.map((item) => ({ ...item, kind: "reservation" })), ...food.map((item) => ({ ...item, kind: "order" }))]
    .map((item) => ({ ...item, createdAt: new Date(item.createdAt).getTime() / 1000 })).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id).slice(0, 30));
}));

async function listReviews(privateView) {
  return db.select({ id: reviews.reservationId, name: reviews.name, hotelRating: reviews.hotelRating, serviceRating: reviews.serviceRating,
    comment: reviews.comment, updatedAt: reviews.updatedAt, roomType: rooms.name,
    ...(privateView ? { reservationCode: reservations.code } : {}),
  }).from(reviews).innerJoin(reservations, eq(reviews.reservationId, reservations.id)).innerJoin(rooms, eq(reservations.roomId, rooms.id)).orderBy(desc(reviews.updatedAt)).limit(50);
}
app.get("/api/reviews", route(async (_req, res) => res.json(await listReviews(false))));
app.get("/api/admin/reviews", account, admin, route(async (_req, res) => res.json(await listReviews(true))));
app.get("/api/reviews/mine", account, route(async (req, res) => {
  ensure(req.account.emailVerified, "Verify your email before reviewing a stay.", 403);
  const stays = await bookingRows(db, and(eq(reservations.email, req.account.email.toLowerCase()), eq(reservations.status, "Confirmed"), sql`coalesce(${reservations.actualCheckOut}, ${reservations.checkOut}) <= ${hotelToday()}`));
  const mine = await db.select().from(reviews).where(eq(reviews.uid, req.account.localId));
  res.json(stays.map((stay) => ({ ...stay, ...mine.find((review) => review.reservationId === stay.id) })));
}));
app.put("/api/reviews/mine/:reservationId", account, route(async (req, res) => {
  ensure(req.account.emailVerified, "Verify your email before reviewing a stay.", 403);
  const { hotelRating, serviceRating, comment } = req.body;
  ensure([hotelRating, serviceRating].every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5) && text(comment, 1000), "Enter a review with ratings from 1 to 5.");
  const stay = await getBooking(id(req));
  ensure(stay.email.toLowerCase() === req.account.email.toLowerCase() && ["Confirmed", "Checked out"].includes(stay.status) && (stay.actualCheckOut || stay.checkOut) <= hotelToday(), "Only completed stays can be reviewed.", 403);
  const values = { reservationId: stay.id, uid: req.account.localId, name: req.account.displayName || "Hotel guest", hotelRating, serviceRating, comment: comment.trim(), updatedAt: new Date() };
  await db.insert(reviews).values(values).onConflictDoUpdate({ target: reviews.reservationId, set: values });
  res.json({ message: "Stay review published." });
}));

app.use("/api", (_req, res) => res.status(404).json({ message: "This hotel API endpoint does not exist." }));
app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Enter valid request data." });
  if (error.type === "entity.too.large") return res.status(413).json({ message: "This request is too large." });
  if (error.code === "23505" || error.cause?.code === "23505") return res.status(409).json({ message: "A record with those details already exists." });
  console.error("Hotel API request failed:", error.code || error.cause?.code || error.name);
  res.status(503).json({ message: "The reservation service is temporarily unavailable. Your form is still here; please retry shortly." });
});

export const config = { path: "/api/*" };
export default app;
