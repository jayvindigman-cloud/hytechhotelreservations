import { sendPasswordResetEmail } from "firebase/auth";
﻿import { auth } from "./Firebase";

export const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || "/api";

export async function accountFetch(url, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  return fetch(url, { ...options, headers });
}

export async function readJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The hotel API is unavailable. Try again shortly.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The request failed.");
  return data;
}

const hotelDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

export function hotelDate(date = new Date()) {
  const parts = Object.fromEntries(hotelDateFormat.formatToParts(date).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join("-");
}
export const hotelToday = () => hotelDate();

export async function requestPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
}

export const extraUnits = { stay: "Per stay", night: "Per night", guest: "Per guest", item: "Per item" };
export const formatPeso = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value));
