import { useEffect, useRef, useState } from "react";
import { ROOMS_DATA } from "../data/room";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthFormat = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" });
const monthKey = (date) => date.toISOString().slice(0, 7);

export default function RoomDetails({ room, rooms, api, today, onClose, onSelectRoom, onReserve }) {
  const dialog = useRef(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [result, setResult] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [retry, setRetry] = useState(0);
  const details = ROOMS_DATA.find((item) => item.name === room.name);
  const firstDay = new Date(month + "-01T00:00:00Z");
  const year = firstDay.getUTCFullYear();
  const monthIndex = firstDay.getUTCMonth();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ room: room.name, month });
    async function refresh() {
      try {
        const response = await fetch(api + "/rooms/availability?" + params, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Availability request failed");
        const { nights, availableRooms, totalRooms } = await response.json();
        if (!controller.signal.aborted) {
          setResult({ month, retry, nights, availableRooms, totalRooms });
          setSelectedDate((date) => nights[date] ? date : "");
        }
      } catch {
        if (!controller.signal.aborted) setResult({ month, retry, error: true });
      }
    }
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [api, room.name, month, retry]);

  const availability = result?.month === month && result.retry === retry ? result : null;

  const inventory = availability?.totalRooms ?? room.total_units;
  const selectedCount = availability?.availableRooms?.[selectedDate];

  function changeMonth(offset) {
    setMonth(monthKey(new Date(Date.UTC(year, monthIndex + offset, 1))));
    setSelectedDate("");
  }

  return (
    <dialog
      ref={dialog}
      className="room-details"
      aria-labelledby="room-details-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="room-details-content">
        <button type="button" className="room-details-close" onClick={onClose} aria-label="Close room details">
          {"\u00d7"}
        </button>
        <img className="room-details-photo" src={room.image} alt={room.name} />
        <div className="room-details-body">
          <div className="room-details-columns">
            <section>
              <p className="room-details-category">{room.category}</p>
              <h2 id="room-details-title">{room.name}</h2>
              <p className="room-details-price">{"\u20b1"}{room.price.toLocaleString("en-PH")} / night</p>
              <p>{room.description}</p>
              <dl className="room-details-facts">
                <div><dt>Guests</dt><dd>Up to {room.capacity}</dd></div>
                <div><dt>Bedding</dt><dd>{room.bed}</dd></div>
                {details?.view && <div><dt>View</dt><dd>{details.view}</dd></div>}
              </dl>
              {details?.amenities?.length > 0 && (
                <ul className="room-details-amenities" aria-label="Amenities">
                  {details.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}
                </ul>
              )}
            </section>
            <section className="room-calendar" aria-labelledby="room-calendar-title">
              <h3 id="room-calendar-title">Reservation calendar</h3>
              <p>Each date shows the rooms left out of the total for this room type.</p>
              {Number.isInteger(inventory) && <p className="room-inventory-total"><strong>{inventory}</strong> {inventory === 1 ? "room" : "rooms"} total</p>}
              <div className="room-calendar-month">
                <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} disabled={month <= today.slice(0, 7)}>{"\u2039"}</button>
                <strong aria-live="polite">{monthFormat.format(firstDay)}</strong>
                <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>{"\u203a"}</button>
              </div>
              <div className="room-calendar-grid" aria-label="Nightly room availability">
                {weekdays.map((day) => <span key={day}>{day}</span>)}
                {Array.from({ length: firstDay.getUTCDay() }, (_, index) => <span key={"blank-" + index} />)}
                {Array.from({ length: dayCount }, (_, index) => {
                  const day = index + 1;
                  const date = month + "-" + String(day).padStart(2, "0");
                  const night = availability?.nights?.[date];
                  const remaining = availability?.availableRooms?.[date];
                  const state = date < today ? "past" : night === true ? "available" : night === false ? "sold-out" : "unknown";
                  const showCount = date >= today && Number.isInteger(remaining);
                  return (
                    <button
                      key={date}
                      type="button"
                      data-state={state}
                      disabled={state !== "available"}
                      aria-pressed={selectedDate === date}
                      aria-label={dateFormat.format(new Date(date)) + ", " + (showCount ? remaining + (Number.isInteger(inventory) ? " of " + inventory : "") + " rooms left" : state.replace("-", " "))}
                      onClick={() => setSelectedDate(date)}
                    >
                      <strong>{day}</strong>
                      {showCount && <small className="room-calendar-stock">{Number.isInteger(inventory) ? remaining + "/" + inventory : remaining + " left"}</small>}
                    </button>
                  );
                })}
              </div>
              <p className="room-calendar-legend"><span>Available</span><span>Sold out</span></p>
              {selectedDate && Number.isInteger(selectedCount) && (
                <p className="room-calendar-selection" role="status"><strong>{selectedCount}{Number.isInteger(inventory) ? " of " + inventory : ""} rooms left</strong> on {dateFormat.format(new Date(selectedDate))}</p>
              )}
              {!availability && <p role="status">Checking availability...</p>}
              {availability?.error && (
                <p role="status">Availability could not load. <button type="button" className="room-calendar-retry" onClick={() => setRetry((previous) => previous + 1)}>Try again</button></p>
              )}
            </section>
          </div>
          <div className="room-details-reserve">
            <span aria-live="polite">{selectedDate ? "Check-in " + dateFormat.format(new Date(selectedDate)) : "Choose dates in the reservation form."}</span>
            <button type="button" onClick={() => onReserve(selectedDate)}>Reserve now</button>
          </div>
          {rooms.length > 1 && (
            <section className="room-details-related">
              <h3>Other rooms</h3>
              <div>
                {rooms.filter((item) => item.name !== room.name).map((item) => (
                  <button type="button" key={item.name} onClick={() => onSelectRoom(item)}>
                    <img src={item.image} alt="" loading="lazy" />
                    <span><strong>{item.name}</strong>{"\u20b1"}{item.price.toLocaleString("en-PH")} / night</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
