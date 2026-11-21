import { ChangePassword } from "./PasswordRecovery";
import { foodItems } from "../data/hotelCatalog";
﻿import { useCallback, useEffect, useRef, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../Firebase";
import { accountFetch, readJson, formatPeso, hotelToday } from "../hotel-api";
import GuestReviews from "./GuestReviews";

async function profilePicture(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG, or WebP image up to 10 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const picture = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This image could not be opened."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const size = Math.min(picture.naturalWidth, picture.naturalHeight);
    const context = canvas.getContext("2d");
    context.fillStyle = "#f8f4e9";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(picture, (picture.naturalWidth - size) / 2, (picture.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function GuestAccount({ api, user, rooms, menu, onLogin, onLogout, onClose, onViewReceipt, onSaveProfile, onBookAgain, onOrderAgain }) {
  const dialog = useRef(null);
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(user?.photoURL || "");;
  const [reservations, setReservations] = useState([]);
  const [orderView, setOrderView] = useState("active");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(Boolean(auth.currentUser?.emailVerified));
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const account = auth.currentUser;
    if (!account || !user?.email) return;
    setLoading(true);
    try {
      await account.reload();
      setVerified(account.emailVerified);
      if (!account.emailVerified) return;
      const query = "?email=" + encodeURIComponent(user.email);
      const [bookings, food] = await Promise.all([
        accountFetch(api + "/reservations" + query).then(readJson),
        accountFetch(api + "/orders" + query).then(readJson),
      ]);
      setReservations(bookings);
      setOrders(food);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [api, user?.email]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function run(key, task) {
    setAction(key);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAction("");
    }
  }

  function cancel(resource, item) {
    if (!window.confirm("Cancel " + item.code + "?")) return;
    run("cancel", async () => {
      const result = await readJson(await accountFetch(api + "/guest/" + resource + "/" + item.id + "/cancel", { method: "PATCH" }));
      const update = (items) => items.map((record) => record.id === item.id ? { ...record, status: "Cancelled" } : record);
      (resource === "orders" ? setOrders : setReservations)(update);
      setMessage(result.message);
    });
  }

  const visibleOrders = orders.filter((item) => ["Served", "Cancelled"].includes(item.status) === (orderView === "history"));
  const date = hotelToday();
  const completedStay = reservations.some((item) => ["Confirmed", "Checked out"].includes(item.status) && (item.actualCheckOut || item.checkOut) <= date);
  return (
    <dialog ref={dialog} className="guest-account-dialog" aria-labelledby="account-title" onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="guest-account">
        <button className="room-details-close account-close" type="button" aria-label="Close account" onClick={onClose}>{"\u00d7"}</button>

        <h3 id="account-title">Profile</h3>
        {!user ? (
          <div className="guest-profile-login">
            <p>Sign in to manage your reservations, food orders, and reviews.</p>
            <button className="hotel-action" type="button" onClick={onLogin}>Sign in</button>
          </div>
        ) : <>
        <div className="guest-account-identity">
          {user.photoURL ? <img className="guest-profile-avatar" src={user.photoURL} alt="" />
            : <span className="guest-profile-avatar" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>}
          <div><strong>{user.name}</strong><p>{user.email}</p></div>
          <button className="hotel-action secondary" type="button" disabled={!!action} onClick={() => run("logout", async () => {
            await onLogout();
            onClose();
          })}>Sign out</button>
        </div>
        <div className="account-tabs" aria-label="Account sections">
          {[["profile", "Details"], ["reservations", "Reservations"], ["orders", "Food orders"], ["reviews", "Reviews"]].map(([value, label]) => (
            <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>
        {tab !== "profile" && <button className="hotel-action secondary guest-refresh" type="button" disabled={loading || !!action}
          onClick={() => run("refresh", refresh)}>Refresh</button>}
        {message && <p role="status" className="account-notice">{message}</p>}
        {tab === "profile" ? (
          <>
          <form className="guest-profile-form" onSubmit={(event) => {
            event.preventDefault();
            run("name", async () => {
              await onSaveProfile(name, photo);
              setMessage("Profile saved.");
            });
          }}>
            <label>Display name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="guest-photo-editor">
              {photo && <img className="guest-profile-avatar" src={photo} alt="Profile photo preview" />}
              <label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!action}
                onChange={(event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (file) run("photo", async () => setPhoto(await profilePicture(file)));
                }} /></label>
              {photo && <button type="button" className="hotel-action secondary" onClick={() => setPhoto("")}>Remove photo</button>}
            </div>
            <div className="account-actions">
              <button className="hotel-action" disabled={!!action}>Save profile</button>
            </div>
          </form>
          {auth.currentUser?.providerData.some((provider) => provider.providerId === "password") && <ChangePassword email={user.email} />}
          </>
        ) : loading ? <p role="status">Loading bookings…</p> : !verified ? (
          <div className="account-notice">
            <p>Verify your email to manage reservations and food orders or leave a review. After verifying, refresh bookings.</p>
            <button className="hotel-action" type="button" disabled={!!action} onClick={() => run("verify", async () => {
              await sendEmailVerification(auth.currentUser);
              setMessage("Verification email sent.");
            })}>Send verification email</button>
          </div>
        ) : tab === "reviews" ? (
          completedStay ? <GuestReviews api={api} user={user} embedded /> : (
            <section><h4>Review your stay</h4><p>Reviews open after check-out for confirmed stays.</p>
              {reservations.map((item) => (
                <article key={item.id} className="account-card">
                  <div className="account-card-heading"><strong>{item.code}</strong><span>{item.status}</span></div>
                  <h5>{item.roomType}</h5><p>{item.checkIn} to {item.checkOut}</p>
                  <div className="account-notice"><div className="review-stars" aria-hidden="true">{"\u2606 ".repeat(5)}</div>
                    This stay is awaiting confirmation or check-out.</div>
                </article>
              ))}
            </section>
          )
        ) : tab === "reservations" ? (
          <>
            <h4>Room reservations</h4>
            {!reservations.length && <p>No room reservations yet.</p>}
            {reservations.map((item) => {
              const room = rooms.find((entry) => entry.name === item.roomType);
              const canCancel = ["Pending", "Confirmed"].includes(item.status) && item.paymentStatus === "Unpaid" && item.paymentMethod === "Cash" && item.checkIn > date;
              return (
                <article key={item.id} className="account-card">
                  {room && <img src={room.image} alt={room.name} />}
                  <div className="account-card-heading"><strong>{item.code}</strong><span>{item.status}</span></div>
                  <h5>{item.roomType}</h5>
                  <p>{item.checkIn} to {item.checkOut} · {item.nights} night(s)</p>
                  {item.actualCheckOut && <p>Checked out {item.actualCheckOut}</p>}
                  <p>{formatPeso(item.totalAmount)} · {item.paymentStatus}</p>
                  <div className="account-actions">
                    <button type="button" className="hotel-action secondary" onClick={() => onViewReceipt(item)}>View receipt</button>
                    <button type="button" className="hotel-action" disabled={!!action} onClick={() => run("rebook", () => onBookAgain(item))}>Book again</button>
                    {canCancel && <button type="button" className="hotel-action danger" disabled={!!action} onClick={() => cancel("reservations", item)}>Cancel booking</button>}
                  </div>
                  {!canCancel && ["Pending", "Confirmed"].includes(item.status) && item.checkIn >= date && <p>Contact the hotel to change or cancel this booking.</p>}
                </article>
              );
            })}
          </>
        ) : (
          <>
            <h4>Food orders</h4>
            <div className="account-tabs" aria-label="Food order views">
              <button type="button" aria-pressed={orderView === "active"} onClick={() => setOrderView("active")}>Active</button>
              <button type="button" aria-pressed={orderView === "history"} onClick={() => setOrderView("history")}>History</button>
            </div>
            {!visibleOrders.length && <p>{orderView === "history" ? "No food orders in history yet." : "No active food orders."}</p>}
            {visibleOrders.map((item) => (
              <article key={item.id} className="account-card">
                <div className="account-card-heading"><strong>{item.code}</strong><span>{item.status}</span></div>
                <ul className="profile-food-list">
                  {item.items?.map((line, index) => {
                    const current = menu.find((entry) => line.id ? entry.id === line.id : entry.title === line.title);
                    const photo = line.image || current?.image || foodItems.find((entry) => entry.title === line.title)?.image;
                    return <li key={index}>
                      {photo && <img src={photo} alt="" loading="lazy" />}
                      <span>{line.title} {"\u00d7"} {line.quantity ?? line.qty}</span>
                    </li>;
                  })}
                </ul>
                <p>{formatPeso(item.totalAmount)}</p>
                {item.notes && <p>Request: {item.notes}</p>}
                <div className="account-actions">
                  <button type="button" className="hotel-action" disabled={!!action} onClick={() => run("reorder", () => onOrderAgain(item))}>Order again</button>
                {item.status === "Pending" && <button type="button" className="hotel-action danger" disabled={!!action} onClick={() => cancel("orders", item)}>Cancel order</button>}
                </div>
              </article>
            ))}
          </>
        )}
        </>}
      </div>
    </dialog>
  );
}
