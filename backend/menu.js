const pool = require("./db");
const defaults = require("../src/data/menu.json");

const fields = "id, title, category, price, image, description AS `desc`, availability";
const statuses = new Set(["available", "out_of_stock", "unavailable"]);

async function initializeMenu() {
  const [columns] = await pool.query("SHOW COLUMNS FROM food_orders LIKE 'served_at'");
  if (!columns.length) {
    try {
      await pool.query("ALTER TABLE food_orders ADD COLUMN served_at TIMESTAMP NULL DEFAULT NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS menu_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(120) NOT NULL UNIQUE,
    category VARCHAR(45) NOT NULL, price DECIMAL(10,2) NOT NULL, image VARCHAR(2048) NULL,
    description VARCHAR(1000) NOT NULL, availability VARCHAR(20) NOT NULL DEFAULT 'available'
  ) ENGINE=InnoDB`);
  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM menu_items");
  if (count) return;
  const rows = defaults.map((item) => [item.title, item.category, Number(item.price.match(/[\d,.]+/)[0].replaceAll(",", "")), item.image, item.desc]);
  await pool.query(`INSERT IGNORE INTO menu_items (title, category, price, image, description) VALUES ?`, [rows]);
}

function registerMenu(app, wrap, account, admin) {
  app.get("/api/menu", wrap(async (_req, res) => {
    const [items] = await pool.query("SELECT " + fields + " FROM menu_items ORDER BY id");
    res.set("Cache-Control", "no-store").json(items);
  }));

  const save = wrap(async (req, res) => {
    const { title, category, price, image, desc, availability } = req.body;
    const valid = (value, size) => typeof value === "string" && value.trim() && value.trim().length <= size;
    let photo = null;
    if (image) {
      try {
        if (valid(image, 2048) && new URL(image).protocol === "https:") photo = image.trim();
      } catch {}
    }
    if (!valid(title, 120) || !valid(category, 45) || (image && !photo) ||
        typeof desc !== "string" || desc.length > 1000 || !Number.isFinite(price) ||
        price <= 0 || price > 99999999 || !statuses.has(availability)) {
      return res.status(400).json({ message: "Enter a valid item name, category, price and availability. Photos must use HTTPS." });
    }
    const values = [title.trim(), category.trim(), price, photo, desc.trim(), availability];
    try {
      if (req.params.id) {
        const [result] = await pool.query(
          "UPDATE menu_items SET title=?, category=?, price=?, image=?, description=?, availability=? WHERE id=?",
          [...values, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Menu item not found." });
        return res.json({ message: "Menu item updated." });
      }
      const [result] = await pool.query(
        "INSERT INTO menu_items (title, category, price, image, description, availability) VALUES (?, ?, ?, ?, ?, ?)", values
      );
      res.status(201).json({ id: result.insertId, message: "Food added to the menu." });
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") throw error;
      res.status(409).json({ message: "A food item with that name already exists." });
    }
  });
  app.post("/api/menu", account, admin, save);
  app.put("/api/menu/:id", account, admin, save);

  app.patch("/api/menu/:id/availability", account, admin, wrap(async (req, res) => {
    const { availability } = req.body;
    if (!statuses.has(availability)) return res.status(400).json({ message: "Choose a valid availability status." });
    const [result] = await pool.query("UPDATE menu_items SET availability=? WHERE id=?", [availability, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Menu item not found." });
    res.json({ message: "Availability updated." });
  }));
}

async function menuOrderLines(connection, items) {
  if (!Array.isArray(items) || !items.length || items.length > 50 || items.some((item) =>
    !item || !Number.isSafeInteger(item.id) || item.id < 1 || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50
  )) return null;
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) return null;
  const [rows] = await connection.query("SELECT " + fields + " FROM menu_items WHERE id IN (?) ORDER BY id FOR UPDATE", [[...ids]]);
  if (rows.length !== items.length || rows.some((item) => item.availability !== "available")) return null;
  const byId = new Map(rows.map((item) => [item.id, item]));
  return items.map(({ id, qty }) => {
    const { title, image, price } = byId.get(id);
    return { id, title, image, price: Number(price), qty };
  });
}

module.exports = { initializeMenu, registerMenu, menuOrderLines };
