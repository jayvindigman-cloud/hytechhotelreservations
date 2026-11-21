import { useEffect, useRef, useState } from "react";
import { API_BASE, accountFetch, hotelToday, readJson } from "../hotel-api";
import AdminIcon from "./AdminIcon";
import "./AdminKeysTab.css";

const API = API_BASE + "/keys";
const actionsByStatus = {
  Available: ["Assign", "Issue", "Lost", "Maintenance", "Delete"],
  Assigned: ["Issue", "Release", "Lost"],
  Issued: ["Return", "Lost"],
  Lost: ["Restore", "Delete"],
  Maintenance: ["Restore", "Delete"],
};
const actionLabels = {
  Assign: "Assign to guest", Issue: "Hand over", Return: "Record return", Release: "Release assignment",
  Lost: "Mark lost", Maintenance: "Mark damaged", Restore: "Mark available", Delete: "Delete key",
};
const statusLabel = (status) => status === "Maintenance" ? "Damaged" : status;
const emptyForm = { keyTag: "", roomNumber: "" };
const formatTime = (value) => value ? new Date(value.replace(" ", "T")).toLocaleString("en-PH") : "";

export default function AdminKeysTab({ reservations }) {
  const [data, setData] = useState({ keys: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [reservationId, setReservationId] = useState("");
  const [notes, setNotes] = useState("");
  const dialog = useRef(null);

  async function load() {
    setLoading(true);
    try {
      setData(await readJson(await accountFetch(API)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch((failure) => setError(failure.message)); }, []);

  function open(key, action) {
    setSelected({ key, action });
    setForm(emptyForm);
    setReservationId("");
    setNotes("");
    setError("");
    setMessage("");
    dialog.current.showModal();
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const { key, action } = selected;
    setBusy(true);
    setError("");
    try {
      const result = await readJson(await accountFetch(key ? API + "/" + key.id : API, {
        method: key ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { action, reservationId, notes } : form),
      }));
      dialog.current.close();
      setSelected(null);
      setMessage(action === "Assign" ? "Key assigned to the guest." : result.message);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const today = hotelToday();
  const needsBooking = selected?.action === "Assign" || (selected?.action === "Issue" && selected.key.status === "Available");
  const eligible = needsBooking ? reservations.filter((booking) => booking.status === "Confirmed" &&
    booking.checkOut > today && (selected.action !== "Issue" || booking.checkIn <= today) && String(booking.roomNumber).trim() === selected.key.roomNumber)
    .sort((first, second) => first.checkIn.localeCompare(second.checkIn)) : [];
  const items = data.keys.filter((key) => (status === "All" || key.status === status) &&
    [key.keyTag, key.roomNumber, key.holder, key.bookingCode].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const summaries = [
    ["Total keys", "Key Management", data.keys.length],
    ["Available", "Check", data.keys.filter((key) => key.status === "Available").length],
    ["Assigned / issued", "Clients", data.keys.filter((key) => ["Assigned", "Issued"].includes(key.status)).length],
    ["Lost / damaged", "Extras", data.keys.filter((key) => ["Lost", "Maintenance"].includes(key.status)).length],
  ];

  return (
    <section className="key-management" aria-label="Key management">
      <header className="key-hero hotel-glass">
        <div>
          <h3><AdminIcon name="Key Management" /> Key Management</h3>
          <p>Assign keys to upcoming guests and track handovers and returns.</p>
        </div>
        <button type="button" className="hotel-action key-add" onClick={() => open(null, "Add")}><AdminIcon name="Add" /> Add key</button>
      </header>
      {error && !selected && <p role="alert" className="account-notice">{error}</p>}
      {message && <p role="status" className="account-notice">{message}</p>}
      <div className="key-summary">
        {summaries.map(([label, icon, value]) => <div key={label} className="hotel-glass">
          <span>{label} <AdminIcon name={icon} /></span><strong>{value}</strong>
        </div>)}
      </div>
      <div className="key-filters">
        <input aria-label="Search keys" placeholder="Search key, room, guest or booking" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter key status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="All">All statuses</option>
          {Object.keys(actionsByStatus).map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}
        </select>
        <button type="button" className="hotel-action secondary" disabled={loading} onClick={() => load().catch((failure) => setError(failure.message))}>Refresh</button>
      </div>
      <div className="key-grid">
        {!items.length && <p>{loading ? "Loading keys..." : "No keys found."}</p>}
        {items.map((key) => (
          <article key={key.id} className="key-card hotel-glass" data-status={key.status}>
            <header><span className="key-card-icon"><AdminIcon name="Key Management" /></span><span className="key-state">{statusLabel(key.status)}</span></header>
            <h4>{key.keyTag}</h4>
            <p>Room {key.roomNumber}</p>
            {key.holder && <p><strong>{key.holder}</strong> {"\u00b7"} {key.bookingCode}</p>}
            {key.checkIn && <p>Stay {key.checkIn} to {key.checkOut}</p>}
            {!!key.needsAttention && <p className="account-notice">{key.status === "Issued" ? "Verify the key was returned before making it available." : "Booking ended, was cancelled, or changed rooms. Review and release this assignment."}</p>}
            {key.issuedAt && <p>Handed over {formatTime(key.issuedAt)}</p>}
            <div className="key-card-actions">
              {actionsByStatus[key.status]?.filter((action) => action !== "Issue" || key.status !== "Assigned" || (!key.needsAttention && key.checkIn && key.checkIn <= today)).map((action) => (
                <button type="button" className={"hotel-action" + (action === "Delete" ? " danger" : ["Assign", "Issue", "Return"].includes(action) ? "" : " secondary")}
                  key={action} disabled={busy} onClick={() => open(key, action)}>{actionLabels[action]}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <details className="key-history hotel-glass">
        <summary>Recent activity</summary>
        {!data.history.length && <p>No key activity recorded.</p>}
        {data.history.length > 0 && <ul>{data.history.map((item) => <li key={item.id}>
          <strong>{item.action} {"\u00b7"} {item.keyTag}</strong>
          <span>Room {item.roomNumber}{item.holder && " \u00b7 " + item.holder}</span>
          {item.notes && <span>{item.notes}</span>}
          <small>{formatTime(item.createdAt)}</small>
        </li>)}</ul>}
      </details>
      <dialog ref={dialog} className="key-dialog" aria-labelledby="key-dialog-title"
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        onClose={() => setSelected(null)}>
        <div>
          <h3 id="key-dialog-title">{selected?.key ? actionLabels[selected.action] : "Add key"}</h3>
          {selected?.key && <p>{selected.key.keyTag} {"\u00b7"} Room {selected.key.roomNumber}</p>}
          {error && <p role="alert" className="account-notice">{error}</p>}
          {selected && <form onSubmit={save}>
            {!selected.key && <>
              <label>Key tag<input required maxLength={60} value={form.keyTag} onChange={(event) => setForm({ ...form, keyTag: event.target.value })} /></label>
              <label>Room number<input required maxLength={60} value={form.roomNumber} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} /></label>
            </>}
            {needsBooking && <label>Guest reservation
              <select required value={reservationId} onChange={(event) => setReservationId(event.target.value)}>
                <option value="">Select a guest</option>
                {eligible.map((booking) => <option key={booking.dbId} value={booking.dbId}>{booking.guestName} {"\u00b7"} {booking.checkIn} {"\u00b7"} {booking.id}</option>)}
              </select>
              {!eligible.length && <small>No eligible booking for this room. Confirm a reservation and check its assigned room and dates.</small>}
            </label>}
            {selected.action === "Delete" && <p>Remove this key from the register? Its activity history will be kept.</p>}
            {selected.key?.holder && <p>Guest: <strong>{selected.key.holder}</strong></p>}
            {selected.key && <label>Notes (optional)<textarea rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>}
            <div className="key-card-actions">
              <button type="submit" className={"hotel-action" + (selected.action === "Delete" ? " danger" : "")} disabled={busy || (needsBooking && !reservationId)}>{busy ? "Saving..." : selected.action === "Delete" ? "Delete key" : "Save"}</button>
              <button type="button" className="hotel-action secondary" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
            </div>
          </form>}
        </div>
      </dialog>
    </section>
  );
}
