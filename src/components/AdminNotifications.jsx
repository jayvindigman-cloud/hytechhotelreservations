import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { accountFetch, readJson } from "../hotel-api";

const keyFor = (item) => item.kind + ":" + item.id;
const dateFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
});

function storedReads(key) {
  try {
    const items = JSON.parse(localStorage.getItem(key));
    return new Set(Array.isArray(items) ? items : []);
  } catch {
    return new Set();
  }
}

export default function AdminNotifications({ api, userId, onOpen, onUnreadChange, ref }) {
  const storageKey = "hytech.admin.notifications." + userId;
  const [read, setRead] = useState(() => storedReads(storageKey));
  const [items, setItems] = useState([]);
  const [view, setView] = useState("unread");
  const [error, setError] = useState("");
  const panel = useRef(null);

  const refresh = useCallback(async (signal) => {
    try {
      const notifications = await accountFetch(api + "/admin/notifications", { signal }).then(readJson);
      if (!signal?.aborted) {
        setItems(notifications);
        setError("");
      }
    } catch (failure) {
      if (!signal?.aborted) setError(failure.message || "Notifications could not load.");
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => refresh(controller.signal);
    load();
    const timer = setInterval(load, 20000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [refresh]);

  function updateRead(entries, isRead = true) {
    const next = new Set(read);
    for (const item of entries) {
      if (isRead) next.add(keyFor(item));
      else next.delete(keyFor(item));
    }
    setRead(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next].slice(-250)));
    } catch {}
  }

  useImperativeHandle(ref, () => ({
    markKindRead(kind) {
      const unreadOfKind = items.filter((item) => item.kind === kind && !read.has(keyFor(item)));
      if (unreadOfKind.length) updateRead(unreadOfKind);
    },
  }));

  const unreadItems = items.filter((item) => !read.has(keyFor(item)));
  const readItems = items.filter((item) => read.has(keyFor(item)));
  const unread = unreadItems.length;
  const reservationUnread = unreadItems.some((item) => item.kind === "reservation");
  const orderUnread = unreadItems.some((item) => item.kind === "order");
  const visibleItems = view === "unread" ? unreadItems : readItems;

  useEffect(() => {
    onUnreadChange({ reservation: reservationUnread, order: orderUnread });
  }, [reservationUnread, orderUnread, onUnreadChange]);
  return (
    <>
      <button type="button" className="admin-notification-trigger hotel-action secondary" aria-haspopup="dialog"
        aria-label={unread ? "Notifications, " + unread + " unread" : "Notifications"} onClick={() => {
          setView(unread || !items.length ? "unread" : "read");
          panel.current.showModal();
          refresh();
        }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && <span aria-hidden="true" />}
      </button>
      <dialog ref={panel} className="admin-calendar-day admin-notification-panel" aria-labelledby="admin-notifications-title"
        onClick={(event) => { if (event.target === event.currentTarget) panel.current.close(); }}>
        <div className="admin-calendar-day-content">
          <header>
            <div><h4 id="admin-notifications-title">Notifications</h4><p>{unread} unread</p></div>
            <button type="button" className="hotel-action secondary" autoFocus onClick={() => panel.current.close()}>Close</button>
          </header>
          {error && <p role="status" className="account-notice">{error}</p>}
          <div className="admin-notification-tabs" aria-label="Notification views">
            <button type="button" aria-pressed={view === "unread"} onClick={() => setView("unread")}>Unread <span>{unread}</span></button>
            <button type="button" aria-pressed={view === "read"} onClick={() => setView("read")}>Read <span>{readItems.length}</span></button>
          </div>
          {view === "unread" && unread > 0 && (
            <button type="button" className="hotel-action secondary admin-notification-mark" onClick={() => updateRead(unreadItems)}>
              Mark all as read
            </button>
          )}
          {!visibleItems.length && !error && (
            <p className="admin-calendar-empty">{view === "unread" ? "No unread notifications." : "No read notifications."}</p>
          )}
          <ul className="admin-notification-list">
            {visibleItems.map((item) => {
              const time = new Date(Number(item.createdAt) * 1000);
              return (
                <li key={keyFor(item)} data-unread={view === "unread"}>
                  <button type="button" className="admin-notification-entry" onClick={() => {
                    updateRead([item]);
                    panel.current.close();
                    onOpen(item);
                  }}>
                    <strong>{item.kind === "reservation" ? "Room reservation" : "Food order"}</strong>
                    <span>{item.guestName} {"\u00b7"} {item.code}</span>
                    {!Number.isNaN(time.getTime()) && <small>{dateFormat.format(time)}</small>}
                  </button>
                  <button type="button" className="hotel-action secondary admin-notification-status" onClick={() => updateRead([item], view === "unread")}>
                    {view === "unread" ? "Mark as read" : "Mark unread"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}
