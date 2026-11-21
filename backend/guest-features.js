const pool = require("./db");

const firebaseKey = process.env.FIREBASE_WEB_API_KEY || "AIzaSyCzydINVn-Gio9P13K4vsYEBAljbiiRLeg";
const project = process.env.FIREBASE_PROJECT_ID || "hotel-reservation-d7595";

async function account(req, res, next) {
  const token = req.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return res.status(401).json({ message: "Sign in to continue." });
  try {
    const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + firebaseKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 500) throw new Error("Firebase unavailable");
    const user = response.ok && (await response.json()).users?.[0];
    if (!user?.email || user.disabled) return res.status(401).json({ message: "Please sign in again." });
    req.account = user;
    return next();
  } catch {
    return res.status(503).json({ message: "Account verification is temporarily unavailable." });
  }
}

async function admin(req, res, next) {
  try {
    const response = await fetch("https://firestore.googleapis.com/v1/projects/" + project +
      "/databases/(default)/documents/users/" + encodeURIComponent(req.account.localId), {
      headers: { Authorization: req.get("authorization") },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 500) throw new Error("Firestore unavailable");
    const profile = response.ok && await response.json();
    if (profile?.fields?.role?.stringValue?.toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Admin access is required." });
    }
    return next();
  } catch {
    return res.status(503).json({ message: "Admin verification is temporarily unavailable." });
  }
}

function verifiedEmail(req, res, next) {
  if (!req.account.emailVerified) {
    return res.status(403).json({ message: "Verify your email before managing bookings or food orders." });
  }
  next();
}

function privateList(req, res, next) {
  if (req.query.email === undefined) return admin(req, res, next);
  return verifiedEmail(req, res, () => {
    if (String(req.query.email).toLowerCase() !== req.account.email.toLowerCase()) {
      return res.status(403).json({ message: "This account cannot access those records." });
    }
    next();
  });
}

const extraSelect = "SELECT id, name, description, price, unit, is_active AS active FROM hotel_extras";
const units = new Set(["stay", "night", "guest", "item"]);

async function initializeGuestFeatures() {
  await pool.query(`CREATE TABLE IF NOT EXISTS guest_directory_profiles (
    uid VARCHAR(128) PRIMARY KEY, email VARCHAR(160) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL,
    photo MEDIUMTEXT NULL
  ) CHARACTER SET utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hotel_extras (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, description VARCHAR(1000) NOT NULL,
    price DECIMAL(10,2) NOT NULL, unit VARCHAR(12) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hotel_reviews (
    uid VARCHAR(128) PRIMARY KEY, display_name VARCHAR(100) NOT NULL,
    hotel_rating TINYINT NOT NULL, service_rating TINYINT NOT NULL,
    comment VARCHAR(1000) NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS stay_reviews (
    reservation_id INT UNSIGNED PRIMARY KEY, uid VARCHAR(128) NOT NULL,
    reservation_code VARCHAR(20) NOT NULL, room_type VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL, hotel_rating TINYINT NOT NULL, service_rating TINYINT NOT NULL,
    comment VARCHAR(1000) NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4`);
  const [roomColumns] = await pool.query("SHOW COLUMNS FROM room_types");
  for (const [field, type] of [["image", "VARCHAR(2048)"], ["bed", "VARCHAR(100)"], ["description", "VARCHAR(1000)"]]) {
    if (!roomColumns.some((column) => column.Field === field)) {
      try {
        await pool.query("ALTER TABLE room_types ADD COLUMN ?? " + type + " NULL", [field]);
      } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") throw error;
      }
    }
  }
  const [columns] = await pool.query("SHOW COLUMNS FROM reservations");
  for (const [field, type] of [["extras_snapshot", "JSON"], ["actual_check_out", "DATE"], ["guest_names", "JSON"]]) {
    if (columns.some((column) => column.Field === field)) continue;
    try {
      await pool.query("ALTER TABLE reservations ADD COLUMN ?? " + type + " NULL", [field]);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }

}

async function priceExtras(conn, selections, nights, guests) {
  if (!Array.isArray(selections) || selections.length > 30 || selections.some((item) =>
    !item || !Number.isSafeInteger(item.id) || item.id < 1 ||
    !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20
  )) return null;
  const quantities = new Map(selections.map(({ id, quantity }) => [id, quantity]));
  if (quantities.size !== selections.length) return null;
  if (!quantities.size) return [];
  const [rows] = await conn.query(extraSelect + " WHERE is_active = 1 AND id IN (?)", [[...quantities.keys()]]);
  if (rows.length !== quantities.size) return null;
  return rows.map(({ id, name, price, unit }) => {
    const quantity = { night: nights, guest: guests, item: quantities.get(id), stay: 1 }[unit];
    return { id, name, price: Number(price), unit, quantity, amount: Math.round(Number(price) * quantity * 100) / 100 };
  });
}

function registerGuestFeatures(app, wrap) {
  async function listReviews(adminView) {
    const [legacy, stays] = await Promise.all([
      pool.query(`SELECT CONCAT('legacy-',uid) AS id, display_name AS name, hotel_rating AS hotelRating,
        service_rating AS serviceRating, comment, updated_at AS updatedAt, NULL AS roomType
        FROM hotel_reviews ORDER BY updated_at DESC`),
      pool.query(`SELECT CONCAT('stay-',reservation_id) AS id, display_name AS name, hotel_rating AS hotelRating,
        service_rating AS serviceRating, comment, updated_at AS updatedAt, room_type AS roomType, reservation_code AS reservationCode
        FROM stay_reviews ORDER BY updated_at DESC`),
    ]);
    const rows = [...legacy[0], ...stays[0]].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (adminView) return rows;
    return rows.slice(0, 50).map(({ id, reservationCode, ...review }) => review);
  }

  app.get("/api/reviews", wrap(async (_req, res) => res.json(await listReviews(false))));

  app.put("/api/guest/directory-profile", account, verifiedEmail, wrap(async (req, res) => {
    const { name, photoURL } = req.body;
    const photo = typeof photoURL === "string" ? photoURL : "";
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        (photo && !(photo.length <= 120000 && (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) ||
          (photo.length <= 2048 && /^https:\/\//i.test(photo)))))) {
      return res.status(400).json({ message: "Invalid directory profile." });
    }
    await pool.query(
      "INSERT INTO guest_directory_profiles (uid,email,name,photo) VALUES (?,?,?,?) " +
      "ON DUPLICATE KEY UPDATE uid=VALUES(uid),email=VALUES(email),name=VALUES(name),photo=VALUES(photo)",
      [req.account.localId, req.account.email.trim().toLowerCase(), name.trim(), photo || null]
    );
    res.sendStatus(204);
  }));

  app.get("/api/admin/client-profile", account, admin, wrap(async (req, res) => {
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    if (!email || email.length > 160) return res.status(400).json({ message: "Select a client email." });
    const [[profile], [orders]] = await Promise.all([
      pool.query("SELECT name, photo AS photoURL FROM guest_directory_profiles WHERE email=?", [email]),
      pool.query("SELECT order_code AS code, items, total_amount AS total, status, created_at AS createdAt FROM food_orders WHERE LOWER(email)=? ORDER BY created_at DESC,id DESC", [email]),
    ]);
    res.set("Cache-Control", "no-store").json({
      profile: profile[0] || null,
      orders: orders.map((order) => ({ ...order, items: Array.isArray(order.items) ? order.items : JSON.parse(order.items) })),
    });
  }));

  app.get("/api/admin/reviews", account, admin, wrap(async (_req, res) => {
    res.set("Cache-Control", "no-store").json(await listReviews(true));
  }));

  app.get("/api/reviews/mine", account, verifiedEmail, wrap(async (req, res) => {
    const [stays] = await pool.query(`SELECT r.id, r.reservation_code AS code, t.name AS roomType,
      r.check_in AS checkIn, COALESCE(r.actual_check_out,r.check_out) AS checkOut,
      s.hotel_rating AS hotelRating, s.service_rating AS serviceRating, s.comment
      FROM reservations r JOIN room_types t ON t.id=r.room_type_id
      LEFT JOIN stay_reviews s ON s.reservation_id=r.id
      WHERE LOWER(r.email)=? AND r.status='Confirmed'
      AND COALESCE(r.actual_check_out,r.check_out)<=DATE(UTC_TIMESTAMP()+INTERVAL 8 HOUR)
      AND (s.uid IS NULL OR s.uid=?)
      ORDER BY COALESCE(r.actual_check_out,r.check_out) DESC,r.id DESC`,
    [req.account.email.toLowerCase(), req.account.localId]);
    res.set("Cache-Control", "no-store").json(stays);
  }));

  app.put("/api/reviews/mine/:reservationId", account, verifiedEmail, wrap(async (req, res) => {
    const { hotelRating, serviceRating, comment } = req.body;
    if (!/^\d+$/.test(req.params.reservationId) ||
        ![hotelRating, serviceRating].every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5) ||
        typeof comment !== "string" || comment.trim().length > 1000) {
      return res.status(400).json({ message: "Select a stay and both star ratings. Comments may be up to 1,000 characters." });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[stay]] = await connection.query(`SELECT r.id, r.reservation_code AS code, t.name AS roomType
        FROM reservations r JOIN room_types t ON t.id=r.room_type_id
        WHERE r.id=? AND LOWER(r.email)=? AND r.status='Confirmed'
        AND COALESCE(r.actual_check_out,r.check_out)<=DATE(UTC_TIMESTAMP()+INTERVAL 8 HOUR) FOR UPDATE`,
      [req.params.reservationId, req.account.email.toLowerCase()]);
      if (!stay) {
        await connection.rollback();
        return res.status(403).json({ message: "You can review your own confirmed stays after checkout." });
      }
      const [[existing]] = await connection.query("SELECT uid FROM stay_reviews WHERE reservation_id=?", [stay.id]);
      if (existing && existing.uid !== req.account.localId) {
        await connection.rollback();
        return res.status(409).json({ message: "This stay already has a review." });
      }
      const name = String(req.account.displayName || "Hotel guest").trim().slice(0, 100);
      await connection.query(`INSERT INTO stay_reviews (reservation_id,uid,reservation_code,room_type,display_name,hotel_rating,service_rating,comment)
        VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),hotel_rating=VALUES(hotel_rating),
        service_rating=VALUES(service_rating),comment=VALUES(comment)`,
      [stay.id, req.account.localId, stay.code, stay.roomType, name, hotelRating, serviceRating, comment.trim()]);
      await connection.commit();
      res.json({ message: existing ? "Stay review updated." : "Stay review published." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }));

  app.get("/api/extras", wrap(async (_req, res) => {
    const [rows] = await pool.query(extraSelect + " WHERE is_active = 1 ORDER BY name");
    res.json(rows);
  }));
  app.get("/api/admin/extras", account, admin, wrap(async (_req, res) => {
    const [rows] = await pool.query(extraSelect + " ORDER BY name");
    res.json(rows);
  }));

  const saveExtra = wrap(async (req, res) => {
    const { name, description, price, unit, active } = req.body;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        typeof description !== "string" || description.trim().length > 1000 ||
        typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 999999 ||
        !units.has(unit) || typeof active !== "boolean") {
      return res.status(400).json({ message: "Enter a valid service name, price and billing unit." });
    }
    const values = [name.trim(), description.trim(), price, unit, active];
    if (req.params.id) {
      const [result] = await pool.query(
        "UPDATE hotel_extras SET name = ?, description = ?, price = ?, unit = ?, is_active = ? WHERE id = ?",
        [...values, req.params.id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Service not found." });
    } else {
      await pool.query("INSERT INTO hotel_extras (name, description, price, unit, is_active) VALUES (?, ?, ?, ?, ?)", values);
    }
    res.json({ message: "Service saved." });
  });
  app.post("/api/admin/extras", account, admin, saveExtra);
  app.put("/api/admin/extras/:id", account, admin, saveExtra);

  app.patch("/api/guest/reservations/:id/cancel", account, verifiedEmail, wrap(async (req, res) => {
    const [result] = await pool.query(`UPDATE reservations SET status = 'Cancelled'
      WHERE id = ? AND LOWER(email) = ? AND status IN ('Pending', 'Confirmed')
      AND actual_check_out IS NULL AND payment_status = 'Unpaid' AND payment_method = 'Cash' AND check_in > DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR)`,
    [req.params.id, req.account.email.toLowerCase()]);
    if (!result.affectedRows) return res.status(409).json({ message: "This booking is no longer eligible for online cancellation. Contact the hotel for help." });
    res.json({ message: "Booking cancelled." });
  }));

  app.patch("/api/guest/orders/:id/cancel", account, verifiedEmail, wrap(async (req, res) => {
    const [result] = await pool.query(`UPDATE food_orders SET status = 'Cancelled'
      WHERE id = ? AND LOWER(email) = ? AND status = 'Pending'`,
    [req.params.id, req.account.email.toLowerCase()]);
    if (!result.affectedRows) return res.status(409).json({ message: "This order is no longer eligible for online cancellation." });
    res.json({ message: "Food order cancelled." });
  }));
}

module.exports = { account, admin, privateList, initializeGuestFeatures, priceExtras, registerGuestFeatures };
