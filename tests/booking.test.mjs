import test from "node:test";
import assert from "node:assert/strict";
import { availableUnits, discountCents, priceExtras, validateBooking, validDate } from "../netlify/server/booking.mjs";

const today = "2026-11-21";
const booking = (changes = {}) => ({
  guestName: "Test Guest", email: "guest@example.com", phone: "0917 123 4567",
  checkIn: "2026-12-01", checkOut: "2026-12-04", paymentMethod: "Cash",
  rooms: [{ roomType: "Standard Room", guests: 2, quantity: 1, guestNames: ["Test Guest", "Second Guest"] }],
  extraSelections: [], ...changes,
});

test("accepts a complete multi-room booking and normalizes guest names", () => {
  const result = validateBooking(booking({ rooms: [
    { roomType: "Standard Room", guests: 2, quantity: 2, guestNames: [" Test Guest ", "Second Guest"] },
    { roomType: "Solo Room", guests: 1, quantity: 1 },
  ] }), today);
  assert.equal(result.nights, 3);
  assert.deepEqual(result.rooms[0].guestNames, ["Test Guest", "Second Guest"]);
  assert.deepEqual(result.rooms[1].guestNames, ["Test Guest"]);
});

test("rejects invalid dates, past arrivals, reversed stays and stays over one year", () => {
  for (const changes of [
    { checkIn: "2026-02-30" }, { checkIn: "2026-11-20" },
    { checkOut: "2026-12-01" }, { checkOut: "2026-11-30" }, { checkOut: "2028-01-01" },
  ]) assert.throws(() => validateBooking(booking(changes), today), { status: 400 });
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
});

test("validates Philippine contact numbers and requires a GCash reference only for GCash", () => {
  for (const phone of ["09171234567", "+63 917 123 4567", "639171234567"]) {
    assert.doesNotThrow(() => validateBooking(booking({ phone }), today));
  }
  for (const phone of ["123", "09171234567890", "+63notaphone"]) {
    assert.throws(() => validateBooking(booking({ phone }), today), { status: 400 });
  }
  assert.throws(() => validateBooking(booking({ paymentMethod: "GCash" }), today), { status: 400 });
  assert.doesNotThrow(() => validateBooking(booking({ paymentMethod: "GCash", paymentReference: "1234567890123" }), today));
  assert.throws(() => validateBooking(booking({ paymentMethod: "Card" }), today), { status: 400 });
});

test("rejects missing occupants, malformed extras, duplicate extras and oversized quantities", () => {
  for (const changes of [
    { rooms: [] }, { rooms: [{ roomType: "Standard Room", guests: 2, quantity: 1 }] },
    { rooms: [{ roomType: "Solo Room", guests: 1, quantity: 21 }] },
    { rooms: [{ roomType: "Solo Room", guests: 1, quantity: 1.5 }] },
    { extraSelections: [{ id: 1, quantity: 1 }, { id: 1, quantity: 2 }] },
    { extraSelections: [{ id: 1, quantity: 21 }] }, { extraIds: {} },
    { expectedTotal: -1 }, { expectedTotal: "1200" },
  ]) assert.throws(() => validateBooking(booking(changes), today), { status: 400 });
});

test("checkout day is free for the next arrival", () => {
  const stays = [{ checkIn: "2026-12-01", checkOut: "2026-12-03" }];
  assert.equal(availableUnits(1, stays, "2026-12-03", "2026-12-05"), 1);
  assert.equal(availableUnits(1, stays, "2026-12-02", "2026-12-03"), 0);
});

test("consecutive stays do not get counted as simultaneous occupancy", () => {
  const stays = [
    { checkIn: "2026-12-01", checkOut: "2026-12-03" },
    { checkIn: "2026-12-03", checkOut: "2026-12-05" },
  ];
  assert.equal(availableUnits(2, stays, "2026-12-01", "2026-12-05"), 1);
});

test("the busiest night limits availability across the entire requested stay", () => {
  const stays = [
    { checkIn: "2026-11-29", checkOut: "2026-12-03" },
    { checkIn: "2026-12-02", checkOut: "2026-12-06" },
    { checkIn: "2026-12-09", checkOut: "2026-12-10" },
  ];
  assert.equal(availableUnits(3, stays, "2026-12-01", "2026-12-05"), 1);
  assert.equal(availableUnits(1, stays, "2026-12-01", "2026-12-05"), 0);
  assert.equal(availableUnits(0, [], "2026-12-01", "2026-12-05"), 0);
});

test("early checkout releases inventory from the actual checkout date", () => {
  const stays = [{ checkIn: "2026-12-01", checkOut: "2026-12-08", actualCheckOut: "2026-12-03" }];
  assert.equal(availableUnits(1, stays, "2026-12-03", "2026-12-05"), 1);
  assert.equal(availableUnits(1, stays, "2026-12-02", "2026-12-04"), 0);
});

test("extra prices use each service's billing unit and reject inactive services", () => {
  const catalog = [
    { id: 1, name: "Breakfast", price: "100.50", unit: "guest", active: true },
    { id: 2, name: "Parking", price: "50.00", unit: "night", active: true },
    { id: 3, name: "Transfer", price: "200.00", unit: "stay", active: true },
    { id: 4, name: "Water", price: "25.25", unit: "item", active: true },
  ];
  const priced = priceExtras(catalog, catalog.map(({ id }) => ({ id, quantity: 2 })), 3, 2);
  assert.deepEqual(priced.map((item) => item.amount), [201, 150, 200, 50.5]);
  assert.throws(() => priceExtras([{ ...catalog[0], active: false }], [{ id: 1, quantity: 1 }], 3, 2), { status: 409 });
  assert.throws(() => priceExtras([], [{ id: 99, quantity: 1 }], 3, 2), { status: 409 });
});

test("discounts round to cents and never exceed the room subtotal", () => {
  assert.equal(discountCents({ discountType: "percent", discountValue: "12.5" }, 120099), 15012);
  assert.equal(discountCents({ discountType: "fixed", discountValue: "100.25" }, 120099), 10025);
  assert.equal(discountCents({ discountType: "fixed", discountValue: "9999" }, 10000), 10000);
  assert.equal(discountCents(null, 10000), 0);
});
