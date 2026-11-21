export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function ensure(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}

export function hotelToday() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
}

export function text(value, max, required = true) {
  return typeof value === "string" && (!required || value.trim().length > 0) && value.trim().length <= max;
}

export function validateBooking(body, today = hotelToday()) {
  ensure(body && typeof body === "object", "Enter your booking details.");
  ensure(text(body.guestName, 100) && text(body.email, 150) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()), "Enter your full name and a valid email.");
  ensure(text(body.phone, 30) && /^(?:\+?63|0)9\d{9}$/.test(body.phone.replace(/[\s-]/g, "")), "Enter a Philippine mobile number, such as 0917 123 4567.");
  ensure(validDate(body.checkIn) && validDate(body.checkOut) && body.checkIn >= today && body.checkOut > body.checkIn, "Choose valid stay dates. Check-in cannot be in the past and check-out must follow check-in.");
  const nights = Math.round((Date.parse(body.checkOut) - Date.parse(body.checkIn)) / 86400000);
  ensure(nights <= 365, "For stays longer than 365 nights, contact the hotel.");
  ensure(["Cash", "GCash"].includes(body.paymentMethod), "Choose Cash or GCash.");
  if (body.paymentMethod === "GCash") ensure(text(body.paymentReference, 60) && body.paymentReference.trim().length >= 6, "Enter the reference number from your GCash payment.");
  ensure(body.notes == null || text(body.notes, 2000, false), "Special requests must be 2,000 characters or fewer.");
  const selections = body.rooms ?? [{ roomType: body.roomType, guests: body.guests ?? 1, quantity: 1 }];
  ensure(Array.isArray(selections) && selections.length > 0 && selections.length <= 20, "Select between 1 and 20 rooms.");
  let count = 0;
  const rooms = selections.map((item) => {
    ensure(item && text(item.roomType, 100) && Number.isInteger(item.guests) && item.guests > 0 && item.guests <= 255 && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20, "Choose valid room quantities and guest counts.");
    count += item.quantity;
    const names = item.guestNames ?? (item.guests === 1 ? [body.guestName] : []);
    ensure(Array.isArray(names) && names.length === item.guests && names.every((name) => text(name, 100)), "Enter the full name of every guest in each room.");
    return { ...item, guestNames: names.map((name) => name.trim()) };
  });
  ensure(count <= 20, "You can reserve up to 20 rooms at once.");
  ensure(body.extraIds === undefined || Array.isArray(body.extraIds), "Choose valid extras.");
  const extras = body.extraSelections ?? (body.extraIds ?? []).map((id) => ({ id, quantity: 1 }));
  ensure(Array.isArray(extras) && extras.length <= 30 && extras.every((item) => item && Number.isSafeInteger(item.id) && item.id > 0 && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20), "Choose valid extras and quantities.");
  ensure(new Set(extras.map((item) => item.id)).size === extras.length, "Select each extra only once.");
  ensure(body.expectedTotal === undefined || (Number.isFinite(body.expectedTotal) && body.expectedTotal >= 0), "Invalid checkout total.");
  ensure(body.voucherCode == null || text(body.voucherCode, 40), "Enter a valid discount code.");
  return { rooms, extras, nights };
}

// Check each night rather than counting all stays that intersect the whole trip.
export function availableUnits(total, stays, checkIn, checkOut) {
  let minimum = total;
  const events = new Map([[checkIn, 0]]);
  for (const stay of stays) {
    const end = stay.actualCheckOut || stay.checkOut;
    if (stay.checkIn >= checkOut || end <= checkIn) continue;
    const start = stay.checkIn < checkIn ? checkIn : stay.checkIn;
    events.set(start, (events.get(start) || 0) + 1);
    events.set(end, (events.get(end) || 0) - 1);
  }
  let occupied = 0;
  for (const [day, change] of [...events].sort(([a], [b]) => a.localeCompare(b))) {
    if (day >= checkOut) break;
    occupied += change;
    minimum = Math.min(minimum, total - occupied);
  }
  return Math.max(0, minimum);
}

export function discountCents(voucher, subtotal) {
  if (!voucher) return 0;
  return Math.min(subtotal, Math.round(voucher.discountType === "fixed" ? Number(voucher.discountValue) * 100 : subtotal * Number(voucher.discountValue) / 100));
}

export function priceExtras(catalog, selections, nights, guests) {
  return selections.map(({ id, quantity }) => {
    const extra = catalog.find((item) => item.id === id && item.active);
    ensure(extra, "An extra service is unavailable. Reopen the reservation form to review current services.", 409);
    const units = { night: nights, guest: guests, item: quantity, stay: 1 }[extra.unit];
    ensure(Number.isInteger(units), "This extra service is unavailable.", 409);
    const price = Number(extra.price);
    return { id, name: extra.name, price, unit: extra.unit, quantity: units, amount: Math.round(price * units * 100) / 100 };
  });
}
