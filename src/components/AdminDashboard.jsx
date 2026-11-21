import FoodOrderReport, { foodOrderHistoryDate } from "./FoodOrderReport";
import AdminCustomerService from "./AdminCustomerService";
import AdminClients from "./AdminClients";
import AdminReviews from "./AdminReviews";
import BookingReport from "./BookingReport";
import AdminIcon from "./AdminIcon";
import AdminNotifications from "./AdminNotifications";
import AdminMenu from "./AdminMenu";
import { roomDescriptions, foodItems } from "../data/hotelCatalog";
import AdminExtras from "./AdminExtras";
import AdminCalendar from "./AdminCalendar";
import { API_BASE, accountFetch, hotelToday, readJson } from "../hotel-api";
import React, { useState, useEffect, useCallback, useRef } from "react";
import AdminKeysTab from "./AdminKeysTab";

const API = API_BASE;

const peso = (value) => "₱" + Number(value || 0).toLocaleString("en-PH");

export default function AdminDashboard({ onLogout, currentUser }) {
  const notifications = useRef(null);
  const [unreadAlerts, setUnreadAlerts] = useState({ reservation: false, order: false });
  const [pressedIcon, setPressedIcon] = useState(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia("(max-width: 720px)").matches);
  const [reservations, setReservations] = useState([]);
  const [arrivalsTab, setArrivalsTab] = useState("Arrivals");

  const [searchQuery, setSearchQuery] = useState("");
  const [movementFilter, setMovementFilter] = useState(null);
  const [roomFilter, setRoomFilter] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [foodOrderTarget, setFoodOrderTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const emptyForm = {
    guestName: "",
    companions: "",
    email: "",
    phone: "",
    roomType: "Standard Room",
    checkIn: "",
    checkOut: "",
    totalAmount: 1200,
    status: "Pending",
    roomNumber: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadReservations();
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await accountFetch(`${API}/rooms?all=1`);
      if (response.ok) setRooms(await response.json());
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const loadReservations = async () => {
    try {
      const response = await accountFetch(API + "/reservations");
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((res) => ({
          id: res.reservation_code || res.code || res.id,
          dbId: res.id,
          guestName: res.guestName || res.guest_name,
          email: res.email,
          phone: res.phone,
          roomType: res.roomType || res.room_type || "Standard Room",
          checkIn: res.checkIn || res.check_in,
          checkOut: res.checkOut || res.check_out,
          actualCheckOut: res.actualCheckOut || "",
          totalAmount: Number(res.totalAmount || res.total_amount || 0),
          status: res.status || "Pending",
          roomNumber: res.roomNumber || "",
          notes: res.notes || "",
          paymentMethod: res.paymentMethod || "",
          paymentReference: res.paymentReference || "",
          paymentStatus: res.paymentStatus || "Unpaid",
          voucherCode: res.voucherCode || "",
          discountAmount: Number(res.discountAmount || 0),
          extras: res.extras || [],
          guestNames: res.guestNames || [],
          guests: Number(res.guests || 1),
          createdAt: res.createdAt,
          createdEpoch: res.createdEpoch,
        }));
        setReservations(formatted);
      }
    } catch (error) {
      console.error("Failed to load reservations from API:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    const names = [formData.guestName.trim(), ...formData.companions.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)];
    try {
      const response = await accountFetch(API + "/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: formData.guestName,
          email: formData.email,
          phone: formData.phone,
          roomType: formData.roomType,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          totalAmount: formData.totalAmount,
          status: formData.status,
          rooms: [{ roomType: formData.roomType, guests: names.length, quantity: 1, guestNames: names }],
          paymentMethod: "Cash",
        }),
      });

      if (response.ok) {
        loadReservations();
        setIsAddModalOpen(false);
        setFormData(emptyForm);
      } else {
        const result = await response.json();
        alert(result.message || "Failed to create booking.");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
    }
  };

  const handleOpenEdit = (res) => {
    setEditingId(res.dbId || res.id);
    setFormData({
      guestName: res.guestName,
      email: res.email,
      phone: res.phone,
      roomType: res.roomType,
      checkIn: res.checkIn,
      checkOut: res.checkOut,
      totalAmount: res.totalAmount,
      status: res.status,
      roomNumber: res.roomNumber || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateBooking = async (e) => {
    e.preventDefault();
    try {
      const response = await accountFetch(`${API}/reservations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: formData.guestName,
          email: formData.email,
          phone: formData.phone,
          roomType: formData.roomType,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          totalAmount: formData.totalAmount,
          status: formData.status,
          roomNumber: formData.roomNumber,
        }),
      });

      if (response.ok) {
        loadReservations();
        setIsEditModalOpen(false);
        setEditingId(null);
        setFormData(emptyForm);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.message || "Failed to update booking.");
      }
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };


  const handlePaymentToggle = async (resItem) => {
    const next = resItem.paymentStatus === "Paid" ? "Unpaid" : "Paid";
    try {
      const response = await accountFetch(`${API}/reservations/${resItem.dbId || resItem.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (response.ok) loadReservations();
      else alert("Could not update the payment status.");
    } catch (error) {
      console.error("Error updating payment:", error);
    }
  };

  const decideCalendarReservation = async (item, status, roomNumber) => {
    await readJson(await accountFetch(API + "/reservations/" + (item.dbId || item.id) + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, roomNumber, expectedStatus: "Pending" }),
    }));
    setReservations((previous) => previous.map((record) =>
      record.id === item.id ? { ...record, status, roomNumber: roomNumber || record.roomNumber } : record));
    loadReservations();
  };

  const handleEarlyCheckout = async (item) => {
    const { reservation } = await readJson(await accountFetch(API + "/reservations/" + item.dbId + "/early-checkout", {
      method: "PATCH",
    }));
    setReservations((previous) => previous.map((record) => record.dbId === item.dbId
      ? { ...record, status: reservation.status, actualCheckOut: reservation.actualCheckOut } : record));
    loadReservations();
  };

  const handleStatusQuickChange = async (resItem, newStatus) => {
    if (newStatus === "Confirmed") {
      setConfirmTarget(resItem);
      return;
    }
    const targetId = resItem.dbId || resItem.id;
    try {
      const response = await accountFetch(`${API}/reservations/${targetId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        loadReservations();
      } else {
        const errData = await response.json();
        alert("Hindi na-update ang status: " + (errData.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("May problema sa koneksyon sa server.");
    }
  };

  const handleDeleteBooking = async (resItem) => {
    const targetId = resItem.dbId || resItem.id;
    if (window.confirm("ARE YOU SURE U WANT TO DELETE?")) {
      try {
        const response = await accountFetch(`${API}/reservations/${targetId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          loadReservations();
        } else {
          alert("Failed to delete booking.");
        }
      } catch (error) {
        console.error("Error deleting booking:", error);
      }
    }
  };

  const today = hotelToday();
  const currentStays = reservations.filter((r) => r.checkIn <= today && r.checkOut > today);
  const confirmed = currentStays.filter((r) => r.status === "Confirmed");
  const totalBooked = confirmed.length;
  function matchesMovement(booking, tab, period) {
    const date = tab === "Arrivals" ? booking.checkIn : (booking.actualCheckOut || booking.checkOut);
    return ["Confirmed", "Checked out"].includes(booking.status) && Boolean(date) && (period === "Today" ? date === today : date > today);
  }

  function openBookingList(status = "All", query = "", date = "") {
    setMovementFilter(null);
    setRoomFilter("");
    setBookingDate(date);
    setSearchQuery(query);
    setFilterStatus(status);
    setActiveTab("Bookings");
  }

  function openMovement(period) {
    openBookingList();
    setMovementFilter({ tab: arrivalsTab, period });
  }

  const search = searchQuery.trim().toLowerCase();
  const shownReservations = reservations.filter((booking) =>
    (filterStatus === "All" || booking.status === filterStatus) &&
    (!bookingDate || (booking.checkIn <= bookingDate && (booking.actualCheckOut || booking.checkOut) > bookingDate)) &&
    (!roomFilter || booking.roomType === roomFilter) &&
    (!movementFilter || matchesMovement(booking, movementFilter.tab, movementFilter.period)) &&
    ([booking.guestName, booking.id, ...booking.guestNames].some((value) => String(value || "").toLowerCase().includes(search)))
  );

  const totalPending = currentStays.filter((r) => r.status === "Pending").length;
  const activeRooms = rooms.filter((r) => r.is_active);
  const roomTypesCount = Object.fromEntries(activeRooms.map((room) => [room.name, room.total_units]));
  const totalRoomUnits = Object.values(roomTypesCount).reduce((sum, n) => sum + Number(n), 0);
  const availableRoomsCount = Math.max(0, totalRoomUnits - totalBooked);
  const roomOptions = Object.keys(roomTypesCount);

  const menuItems = [
    { id: "Dashboard", label: "Dashboard" },
    { id: "Calendar", label: "Calendar" },
    { id: "Bookings", label: "Bookings" },
    { id: "Clients", label: "Clients" },
    { id: "Rooms", label: "Rooms" },
    { id: "Key Management", label: "Key Management" },
    { id: "Discounts", label: "Discounts" },
    { id: "Food Orders", label: "Food Orders" },
    { id: "Extras", label: "Extras" },
    { id: "Reviews", label: "Reviews" },
    { id: "Customer Service", label: "Customer Service" },
  ];

  return (
    <div className="hotel-admin"
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "lightgray",
        color: "#333",
      }}
    >
      <div className="hotel-admin-sidebar" data-expanded={sidebarOpen}
        style={{
          width: sidebarOpen ? "250px" : "75px",
          backgroundColor: "#2f4f4f",
          color: "white",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          boxShadow: "2px 0 10px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            padding: "24px 20px",
            textAlign: sidebarOpen ? "left" : "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {sidebarOpen ? (
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  color: "#ffffff",
                }}
              >
                Hytech Hotel & Bistro
              </h3>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#a2b4b4",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Admin Panel
              </span>
            </div>
          ) : (
            <span style={{ fontWeight: "700", fontSize: "1.2rem" }}>DH</span>
          )}
        </div>

        <nav style={{ marginTop: "20px", flex: 1, padding: "0 10px" }}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const hasAlert = item.id === "Food Orders" ? unreadAlerts.order
              : ["Bookings", "Calendar"].includes(item.id) && unreadAlerts.reservation;
            return (
              <button
                key={item.id}
                aria-current={isActive ? "page" : undefined}
                className="admin-nav-item"
                aria-label={hasAlert ? item.label + ", unread notifications" : item.label}
                onClick={() => {
                  setPressedIcon((previous) => ({ item: item.id, count: (previous?.count || 0) + 1 }));
                  if (item.id === "Bookings" || item.id === "Calendar") notifications.current?.markKindRead("reservation");
                  if (item.id === "Food Orders") notifications.current?.markKindRead("order");
                  if (item.id === "Bookings") openBookingList();
                  else {
                    setFoodOrderTarget(null);
                    if (item.id === "Customer Service") setSupportEmail("");
                    setActiveTab(item.id);
                    if (item.id === "Calendar" || item.id === "Key Management") loadReservations();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "12px 16px",
                  marginBottom: "4px",
                  backgroundColor: isActive
                    ? "rgba(255, 255, 255, 0.12)"
                    : "transparent",
                  color: isActive ? "#ffffff" : "#c1d0d0",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? "600" : "500",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "inset 3px 0 0 #b22222" : "none",
                }}
              >
                <span key={pressedIcon?.item === item.id ? pressedIcon.count : "idle"}
                  className={pressedIcon?.item === item.id ? "admin-icon-pressed" : undefined}>
                  <AdminIcon name={item.id} />
                </span>
                {sidebarOpen && <span>{item.label}</span>}
                {hasAlert && <span className="admin-nav-alert" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div
          style={{
            padding: "15px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "#b22222",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "600",
              letterSpacing: "0.3px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(178,34,34,0.3)",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#961c1c")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#b22222")
            }
          >
            {sidebarOpen ? "Logout" : "Exit"}
          </button>
        </div>
      </div>

      <div className="hotel-admin-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
        }}
      >
        <div className="hotel-admin-heading"
          style={{
            height: "64px",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            borderBottom: "1px solid #eef2f5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              aria-expanded={sidebarOpen}
              aria-label="Toggle admin navigation"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
                color: "#2f4f4f",
                padding: "6px 10px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ☰
            </button>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                color: "#2f4f4f",
                fontWeight: "700",
                letterSpacing: "-0.3px",
              }}
            >
              {activeTab}
            </h2>
          </div>

          <div className="admin-heading-tools">
          {currentUser && <AdminNotifications ref={notifications} key={currentUser.uid} api={API} userId={currentUser.uid || currentUser.email} onUnreadChange={setUnreadAlerts}
            onOpen={(item) => {
              if (item.kind === "reservation") {
                openBookingList("All", item.code);
                loadReservations();
              } else {
                setFoodOrderTarget(item.id);
                setActiveTab("Food Orders");
              }
            }} />}
          </div>
        </div>

        <div className="hotel-admin-content" style={{ flex: 1 }}>
          {activeTab === "Dashboard" && (
            <div className="hotel-admin-overview"
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1fr",
                gap: "24px",
              }}
            >
              <div>
                <div className="hotel-admin-panel"
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    marginBottom: "24px",
                    border: "1px solid #eef2f5",
                  }}
                >
                  <button type="button" className="admin-stat-link" onClick={() => openBookingList("Confirmed", "", today)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid #f2f5f8",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Rooms Booked Today
                    </span>
                    <strong style={{ color: "#2f4f4f", fontSize: "1.1rem" }}>
                      {totalBooked}
                    </strong>
                  </button>
                  <button type="button" className="admin-stat-link" onClick={() => openBookingList("Pending", "", today)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid #f2f5f8",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Pending Rooms Today
                    </span>
                    <strong style={{ color: "#b22222", fontSize: "1.1rem" }}>
                      {totalPending}
                    </strong>
                  </button>
                  <button type="button" className="admin-stat-link" onClick={() => setActiveTab("Calendar")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Available Rooms Today
                    </span>
                    <strong style={{ color: "#2e7d32", fontSize: "1.1rem" }}>
                      {availableRoomsCount}
                    </strong>
                  </button>
                </div>

                <div className="hotel-admin-panel"
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid #eef2f5",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 16px 0",
                      color: "#2f4f4f",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      fontWeight: "700",
                    }}
                  >
                    Available Rooms By Type
                  </h4>
                  {Object.entries(roomTypesCount).map(([type, count]) => (
                    <button type="button" className="admin-stat-link" key={type} onClick={() => {
                        openBookingList("All", "", today);
                        setRoomFilter(type);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        fontSize: "0.9rem",
                        color: "#444",
                        borderBottom: "1px dashed #eef2f5",
                      }}
                    >
                      <span>{type}</span>
                      <strong style={{ color: "#2f4f4f" }}>{Math.max(0, Number(count) - currentStays.filter((item) => item.roomType === type && item.status === "Confirmed").length)}</strong>
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTab("Calendar")}
                    style={{
                      marginTop: "16px",
                      background: "none",
                      border: "none",
                      color: "#b22222",
                      cursor: "pointer",
                      fontSize: "0.88rem",
                      fontWeight: "600",
                      padding: 0,
                    }}
                  >
                    View Calendar →
                  </button>
                </div>
              </div>

              <div>
                <div className="hotel-admin-panel"
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid #eef2f5",
                    minHeight: "260px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      borderBottom: "1px solid #eef2f5",
                      marginBottom: "16px",
                    }}
                  >
                    <button
                      type="button" aria-pressed={arrivalsTab === "Arrivals"} onClick={() => setArrivalsTab("Arrivals")}
                      style={{
                        padding: "10px 16px",
                        border: "none",
                        background: "none",
                        borderBottom:
                          arrivalsTab === "Arrivals"
                            ? "2px solid #2f4f4f"
                            : "2px solid transparent",
                        fontWeight: arrivalsTab === "Arrivals" ? "700" : "500",
                        color: arrivalsTab === "Arrivals" ? "#2f4f4f" : "#888",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Arrivals
                    </button>
                    <button
                      type="button" aria-pressed={arrivalsTab === "Departures"} onClick={() => setArrivalsTab("Departures")}
                      style={{
                        padding: "10px 16px",
                        border: "none",
                        background: "none",
                        borderBottom:
                          arrivalsTab === "Departures"
                            ? "2px solid #2f4f4f"
                            : "2px solid transparent",
                        fontWeight:
                          arrivalsTab === "Departures" ? "700" : "500",
                        color:
                          arrivalsTab === "Departures" ? "#2f4f4f" : "#888",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Departures
                    </button>
                  </div>

                  <div
                    style={{
                      color: "#777",
                      fontSize: "0.9rem",
                      textAlign: "center",
                      paddingTop: "6px",
                    }}
                  >
                    <div className="admin-movement-grid">
                      {["Today", "Upcoming"].map((period) => (
                        <button type="button" key={period} className="admin-movement-tile" onClick={() => openMovement(period)}>
                          <span>{period}</span>
                          <strong className="admin-movement-count">{reservations.filter((booking) => matchesMovement(booking, arrivalsTab, period)).length}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Calendar" && (
            <AdminCalendar reservations={reservations} today={today} onDecision={decideCalendarReservation} onEarlyCheckout={handleEarlyCheckout} onOpenBooking={(id) => openBookingList("All", id)} />
          )}

          {activeTab === "Bookings" && (
            <div className="hotel-admin-panel"
              style={{
                backgroundColor: "#ffffff",
                padding: "28px",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid #eef2f5",
              }}
            >
              <BookingReport reservations={reservations} rooms={rooms} />
              {roomFilter && (
                <div className="account-notice">
                  Room type: {roomFilter}{" "}
                  <button type="button" className="hotel-action secondary" onClick={() => setRoomFilter("")}>All room types</button>
                </div>
              )}
              {movementFilter && (
                <div className="account-notice">
                  {movementFilter.tab} {movementFilter.period === "Today" ? "today" : "after today"}{" "}
                  <button type="button" className="hotel-action secondary" onClick={() => setMovementFilter(null)}>Clear date filter</button>
                </div>
              )}
              {bookingDate && (
                <div className="account-notice">
                  Bookings for {bookingDate}{" "}
                  <button type="button" className="hotel-action secondary" onClick={() => setBookingDate("")}>Show all dates</button>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  placeholder="Search guest or booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    width: "280px",
                    borderRadius: "6px",
                    border: "1px solid #dcdfe4",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />

                <div
                  style={{ display: "flex", gap: "12px", alignItems: "center" }}
                >
                  <button
                    onClick={() => {
                      setFormData(emptyForm);
                      setIsAddModalOpen(true);
                    }}
                    style={{
                      backgroundColor: "whitesmoke",
                      color: "black",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.88rem",
                      boxShadow: "whitesmoke 0px 2px 4px rgba(0,0,0,0.1)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    + Add New Booking
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      backgroundColor: "#121414",
                      padding: "3px",
                      borderRadius: "6px",
                    }}
                  >
                    {["All", "Pending", "Confirmed", "Checked out", "Cancelled"].map((st) => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor:
                            filterStatus === st ? "#ffffff" : "transparent",
                          color: filterStatus === st ? "#2f4f4f" : "#607274",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: filterStatus === st ? "600" : "500",
                          fontSize: "0.82rem",
                          boxShadow:
                            filterStatus === st
                              ? "0 1px 3px rgba(0,0,0,0.08)"
                              : "none",
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin-table-scroll" role="region" aria-label="Reservations table" tabIndex={0}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.88rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#2f4f4f",
                        color: "white",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: "12px 16px",
                          borderRadius: "6px 0 0 6px",
                        }}
                      >
                        ID
                      </th>
                      <th style={{ padding: "12px 16px" }}>Guest Details</th>
                      <th style={{ padding: "12px 16px" }}>Room</th>
                      <th style={{ padding: "12px 16px" }}>Room No.</th>
                      <th style={{ padding: "12px 16px" }}>Dates</th>
                      <th style={{ padding: "12px 16px" }}>Amount</th>
                      <th style={{ padding: "12px 16px" }}>Payment</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderRadius: "0 6px 6px 0",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownReservations.length === 0 ? (
                      <tr>
                        <td
                          colSpan="9"
                          style={{
                            textAlign: "center",
                            padding: "28px",
                            color: "#888",
                          }}
                        >
                          No reservations match these filters.
                        </td>
                      </tr>
                    ) : (
                      shownReservations
                        .map((res) => (
                          <tr
                            key={res.dbId || res.id}
                            style={{ borderBottom: "1px solid #f2f5f8" }}
                          >
                            <td
                              style={{
                                padding: "14px 16px",
                                fontWeight: "600",
                                color: "#2f4f4f",
                              }}
                            >
                              {res.id}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ fontWeight: "600", color: "#333" }}>
                                {res.guestName}
                              </div>
                              <div
                                style={{ fontSize: "0.8rem", color: "#777" }}
                              >
                                {res.email} | {res.phone}
                              </div>
                              {res.guestNames.length > 0 && <small>Occupants: {res.guestNames.join(", ")}</small>}
                              <details className="booking-extras-summary" open={res.extras.length ? true : undefined}>
                                <summary>Extras ({res.extras.length})</summary>
                                {res.extras.length ? <ul>{res.extras.map((extra) => <li key={extra.id}>{extra.name}{extra.quantity ? " ? " + extra.quantity : ""} ({peso(extra.amount)})</li>)}</ul>
                                  : <small>No extras were selected for this booking.</small>}
                              </details>
                              {res.notes && (
                                <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "4px" }}>
                                  Request: {res.notes}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              {res.roomType}
                            </td>
                            <td style={{ padding: "14px 16px", fontWeight: "700", color: "#2f4f4f" }}>
                              {res.roomNumber || "Not assigned"}
                            </td>
                            <td style={{ padding: "14px 16px", color: "#555" }}>
                              {res.checkIn} to {res.checkOut}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontWeight: "700",
                                color: "#b22222",
                              }}
                            >
                              {peso(res.totalAmount)}
                              {res.discountAmount > 0 && (
                                <div style={{ fontSize: "0.75rem", fontWeight: "500", color: "#2e7d32" }}>
                                  {res.voucherCode}: -{peso(res.discountAmount)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: "0.82rem" }}>
                              <div style={{ fontWeight: "600" }}>{res.paymentMethod}</div>
                              {res.paymentReference && (
                                <div style={{ color: "#777" }}>Ref: {res.paymentReference}</div>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePaymentToggle(res)}
                                style={{
                                  marginTop: "4px",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "700",
                                  fontSize: "0.75rem",
                                  backgroundColor: res.paymentStatus === "Paid" ? "#e6f4ea" : "#fff4dc",
                                  color: res.paymentStatus === "Paid" ? "#1e6b34" : "#8a5a00",
                                }}
                              >
                                {res.paymentStatus}
                              </button>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <select
                                value={res.status}
                                disabled={Boolean(res.actualCheckOut)}
                                onChange={(e) =>
                                  handleStatusQuickChange(
                                    res,
                                    e.target.value,
                                  )
                                }
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "4px",
                                  fontWeight: "600",
                                  fontSize: "0.82rem",
                                  border: "1px solid #dcdfe4",
                                  backgroundColor: "#ffffff",
                                  color:
                                    res.status === "Confirmed"
                                      ? "#2e7d32"
                                      : res.status === "Cancelled"
                                        ? "#b22222"
                                        : "#d97706",
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Cancelled">Cancelled</option>
                                {res.actualCheckOut && <option value="Checked out">Checked out</option>}
                              </select>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {res.actualCheckOut && <small>Checked out {res.actualCheckOut}</small>}
                                {res.status === "Confirmed" && res.checkIn <= today && res.checkOut > today && (
                                  <button type="button" className="hotel-action secondary" onClick={async () => {
                                    if (!window.confirm("Check this guest out early and release the remaining nights?")) return;
                                    try { await handleEarlyCheckout(res); }
                                    catch (error) { window.alert(error.message); }
                                  }}>Check out early</button>
                                )}
                                <button
                                  disabled={Boolean(res.actualCheckOut)}
                                  onClick={() => handleOpenEdit(res)}
                                  style={{
                                    backgroundColor: "#ffffff",
                                    color: "#2f4f4f",
                                    border: "1px solid #dcdfe4",
                                    padding: "6px 12px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBooking(res)}
                                  style={{
                                    backgroundColor: "rgba(178,34,34,0.08)",
                                    color: "#b22222",
                                    border: "1px solid rgba(178,34,34,0.2)",
                                    padding: "6px 12px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "Clients" && <AdminClients api={API} reservations={reservations} onOpenBooking={(id) => openBookingList("All", id)} onPasswordHelp={(email) => {
            setSupportEmail(email);
            setActiveTab("Customer Service");
          }} />}
          {activeTab === "Customer Service" && <AdminCustomerService key={supportEmail} initialEmail={supportEmail} />}
          {activeTab === "Reviews" && <AdminReviews api={API} rooms={rooms} />}

          {activeTab === "Rooms" && <AdminRoomsTab rooms={rooms} onSaved={loadRooms} />}
          {activeTab === "Key Management" && <AdminKeysTab reservations={reservations} />}

          {activeTab === "Discounts" && <AdminVouchersTab />}

          {activeTab === "Food Orders" && <AdminOrdersTab selectedId={foodOrderTarget} onClearSelection={() => setFoodOrderTarget(null)} />}

          {activeTab === "Extras" && <AdminExtras api={API} />}
        </div>
      </div>

      {confirmTarget && (
        <ConfirmBookingModal
          reservation={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={() => {
            setConfirmTarget(null);
            loadReservations();
          }}
        />
      )}

      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "10px",
              width: "420px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#2f4f4f",
                fontSize: "1.15rem",
                fontWeight: "700",
              }}
            >
              Add New Reservation
            </h3>
            <form onSubmit={handleCreateBooking}>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Guest Name:
                </label>
                <input
                  type="text"
                  name="guestName"
                  required
                  value={formData.guestName}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <label className="booking-guest-name">
                Companion names (one full name per line)
                <textarea name="companions" rows={2} className="bb-input form-control"
                  value={formData.companions} onChange={handleInputChange} />
              </label>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Email:
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Phone:
                </label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Room Type:
                </label>
                <select
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                >
                  {roomOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "12px" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-In:
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    required
                    value={formData.checkIn}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-Out:
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    required
                    value={formData.checkOut}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Amount (₱):
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #2f4f4f",
                    backgroundColor: "#2f4f4f",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#2f4f4f",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "10px",
              width: "420px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#2f4f4f",
                fontSize: "1.15rem",
                fontWeight: "700",
              }}
            >
              Edit Booking
            </h3>
            <form onSubmit={handleUpdateBooking}>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Guest Name:
                </label>
                <input
                  type="text"
                  name="guestName"
                  required
                  value={formData.guestName}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Email:
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Phone:
                </label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Room Type:
                </label>
                <select
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                >
                  {roomOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "12px" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-In:
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    required
                    value={formData.checkIn}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-Out:
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    required
                    value={formData.checkOut}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#444" }}>
                  Room Number:
                </label>
                <input
                  type="text"
                  name="roomNumber"
                  value={formData.roomNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 204"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Amount (₱):
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #dcdfe4",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#2f4f4f",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Update Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const adPanel = {
  backgroundColor: "#ffffff",
  padding: "28px",
  borderRadius: "10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  border: "1px solid #eef2f5",
};

const adHeading = { margin: "0 0 8px 0", color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" };

const adSubheading = { margin: "0 0 20px 0", color: "#777", fontSize: "0.88rem" };

const adLabel = { fontSize: "0.82rem", fontWeight: "600", color: "#444" };

const adInput = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "4px",
  border: "1px solid #dcdfe4",
  boxSizing: "border-box",
  marginTop: "4px",
  backgroundColor: "#fff",
  color: "#333",
};

const adPrimaryButton = {
  backgroundColor: "#2f4f4f",
  color: "white",
  border: "none",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adGhostButton = {
  backgroundColor: "#ffffff",
  color: "#2f4f4f",
  border: "1px solid #dcdfe4",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adDangerButton = {
  backgroundColor: "rgba(178,34,34,0.08)",
  color: "#b22222",
  border: "1px solid rgba(178,34,34,0.2)",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(2px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const adModal = {
  backgroundColor: "#fff",
  padding: "28px",
  borderRadius: "10px",
  width: "420px",
  maxWidth: "92vw",
  maxHeight: "92vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
};

const adTh = { padding: "12px 16px" };

const adErrorBox = {
  backgroundColor: "#fbe9e7",
  color: "#b22222",
  padding: "8px 12px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  marginBottom: "12px",
};

function AdminRoomsTab({ rooms, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEdit = (room) => {
    setEditing(room);
    setForm({
      name: room.name,
      category: room.category,
      price: room.price,
      capacity: room.capacity,
      totalUnits: room.total_units,
      isActive: Boolean(room.is_active),
      image: room.image || "",
      bed: room.bed || "",
      description: room.description || "",
    });
    setError("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", category: "", price: "", capacity: 2, totalUnits: 1, isActive: true, image: "", bed: "", description: "" });
    setError("");
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(null);
  };

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await accountFetch(editing ? `${API}/rooms/${editing.id}` : `${API}/rooms`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          capacity: Number(form.capacity),
          totalUnits: Number(form.totalUnits),
          isActive: form.isActive,
          image: form.image.trim(),
          bed: form.bed.trim(),
          description: form.description.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not save the room.");
        return;
      }
      closeEdit();
      onSaved();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hotel-admin-panel" style={adPanel}>
      <h3 style={adHeading}>Room Management</h3>
      <p style={adSubheading}>Configure hotel room capacity and base prices.</p>
      <button type="button" className="hotel-action" style={{ marginBottom: 16 }} onClick={openCreate}>Add room</button>

      {rooms.length === 0 ? (
        <div style={{ padding: "24px", border: "1px dashed #dcdfe4", borderRadius: "8px", textAlign: "center", color: "#888" }}>
          No rooms loaded. Check that the backend is running.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: "16px" }}>
          {rooms.map((room) => {
            const photo = room.image || roomDescriptions.find((item) => item.name === room.name || item.name.toLowerCase().replaceAll(" ", "-") === room.slug)?.image;
            return (
            <div
              key={room.id}
              style={{
                padding: "20px",
                border: "1px solid #eef2f5",
                borderRadius: "8px",
                backgroundColor: "#fcfdfe",
                opacity: room.is_active ? 1 : 0.6,
              }}
            >
              {photo && <img className="admin-room-photo" src={photo} alt={room.name} loading="lazy" />}
              <h4 style={{ margin: "0 0 4px 0", color: "#2f4f4f" }}>{room.name}</h4>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>
                {room.category}{room.is_active ? "" : " · Hidden from guests"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.7, marginBottom: "14px" }}>
                <div>Price: <strong>{peso(room.price)}</strong> / night</div>
                <div>Capacity: <strong>{room.capacity}</strong> guest{room.capacity > 1 ? "s" : ""}</div>
                <div>Total inventory: <strong>{room.total_units}</strong> rooms</div>
              </div>
              <button type="button" onClick={() => openEdit(room)} style={adPrimaryButton}>
                Edit Details
              </button>
            </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="hotel-admin-overlay" style={adOverlay} onClick={closeEdit}>
          <div className="hotel-admin-modal" style={adModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" }}>{editing ? "Edit Room Details" : "Add room"}</h3>
            <form onSubmit={save}>
              {error && <div style={adErrorBox}>{error}</div>}
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Room name:</label>
                <input style={adInput} name="name" maxLength={100} required value={form.name} onChange={change} />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Category:</label>
                <input style={adInput} name="category" maxLength={30} required value={form.category} onChange={change} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Price per night (₱):</label>
                  <input style={adInput} type="number" min="0" step="0.01" name="price" required value={form.price} onChange={change} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Max guests:</label>
                  <input style={adInput} type="number" min="1" name="capacity" required value={form.capacity} onChange={change} />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Total rooms of this type:</label>
                <input style={adInput} type="number" min="0" name="totalUnits" required value={form.totalUnits} onChange={change} />
              </div>
              <label style={adLabel}>Photo URL
                <input style={adInput} type="url" name="image" maxLength={2048} value={form.image} onChange={change} placeholder="https://" />
              </label>
              <label style={adLabel}>Bedding
                <input style={adInput} name="bed" maxLength={100} value={form.bed} onChange={change} />
              </label>
              <label style={adLabel}>Description
                <textarea style={adInput} name="description" maxLength={1000} rows={3} value={form.description} onChange={change} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", color: "#444", marginBottom: "20px" }}>
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} />
                Available for guest booking
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={closeEdit} style={adGhostButton}>Cancel</button>
                <button type="submit" disabled={saving} style={adPrimaryButton}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const emptyVoucher = { code: "", discountType: "percent", discountValue: "", validUntil: "" };

function AdminVouchersTab() {
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState(emptyVoucher);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await accountFetch(`${API}/vouchers`);
      if (response.ok) setVouchers(await response.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await accountFetch(`${API}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          validUntil: form.validUntil || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not create the voucher.");
        return;
      }
      setForm(emptyVoucher);
      load();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (voucher) => {
    await accountFetch(`${API}/vouchers/${voucher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !voucher.isActive }),
    });
    load();
  };

  const remove = async (voucher) => {
    if (!window.confirm(`Delete voucher ${voucher.code}?`)) return;
    await accountFetch(`${API}/vouchers/${voucher.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="hotel-admin-panel" style={adPanel}>
      <h3 style={adHeading}>Discount Vouchers</h3>
      <p style={adSubheading}>Create promotional discount codes for direct bookings.</p>

      <form onSubmit={create} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "10px" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={adLabel}>Code:</label>
          <input style={adInput} name="code" required placeholder="SUMMER10" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
        </div>
        <div style={{ flex: "0 1 140px" }}>
          <label style={adLabel}>Type:</label>
          <select style={adInput} name="discountType" value={form.discountType} onChange={change}>
            <option value="percent">Percent off</option>
            <option value="fixed">Peso amount off</option>
          </select>
        </div>
        <div style={{ flex: "0 1 120px" }}>
          <label style={adLabel}>{form.discountType === "percent" ? "Percent:" : "Amount (₱):"}</label>
          <input style={adInput} type="number" min="1" name="discountValue" required value={form.discountValue} onChange={change} />
        </div>
        <div style={{ flex: "0 1 160px" }}>
          <label style={adLabel}>Valid until (optional):</label>
          <input style={adInput} type="date" name="validUntil" value={form.validUntil} onChange={change} />
        </div>
        <button type="submit" disabled={saving} style={{ ...adPrimaryButton, padding: "10px 18px" }}>
          {saving ? "Creating..." : "Create voucher"}
        </button>
      </form>
      {error && <div style={adErrorBox}>{error}</div>}

      <div className="admin-table-scroll" role="region" aria-label="Discount vouchers" tabIndex={0}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", marginTop: "16px" }}>
        <thead>
          <tr style={{ backgroundColor: "#2f4f4f", color: "white", textAlign: "left" }}>
            <th style={{ ...adTh, borderRadius: "6px 0 0 6px" }}>Code</th>
            <th style={adTh}>Discount</th>
            <th style={adTh}>Valid until</th>
            <th style={adTh}>Status</th>
            <th style={{ ...adTh, borderRadius: "0 6px 6px 0" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "28px", color: "#888" }}>
                No vouchers yet. Create one above.
              </td>
            </tr>
          ) : (
            vouchers.map((v) => (
              <tr key={v.id} style={{ borderBottom: "1px solid #f2f5f8" }}>
                <td style={{ ...adTh, fontWeight: "700", color: "#2f4f4f" }}>{v.code}</td>
                <td style={adTh}>{v.discountType === "percent" ? `${Number(v.discountValue)}% off` : `${peso(v.discountValue)} off`}</td>
                <td style={adTh}>{v.validUntil || "No expiry"}</td>
                <td style={{ ...adTh, fontWeight: "600", color: v.isActive ? "#2e7d32" : "#888" }}>{v.isActive ? "Active" : "Paused"}</td>
                <td style={adTh}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" style={{ ...adGhostButton, padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => toggle(v)}>
                      {v.isActive ? "Pause" : "Activate"}
                    </button>
                    <button type="button" style={{ ...adDangerButton, padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => remove(v)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const ORDER_STATUSES = ["Pending", "Preparing", "Served", "Cancelled"];

const orderTone = (status) => {
  if (status === "Served") return "#2e7d32";
  if (status === "Cancelled") return "#b22222";
  if (status === "Preparing") return "#1a4f8b";
  return "#d97706";
};

function AdminOrdersTab({ selectedId, onClearSelection }) {
  const [view, setView] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await accountFetch(`${API}/orders`);
      setOrders(await readJson(response));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Cannot reach the server.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const closed = (item) => ["Served", "Cancelled"].includes(item.status);
  const selectedOrder = orders.find((item) => String(item.id) === String(selectedId));
  const selectedView = selectedOrder && view !== "menu" ? (closed(selectedOrder) ? "history" : "orders") : view;
  const history = selectedView === "history";
  const shownOrders = orders.filter((item) => closed(item) === history && (selectedId == null || String(item.id) === String(selectedId)));

  function changeView(next) {
    if (selectedId != null) onClearSelection();
    setView(next);
  }

  const changeStatus = async (order, status) => {
    const response = await accountFetch(`${API}/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const result = await response.json();
      alert(result.message || "Could not update the order.");
      return;
    }
    await load();
  };

  return (
    <div className="admin-food-dashboard">
      <div className="admin-food-tabs" aria-label="Food management">
        <button type="button" className="hotel-action secondary" aria-pressed={selectedView === "orders"} onClick={() => changeView("orders")}>Incoming orders</button>
        <button type="button" className="hotel-action secondary" aria-pressed={history} onClick={() => changeView("history")}>History</button>
        <button type="button" className="hotel-action secondary" aria-pressed={selectedView === "menu"} onClick={() => changeView("menu")}>Dining menu</button>
      </div>
      {selectedView === "menu" ? <AdminMenu api={API} /> : <div className="hotel-admin-panel" style={adPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <h3 style={adHeading}>{history ? "Food order history" : "Incoming food orders"}</h3>
          <p style={adSubheading}>{history ? "Served and cancelled orders." : "Pending and preparing orders. Refreshes every 20 seconds."}</p>
        </div>
        <button type="button" onClick={load} style={adGhostButton}>Refresh</button>
      </div>
      {error && <div style={{ color: "#b22222", fontSize: "0.85rem", marginBottom: "12px" }}>{error}</div>}

      {history && <FoodOrderReport orders={orders} />}
      {selectedId != null && <button type="button" className="hotel-action secondary" onClick={onClearSelection}>Show all orders</button>}
      <div className="admin-table-scroll" role="region" aria-label="Food orders" tabIndex={0}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#2f4f4f", color: "white", textAlign: "left" }}>
            <th style={{ ...adTh, borderRadius: "6px 0 0 6px" }}>Order</th>
            <th style={adTh}>Guest</th>
            <th style={adTh}>Items</th>
            <th style={adTh}>Deliver to</th>
            <th style={adTh}>Total</th>
            <th style={{ ...adTh, borderRadius: "0 6px 6px 0" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {shownOrders.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: "28px", color: "#888" }}>
                {history ? "No closed food orders yet." : "No incoming food orders."}
              </td>
            </tr>
          ) : (
            shownOrders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f2f5f8", verticalAlign: "top" }}>
                <td style={{ ...adTh, fontWeight: "700", color: "#2f4f4f" }}>{o.code}{history && <div><small>{foodOrderHistoryDate(o)}</small></div>}</td>
                <td style={adTh}>
                  <div style={{ fontWeight: "600" }}>{o.guestName}</div>
                  <div style={{ fontSize: "0.8rem", color: "#777" }}>{o.phone}</div>
                </td>
                <td style={adTh}>
                  {o.items.map((i, index) => {
                    const photo = i.image || foodItems.find((item) => item.title === i.title)?.image;
                    return <div key={index} className="admin-food-line">
                      {photo && <img src={photo} alt="" loading="lazy" />}
                      <span>{i.qty} {"\u00d7"} {i.title}</span>
                    </div>;
                  })}
                  {o.notes && <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "4px" }}>Request: {o.notes}</div>}
                </td>
                <td style={adTh}>{o.roomNumber || "Not specified"}</td>
                <td style={{ ...adTh, fontWeight: "700", color: "#b22222" }}>{peso(o.totalAmount)}</td>
                <td style={adTh}>
                  {history ? <strong style={{ color: orderTone(o.status) }}>{o.status}</strong> : <select
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "4px", fontWeight: "600", fontSize: "0.82rem", border: "1px solid #dcdfe4", backgroundColor: "#fff", color: orderTone(o.status) }}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      </div>}
    </div>
  );
}

function ConfirmBookingModal({ reservation, onClose, onDone }) {
  const [roomNumber, setRoomNumber] = useState(reservation.roomNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await accountFetch(`${API}/reservations/${reservation.dbId || reservation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed", roomNumber: roomNumber.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not confirm this booking.");
        return;
      }
      onDone();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={adOverlay} onClick={onClose}>
      <div style={{ ...adModal, width: "380px" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" }}>Confirm booking</h3>
        <p style={{ margin: "0 0 14px", fontSize: "0.88rem", color: "#555", lineHeight: 1.5 }}>
          {reservation.guestName} · {reservation.roomType}<br />
          {reservation.checkIn} to {reservation.checkOut}
        </p>
        {reservation.paymentMethod === "GCash" && (
          <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "#555" }}>
            GCash reference: <strong>{reservation.paymentReference || "none"}</strong>. Check it against your GCash history before confirming.
          </p>
        )}
        <form onSubmit={submit}>
          {error && <div style={adErrorBox}>{error}</div>}
          <label style={adLabel}>Assign room number:</label>
          <input
            style={{ ...adInput, marginBottom: "6px" }}
            required
            autoFocus
            placeholder="e.g. 204"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <p style={{ margin: "0 0 18px", fontSize: "0.8rem", color: "#888" }}>
            The guest receives a text message with this room number.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} style={adGhostButton}>Cancel</button>
            <button type="submit" disabled={saving} style={adPrimaryButton}>
              {saving ? "Confirming..." : "Confirm booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
