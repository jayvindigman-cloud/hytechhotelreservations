import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatPeso, hotelDate, hotelToday } from "../hotel-api";

export function foodOrderHistoryDate(order) {
  const epoch = order.servedEpoch ?? order.createdEpoch;
  return epoch == null ? String(order.createdAt || "").slice(0, 10) : hotelDate(new Date(Number(epoch) * 1000));
}

export default function FoodOrderReport({ orders }) {
  const [period, setPeriod] = useState("today");
  useEffect(() => {
    document.body.classList.add("has-booking-report");
    return () => document.body.classList.remove("has-booking-report");
  }, []);

  const today = hotelToday();
  const start = new Date(today + "T00:00:00Z");
  if (period === "month") start.setUTCDate(start.getUTCDate() - 29);
  const first = start.toISOString().slice(0, 10);
  const served = orders.filter((order) => {
    const date = foodOrderHistoryDate(order);
    return order.status === "Served" && date >= first && date <= today;
  }).sort((a, b) => Number(b.servedEpoch ?? b.createdEpoch) - Number(a.servedEpoch ?? a.createdEpoch));
  const count = served.reduce((sum, order) => sum + order.items.reduce((qty, item) => qty + Number(item.qty || 0), 0), 0);
  const total = served.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  return (
    <section className="booking-report" aria-labelledby="food-report-title">
      <h3 id="food-report-title">Print served orders</h3>
      <div className="booking-report-controls">
        <label>Period<select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="today">Today</option><option value="month">Last 30 days</option>
        </select></label>
        <button type="button" className="hotel-action" onClick={() => window.print()}>Print report</button>
      </div>
      <p>{served.length} served orders {"·"} {count} items {"·"} {formatPeso(total)} order total</p>
      {createPortal(<section className="booking-print">
        <h1>Hytech Hotel &amp; Bistro</h1>
        <h2>Served food orders</h2>
        <p>{first} to {today}</p>
        <p><strong>{served.length} served orders {"·"} {count} items {"·"} {formatPeso(total)} order total</strong></p>
        {!served.length && <p>No served orders in this period.</p>}
        {served.map((order) => <article key={order.id}>
          <h3>{order.code} {"·"} {order.guestName}</h3>
          <p>{order.servedEpoch == null ? "Order date" : "Served"} {foodOrderHistoryDate(order)} {"·"} {order.roomNumber || "No delivery location recorded"}</p>
          <ul>{order.items.map((item, index) => <li key={index}>{item.qty} {"×"} {item.title} {"·"} {formatPeso(item.price)} each</li>)}</ul>
          {order.notes && <p>Request: {order.notes}</p>}
          <p>Total {formatPeso(order.totalAmount)}</p>
        </article>)}
        {served.some((order) => order.servedEpoch == null) && <p>Older orders without a serving timestamp use their original order date.</p>}
      </section>, document.body)}
    </section>
  );
}
