import { roomDescriptions } from "../data/hotelCatalog";
import GuestAccount from "./GuestAccount";
import GuestReviews from "./GuestReviews";
import { API_BASE, accountFetch, extraUnits, hotelToday, readJson } from "../hotel-api";
import React, { useState, useEffect } from "react";
import LoginModal from "./LoginModal";
import RoomDetails from "./RoomDetails";

const hotelStyles = `
.bb-chip {
  border: 1px solid #1d3f40;
  background: transparent;
  color: #1d3f40;
  padding: 8px 18px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.25s ease, color 0.25s ease;
}
.bb-chip:hover { background: #f3ead7; }
.bb-chip.active { background: #10292a; border-color: #10292a; color: #d8b46a; }

.bb-room-card {
  transition: transform 0.35s ease, box-shadow 0.35s ease;
}
.bb-room-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 14px 30px rgba(16, 41, 42, 0.28);
}
.bb-room-card img { transition: transform 0.6s ease; }
.bb-room-card:hover img { transform: scale(1.08); }
.bb-room-media { position: relative; overflow: hidden; }
.bb-room-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(16, 41, 42, 0.85);
  color: #d8b46a;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}
.bb-room-btn { transition: background-color 0.25s ease, letter-spacing 0.25s ease; }
.bb-room-btn:hover { background-color: #e6c680 !important; letter-spacing: 0.4px; }

.bb-menu {
  background: linear-gradient(160deg, #10292a 0%, #1d3f40 55%, #2a5253 100%);
  color: #f3ead7;
}
.bb-menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 22px;
  max-width: 1300px;
  margin: 0 auto;
}
.bb-menu-card {
  position: relative;
  height: 380px;
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}
.bb-menu-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}
.bb-menu-card img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease, filter 0.5s ease;
}
.bb-menu-card:hover img { transform: scale(1.12); filter: brightness(0.55); }
.bb-menu-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(8, 22, 22, 0.92) 0%, rgba(8, 22, 22, 0.35) 45%, rgba(8, 22, 22, 0) 70%);
}
.bb-menu-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(243, 234, 215, 0.16);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(243, 234, 215, 0.35);
  color: #f3ead7;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
}
.bb-menu-price {
  position: absolute;
  top: 14px;
  right: 14px;
  background: #d8b46a;
  color: #10292a;
  font-weight: 800;
  font-size: 0.85rem;
  padding: 6px 12px;
  border-radius: 10px;
  transition: transform 0.35s ease;
}
.bb-menu-card:hover .bb-menu-price { transform: scale(1.1) rotate(-3deg); }
.bb-menu-body {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px;
  text-align: left;
}
.bb-menu-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
}
.bb-menu-line {
  width: 36px;
  height: 3px;
  background: #d8b46a;
  border-radius: 2px;
  margin: 10px 0;
  transition: width 0.4s ease;
}
.bb-menu-card:hover .bb-menu-line { width: 90px; }
.bb-menu-desc {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #e6dcc6;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.5s ease, opacity 0.5s ease;
}
.bb-menu-card:hover .bb-menu-desc { max-height: 120px; opacity: 1; }
.bb-menu-tab {
  border: 1px solid rgba(243, 234, 215, 0.4);
  background: transparent;
  color: #f3ead7;
  padding: 9px 20px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 600;
  transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
.bb-menu-tab:hover { border-color: #d8b46a; color: #d8b46a; }
.bb-menu-tab.active { background: #d8b46a; border-color: #d8b46a; color: #10292a; }

.bb-menu-add {
  margin-top: 14px;
  background: #d8b46a;
  color: #10292a;
  border: none;
  border-radius: 8px;
  padding: 9px 18px;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}
.bb-menu-add:hover { background: #e6c680; transform: translateY(-1px); }
.bb-tray {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1500;
  background: #10292a;
  color: #d8b46a;
  border: 1px solid #d8b46a;
  border-radius: 999px;
  padding: 14px 24px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.bb-tray:hover { transform: translateY(-2px); background: #17393a; }
.bb-overlay { animation: bbFade 0.25s ease; }
.bb-modal { animation: bbRise 0.3s ease; }
@keyframes bbFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bbRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

.bb-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1d3f40;
  margin-bottom: 6px;
  text-align: left;
}
.bb-input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  background-color: #ffffff;
  color: #1f2d2d;
  border: 1px solid #d9cba5;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  color-scheme: light;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.bb-input::placeholder { color: #9aa8a8; }
.bb-input:hover { border-color: #b8923f; }
.bb-input:focus {
  outline: none;
  border-color: #b8923f;
  box-shadow: 0 0 0 3px rgba(216, 180, 106, 0.35);
}
.bb-grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
  gap: 14px;
}
.bb-field { margin-bottom: 16px; }
.bb-pay-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.bb-pay {
  border: 1px solid #d9cba5;
  background: #fff;
  color: #1d3f40;
  border-radius: 8px;
  padding: 10px 8px;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}
.bb-pay:hover { border-color: #b8923f; transform: translateY(-1px); }
.bb-pay.active { background: #10292a; color: #d8b46a; border-color: #10292a; }
.bb-submit {
  width: 100%;
  background-color: #d8b46a;
  color: #10292a;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}
.bb-submit:hover:not(:disabled) {
  background-color: #e6c680;
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(216, 180, 106, 0.4);
}
.bb-submit:disabled { background-color: #e4dcc6; color: #9a917a; cursor: not-allowed; }
.bb-close { transition: background-color 0.2s ease, color 0.2s ease; }
.bb-close:hover { background-color: #f3ead7; color: #1d3f40; }

@media (hover: none) {
  .bb-menu-desc { max-height: 120px; opacity: 1; }
  .bb-menu-line { width: 90px; }
}
@media (prefers-reduced-motion: reduce) {
  .bb-room-card, .bb-room-card img, .bb-menu-card, .bb-menu-card img, .bb-modal, .bb-overlay { transition: none; animation: none; }
}
`;

const API = API_BASE;

const peso = (value) => "₱" + Number(value || 0).toLocaleString("en-PH");

const foodOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(8, 22, 22, 0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};

const foodModalStyle = {
  backgroundColor: "#faf6ec",
  borderTop: "5px solid #d8b46a",
  padding: "28px",
  borderRadius: "16px",
  maxWidth: "520px",
  width: "92%",
  maxHeight: "92vh",
  overflowY: "auto",
  position: "relative",
  boxSizing: "border-box",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
  colorScheme: "light",
};

const closeStyle = {
  position: "absolute",
  top: "14px",
  right: "14px",
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  border: "none",
  background: "none",
  fontSize: "1.1rem",
  cursor: "pointer",
  color: "#666",
};

const qtyButton = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "1px solid #d9cba5",
  background: "#fff",
  color: "#1d3f40",
  fontWeight: "700",
  cursor: "pointer",
  lineHeight: 1,
};

