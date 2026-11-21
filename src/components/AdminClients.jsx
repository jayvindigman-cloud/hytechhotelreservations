import { useEffect, useRef, useState } from "react";
import { accountFetch, formatPeso, readJson } from "../hotel-api";

const byLatest = (a, b) => Number(b.createdEpoch || 0) - Number(a.createdEpoch || 0) || Number(b.dbId) - Number(a.dbId);

export default function AdminClients({ api, reservations, onPasswordHelp, onOpenBooking }) {
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const panel = useRef(null);
  const search = query.trim().toLowerCase();
  const groups = new Map();

  for (const booking of [...reservations].sort(byLatest)) {
    const key = booking.email?.trim().toLowerCase() || booking.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(booking);
  }

  const clients = [...groups.entries()].filter(([, history]) => history.some((booking) => {
    const lastDate = booking.actualCheckOut || booking.checkOut;
    return (!fromDate || lastDate > fromDate) &&
      (!toDate || (booking.checkIn && booking.checkIn <= toDate)) &&
      [booking.guestName, booking.email, booking.phone, booking.id, ...booking.guestNames]
        .some((value) => String(value || "").toLowerCase().includes(search));
  }));
  const history = selected ? groups.get(selected) || [] : [];
  const latest = history[0];
  const email = latest?.email;

  useEffect(() => {
    if (!email) return;
    const controller = new AbortController();
    accountFetch(api + "/admin/client-profile?" + new URLSearchParams({ email }), { signal: controller.signal }).then(readJson)
      .then((result) => { if (!controller.signal.aborted) setDetail(result); })
      .catch(() => { if (!controller.signal.aborted) setError("The profile photo and food order history could not load."); });
    return () => controller.abort();
  }, [api, email]);

  function open(key) {
    setDetail(null);
    setError("");
    setSelected(key);
    panel.current.showModal();
  }

  return (
    <section className="hotel-glass admin-directory">
      <h3>Client Directory</h3>
      <input type="search" aria-label="Search client directory" placeholder="Search guest, companion, email or booking"
        value={query} onChange={(event) => setQuery(event.target.value)} />
      <fieldset className="directory-date-filter">
        <legend>Stay dates</legend>
        <label>From<input type="date" max={toDate || undefined} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>Through<input type="date" min={fromDate || undefined} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        {(fromDate || toDate) && <button type="button" className="hotel-action secondary" onClick={() => { setFromDate(""); setToDate(""); }}>Clear dates</button>}
      </fieldset>
      {!clients.length && <p>No clients match these filters.</p>}
      <ul className="directory-bookings">
        {clients.map(([key, bookings]) => {
          const booking = bookings[0];
          return <li className="hotel-glass" key={key}>
            <button type="button" className="directory-profile-button" aria-haspopup="dialog" onClick={() => open(key)}>
              <span><strong>{booking.guestName}</strong><small>{booking.email}</small></span>
              <span><strong>Latest {booking.roomType}</strong><small>{booking.checkIn} to {booking.actualCheckOut || booking.checkOut}</small></span>
              <span>{bookings.length} {bookings.length === 1 ? "booking" : "bookings"}</span>
            </button>
          </li>;
        })}
      </ul>
      <dialog ref={panel} className="directory-profile-dialog" aria-labelledby="directory-profile-title" onClose={() => setSelected(null)}
        onClick={(event) => { if (event.target === event.currentTarget) panel.current.close(); }}>
        <div className="directory-profile-content">
          <header><h3 id="directory-profile-title">Guest details</h3><button type="button" className="hotel-action secondary" autoFocus onClick={() => panel.current.close()}>Close</button></header>
          {latest && <>
            <div className="directory-profile-identity">
              {detail?.profile?.photoURL ? <img className="guest-profile-avatar" src={detail.profile.photoURL} alt="" referrerPolicy="no-referrer" />
                : <span className="guest-profile-avatar" aria-hidden="true">{(detail?.profile?.name || latest.guestName || "?").slice(0, 1).toUpperCase()}</span>}
              <div><strong>{detail?.profile?.name || latest.guestName}</strong><p>{email}</p><p>{latest.phone}</p></div>
            </div>
            {email && <button type="button" className="hotel-action secondary" onClick={() => { panel.current.close(); onPasswordHelp(email); }}>Help with password</button>}
            {error && <p role="status">{error}</p>}
            <h4>Latest booking</h4>
            <BookingDetails booking={latest} onOpen={() => { panel.current.close(); onOpenBooking(latest.id); }} />
            <h4>Booking history ({history.length})</h4>
            {history.length === 1 && <p>No earlier bookings.</p>}
            {history.slice(1).map((booking) => <BookingDetails key={booking.id} booking={booking} onOpen={() => { panel.current.close(); onOpenBooking(booking.id); }} />)}
            <h4>Food order history</h4>
            {detail ? (detail.orders.length ? detail.orders.map((order) => <article className="account-card" key={order.code}>
              <strong>{order.code} {"\u00b7"} {order.status}</strong><p>{String(order.createdAt || "").slice(0, 10)} {"\u00b7"} {formatPeso(order.total)}</p>
              <p>{order.items.map((item) => item.title + " × " + (item.qty || item.quantity || 1)).join(", ")}</p>
            </article>) : <p>No food orders recorded.</p>) : email && !error && <p>Loading food orders...</p>}
          </>}
        </div>
      </dialog>
    </section>
  );
}

function BookingDetails({ booking, onOpen }) {
  return <article className="account-card">
    <strong>{booking.roomType} {"\u00b7"} {booking.status}</strong>
    <p>{booking.id}{booking.roomNumber && " · Room " + booking.roomNumber}</p>
    <p>Booked {String(booking.createdAt || "").slice(0, 10)} {"\u00b7"} Stay {booking.checkIn} to {booking.actualCheckOut || booking.checkOut}</p>
    <p>Occupants: {(booking.guestNames.length ? booking.guestNames : [booking.guestName]).join(", ")}</p>
    <p>{formatPeso(booking.totalAmount)} {"\u00b7"} {booking.paymentMethod} {"\u00b7"} {booking.paymentStatus}</p>
    {booking.extras.length > 0 && <p>Extras: {booking.extras.map((item) => item.name + " (" + formatPeso(item.amount) + ")").join(", ")}</p>}
    {booking.notes && <p>Notes: {booking.notes}</p>}
    <button type="button" className="hotel-action secondary" onClick={onOpen}>Open booking</button>
  </article>;
}
