import { useCallback, useEffect, useState } from "react";
import { accountFetch, readJson, formatPeso, extraUnits } from "../hotel-api";

const emptyExtra = { name: "", description: "", price: "", unit: "stay", active: true };

export default function AdminExtras({ api }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await readJson(await accountFetch(api + "/admin/extras")));
    } catch (error) {
      setMessage(error.message);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  const set = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await readJson(await accountFetch(api + "/admin/extras" + (form.id ? "/" + form.id : ""), {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price), active: Boolean(form.active) }),
      }));
      setForm(null);
      setMessage("Service saved.");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hotel-glass admin-extras">
      <h3>Extras &amp; services</h3>
      <p>Available services appear in the guest reservation form.</p>
      <button type="button" className="hotel-action" onClick={() => setForm(emptyExtra)}>Add service</button>
      {message && <p role="status">{message}</p>}
      {form && (
        <form className="hotel-glass admin-extra-form" onSubmit={save}>
          <h4>{form.id ? "Edit service" : "New service"}</h4>
          <label>Name<input required maxLength={100} value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
          <label>Description<textarea maxLength={1000} value={form.description} onChange={(event) => set("description", event.target.value)} /></label>
          <label>Price (PHP)<input type="number" min="0" max="999999" step=".01" required value={form.price} onChange={(event) => set("price", event.target.value)} /></label>
          <label>Billing unit<select value={form.unit} onChange={(event) => set("unit", event.target.value)}>
            {Object.entries(extraUnits).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => set("active", event.target.checked)} /> Available to guests</label>
          <div><button className="hotel-action" disabled={busy}>Save service</button> <button type="button" className="hotel-action secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="admin-extra-list">
        {items.map((item) => (
          <article key={item.id} className="hotel-glass">
            <h4>{item.name}</h4>
            <p>{item.description}</p>
            <p>{formatPeso(item.price)} · {extraUnits[item.unit]}</p>
            <p>{item.active ? "Available" : "Hidden"}</p>
            <button type="button" className="hotel-action secondary" onClick={() => setForm(item)}>Edit service</button>
          </article>
        ))}
      </div>
    </section>
  );
}
