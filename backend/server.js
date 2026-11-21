require('dotenv').config({ quiet: true });
const { randomBytes } = require("node:crypto");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { initializeMenu, registerMenu, menuOrderLines } = require("./menu");
const { account, admin, privateList, initializeGuestFeatures, priceExtras, registerGuestFeatures } = require("./guest-features");
const { router: keysRouter, initializeKeys } = require("./keys");

const nodemailer = require("nodemailer");

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
const HOTEL_NAME = "Hytech Hotel & Bistro";

const transporter = GMAIL_USER && GMAIL_APP_PASSWORD ? nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
}) : null;

const peso = (value) => "PHP " + Number(value || 0).toLocaleString("en-PH");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function emailLayout(headline, intro, rows, footer) {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;color:#1d3f40">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;border-top:5px solid #d8b46a;padding:24px;background:#faf6ec">
    <h2 style="margin:0 0 4px;color:#1d3f40">${escapeHtml(HOTEL_NAME)}</h2>
    <h3 style="margin:16px 0 8px;color:#1d3f40">${escapeHtml(headline)}</h3>
    <p style="color:#333;line-height:1.5">${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse;font-size:0.95rem;margin:12px 0">${body}</table>
    <p style="color:#777;font-size:0.85rem;line-height:1.5">${escapeHtml(footer)}</p>
  </div>`;
}

async function sendEmail(to, subject, html) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({ from: `"${HOTEL_NAME}" <${GMAIL_USER}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error("Email failed:", err.message);
    return false;
  }
}

function reservationRows(r, roomNumber) {
  return [
    ["Booking reference", r.code],
    ["Guest", r.guestName],
    ...(r.guestNames?.length ? [["Room occupants", r.guestNames.join(", ")]] : []),
    ["Room type", r.roomType],
    ["Room number", roomNumber || "Assigned once confirmed"],
    ["Check-in", r.checkIn],
    ["Check-out", r.checkOut],
    ...(r.actualCheckOut ? [["Actual check-out", r.actualCheckOut]] : []),
    ["Guests", r.guests],
    ["Payment", `${r.paymentMethod}${r.paymentReference ? " (ref " + r.paymentReference + ")" : ""}`],
    ...(r.extras || []).map((item) => [item.name, peso(item.amount)]),
    ...(Number(r.discountAmount) > 0 ? [[`Discount (${r.voucherCode})`, "-" + peso(r.discountAmount)]] : []),
    ["Total", peso(r.totalAmount)],
    ["Special requests", r.notes || "None"],
  ];
}

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json());
app.use("/api/keys", account, admin, keysRouter);

const PAYMENTS = ["GCash", "Cash",];
const STATUSES = ["Pending", "Confirmed", "Cancelled"];
const PAYMENT_STATUSES = ["Unpaid", "Paid"];
const ORDER_STATUSES = ["Pending", "Preparing", "Served", "Cancelled"];

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ message: "Server error. Please try again." });
  });

const RESERVATION_SELECT = `
  SELECT r.id, r.reservation_code AS code, r.guest_name AS guestName, r.email, r.phone,
         t.name AS roomType, r.check_in AS checkIn, r.check_out AS checkOut, r.actual_check_out AS actualCheckOut,
         r.guests, r.guest_names AS guestNames, r.nights, r.total_amount AS totalAmount,
         r.payment_method AS paymentMethod, r.payment_reference AS paymentReference,
         r.payment_status AS paymentStatus, CASE WHEN r.actual_check_out IS NOT NULL THEN 'Checked out' ELSE r.status END AS status, r.notes, r.room_type_id AS roomId,
         r.room_number AS roomNumber, r.voucher_code AS voucherCode,
         r.discount_amount AS discountAmount, r.extras_snapshot AS extras, r.created_at AS createdAt, UNIX_TIMESTAMP(r.created_at) AS createdEpoch
  FROM reservations r JOIN room_types t ON t.id = r.room_type_id`;

function parseReservation(row) {
  if (!row) return null;
  const extras = typeof row.extras === "string" ? JSON.parse(row.extras) : row.extras;
  const guestNames = typeof row.guestNames === "string" ? JSON.parse(row.guestNames) : row.guestNames;
  return { ...row, extras: extras || [], guestNames: guestNames || [] };
}

