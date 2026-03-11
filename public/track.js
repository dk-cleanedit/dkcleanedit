import { auth, db } from "../firebase.js";
import { qs, setText } from "../ui/dom.js";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
// the listed status tghat will be usd
const STATUS_ORDER = ["Booked", "Received", "Cleaning", "Drying & Finish", "Ready", "Completed"];
// the function called progess status
function progressPercent(status) {
  const i = Math.max(0, STATUS_ORDER.indexOf(status));
  return Math.round((i / (STATUS_ORDER.length - 1)) * 100);
}
// it is mapping
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function renderOrderCard(o) {
  const pct = progressPercent(o.status);
  const title = `${o.service || "Service"} • ${o.location || "Location"}`;
  const dateLine = `${o.date || "-"} • ${o.timeSlot || "-"}`;

  return `
    <div class="order-card">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(title)}</div>
          <div class="sub">${esc(dateLine)}</div>
        </div>
        <span class="badge">${esc(o.status || "Booked")}</span>
      </div>

      <div class="progress" aria-label="Order progress">
        <div class="bar" style="width:${pct}%"></div>
      </div>

      <div class="order-meta">
        <span class="sub">Order ID: ${esc(o.id)}</span>
        <span class="sub">Progress: ${pct}%</span>
      </div>
    </div>
  `;
}

export function initTrackingPage() {
  const ordersEl = qs("#orders");
  const msgEl = qs("#msg");
  const refreshBtn = qs("#btnRefresh");

  if (!ordersEl) return;

  const user = auth.currentUser;
  if (!user) {
    setText(msgEl, "Please log in to view tracking.");
    return;
  }

  const q = query(
    collection(db, "orders"),
    where("uid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));

    if (items.length === 0) {
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">No orders yet</div>
          <p class="sub">Book a service to start tracking.</p>
          <a class="btn primary" href="booking.html" data-requires-auth="true">Go to Booking</a>
        </div>
      `;
      setText(msgEl, "");
      return;
    }

    ordersEl.innerHTML = items.map(renderOrderCard).join("");
    setText(msgEl, "");
  }, (err) => {
    console.error(err);
    setText(msgEl, "Failed to load orders. Check console.");
  });

  // Live tracking updates already refresh automatically
  refreshBtn?.addEventListener("click", () => {
    setText(msgEl, "Tracking is live — updates appear automatically.");
    setTimeout(() => setText(msgEl, ""), 1500);
  });

  window.addEventListener("beforeunload", () => unsub());
}