function FoodOrder({ cart, setCart, menu, addToCart, user, onClose, notice, refreshMenu }) {
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  const [extraFoodId, setExtraFoodId] = useState("");
  const lines = Object.values(cart);
  const addableFoods = menu.filter((item) => item.availability === "available" && !cart[item.id]);
  const extraFood = addableFoods.find((item) => String(item.id) === extraFoodId);
  const unavailable = lines.some((line) => line.availability !== "available");
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  const changeQty = (id, delta) => {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const qty = line.qty + delta;
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = { ...line, qty: Math.min(qty, 50) };
      return next;
    });
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (lines.length === 0 || unavailable) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await accountFetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: user.name || user.displayName || "",
          email: user.email,
          phone: phone.replace(/[\s-]/g, ""),
          roomNumber: roomNumber.trim(),
          notes: notes.trim(),
          items: lines.map(({ id, qty }) => ({ id, qty })),
          expectedTotal: total,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Your order could not be sent.");
        if (response.status === 409) refreshMenu().catch(() => {});
        return;
      }
      setPlacedOrder(result);
      setCart({});
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server. Make sure the backend is running on port 8080.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bb-overlay" onClick={onClose} style={foodOverlayStyle}>
      <div className="bb-modal" onClick={(e) => e.stopPropagation()} style={foodModalStyle}>
        <button className="bb-close" onClick={onClose} aria-label="Close" style={closeStyle}>
          ✕
        </button>

        {placedOrder ? (
          <div>
            <div
              style={{
                backgroundColor: "#fff4dc",
                color: "#8a5a00",
                padding: "12px",
                borderRadius: "8px",
                textAlign: "center",
                fontWeight: "bold",
                margin: "6px 30px 20px 0",
              }}
            >
              Order received. The kitchen will confirm it shortly.
            </div>
            <div style={{ border: "1px dashed #1d3f40", borderRadius: "10px", padding: "20px", backgroundColor: "#fffdf7" }}>
              <div style={{ textAlign: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, color: "#1d3f40" }}>HYTECH HOTEL AND BISTRO</h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#666" }}>Food Order Receipt</p>
              </div>
              <div style={{ fontSize: "0.9rem", lineHeight: "1.8", color: "#333" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Order Reference:</strong>
                  <span style={{ color: "#9a7430", fontWeight: "bold" }}>{placedOrder.code}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Room or table:</strong>
                  <span>{placedOrder.roomNumber || "Not specified"}</span>
                </div>
                {placedOrder.items.map((item) => (
                  <div key={item.title} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span>{item.qty} × {item.title}</span>
                    <span>{peso(item.price * item.qty)}</span>
                  </div>
                ))}
                {placedOrder.notes && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <strong>Special requests:</strong>
                    <span style={{ textAlign: "right" }}>{placedOrder.notes}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #1d3f40", marginTop: "12px", paddingTop: "10px", fontSize: "1.1rem" }}>
                  <strong>Total to pay:</strong>
                  <strong style={{ color: "#1d3f40" }}>{peso(placedOrder.totalAmount)}</strong>
                </div>
              </div>
            </div>
            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#666", margin: "14px 0" }}>
              Pay when your order is served. You can check its status anytime in Profile.
            </p>
            <button className="bb-submit" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={submitOrder}>
            <h3 style={{ margin: "0 0 4px", color: "#1d3f40", fontSize: "1.5rem" }}>Your order</h3>
            <p style={{ margin: "0 0 18px", color: "#777", fontSize: "0.9rem" }}>
              Review your items, then send the order to the bistro.
            </p>
            {notice && <p className="account-notice" role="status">{notice}</p>}

            {lines.length === 0 ? (
              <div style={{ padding: "24px", border: "1px dashed #cdb98a", borderRadius: "10px", textAlign: "center", color: "#8a7a55", marginBottom: "16px" }}>
                Your order is empty. Add dishes from the menu.
              </div>
            ) : (
              <div style={{ marginBottom: "16px" }}>
                {lines.map((line) => (
                  <div
                    key={line.id}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid #e3d6b6" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "600", color: "#1d3f40" }}>{line.title}{line.availability !== "available" && <small> (unavailable)</small>}</div>
                      <div style={{ fontSize: "0.82rem", color: "#777" }}>{peso(line.price)} each</div>
                    </div>
                    <button type="button" style={qtyButton} onClick={() => changeQty(line.id, -1)} disabled={submitting} aria-label={"Remove one " + line.title}>−</button>
                    <span style={{ minWidth: "20px", textAlign: "center", fontWeight: "700" }}>{line.qty}</span>
                    <button type="button" style={qtyButton} onClick={() => changeQty(line.id, 1)} disabled={submitting || line.availability !== "available" || line.qty >= 50} aria-label={"Add one " + line.title}>+</button>
                    <span style={{ minWidth: "70px", textAlign: "right", fontWeight: "700", color: "#1d3f40" }}>
                      {peso(line.price * line.qty)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {addableFoods.length > 0 && (
              <div className="food-order-add-more bb-field">
                <label htmlFor="extraFood" className="bb-label">Add more food</label>
                <div>
                  <select id="extraFood" className="bb-input" value={extraFood ? extraFoodId : ""} disabled={submitting}
                    onChange={(event) => setExtraFoodId(event.target.value)}>
                    <option value="">Choose a dish</option>
                    {addableFoods.map((item) => <option key={item.id} value={item.id}>{item.title} {"\u00b7"} {peso(item.price)}</option>)}
                  </select>
                  <button type="button" className="hotel-action" disabled={!extraFood || submitting} onClick={() => {
                    addToCart(extraFood);
                    setExtraFoodId("");
                  }}>Add to order</button>
                </div>
              </div>
            )}

            <div className="bb-grid-2 bb-field">
              <div>
                <label className="bb-label" htmlFor="orderPhone">Contact number</label>
                <input
                  id="orderPhone"
                  className="bb-input"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  required
                  pattern="^(\+?63|0)9[\d\s\-]{9,12}$"
                  title="Enter a mobile number like 0917 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="bb-label" htmlFor="orderRoom">Room number or table</label>
                <input
                  id="orderRoom"
                  className="bb-input"
                  type="text"
                  placeholder="Room 204 or Table 5"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="bb-field">
              <label className="bb-label" htmlFor="orderNotes">Special requests (optional)</label>
              <textarea
                id="orderNotes"
                className="bb-input"
                rows={2}
                placeholder="No onions, extra rice, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: "#fbe9e7", color: "#b22222", padding: "10px 12px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "14px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", marginBottom: "10px" }}>
              <span style={{ fontWeight: "600", color: "#1d3f40" }}>Total</span>
              <strong style={{ fontSize: "1.3rem", color: "#1d3f40" }}>{peso(total)}</strong>
            </div>

            <button type="submit" className="bb-submit" disabled={lines.length === 0 || unavailable || submitting}>
              {submitting ? "Sending order..." : "Place order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const toDateInputValue = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const addDays = (dateString, days) => {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const GCASH_NUMBER = "0923-456-7890";
const GCASH_NAME = "Hytech Hotel and Bistro";

const emptyForm = {
  guestName: "",
  email: "",
  phone: "",
  checkIn: "",
  checkOut: "",
  paymentMethod: "GCash",
  paymentReference: "",
  notes: "",
};

export default function HotelInfo({ user, onLogin, onGoogleLogin, onSignup, authError, onLogout, onSaveProfile }) {
  const [detailsRoom, setDetailsRoom] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [roomFilter, setRoomFilter] = useState("All");
  const [menuFilter, setMenuFilter] = useState("All");
  const [formData, setFormData] = useState(emptyForm);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [cart, setCart] = useState({});
  const [menu, setMenu] = useState([]);
  const [menuError, setMenuError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountTab, setAccountTab] = useState(null);
  const [guestNames, setGuestNames] = useState({});
  const [bookingStep, setBookingStep] = useState(0);

  useEffect(() => {
    if (window.CSS?.supports("animation-timeline", "scroll()") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = null;
    const root = document.documentElement;
    const paint = () => {
      frame = null;
      root.style.setProperty("--hotel-scroll-travel", Math.min(Math.max(window.scrollY, 0) / 360, 1));
    };
    const onScroll = () => { if (frame === null) frame = window.requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--hotel-scroll-travel");
    };
  }, []);
  const [roomSelections, setRoomSelections] = useState({});
  const [roomInventory, setRoomInventory] = useState(null);
  const [bookingReceipts, setBookingReceipts] = useState([]);
  const [bookingError, setBookingError] = useState("");
  const [extras, setExtras] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [extrasError, setExtrasError] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState(null);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);

  const navLinkStyle = {
    margin: "0 15px",
    textDecoration: "none",
    color: "#f3ead7",
    fontWeight: "500",
    transition: "color 0.3s ease",
  };



  useEffect(() => {
    const controller = new AbortController();
    fetch(API + "/rooms?all=1", { signal: controller.signal }).then(readJson)
      .then(setRoomInventory)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const rooms = roomInventory ? roomInventory.filter((item) => item.is_active).map((item) => {
    const description = roomDescriptions.find((entry) => entry.name === item.name)
      || roomDescriptions.find((entry) => entry.name.toLowerCase().replaceAll(" ", "-") === item.slug);
    return { ...description, ...item, image: item.image ?? description?.image, bed: item.bed ?? description?.bed, description: item.description ?? description?.description, price: Number(item.price), capacity: Number(item.capacity) };
  }) : roomDescriptions;
  const roomsSelected = rooms.filter((room) => roomSelections[room.name]).map((room) => ({
    ...roomSelections[room.name], roomType: room.name, price: room.price,
  }));
  const bookedUnits = roomsSelected.flatMap(({ roomType, guests, quantity }) =>
    Array.from({ length: quantity }, (_, index) => ({ roomType, guests, key: roomType + ":" + index }))
  );

  const totalRooms = roomsSelected.reduce((total, item) => total + item.quantity, 0);

  function changeRoomSelection(room, changes) {
    setRoomSelections((previous) => {
      const next = { ...previous };
      if (changes === null) delete next[room.name];
      else next[room.name] = { guests: 1, quantity: 1, ...previous[room.name], ...changes };
      return next;
    });
    setBookingError("");
    removeVoucher();
  }

  const roomCategories = ["All", ...new Set(rooms.map((room) => room.category))];

  const visibleRooms =
    roomFilter === "All" ? rooms : rooms.filter((r) => r.category === roomFilter);



  const menuCategories = ["All", ...new Set(menu.map((item) => item.category))];

  async function refreshMenu(signal) {
    const items = await fetch(API + "/menu", { cache: "no-store", signal }).then(readJson);
    if (signal?.aborted) return items;
    setMenu(items);
    setMenuError("");
    setCart((previous) => Object.fromEntries(Object.values(previous).map((line) => {
      const current = items.find((item) => item.id === line.id);
      return [line.id, current ? { ...line, title: current.title, price: Number(current.price), availability: current.availability } : { ...line, availability: "unavailable" }];
    })));
    return items;
  }

  useEffect(() => {
    const controller = new AbortController();
    const load = () => refreshMenu(controller.signal).catch(() => {
      if (!controller.signal.aborted) setMenuError("The menu could not load. Please try again.");
    });
    load();
    const timer = setInterval(load, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  const addToCart = (item) => {
    if (item.availability !== "available") return;
    setCart((previous) => ({
      ...previous,
      [item.id]: { id: item.id, title: item.title, price: Number(item.price), availability: item.availability,
        qty: Math.min((previous[item.id]?.qty || 0) + 1, 50) },
    }));
  };

  async function orderAgain(order) {
    const items = await refreshMenu();
    const selection = {};
    let skipped = 0;
    for (const line of order.items || []) {
      const item = items.find((candidate) => line.id ? candidate.id === line.id : candidate.title === line.title);
      if (!item || item.availability !== "available") {
        skipped++;
        continue;
      }
      const qty = Math.min((selection[item.id]?.qty || 0) + Number(line.qty || line.quantity || 1), 50);
      selection[item.id] = { id: item.id, title: item.title, price: Number(item.price), availability: item.availability, qty };
    }
    if (!Object.keys(selection).length) throw new Error("The items in this order are currently unavailable.");
    setCart((previous) => ({ ...previous, ...selection }));
    setCartNotice(skipped ? "Unavailable items were left out. Review your cart before ordering." : "Review your cart and current prices before ordering.");
    setAccountTab(null);
    setIsCartOpen(true);
  }

  function bookAgain(booking) {
    const room = rooms.find((item) => (booking.roomId && item.id === booking.roomId) || item.name === booking.roomType);
    if (!room || room.total_units === 0) throw new Error("This room type is currently unavailable.");
    setAccountTab(null);
    openBookingForm(room.name, "", booking.guests);
  }

  const cartCount = Object.values(cart).reduce((sum, line) => sum + line.qty, 0);

  const handleOpenCart = () => {
    if (!user) {
      setPendingBooking(null);
      setIsLoginOpen(true);
      return;
    }
    setIsCartOpen(true);
  };

  const visibleFood =
    menuFilter === "All" || !menuCategories.includes(menuFilter) ? menu : menu.filter((item) => item.category === menuFilter);

  const paymentOptions = ["GCash", "Cash",];

  const today = hotelToday();
  const minCheckOut = formData.checkIn ? addDays(formData.checkIn, 1) : addDays(today, 1);
  const datesChosen = Boolean(formData.checkIn && formData.checkOut);
  const datesValid = datesChosen && formData.checkOut > formData.checkIn;

  const calculateNights = () => {
    if (!datesValid) return 0;
    const start = new Date(formData.checkIn + "T00:00:00");
    const end = new Date(formData.checkOut + "T00:00:00");
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();
  const baseAmount = roomsSelected.reduce((total, item) => total + nights * item.price * item.quantity, 0);
  const discountAmount = voucher
    ? Math.min(
        baseAmount,
        Math.round((voucher.discountType === "fixed" ? voucher.discountValue : (baseAmount * voucher.discountValue) / 100) * 100) / 100
      )
    : 0;
  const extraAmount = (item) => roomsSelected.reduce((total, room) => {
    const multiplier = { night: nights, guest: room.guests, item: selectedExtras[item.id], stay: 1 }[item.unit];
    return total + (Math.round(Number(item.price) * multiplier * 100) / 100) * room.quantity;
  }, 0);
  const extrasTotal = extras.filter((item) => selectedExtras[item.id]).reduce((sum, item) => sum + extraAmount(item), 0);
  const totalAmount = Math.max(0, baseAmount - discountAmount) + extrasTotal;

  const applyVoucher = async () => {
    const code = voucherInput.trim();
    if (!code) return;
    setVoucherBusy(true);
    setVoucherMsg("");
    try {
      const response = await fetch(`${API}/vouchers/check?code=${encodeURIComponent(code)}&amount=${baseAmount}`);
      const result = await response.json();
      if (!response.ok) {
        setVoucher(null);
        setVoucherMsg(result.message || "This discount code is not valid.");
        return;
      }
      setVoucher(result);
    } catch (error) {
      console.error(error);
      setVoucher(null);
      setVoucherMsg("Cannot reach the server.");
    } finally {
      setVoucherBusy(false);
    }
  };

  const removeVoucher = () => {
    setVoucher(null);
    setVoucherInput("");
    setVoucherMsg("");
  };

  const openBookingForm = (roomName, checkIn = "", guests = 1) => {
    setFormData({
      ...emptyForm,
      guestName: user?.displayName || user?.name || "",
      email: user?.email || "",
      checkIn,
      checkOut: checkIn ? addDays(checkIn, 1) : "",
    });
    const initialRoom = roomName && rooms.find((room) => room.name === roomName && room.total_units !== 0);
    setRoomSelections(initialRoom ? { [initialRoom.name]: { quantity: 1, guests: Math.min(Number(guests) || 1, initialRoom.capacity) } } : {});
    setBookingReceipt(null);
    setBookingReceipts([]);
    setBookingError("");
    setBookingStep(0);
    setGuestNames({});
    setSelectedExtras({});
    setExtras([]);
    setExtrasError("");
    fetch(API + "/rooms?all=1").then(readJson).then(setRoomInventory).catch(() => {});
    fetch(API + "/extras").then(readJson).then(setExtras)
      .catch(() => setExtrasError("Extras could not load. You can continue without them."));
    removeVoucher();
    setIsModalOpen(true);
  };

  const handleOpenModal = (roomName, checkIn) => {
    if (!user) {
      setPendingBooking({ roomName: roomName || null, checkIn });
      setIsLoginOpen(true);
      return;
    }
    openBookingForm(roomName, checkIn);
  };

  const handleOpenLogin = () => {
    setPendingBooking(null);
    setIsLoginOpen(true);
  };

  const handleCloseLogin = () => {
    setIsLoginOpen(false);
    setPendingBooking(null);
  };

  useEffect(() => {
    if (!user) return;
    setIsLoginOpen(false);
    if (pendingBooking) {
      openBookingForm(pendingBooking.roomName, pendingBooking.checkIn);
      setPendingBooking(null);
    }
  }, [user]);

  useEffect(() => {
    if (authError && !user) setIsLoginOpen(true);
  }, [authError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "checkIn" && next.checkOut && next.checkOut <= value) {
        next.checkOut = "";
      }
      return next;
    });
  };

  const handleSelectPayment = (method) => {
    setFormData((prev) => ({ ...prev, paymentMethod: method }));
  };

 
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setBookingError("");
    if (!totalRooms || totalRooms > 20) return;
    if (bookingStep < 3) {
      if (bookingStep === 1 && !datesValid) return;
      setBookingStep((step) => step + 1);
      return;
    }
    if (!datesValid || submittingBooking) return;
    setSubmittingBooking(true);
    try {
      const response = await accountFetch(`${API}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: formData.guestName,
          email: formData.email,
          phone: formData.phone.replace(/[\s-]/g, ""),
          rooms: bookedUnits.map(({ roomType, guests, key }, roomIndex) => ({
            roomType, guests, quantity: 1,
            guestNames: Array.from({ length: guests }, (_, personIndex) =>
              roomIndex === 0 && personIndex === 0 ? formData.guestName.trim() : (guestNames[key + ":" + personIndex] || "").trim()),
          })),
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          paymentMethod: formData.paymentMethod,
          paymentReference: formData.paymentMethod === "GCash" ? formData.paymentReference.trim() : null,
          voucherCode: voucher ? voucher.code : null,
          extraSelections: Object.entries(selectedExtras).map(([id, quantity]) => ({ id: Number(id), quantity })),
          expectedTotal: totalAmount,
          notes: formData.notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setBookingError(result.message || "The reservation could not be saved.");
        return;
      }

      setBookingReceipt(result.reservation);
      setBookingReceipts(result.reservations || [result.reservation]);
    } catch (error) {
      console.error("Error submitting reservation:", error);
      setBookingError("The reservation server is unavailable. Please try again.");
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCloseModal = () => {
    if (submittingBooking) return;
    setIsModalOpen(false);
    setBookingReceipt(null);
    setFormData(emptyForm);
    removeVoucher();
  };

  const handleViewReceipt = (reservation) => {
    setAccountTab(null);
    setBookingReceipts([]);
    setBookingReceipt(reservation);
    setIsModalOpen(true);
  };

  const receiptRowStyle = { display: "flex", justifyContent: "space-between", gap: "12px" };

  const receiptRows = bookingReceipt
    ? [
        ["Guest Name:", bookingReceipt.guestName],
        ["Email:", bookingReceipt.email],
        ["Contact Phone:", bookingReceipt.phone],
        ["Selected Room:", bookingReceipt.roomType],
        ["Room Number:", bookingReceipt.roomNumber || "Assigned once confirmed"],
        ["Guests:", bookingReceipt.guests],
        ...(bookingReceipt.guestNames?.length ? [["Room occupants:", bookingReceipt.guestNames.join(", ")]] : []),
        ["Check-In Date:", formatDate(bookingReceipt.checkIn)],
        ["Check-Out Date:", formatDate(bookingReceipt.checkOut)],
        ...(bookingReceipt.actualCheckOut ? [["Actual Check-Out:", formatDate(bookingReceipt.actualCheckOut)]] : []),
        ["Duration:", `${bookingReceipt.nights} night(s)`],
        ["Payment Method:", bookingReceipt.paymentMethod],
        ...(bookingReceipt.paymentMethod === "GCash" && bookingReceipt.paymentReference
          ? [["GCash Reference:", bookingReceipt.paymentReference]]
          : []),
        ["Payment Status:", bookingReceipt.paymentStatus || "Unpaid"],
        ...(Number(bookingReceipt.discountAmount) > 0
          ? [[`Discount (${bookingReceipt.voucherCode}):`, "-" + peso(bookingReceipt.discountAmount)]]
          : []),
        ...(bookingReceipt.extras || []).map((item) => [item.name, peso(item.amount)]),
        ["Special Requests:", bookingReceipt.notes || "None"],
        ["Booking Status:", bookingReceipt.status],
      ]
    : [];

  const receiptTones = {
    Pending: { bg: "#fff4dc", color: "#8a5a00", text: "Reservation received. Waiting for the hotel to confirm it." },
    Confirmed: { bg: "#e6f4ea", color: "#1e6b34", text: "Booking confirmed" },
    "Checked out": { bg: "#e6f4ea", color: "#1e6b34", text: "Checkout recorded" },
    Cancelled: { bg: "#fbe9e7", color: "#b22222", text: "This booking was cancelled" },
  };
  const receiptTone = receiptTones[bookingReceipt?.status] || receiptTones.Pending;

  const authButtonStyle = {
    marginLeft: "12px",
    backgroundColor: "transparent",
    color: "#d8b46a",
    border: "1px solid #d8b46a",
    padding: "7px 16px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background-color 0.25s ease, color 0.25s ease",
  };



  return (
    <div className="guest-site-shell"
      style={{
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        color: "#333",
        margin: 0,
        padding: 0,
        width: "100%",
        overflowX: "clip",
      }}
    >
      <style>{hotelStyles}</style>
      <div className="guest-moving-background" aria-hidden="true" />

      <header className="hotel-navigation" data-menu-open={mobileMenuOpen}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "15px 40px",
          backgroundColor: "rgba(16, 41, 42, 0.96)",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          boxSizing: "border-box",
          zIndex: 1000,
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <a className="hotel-brand" href="#home" onClick={() => setMobileMenuOpen(false)}>
          <span className="hotel-monogram" aria-hidden="true">H</span>
          <span>Hytech<small>Hotel &amp; Bistro</small></span>
        </a>
        <button type="button" className="hotel-menu-toggle" aria-controls="hotel-navigation-links"
          aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>
          {mobileMenuOpen ? "Close menu" : "Menu"}
        </button>
        <nav id="hotel-navigation-links" aria-label="Hotel navigation" style={{ display: "flex", alignItems: "center" }}
          onClick={(event) => { if (event.target.closest("a, button")) setMobileMenuOpen(false); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMobileMenuOpen(false);
              event.currentTarget.previousElementSibling?.focus();
            }
          }}>
          <a href="#home" style={navLinkStyle}>
            Home
          </a>
          <a href="#hotel" style={navLinkStyle}>
            The Hotel
          </a>
          <a href="#rooms" style={navLinkStyle}>
            Our Rooms
          </a>
          <a href="#food" style={navLinkStyle}>
            Food & Drink
          </a>
          <a href="#contact" style={navLinkStyle}>
            Contact
          </a>
          <a href="#reviews" style={navLinkStyle}>Reviews</a>
          <button className="hotel-booking-link"
            onClick={() => handleOpenModal()}
            style={{
              backgroundColor: "#d8b46a",
              color: "#10292a",
              border: "none",
              padding: "8px 18px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Booking
          </button>
          <button type="button" style={authButtonStyle} onClick={() => setAccountTab("profile")}>
            {user?.photoURL && <img className="guest-nav-avatar" src={user.photoURL} alt="" />}Profile
          </button>
        </nav>
      </header>

      <section
        id="home" className="hotel-hero"
        style={{
          backgroundImage: "url('https://www.travelorientalmindoro.ph/uploads/places/173/gallery/20251211023658_6d782088.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "80px",
          boxSizing: "border-box",
        }}
      >
        <div className="hotel-hero-panel"
          style={{
            backgroundColor: "rgba(16, 41, 42, 0.85)",
            padding: "40px",
            borderRadius: "12px",
            textAlign: "center",
            maxWidth: "700px",
            width: "90%",
            margin: "0 20px",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.15)",
          }}
        >
          <p style={{ fontSize: "1rem", color: "#d8b46a" }}>
            ⭐ 4.8 (Google Reviews)
          </p>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              color: "#ffffff",
              margin: "10px 0",
            }}
          >
            Experience Comfort in the Heart of Hytech Hotel & Bistro
          </h1>
          <p style={{ fontSize: "1.2rem", color: "#e6dcc6" }}>
            Immaculate accommodations, seamless booking, and exceptional hospitality.
          </p>
          <div style={{ marginTop: "20px" }}>
            <button
              onClick={() => handleOpenModal()}
              style={{
                backgroundColor: "#d8b46a",
                color: "#10292a",
                border: "none",
                padding: "12px 24px",
                marginRight: "10px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              Reserve Now
            </button>
            <a
              href="#contact"
              style={{
                backgroundColor: "transparent",
                border: "2px solid #d8b46a",
                color: "#d8b46a",
                textDecoration: "none",
                padding: "12px 24px",
                borderRadius: "4px",
                display: "inline-block",
                fontSize: "1rem",
              }}
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      <section
        id="hotel" className="hotel-features"
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-around",
          padding: "60px 40px",
          backgroundColor: "#faf6ec",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        {[
          {
            title: "Personalized Hospitality",
            text: "We provide tailored guest services designed to make you feel completely at home while attending to your every requirement.",
          },
          {
            title: "Exclusive Perks",
            text: "Enjoy complimentary fitness center access alongside dining discounts. Discover Roxas by foot or bicycle.",
          },
          {
            title: "Prime Accessibility",
            text: "Conveniently situated near major transportation terminals, providing effortless access to local landmarks.",
          },
        ].map((info, i) => (
          <div
            key={i}
            style={{
              width: "320px",
              flex: "1 1 280px",
              background: "white",
              padding: "20px",
              borderRadius: "8px",
              borderTop: "3px solid #d8b46a",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ color: "#1d3f40", marginTop: 0 }}>{info.title}</h3>
            <p style={{ lineHeight: "1.6", color: "#666" }}>{info.text}</p>
          </div>
        ))}
      </section>

      <section
        id="rooms" className="hotel-rooms"
        style={{ width: "100%", boxSizing: "border-box", padding: "60px 40px", backgroundColor: "#f3ead7" }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: "10px",
            color: "#1d3f40",
          }}
        >
          Our Accommodations
        </h2>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "26px" }}>
          {rooms.length} room types for solo travelers, couples, families, and groups.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "36px",
          }}
        >
          {roomCategories.map((cat) => (
            <button
              key={cat}
              className={`bb-chip${roomFilter === cat ? " active" : ""}`}
              onClick={() => setRoomFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: "1400px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "24px",
          }}
        >
          {visibleRooms.map((room) => (
            <div
              key={room.name}
              className="bb-room-card"
              style={{
                background: "white",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div className="bb-room-media">
                  {room.image && <img
                    src={room.image}
                    alt={room.name}
                    style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
                  />}
                  <span className="bb-room-tag">{room.category}</span>
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ margin: "0 0 6px 0", color: "#1d3f40", fontSize: "1.1rem" }}>
                    {room.name}
                  </h3>
                  <p style={{ margin: "0 0 10px 0", fontSize: "0.82rem", color: "#777" }}>
                    Up to {room.capacity} guest{room.capacity > 1 ? "s" : ""} · {room.bed}
                  </p>
                  <p
                    style={{
                      fontWeight: "bold",
                      color: "#9a7430",
                      margin: "0 0 10px 0",
                      fontSize: "1rem",
                    }}
                  >
                    ₱{room.price.toLocaleString()} / night
                  </p>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "#666",
                      lineHeight: "1.5",
                      margin: 0,
                    }}
                  >
                    {room.description}
                  </p>
                </div>
              </div>
              <div style={{ padding: "16px", paddingTop: 0 }}>
                <button type="button" className="room-details-link" onClick={() => setDetailsRoom(room)}>
                  View room details
                </button>
                <button
                  className="bb-room-btn"
                  onClick={() => handleOpenModal(room.name)}
                  style={{
                    width: "100%",
                    backgroundColor: "#d8b46a",
                    color: "#10292a",
                    border: "none",
                    padding: "11px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Reserve Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="food"
        className="bb-menu"
        style={{ width: "100%", boxSizing: "border-box", padding: "80px 40px" }}
      >
        <div style={{ maxWidth: "1300px", margin: "0 auto 36px", textAlign: "left" }}>
          <h2 style={{ color: "#fff", fontSize: "2.2rem", margin: "0 0 10px" }}>
            Dining & Beverages
          </h2>
          <p style={{ color: "#d9cfb8", maxWidth: "560px", lineHeight: "1.6", margin: "0 0 26px" }}>
            Fresh local seafood, hot breakfast plates, and cold drinks, served at the bistro and on the rooftop deck.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {menuCategories.map((cat) => (
              <button
                key={cat}
                className={`bb-menu-tab${menuFilter === cat ? " active" : ""}`}
                onClick={() => setMenuFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {menuError && <p role="status" className="account-notice">{menuError} <button type="button" className="hotel-action secondary" onClick={() => refreshMenu().catch(() => {})}>Retry</button></p>}
        <div className="bb-menu-grid">
          {visibleFood.map((item) => (
            <div key={item.id} className="bb-menu-card">
              {item.image && <img src={item.image} alt={item.title} />}
              <div className="bb-menu-shade" />
              <span className="bb-menu-badge">{item.category}</span>
              <span className="bb-menu-price">{peso(item.price)}</span>
              <div className="bb-menu-body">
                <h4 className="bb-menu-title">{item.title}</h4>
                <div className="bb-menu-line" />
                <p className="bb-menu-desc">{item.desc}</p>
                <button
                  type="button"
                  className="bb-menu-add"
                  disabled={item.availability !== "available"}
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(item);
                  }}
                >
                  {item.availability === "out_of_stock" ? "Out of stock" : item.availability === "unavailable" ? "Unavailable" : cart[item.id] ? `Add another (${cart[item.id].qty} in order)` : "Add to order"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <GuestReviews api={API} user={user} rooms={rooms} onOpenRoom={setDetailsRoom} onLogin={handleOpenLogin} />

      <section
        id="contact"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "60px 40px",
          background: "linear-gradient(160deg, #10292a 0%, #1d3f40 55%, #2a5253 100%)",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#ffffff", marginBottom: "20px" }}>Contact Us</h2>
        <div style={{ marginTop: "20px", lineHeight: "1.8", color: "#e6dcc6" }}>
          <p>
            <strong>Address:</strong> Bongabong, Oriental Mindoro, Philippines
          </p>
          <p>
            <strong>Phone:</strong> +63 (09) 66793-2441
          </p>
          <p>
            <strong>Email:</strong> hytechhotel@gmail.com
          </p>
        </div>
      </section>

      <footer
        style={{
          width: "100%",
          boxSizing: "border-box",
          backgroundColor: "#0b1f20",
          color: "#e6dcc6",
          textAlign: "center",
          padding: "25px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "15px",
        }}
      >
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Hytech HOTEL AND BISTRO. All rights reserved.
        </p>
      </footer>

      {detailsRoom && (
        <RoomDetails
          key={detailsRoom.name}
          room={detailsRoom}
          rooms={rooms}
          api={API}
          today={today}
          onClose={() => setDetailsRoom(null)}
          onSelectRoom={setDetailsRoom}
          onReserve={(date) => {
            setDetailsRoom(null);
            handleOpenModal(detailsRoom.name, date);
          }}
        />
      )}

      {isModalOpen && (
        <div
          className="bb-overlay"
          onClick={handleCloseModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(8, 22, 22, 0.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            className={bookingReceipt ? "bb-modal hotel-receipt" : "bb-modal hotel-reservation"}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#faf6ec",
              borderTop: "5px solid #d8b46a",
              padding: "28px",
              borderRadius: "16px",
              maxWidth: "560px",
              width: "92%",
              maxHeight: "92vh",
              overflowY: "auto",
              position: "relative",
              boxSizing: "border-box",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              colorScheme: "light",
            }}
          >
            <button
              className="bb-close"
              onClick={handleCloseModal}
              disabled={submittingBooking}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                border: "none",
                background: "none",
                fontSize: "1.1rem",
                cursor: "pointer",
                color: "#666",
              }}
            >
              ✕
            </button>

            {bookingReceipt ? (
              <div>
                {bookingReceipts.length > 1 && (
                  <div className="batch-receipt-summary">
                    <strong>{bookingReceipts.length} rooms reserved ? {peso(bookingReceipts.reduce((sum, item) => sum + Number(item.totalAmount), 0))}</strong>
                    <div>{bookingReceipts.map((item) => (
                      <button key={item.id} type="button" className="hotel-action secondary"
                        aria-pressed={bookingReceipt.id === item.id} onClick={() => setBookingReceipt(item)}>
                        {item.roomType} ? {item.code}
                      </button>
                    ))}</div>
                  </div>
                )}
                <div
                  style={{
                    backgroundColor: receiptTone.bg,
                    color: receiptTone.color,
                    padding: "12px",
                    borderRadius: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    margin: "6px 30px 20px 0",
                    fontSize: "1.05rem",
                  }}
                >
                  {receiptTone.text}
                </div>

                <div
                  style={{
                    border: "1px dashed #1d3f40",
                    borderRadius: "10px",
                    padding: "20px",
                    backgroundColor: "#fffdf7",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      borderBottom: "1px solid #ddd",
                      paddingBottom: "10px",
                      marginBottom: "15px",
                    }}
                  >
                    <h3 style={{ margin: 0, color: "#1d3f40" }}>HYTECH HOTEL AND BISTRO</h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                      Official Reservation Receipt
                    </p>
                  </div>

                  <div style={{ fontSize: "0.9rem", lineHeight: "1.8", color: "#333" }}>
                    <div style={receiptRowStyle}>
                      <span><strong>Booking Reference:</strong></span>
                      <span style={{ color: "#9a7430", fontWeight: "bold" }}>{bookingReceipt.id}</span>
                    </div>
                    {receiptRows.map(([label, value]) => (
                      <div key={label} style={receiptRowStyle}>
                        <span><strong>{label}</strong></span>
                        <span style={{ textAlign: "right" }}>{value}</span>
                      </div>
                    ))}

                    <div
                      style={{
                        ...receiptRowStyle,
                        borderTop: "2px solid #1d3f40",
                        marginTop: "12px",
                        paddingTop: "10px",
                        fontSize: "1.1rem",
                      }}
                    >
                      <span><strong>Total Amount:</strong></span>
                      <span style={{ color: "#1d3f40", fontWeight: "bold" }}>
                        {peso(bookingReceipt.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    textAlign: "center",
                    fontSize: "0.85rem",
                    color: "#666",
                    marginTop: "15px",
                  }}
                >
                  Thank you for booking with HYTECH HOTEL AND BISTRO! Keep this receipt. You can open it again anytime from Profile, and we will text you when the hotel confirms.
                </p>

                <button
                  className="bb-submit"
                  onClick={handleCloseModal}
                  style={{ marginTop: "10px" }}
                >
                  Close Receipt
                </button>
              </div>
            ) : (
              <div className="booking-wizard">
                <header>
                  <h3>Reserve your stay</h3>
                  <p>Choose your rooms, add your details, and confirm your stay.</p>
                </header>
                <ol className="booking-steps">
                  {["Rooms", "Your stay", "Extras", "Payment"].map((label, index) => (
                    <li key={label} aria-current={bookingStep === index ? "step" : undefined} data-complete={index < bookingStep}>
                      <span>{index + 1}</span>{label}
                    </li>
                  ))}
                </ol>
                <form onSubmit={handleSubmitBooking}>
                  <div className="booking-screen" key={bookingStep}>
                    {bookingStep === 0 && <>
                      <div className="booking-room-heading">
                        <h4>Choose your rooms</h4><span>{totalRooms} selected</span>
                      </div>
                      <p>Mix room types or book several rooms with the same stay dates.</p>
                      <div className="booking-room-list">
                        {rooms.map((room) => {
                          const selection = roomSelections[room.name];
                          const roomLimit = Math.min(room.total_units ?? 1, 20 - totalRooms + (selection?.quantity || 0));
                          return (
                            <div key={room.name} className="booking-room-choice">
                              <label className="booking-option">
                                <input type="checkbox" checked={Boolean(selection)} disabled={!selection && roomLimit < 1}
                                  onChange={(event) => changeRoomSelection(room, event.target.checked ? {} : null)} />
                                {room.image && <img src={room.image} alt="" loading="lazy" />}
                                <span><strong>{room.name}</strong><small>{peso(room.price)} / night · Up to {room.capacity} guests</small></span>
                              </label>
                              {selection && (
                                <div className="booking-room-quantities">
                                  <label>Rooms<select className="bb-input" value={selection.quantity}
                                    onChange={(event) => changeRoomSelection(room, { quantity: Number(event.target.value) })}>
                                    {Array.from({ length: roomLimit }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                                  </select></label>
                                  <label>Guests per room<select className="bb-input" value={selection.guests}
                                    onChange={(event) => changeRoomSelection(room, { guests: Number(event.target.value) })}>
                                    {Array.from({ length: room.capacity }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                                  </select></label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>}
                    {bookingStep === 1 && <>
                  <div className="bb-field">
                    <label className="bb-label" htmlFor="guestName">Full name</label>
                    <input
                      id="guestName"
                      className="bb-input"
                      type="text"
                      name="guestName"
                      placeholder="Juan Dela Cruz"
                      required
                      value={formData.guestName}
                      onChange={handleInputChange}
                    />
                  </div>

                  {bookedUnits.map((unit, roomIndex) => (roomIndex > 0 || unit.guests > 1) && (
                    <fieldset className="booking-price-breakdown" key={unit.key}>
                      <legend className="bb-label">Guest names {"\u00b7"} {unit.roomType} {bookedUnits.length > 1 ? "(room " + (roomIndex + 1) + ")" : ""}</legend>
                      {Array.from({ length: unit.guests }, (_, personIndex) => {
                        if (roomIndex === 0 && personIndex === 0) return null;
                        const field = unit.key + ":" + personIndex;
                        return <label className="booking-guest-name" key={field}>
                          Guest {personIndex + 1} full name
                          <input required maxLength={100} className="bb-input" value={guestNames[field] || ""}
                            onChange={(event) => setGuestNames((previous) => ({ ...previous, [field]: event.target.value }))} />
                        </label>;
                      })}
                    </fieldset>
                  ))}

                  <div className="bb-grid-2 bb-field">
                    <div>
                      <label className="bb-label" htmlFor="email">Email address</label>
                      <input
                        id="email" readOnly
                        className="bb-input"
                        type="email"
                        name="email"
                        placeholder="name@email.com"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label className="bb-label" htmlFor="phone">Contact number</label>
                      <input
                        id="phone"
                        className="bb-input"
                        type="tel"
                        name="phone"
                        placeholder="09XX XXX XXXX"
                        required
                        pattern="^(\+?63|0)9[\d\s\-]{9,12}$"
                        title="Enter a mobile number like 0917 123 4567. We text your booking updates to this number."
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="bb-grid-2 bb-field">
                    <div>
                      <label className="bb-label" htmlFor="checkIn">Check-in</label>
                      <input
                        id="checkIn"
                        className="bb-input"
                        type="date"
                        name="checkIn"
                        min={today}
                        required
                        value={formData.checkIn}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label className="bb-label" htmlFor="checkOut">Check-out</label>
                      <input
                        id="checkOut"
                        className="bb-input"
                        type="date"
                        name="checkOut"
                        min={minCheckOut}
                        required
                        value={formData.checkOut}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                    </>}
                    {bookingStep === 2 && <section className="booking-extras">
                      <h4>Make your stay your own</h4>
                      <p>Selected services apply to every room. Per-guest services are charged once for each guest.</p>
                      {extrasError && <p role="status">{extrasError}</p>}
                      {!extras.length && !extrasError && <p>No extras are currently listed.</p>}
                      {extras.map((item) => {
                        const quantity = selectedExtras[item.id];
                        return (
                          <div key={item.id} className="booking-room-choice">
                            <label className="booking-option">
                              <input type="checkbox" checked={Boolean(quantity)} onChange={(event) => {
                                const checked = event.target.checked;
                                setSelectedExtras((previous) => {
                                  const next = { ...previous };
                                  if (checked) next[item.id] = 1;
                                  else delete next[item.id];
                                  return next;
                                });
                              }} />
                              <span><strong>{item.name}</strong><small>{peso(item.price)} · {extraUnits[item.unit]}</small>
                                <span>{item.description}</span>
                                {quantity && <strong>{peso(extraAmount(item))}</strong>}
                              </span>
                            </label>
                            {quantity && item.unit === "item" && (
                              <label className="booking-extra-quantity">Quantity per room
                                <select className="bb-input" value={quantity} onChange={(event) => {
                                  const value = Number(event.target.value);
                                  setSelectedExtras((previous) => ({ ...previous, [item.id]: value }));
                                }}>
                                  {Array.from({ length: 20 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
                                </select>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </section>}
                    {bookingStep === 3 && <>
                      <dl className="booking-price-breakdown">
                        <div><dt>Room charges</dt><dd>{peso(baseAmount)}</dd></div>
                        {discountAmount > 0 && <div><dt>Room discount</dt><dd>-{peso(discountAmount)}</dd></div>}
                        {extrasTotal > 0 && <div><dt>Optional extras</dt><dd>{peso(extrasTotal)}</dd></div>}
                        <div><dt>Total</dt><dd>{peso(totalAmount)}</dd></div>
                      </dl>
                  <div className="bb-field">
                    <span className="bb-label">Payment method</span>
                    <div className="bb-pay-grid">
                      {paymentOptions.map((method) => (
                        <button
                          type="button"
                          key={method}
                          className={`bb-pay${formData.paymentMethod === method ? " active" : ""}`}
                          onClick={() => handleSelectPayment(method)}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.paymentMethod === "GCash" && (
                    <div
                      className="bb-field"
                      style={{ padding: "14px", border: "1px solid #dcc99b", borderRadius: "10px", backgroundColor: "#f3ead7" }}
                    >
                      <div style={{ fontSize: "0.88rem", color: "#1d3f40", lineHeight: 1.6, marginBottom: "10px" }}>
                        Send {datesValid ? peso(totalAmount) : "the total"} to GCash number <strong>{GCASH_NUMBER}</strong> ({GCASH_NAME}), then enter the reference number from your GCash receipt.
                      </div>
                      <label className="bb-label" htmlFor="paymentReference">GCash reference number</label>
                      <input
                        id="paymentReference"
                        className="bb-input"
                        type="text"
                        name="paymentReference"
                        placeholder="13-digit reference number"
                        required
                        minLength={6}
                        value={formData.paymentReference}
                        onChange={handleInputChange}
                      />
                    </div>
                  )}

                  <div className="bb-field">
                    <label className="bb-label" htmlFor="voucherCode">Discount code (optional)</label>
                    {voucher ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#e6f4ea", color: "#1e6b34", fontWeight: "600", fontSize: "0.9rem" }}>
                        <span>
                          {voucher.code} applied
                          {voucher.discountType === "percent" ? ` (${voucher.discountValue}% off)` : ` (${peso(voucher.discountValue)} off)`}
                        </span>
                        <button type="button" onClick={removeVoucher} style={{ background: "none", border: "none", color: "#1e6b34", cursor: "pointer", fontWeight: "700", textDecoration: "underline" }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          id="voucherCode"
                          className="bb-input"
                          type="text"
                          placeholder="Enter code"
                          value={voucherInput}
                          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                        />
                        <button
                          type="button"
                          onClick={applyVoucher}
                          disabled={voucherBusy || !voucherInput.trim()}
                          style={{ backgroundColor: "#10292a", color: "#d8b46a", border: "none", borderRadius: "8px", padding: "0 18px", fontWeight: "700", cursor: "pointer", opacity: voucherBusy || !voucherInput.trim() ? 0.5 : 1 }}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    {voucherMsg && <div style={{ color: "#b22222", fontSize: "0.82rem", marginTop: "6px" }}>{voucherMsg}</div>}
                  </div>

                  <div className="bb-field">
                    <label className="bb-label" htmlFor="notes">Special requests (optional)</label>
                    <textarea
                      id="notes"
                      className="bb-input"
                      name="notes"
                      rows={2}
                      placeholder="Late arrival, extra pillows, etc."
                      value={formData.notes}
                      onChange={handleInputChange}
                      style={{ resize: "vertical" }}
                    />
                  </div>

                    </>}
                  </div>
                  {bookingError && <p role="alert" className="account-notice">{bookingError}</p>}
                  <div className="booking-footer">
                    <div aria-live="polite">
                      <small>{totalRooms} {totalRooms === 1 ? "room" : "rooms"}{nights > 0 ? " / " + nights + (nights === 1 ? " night" : " nights") : ""}</small>
                      <strong>{datesValid ? peso(totalAmount) : "Choose stay dates"}</strong>
                    </div>
                    <div>
                      {bookingStep > 0 && <button type="button" className="hotel-action secondary" disabled={submittingBooking}
                        onClick={() => setBookingStep((step) => step - 1)}>Back</button>}
                      <button type="submit" className="hotel-action booking-next" disabled={submittingBooking || !totalRooms || (bookingStep === 1 && !datesValid)}>
                        {submittingBooking ? "Submitting…" : ["Guest details", "Choose extras", "Continue to payment", "Reserve " + totalRooms + (totalRooms === 1 ? " room" : " rooms")][bookingStep]}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {cartCount > 0 && !isCartOpen && (
        <button type="button" className="bb-tray" onClick={handleOpenCart}>
          View order ({cartCount})
        </button>
      )}

      {isCartOpen && user && (
        <FoodOrder cart={cart} setCart={setCart} menu={menu} addToCart={addToCart} user={user} onClose={() => { setIsCartOpen(false); setCartNotice(""); }} notice={cartNotice} refreshMenu={refreshMenu} />
      )}

      {accountTab && !isLoginOpen && (
        <GuestAccount api={API} user={user} menu={menu} rooms={[...rooms, ...roomDescriptions]} onLogin={handleOpenLogin} onLogout={onLogout}
          onClose={() => setAccountTab(null)} onViewReceipt={handleViewReceipt} onSaveProfile={onSaveProfile} onBookAgain={bookAgain} onOrderAgain={orderAgain} />
      )}

      {isLoginOpen && !user && (
        <LoginModal
          onLogin={onLogin}
          onGoogleLogin={onGoogleLogin}
          onSignup={onSignup}
          authError={authError}
          onClose={handleCloseLogin}
        />
      )}
    </div>
  );
}