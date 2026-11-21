const paths = {
  Dashboard: "M3 3h7v8H3z M14 3h7v5h-7z M3 15h7v6H3z M14 12h7v9h-7z",
  Calendar: "M4 6h16a1 1 0 0 1 1 1v13H3V7a1 1 0 0 1 1-1 M7 3v5m10-5v5M3 11h18m-13 4h2m4 0h2",
  Bookings: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6m-6 4h6",
  Clients: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4m-3-12a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  Rooms: "M3 20v-9m18 9v-9M3 17h18M5 16v-7h14v7M7 9V5h10v4m-6 3h2",
  "Key Management": "M14 10a4 4 0 1 1 2 2l-7 7H5v-4l7-7m5-3h.01",
  Discounts: "M3 4h8l10 10-7 7L3 10z M7.5 8h.01m8 3-5 5",
  "Food Orders": "M4 3v5a3 3 0 0 0 6 0V3M7 3v18m12-18c-3 2-4 6-4 9h4m0-9v18",
  Extras: "m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z",
  "Customer Service": "M4 13v-2a8 8 0 1 1 16 0v2m-16 0h3v5H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Zm16 0h-3v5h3a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2Zm0 5c0 2-2 3-5 3h-2",
  Reviews: "M4 4h16v11H10l-6 5z M8 8h8m-8 4h5",
  Add: "M12 5v14M5 12h14",
  Check: "m5 12 4 4L19 6",
};

export default function AdminIcon({ name }) {
  return <svg className="admin-icon" aria-hidden="true" width="21" height="21" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
