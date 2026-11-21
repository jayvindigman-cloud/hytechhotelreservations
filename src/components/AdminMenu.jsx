import { useCallback, useEffect, useState } from "react";
import { accountFetch, readJson, formatPeso } from "../hotel-api";

const statuses = { available: "Available", out_of_stock: "Out of stock", unavailable: "Unavailable now" };
const blank = { title: "", category: "", price: "", image: "", desc: "", availability: "available" };

export default function AdminMenu({ api }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const load = useCallback(async () => setItems(await readJson(await fetch(api + "/menu", { cache: "no-store" }))), [api]);
  useEffect(() => { load().catch((error) => setStatus(error.message)); }, [load]);

  async function update(path, method, data, close = false) {
    setBusy(true);
    setStatus("");
    try {
      const result = await readJson(await accountFetch(api + "/menu" + path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      }));
      if (close) setForm(null);
      await load();
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-menu-manager hotel-glass" aria-labelledby="admin-menu-title">
      <header><div><h4 id="admin-menu-title">Dining menu</h4><p>Manage the items guests can order.</p></div>
        <button type="button" className="hotel-action" disabled={busy} onClick={() => setForm(blank)}>Add food</button>
      </header>
      {status && <p role="status" className="account-notice">{status}</p>}
      {form && (
        <form className="admin-menu-form" onSubmit={(event) => {
          event.preventDefault();
          update(form.id ? "/" + form.id : "", form.id ? "PUT" : "POST", { ...form, price: Number(form.price) }, true);
        }}>
          <h5>{form.id ? "Edit food" : "New food"}</h5>
          <div>
            <label>Food name<input name="title" maxLength={120} required value={form.title} onChange={change} /></label>
            <label>Category<input name="category" maxLength={45} required value={form.category} onChange={change} list="food-categories" /></label>
            <datalist id="food-categories">{[...new Set(items.map((item) => item.category))].map((name) => <option key={name} value={name} />)}</datalist>
            <label>Price (PHP)<input name="price" type="number" min=".01" step=".01" required value={form.price} onChange={change} /></label>
            <label>Availability<select name="availability" value={form.availability} onChange={change}>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>HTTPS photo URL<input name="image" type="url" maxLength={2048} value={form.image || ""} onChange={change} /></label>
            <label>Description<textarea name="desc" rows={2} maxLength={1000} value={form.desc} onChange={change} /></label>
          </div>
          <button className="hotel-action" disabled={busy}>Save food</button>{" "}
          <button type="button" className="hotel-action secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
        </form>
      )}
      <ul className="admin-menu-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.image && <img src={item.image} alt="" loading="lazy" />}
            <div><strong>{item.title}</strong><small>{item.category} · {formatPeso(item.price)}</small></div>
            <select aria-label={"Availability for " + item.title} value={item.availability} disabled={busy}
              onChange={(event) => update("/" + item.id + "/availability", "PATCH", { availability: event.target.value })}>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" className="hotel-action secondary" disabled={busy} onClick={() => setForm(item)}>Edit</button>
          </li>
        ))}
      </ul>
    </section>
  );

  function change(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }
}