async function findReservation(id) {
  const [[row]] = await pool.query(`${RESERVATION_SELECT} WHERE r.id = ?`, [id]);
  return parseReservation(row);
}

function computeDiscount(voucher, base) {
  const value = Number(voucher.discount_value);
  const raw = voucher.discount_type === "fixed" ? value : (base * value) / 100;
  return Math.min(base, Math.round(raw * 100) / 100);
}

async function lookupVoucher(conn, code) {
  if (!code) return null;
  const [[voucher]] = await conn.query(
    `SELECT * FROM vouchers
     WHERE code = ? AND is_active = 1 AND (valid_until IS NULL OR valid_until >= CURDATE())`,
    [String(code).trim().toUpperCase()]
  );
  return voucher || null;
}

async function roomNumberTaken(roomNumber, checkIn, checkOut, excludeId, connection) {
  const [[{ taken }]] = await connection.query(
    `SELECT COUNT(*) AS taken FROM reservations
     WHERE room_number = ? AND status = 'Confirmed' AND id <> ?
       AND check_in < ? AND COALESCE(actual_check_out, check_out) > ?`,
    [roomNumber, excludeId, checkOut, checkIn]
  );
  return taken > 0;
}

app.get("/api/rooms", wrap(async (req, res) => {
  const where = req.query.all === "1" ? "" : "WHERE is_active = 1";
  const [rows] = await pool.query(
    `SELECT id, slug, name, category, price, capacity, total_units, is_active, image, bed, description
     FROM room_types ${where} ORDER BY price`
  );
  res.json(rows);
}));

app.get("/api/rooms/availability", wrap(async (req, res) => {
  const { room, month } = req.query;
  if (typeof room !== "string" || !room.trim() || room.length > 150 ||
      typeof month !== "string" || !/^(?:19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ message: "Enter a room name and month in YYYY-MM format." });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const dateKey = (date) => date.toISOString().slice(0, 10);
  const [[roomType]] = await pool.query(
    "SELECT id, total_units FROM room_types WHERE name = ? AND is_active = 1",
    [room]
  );
  if (!roomType) return res.status(404).json({ message: "Room type not found." });

  const [stays] = await pool.query(
    `SELECT check_in, COALESCE(actual_check_out, check_out) AS check_out FROM reservations
     WHERE room_type_id = ? AND status = 'Confirmed'
       AND check_in < ? AND COALESCE(actual_check_out, check_out) > ?`,
    [roomType.id, dateKey(end), dateKey(start)]
  );

  const nights = {};
  const availableRooms = {};
  for (const date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = dateKey(date);
    const booked = stays.filter((stay) => stay.check_in <= key && stay.check_out > key).length;
    availableRooms[key] = Math.max(0, Number(roomType.total_units) - booked);
    nights[key] = availableRooms[key] > 0;
  }
  res.set("Cache-Control", "no-store").json({ nights, availableRooms, totalRooms: Number(roomType.total_units) });
}));

const saveRoom = wrap(async (req, res) => {
  const { name, category, price, capacity, totalUnits, isActive, image, bed, description } = req.body;
  const text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
  let validImage = !image;
  if (text(image, 2048)) {
    try { validImage = new URL(image).protocol === "https:"; } catch {}
  }
  if (!text(name, 100) || !text(category, 30) || !validImage ||
      !Number.isFinite(price) || price < 0 || price > 99999999 ||
      !Number.isInteger(capacity) || capacity < 1 || capacity > 255 ||
      !Number.isInteger(totalUnits) || totalUnits < 0 || totalUnits > 65535 ||
      (bed && !text(bed, 100)) || (description && !text(description, 1000))) {
    return res.status(400).json({ message: "Enter valid room details and an HTTPS photo URL if provided." });
  }
  const values = [name.trim(), category.trim(), price, capacity, totalUnits, isActive === false ? 0 : 1,
    image ? image.trim() : null, bed ? bed.trim() : null, description ? description.trim() : null];
  try {
    if (req.params.id) {
      const [result] = await pool.query(
        "UPDATE room_types SET name=?, category=?, price=?, capacity=?, total_units=?, is_active=?, image=?, bed=?, description=? WHERE id=?",
        [...values, req.params.id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Room not found." });
      return res.json({ message: "Room updated." });
    }
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 34).replace(/^-|-$/g, "");
    const [result] = await pool.query(
      "INSERT INTO room_types (slug,name,category,price,capacity,total_units,is_active,image,bed,description) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [(slug || "room") + "-" + randomBytes(5).toString("hex"), ...values]
    );
    res.status(201).json({ id: result.insertId, message: "Room created." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A room type with that name already exists." });
    throw error;
  }
});
app.post("/api/rooms", account, admin, saveRoom);
app.put("/api/rooms/:id", account, admin, saveRoom);

app.get("/api/vouchers", account, admin, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
            valid_until AS validUntil, is_active AS isActive
     FROM vouchers ORDER BY created_at DESC`
  );
  res.json(rows);
}));

app.get("/api/vouchers/check", wrap(async (req, res) => {
  const voucher = await lookupVoucher(pool, req.query.code);
  if (!voucher) return res.status(404).json({ message: "This discount code is not valid." });
  const base = Number(req.query.amount) || 0;
  res.json({
    code: voucher.code,
    discountType: voucher.discount_type,
    discountValue: Number(voucher.discount_value),
    discountAmount: computeDiscount(voucher, base),
  });
}));

app.post("/api/vouchers", account, admin, wrap(async (req, res) => {
  const { code, discountType = "percent", discountValue, validUntil = null } = req.body;
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(cleanCode))
    return res.status(400).json({ message: "Code must be 3 to 40 letters or numbers." });
  if (!["percent", "fixed"].includes(discountType))
    return res.status(400).json({ message: "Invalid discount type." });
  const value = Number(discountValue);
  if (!(value > 0) || (discountType === "percent" && value > 100))
    return res.status(400).json({ message: "Invalid discount value." });
  try {
    await pool.query(
      "INSERT INTO vouchers (code, discount_type, discount_value, valid_until) VALUES (?,?,?,?)",
      [cleanCode, discountType, value, validUntil || null]
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "This code already exists." });
    throw err;
  }
  res.status(201).json({ message: "Voucher created." });
}));

app.patch("/api/vouchers/:id", account, admin, wrap(async (req, res) => {
  const [r] = await pool.query("UPDATE vouchers SET is_active = ? WHERE id = ?", [
    req.body.isActive ? 1 : 0,
    req.params.id,
  ]);
  if (!r.affectedRows) return res.status(404).json({ message: "Voucher not found." });
  res.json({ message: "Voucher updated." });
}));

app.delete("/api/vouchers/:id", account, admin, wrap(async (req, res) => {
  const [r] = await pool.query("DELETE FROM vouchers WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Voucher not found." });
  res.json({ message: "Voucher deleted." });
}));

app.get("/api/reservations", account, privateList, wrap(async (req, res) => {
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
  const [rows] = email
    ? await pool.query(`${RESERVATION_SELECT} WHERE LOWER(r.email) = ? ORDER BY r.created_at DESC`, [email])
    : await pool.query(`${RESERVATION_SELECT} ORDER BY r.created_at DESC`);
  res.json(rows.map(parseReservation));
}));

function bookingOwner(req, res, next) {
  if (typeof req.body.email === "string" && req.body.email.trim().toLowerCase() === req.account.email.toLowerCase()) return next();
  return admin(req, res, next);
}

app.post("/api/reservations", account, bookingOwner, wrap(async (req, res) => {
  const { guestName, email, phone, roomType, checkIn, checkOut,
    guests = 1, paymentMethod = "GCash", paymentReference = null,
    voucherCode = null, notes = null, extraIds = [], extraSelections, expectedTotal, rooms = [{ roomType, guests: Number(guests), quantity: 1 }] } = req.body;

  if (!guestName || !email || !phone || !checkIn || !checkOut) {
    return res.status(400).json({ message: "Missing required fields." });
  }
  if (!PAYMENTS.includes(paymentMethod)) return res.status(400).json({ message: "Invalid payment method." });
  if (paymentMethod === "GCash" && String(paymentReference || "").trim().length < 6) {
    return res.status(400).json({ message: "Enter the GCash reference number from your payment." });
  }
  const validDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(checkIn) || !validDate(checkOut) || checkIn >= checkOut) {
    return res.status(400).json({ message: "Choose valid stay dates. Check-out must follow check-in." });
  }
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Array.isArray(rooms) || !rooms.length || rooms.length > 20 || rooms.some((item) =>
      !item || typeof item.roomType !== "string" || !item.roomType.trim() ||
      !Number.isInteger(item.guests) || item.guests < 1 || !Number.isInteger(item.quantity) || item.quantity < 1
    ) || rooms.reduce((total, item) => total + item.quantity, 0) > 20) {
    return res.status(400).json({ message: "Select between 1 and 20 rooms and enter a valid guest count." });
  }

  if (rooms.some((item) => {
    if (item.guestNames === undefined) return item.guests > 1;
    return !Array.isArray(item.guestNames) || item.quantity !== 1 || item.guestNames.length !== item.guests ||
      item.guestNames.some((name) => typeof name !== "string" || !name.trim() || name.trim().length > 100);
  })) {
    return res.status(400).json({ message: "Enter the full name of each guest staying in every room." });
  }

  const extrasRequested = extraSelections ?? (Array.isArray(extraIds) ? [...new Set(extraIds)].map((id) => ({ id, quantity: 1 })) : null);
  if (expectedTotal !== undefined && (typeof expectedTotal !== "number" || !Number.isFinite(expectedTotal) || expectedTotal < 0)) {
    return res.status(400).json({ message: "Invalid checkout total." });
  }
  const conn = await pool.getConnection();
  const ids = [];
  let totalCents = 0;
  try {
    await conn.beginTransaction();
    // Lock room types in ID order so overlapping guest checkouts serialize consistently.
    const [catalog] = await conn.query(
      "SELECT id, name, price, capacity, total_units FROM room_types WHERE is_active = 1 AND name IN (?) ORDER BY id FOR UPDATE",
      [rooms.map((room) => room.roomType)]
    );
    const selections = rooms.map((item) => ({
      ...item,
      room: catalog.find((room) => room.name.toLowerCase() === item.roomType.toLowerCase()),
    }));
    if (selections.some((item) => !item.room || item.guests > item.room.capacity)) {
      await conn.rollback();
      return res.status(400).json({ message: "A room is unavailable or exceeds its guest capacity." });
    }

    for (const room of catalog) {
      const requested = selections.filter((item) => item.room.id === room.id).reduce((count, item) => count + item.quantity, 0);
      const [overlaps] = await conn.query(`SELECT check_in, COALESCE(actual_check_out, check_out) AS check_out FROM reservations
        WHERE room_type_id = ? AND status = 'Confirmed' AND check_in < ? AND COALESCE(actual_check_out, check_out) > ?`,
      [room.id, checkOut, checkIn]);
      const events = new Map([[checkIn, 0]]);
      for (const stay of overlaps) {
        const start = stay.check_in < checkIn ? checkIn : stay.check_in;
        events.set(start, (events.get(start) || 0) + 1);
        events.set(stay.check_out, (events.get(stay.check_out) || 0) - 1);
      }
      let occupied = 0;
      for (const [date, change] of [...events].sort(([first], [second]) => first.localeCompare(second))) {
        if (date >= checkOut) break;
        occupied += change;
        if (occupied + requested > room.total_units) {
          await conn.rollback();
          return res.status(409).json({ message: room.name + " does not have enough rooms for those dates." });
        }
      }
    }

    let remainingDiscount = 0;
    let appliedCode = null;
    if (voucherCode) {
      const voucher = await lookupVoucher(conn, voucherCode);
      if (!voucher) {
        await conn.rollback();
        return res.status(400).json({ message: "This discount code is not valid." });
      }
      const subtotal = selections.reduce((sum, item) => sum + Number(item.room.price) * nights * item.quantity, 0);
      remainingDiscount = Math.round(computeDiscount(voucher, subtotal) * 100);
      appliedCode = voucher.code;
    }

    for (const { room, guests, quantity, guestNames } of selections) {
      const extras = await priceExtras(conn, extrasRequested, nights, guests);
      if (!extras) {
        await conn.rollback();
        return res.status(400).json({ message: "An extra service is unavailable. Reopen the reservation form to see current services." });
      }
      const base = Math.round(Number(room.price) * nights * 100);
      const extraCents = extras.reduce((sum, extra) => sum + Math.round(extra.amount * 100), 0);
      for (let index = 0; index < quantity; index++) {
        const discount = Math.min(base, remainingDiscount);
        remainingDiscount -= discount;
        const roomTotal = base - discount + extraCents;
        totalCents += roomTotal;
        const total = roomTotal / 100;
        const code = "RES-" + randomBytes(6).toString("hex").toUpperCase();
        const [result] = await conn.query(`INSERT INTO reservations
          (reservation_code, room_type_id, guest_name, email, phone, check_in, check_out,
           guests, nights, total_amount, payment_method, payment_reference, voucher_code,
           discount_amount, status, notes, extras_snapshot, guest_names)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'Pending', ?, ?, ?)`,
          [code, room.id, guestName, email.trim(), phone, checkIn, checkOut, guests, nights, total,
            paymentMethod, paymentMethod === "GCash" ? String(paymentReference).trim() : null,
            appliedCode, discount / 100, notes, JSON.stringify(extras), JSON.stringify(guestNames ? guestNames.map((name) => name.trim()) : [guestName.trim()])]);
        ids.push(result.insertId);
      }
    }
    if (expectedTotal !== undefined && Math.round(expectedTotal * 100) !== totalCents) {
      await conn.rollback();
      return res.status(409).json({ message: "Room or service prices changed. Reopen the booking to review current prices before submitting." });
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const reservations = await Promise.all(ids.map(findReservation));
  const [reservation] = reservations;
  sendEmail(
    reservation.email,
    reservations.length === 1 ? "Booking received: " + reservation.code : "Room reservations received",
    emailLayout(
      "We received your booking",
      "The hotel will review your reservation and email you when it is confirmed.",
      reservations.flatMap((item) => reservationRows(item, null)),
      "You can see your booking status and open receipts in Profile."
    )
  );
  res.status(201).json({ id: reservation.id, code: reservation.code, reservation, reservations });
}));

app.put("/api/reservations/:id", account, admin, wrap(async (req, res) => {
  const { guestName, email, phone, roomType, checkIn, checkOut, totalAmount, status, roomNumber } = req.body;
  if (!guestName || !email || !phone || !roomType || !checkIn || !checkOut)
    return res.status(400).json({ message: "Missing required fields." });
  if (status && !STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (!Number.isFinite(nights) || nights < 1)
    return res.status(400).json({ message: "Check-out must be after check-in." });

  const [[room]] = await pool.query("SELECT id FROM room_types WHERE name = ?", [roomType]);
  if (!room) return res.status(400).json({ message: "Unknown room type." });

  const cleanRoomNumber = roomNumber ? String(roomNumber).trim() : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (status === "Confirmed") {
      if (!cleanRoomNumber) {
        await connection.rollback();
        return res.status(400).json({ message: "Assign a room number before confirming." });
      }
      if (!(await hasConfirmedCapacity(connection, room.id, checkIn, checkOut, req.params.id)) ||
          await roomNumberTaken(cleanRoomNumber, checkIn, checkOut, req.params.id, connection)) {
        await connection.rollback();
        return res.status(409).json({ message: "This room type or room number is fully booked for the requested dates." });
      }
    }
    const [result] = await connection.query(
      `UPDATE reservations SET guest_name = ?, email = ?, phone = ?, room_type_id = ?, check_in = ?,
              check_out = ?, nights = ?, total_amount = ?, status = ?, room_number = ?
       WHERE id = ? AND actual_check_out IS NULL`,
      [guestName, email, phone, room.id, checkIn, checkOut, nights, Number(totalAmount) || 0,
       status || "Pending", cleanRoomNumber, req.params.id]
    );
    await connection.commit();
    if (!result.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json({ message: "Reservation updated." });
}));

async function hasConfirmedCapacity(connection, roomId, checkIn, checkOut, excludeId) {
  const [[room]] = await connection.query("SELECT total_units FROM room_types WHERE id = ? FOR UPDATE", [roomId]);
  const [stays] = await connection.query(`SELECT check_in, COALESCE(actual_check_out, check_out) AS check_out FROM reservations
    WHERE room_type_id = ? AND id <> ? AND status = 'Confirmed'
    AND check_in < ? AND COALESCE(actual_check_out, check_out) > ?`, [roomId, excludeId, checkOut, checkIn]);
  return Number(room?.total_units) > 0 && [checkIn, ...stays.map((stay) => stay.check_in).filter((date) => date > checkIn)]
    .every((date) => stays.filter((stay) => stay.check_in <= date && stay.check_out > date).length < room.total_units);
}

app.patch("/api/reservations/:id/status", account, admin, wrap(async (req, res) => {
  const { status, roomNumber, expectedStatus } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const current = await findReservation(req.params.id);
  if (!current) return res.status(404).json({ message: "Reservation not found." });
  if (current.actualCheckOut) return res.status(409).json({ message: "This reservation has already checked out." });
  if (expectedStatus !== undefined && current.status !== expectedStatus) {
    return res.status(409).json({ message: "This reservation has already changed. Refresh and try again." });
  }

  let finalRoomNumber = roomNumber ? String(roomNumber).trim() : current.roomNumber;
  if (status === "Confirmed") {
    if (!finalRoomNumber) return res.status(400).json({ message: "Assign a room number before confirming." });
  }
  if (status === "Cancelled") finalRoomNumber = current.roomNumber;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (status === "Confirmed" && !(await hasConfirmedCapacity(connection, current.roomId, current.checkIn, current.checkOut, current.id))) {
      await connection.rollback();
      return res.status(409).json({ message: "This room type is fully booked for the requested dates." });
    }
    if (status === "Confirmed" && await roomNumberTaken(finalRoomNumber, current.checkIn, current.checkOut, current.id, connection)) {
      await connection.rollback();
      return res.status(409).json({ message: "That room number is already assigned for the requested dates." });
    }
    const [updatedStatus] = await connection.query(
      "UPDATE reservations SET status = ?, room_number = ? WHERE id = ? AND status = ? AND room_type_id = ? AND check_in = ? AND check_out = ? AND actual_check_out IS NULL",
      [status, finalRoomNumber || null, current.id, current.status, current.roomId, current.checkIn, current.checkOut]
    );
    await connection.commit();
    if (!updatedStatus.affectedRows) return res.status(409).json({ message: "The reservation changed. Refresh and try again." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (status !== current.status) {
    const updated = { ...current, status };
    if (status === "Confirmed") {
      sendEmail(
        current.email,
        `Booking confirmed: ${current.code}`,
        emailLayout(
          "Your booking is confirmed",
          `Your room is ${finalRoomNumber}. We look forward to welcoming you.`,
          reservationRows(updated, finalRoomNumber),
          "Please show this email or your booking reference at check-in."
        )
      );
    } else if (status === "Cancelled") {
      sendEmail(
        current.email,
        `Booking cancelled: ${current.code}`,
        emailLayout(
          "Your booking was cancelled",
          "If this is a mistake, please contact the hotel.",
          reservationRows(updated, current.roomNumber),
          ""
        )
      );
    }
  }
  res.json({ message: "Status updated." });
}));

app.patch("/api/reservations/:id/early-checkout", account, admin, wrap(async (req, res) => {
  const [result] = await pool.query(
    "UPDATE reservations SET actual_check_out = DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR) " +
    "WHERE id = ? AND status = 'Confirmed' AND actual_check_out IS NULL " +
    "AND check_in <= DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR) AND check_out > DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR)",
    [req.params.id]
  );
  if (!result.affectedRows) return res.status(409).json({ message: "Only an active confirmed stay can check out early." });
  const reservation = await findReservation(req.params.id);
  res.json({ message: "Early checkout recorded.", reservation });
}));

app.patch("/api/reservations/:id/payment", account, admin, wrap(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return res.status(400).json({ message: "Invalid payment status." });
  const [r] = await pool.query("UPDATE reservations SET payment_status = ? WHERE id = ?", [paymentStatus, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Payment updated." });
}));

app.delete("/api/reservations/:id", account, admin, wrap(async (req, res) => {
  const [r] = await pool.query("DELETE FROM reservations WHERE id = ?", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Reservation deleted." });
}));

const ORDER_SELECT = `
  SELECT id, order_code AS code, guest_name AS guestName, email, phone, room_number AS roomNumber,
         items, total_amount AS totalAmount, notes, status, created_at AS createdAt,
         UNIX_TIMESTAMP(created_at) AS createdEpoch, UNIX_TIMESTAMP(served_at) AS servedEpoch
  FROM food_orders`;

const parseOrder = (row) => {
  let items = [];
  try { items = Array.isArray(row.items) ? row.items : JSON.parse(row.items); } catch (e) { items = []; }
  return { ...row, items };
};

app.get("/api/orders", account, privateList, wrap(async (req, res) => {
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
  const [rows] = email
    ? await pool.query(`${ORDER_SELECT} WHERE LOWER(email) = ? ORDER BY created_at DESC`, [email])
    : await pool.query(`${ORDER_SELECT} ORDER BY created_at DESC`);
  res.json(rows.map(parseOrder));
}));

app.post("/api/orders", account, bookingOwner, wrap(async (req, res) => {
  const { guestName, email, phone, roomNumber = null, items, notes = null } = req.body;
  if (!guestName || !email || !phone) return res.status(400).json({ message: "Missing required fields." });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Your order is empty." });

  const connection = await pool.getConnection();
  let result;
  try {
    await connection.beginTransaction();
    const cleanItems = await menuOrderLines(connection, items);
    if (!cleanItems) {
      await connection.rollback();
      return res.status(409).json({ message: "An item is unavailable or your cart is out of date. Check the dining menu and try again." });
    }
    const totalCents = cleanItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
    if (req.body.expectedTotal !== undefined && Math.round(Number(req.body.expectedTotal) * 100) !== totalCents) {
      await connection.rollback();
      return res.status(409).json({ message: "Menu prices changed. Review the updated cart and submit again." });
    }
    const code = "ORD-" + randomBytes(6).toString("hex").toUpperCase();
    [result] = await connection.query(
      "INSERT INTO food_orders (order_code, guest_name, email, phone, room_number, items, total_amount, notes) VALUES (?,?,?,?,?,?,?,?)",
      [code, guestName, email, phone, roomNumber || null, JSON.stringify(cleanItems), totalCents / 100, notes]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const [[row]] = await pool.query(`${ORDER_SELECT} WHERE id = ?`, [result.insertId]);
  const order = parseOrder(row);
  sendEmail(
    order.email,
    `Food order received: ${order.code}`,
    emailLayout(
      "We received your food order",
      "The kitchen will prepare it shortly. Pay when your order is served.",
      [
        ["Order reference", order.code],
        ["Deliver to", order.roomNumber || "Not specified"],
        ...order.items.map((i) => [`${i.qty} x ${i.title}`, peso(i.price * i.qty)]),
        ["Total", peso(order.totalAmount)],
        ["Special requests", order.notes || "None"],
      ],
      ""
    )
  );
  res.status(201).json(order);
}));

app.patch("/api/orders/:id/status", account, admin, wrap(async (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status." });
  const [r] = await pool.query(
    "UPDATE food_orders SET served_at=IF(?='Served' AND status<>'Served',CURRENT_TIMESTAMP,served_at), status=? " +
    "WHERE id=? AND (status NOT IN ('Cancelled','Served') OR status=?)",
    [status, status, req.params.id, status]
  );
  if (!r.affectedRows) return res.status(409).json({ message: "This order has already been closed or no longer exists. Refresh the list." });
  res.json({ message: "Order updated." });
}));

app.get("/api/admin/notifications", account, admin, wrap(async (_req, res) => {
  const [[bookings], [orders]] = await Promise.all([
    pool.query("SELECT id, 'reservation' AS kind, reservation_code AS code, guest_name AS guestName, UNIX_TIMESTAMP(created_at) AS createdAt FROM reservations ORDER BY created_at DESC, id DESC LIMIT 30"),
    pool.query("SELECT id, 'order' AS kind, order_code AS code, guest_name AS guestName, UNIX_TIMESTAMP(created_at) AS createdAt FROM food_orders ORDER BY created_at DESC, id DESC LIMIT 30"),
  ]);
  const items = [...bookings, ...orders].sort((first, second) =>
    Number(second.createdAt) - Number(first.createdAt) || Number(second.id) - Number(first.id)).slice(0, 30);
  res.set("Cache-Control", "no-store").json(items);
}));

registerGuestFeatures(app, wrap);
registerMenu(app, wrap, account, admin);

process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e));

pool.query("SELECT 1")
  .then(() => initializeKeys())
  .then(() => initializeGuestFeatures())
  .then(() => initializeMenu())
  .then(() => {
    const port = Number(process.env.PORT || 8080);
    return app.listen(port, () => console.log("Server running on port " + port + ", DB connected"));
  })
  .catch((e) => { console.error("Cannot connect to MySQL. Is it started in XAMPP?\n", e.message); process.exit(1); });
