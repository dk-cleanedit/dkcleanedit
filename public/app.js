

// ─────────────────────────────────────────────────────────────
//  SECTION 1 — FIREBASE IMPORTS
// ─────────────────────────────────────────────────────────────

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";


// ─────────────────────────────────────────────────────────────
//  SECTION 2 — CONSTANTS
// ─────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "danielasouzu2@gmail.com";

const STATUS = [
  "Booked",
  "Received",
  "Cleaning",
  "Drying & Finish",
  "Ready",
  "Awaiting Pickup",
  "Completed",
  "Cancelled",
];

const TRACKABLE_STATUS = [
  "Booked",
  "Received",
  "Cleaning",
  "Drying & Finish",
  "Ready",
  "Awaiting Pickup",
  "Completed",
];

const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00"];

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMAILJS_SERVICE = "service_6ep5ahh";

const LOCATION_DATA = {
  charles_street_leicester: {
    name:     "Charles Street, Leicester",
    address:  "Charles Street, Leicester, UK",
    mapsLink: "https://www.google.com/maps/search/?api=1&query=Charles+Street+Leicester+UK",
    embed:    "https://www.google.com/maps?q=Charles%20Street%20Leicester%20UK&z=15&output=embed",
  },
  canada_water: {
    name:     "Canada Water, London",
    address:  "Canada Water, London, UK",
    mapsLink: "https://www.google.com/maps/search/?api=1&query=Canada+Water+London+UK",
    embed:    "https://www.google.com/maps?q=Canada%20Water%20London%20UK&z=15&output=embed",
  },
};

const ROLES = {
  pickup:   "Shoe pickup",
  delivery: "Deliver a pair of shoes",
  cleaning: "Shoe cleaning",
  both:     "Pickup + cleaning",
  manager:  "Floor manager",
};

const LOCATIONS = {
  leicester:      "Leicester",
  "canada-water": "Canada Water",
};

const SERVICE_PRICES = {
  standard_clean: "£25",
  express:        "£30",
  next_day:       "£40",
};

const storage = getStorage();

window._staffList = [];


// ─────────────────────────────────────────────────────────────
//  SECTION 3 — UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(val) {
  return String(val ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidDate(val) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val ?? ""))) return false;
  const d = new Date(val + "T00:00:00");
  return !isNaN(d.getTime());
}

function isValidTime(val) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(val ?? ""));
}

function isAdmin(email) {
  return String(email ?? "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function isStaff(email) {
  if (!email) return false;
  return (window._staffList || []).some(
    (s) =>
      String(s.email || "").trim().toLowerCase() === email.trim().toLowerCase()
  );
}

function serviceLabel(val) {
  const labels = {
    standard_clean: "Standard Cleaning",
    express:        "Express Service",
    next_day:       "Next Day",
  };
  return labels[val] ?? val ?? "";
}

function badgeClass(status) {
  if (status === "Completed")                                return "badge success";
  if (status === "Cancelled")                                return "badge danger";
  if (status === "Ready" || status === "Awaiting Pickup")    return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function setMsg(text, id = "msg") {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function formatDate(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!iso || !isValidDate(iso)) return iso ?? "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts);
}

async function withRetry(fn, attempts = 3, baseDelay = 400) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
      }
    }
  }
  throw lastErr;
}

function goLogin(next = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 4 — TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

const _toastQueue   = [];
let   _toastRunning = false;

function toast(text, type = "default") {
  _toastQueue.push({ text, type });
  if (!_toastRunning) _drainToasts();
}

function _drainToasts() {
  if (!_toastQueue.length) {
    _toastRunning = false;
    return;
  }
  _toastRunning = true;

  const { text, type } = _toastQueue.shift();

  let host = $("#toastHost");
  if (!host) {
    host = Object.assign(document.createElement("div"), { id: "toastHost" });
    document.body.appendChild(host);
  }

  const t = Object.assign(document.createElement("div"), {
    className:   `toast toast--${type}`,
    textContent: text,
    role:        "status",
  });
  t.setAttribute("aria-live", "polite");

  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));

  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => {
      t.remove();
      _drainToasts();
    }, 220);
  }, 2400);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 5 — EMAIL FUNCTION
// ─────────────────────────────────────────────────────────────

// Booking confirmation — sent when a customer books
function sendBookingEmail({
  customerName,
  customerEmail,
  orderId,
  service,
  location,
  bookingDate,
  bookingTime,
  price,
  shoeNotes,
}) {
  if (!window.emailjs) return;
  window.emailjs
    .send(EMAILJS_SERVICE, "template_qca25sq", {
      customer_name:  customerName  || "Customer",
      customer_email: customerEmail || "",
      order_id:       orderId       || "",
      service:        service       || "",
      location:       location      || "",
      booking_date:   bookingDate   || "",
      booking_time:   bookingTime   || "",
      price:          price         || "",
      shoe_notes:     shoeNotes     || "",
    })
    .catch((err) => console.warn("Booking email failed:", err));
}

// Completion email — sent when admin marks an order as Completed
async function sendCleaningCompleteEmail({
  recipientEmail,
  recipientName,
  locationName,
  cleaningSummary,
  completedAt,
}) {
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  if (!recipientEmail) throw new Error("No recipient email address provided");

  return window.emailjs.send(EMAILJS_SERVICE, "template_cleaning_done", {
    to_email:         recipientEmail,
    recipient_name:   recipientName  || "Customer",
    location_name:    locationName   || "DKcleanedit",
    cleaning_summary: cleaningSummary || "Your shoes have been cleaned.",
    completed_date:   completedAt    || new Date().toLocaleDateString("en-GB"),
    sender_name:      "DKcleanedit",
  });
}

// Missed appointment reminder — sent from the Missed tab
async function sendMissedEmail({
  customerName,
  customerEmail,
  orderId,
  bookingDate,
  bookingTime,
  location,
}) {
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  if (!customerEmail) throw new Error("No customer email");

  return window.emailjs.send(EMAILJS_SERVICE, "template_missed_appt", {
    customer_name:  customerName  || "Customer",
    customer_email: customerEmail || "",
    order_id:       orderId       || "",
    booking_date:   bookingDate   || "",
    booking_time:   bookingTime   || "",
    location:       location      || "",
  });
}

// Pickup summary email — sent manually by admin after choosing date/time
async function sendPickupSummaryEmail({
  recipientEmail,
  recipientName,
  orderId,
  locationName,
  cleaningSummary,
  pickupDate,
  pickupTime,
}) {
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  if (!recipientEmail) throw new Error("No recipient email");

  return window.emailjs.send(EMAILJS_SERVICE, "template_pickup_summary", {
    to_email:      recipientEmail,
    customer_name: recipientName   || "Customer",
    service:       cleaningSummary || "Your shoes are ready",
    location:      locationName    || "DKcleanedit",
    order_id:      orderId         || "",
    pickup_date:   pickupDate      || "",
    pickup_time:   pickupTime      || "",
  });
}

// ─────────────────────────────────────────────────────────────
//  SECTION 6 — AVAILABILITY (open/closed time slots)
// ─────────────────────────────────────────────────────────────

async function getOpenSlots(dateISO, location) {
  const [availSnap, bookingSnap] = await Promise.all([
    getDoc(doc(db, "availability", dateISO)).catch(() => null),
    getDocs(
      query(
        collection(db, "orders"),
        where("date",     "==", dateISO),
        where("location", "==", location),
        where("status",   "!=", "Cancelled")
      )
    ).catch(() => null),
  ]);

  const slots = availSnap?.exists() ? availSnap.data().slots ?? {} : {};

  const taken = new Set();
  bookingSnap?.forEach((d) => taken.add(d.data().timeSlot));

  return TIME_SLOTS.filter((s) => slots[s] !== false && !taken.has(s));
}

async function slotAvailable(dateISO, location, timeSlot) {
  const open = await getOpenSlots(dateISO, location);
  return open.includes(timeSlot);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 7 — ORDER CARD RENDERING (customer view)
// ─────────────────────────────────────────────────────────────

function progressPercent(status) {
  if (status === "Cancelled") return 0;
  const index = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  return Math.round((index / (TRACKABLE_STATUS.length - 1)) * 100);
}

function renderProgress(status) {
  const activeIndex = Math.max(0, TRACKABLE_STATUS.indexOf(status));

  const steps = TRACKABLE_STATUS.map((stage, i) => {
    const cls =
      status === "Cancelled"
        ? "cancelled"
        : i <= activeIndex
        ? "active"
        : "";
    return `<div class="step ${cls}" aria-label="${esc(stage)}: ${cls || "pending"}">
      <span class="circle"></span>
      <span class="label">${esc(stage)}</span>
    </div>`;
  }).join("");

  return `<div class="order-tracker" role="list" aria-label="Order progress">
    ${steps}
  </div>`;
}

function renderPickupBanner(order) {
  if (order.status === "Awaiting Pickup") {
    return `<div class="pickup-notice" role="alert">
      <strong>Your shoes are ready!</strong>
      Please collect them from ${esc(order.location || "the branch")}.
    </div>`;
  }
  if (order.pickedUp) {
    return `<div class="pickup-collected">✅ Shoes collected</div>`;
  }
  return "";
}

function renderOrderCard(order) {
  const pct           = progressPercent(order.status || "Booked");
  const canEdit       = ["Booked", "Received"].includes(order.status);
  const dateFormatted = formatDate(order.date);

  return `
    <article class="order-card" data-id="${esc(order.id)}" aria-label="Order ${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">
            ${esc(serviceLabel(order.service))} &bull; ${esc(order.location)}
          </div>
          <div class="sub">
            ${esc(dateFormatted)} &bull; ${esc(order.timeSlot)} &bull; ${esc(order.price || "")}
          </div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">
          ${esc(order.status || "Booked")}
        </span>
      </div>

      ${renderProgress(order.status || "Booked")}
      ${renderPickupBanner(order)}

      <div class="order-meta">
        <span class="sub">Order ID: <code>${esc(order.id)}</code></span>
        <span class="sub" aria-label="${pct}% complete">${pct}%</span>
      </div>

      ${
        canEdit
          ? `<div class="order-actions">
               <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">
                 Reschedule
               </button>
               <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">
                 Cancel
               </button>
             </div>`
          : ""
      }
    </article>`;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 8 — ADMIN CARD RENDERING
// ─────────────────────────────────────────────────────────────

function getImageUrls(order) {
  const urls = [];

  ["imageUrl", "photoUrl", "uploadUrl", "beforeImage", "beforeImageUrl"].forEach((f) => {
    const v = order?.[f];
    if (typeof v === "string" && v.trim()) urls.push(v.trim());
  });

  ["imageUrls", "photos", "uploads", "images"].forEach((f) => {
    const v = order?.[f];
    if (Array.isArray(v)) {
      v.forEach((u) => {
        if (typeof u === "string" && u.trim()) urls.push(u.trim());
      });
    }
  });

  return [...new Set(urls)];
}

function findConflicts(orders) {
  const groups = {};
  orders
    .filter((o) => o.status !== "Cancelled")
    .forEach((o) => {
      const key = `${o.date}__${o.timeSlot}__${o.location}`;
      (groups[key] = groups[key] || []).push(o);
    });
  return Object.values(groups).filter((g) => g.length > 1);
}

function renderAdminCard(order, currentUser, conflict = false) {
  const status    = order.status || "Booked";
  const canEdit   = isAdmin(currentUser?.email);
  const imageUrls = getImageUrls(order);
  const dateStr   = formatDate(order.date);

  const imageBlock = imageUrls.length
    ? `<div class="admin-images" style="margin-top:12px;">
         <div class="sub" style="margin-bottom:8px;">
           Customer Uploads (${imageUrls.length})
         </div>
         <div style="display:flex;gap:10px;flex-wrap:wrap;">
           ${imageUrls
             .map(
               (url, i) =>
                 `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
                     aria-label="View upload ${i + 1}">
                    <img src="${esc(url)}" alt="Upload ${i + 1}"
                      style="width:88px;height:88px;object-fit:cover;
                             border-radius:10px;border:1px solid var(--line);"
                      loading="lazy"/>
                  </a>`
             )
             .join("")}
         </div>
       </div>`
    : "";

  const staffOptions = (window._staffList || [])
    .map(
      (s) =>
        `<option value="${esc(s.name)}" ${order.assignedStaff === s.name ? "selected" : ""}>
           ${esc(s.name)} (${esc(LOCATIONS[s.location] || s.location || "")})
         </option>`
    )
    .join("");

  return `
    <article class="order-card${conflict ? " conflict-card" : ""}"
             data-id="${esc(order.id)}">

      <div class="order-top">
        <div>
          <div class="order-title">
            ${esc(order.customerName || "Customer")}
            &bull; ${esc(serviceLabel(order.service))}
            ${conflict ? `<span class="conflict-badge">Conflict</span>` : ""}
          </div>
          <div class="sub">
            ${esc(order.customerEmail || "")}
            ${order.customerPhone ? ` &bull; ${esc(order.customerPhone)}` : ""}
          </div>
          <div class="sub">${esc(order.location || "")}</div>
          <div class="sub">
            ${esc(dateStr)} &bull; ${esc(order.timeSlot || "")} &bull; ${esc(order.price || "")}
          </div>
          <div class="sub">Order ID: <code>${esc(order.id)}</code></div>
          <div class="sub">Collected: ${order.pickedUp ? "✅ Yes" : "No"}</div>
          ${order.assignedStaff
            ? `<div class="sub">Assigned: <strong>${esc(order.assignedStaff)}</strong></div>`
            : ""}
        </div>
        <span class="${badgeClass(status)}">${esc(status)}</span>
      </div>

      ${renderProgress(status)}
      ${imageBlock}

      ${canEdit
        ? `
        <div class="admin-row" style="margin-top:14px;">
          <div class="admin-field">
            <label class="sub" for="status-${esc(order.id)}">Status</label>
            <select id="status-${esc(order.id)}"
                    class="admin-status"
                    data-id="${esc(order.id)}">
              ${STATUS.map(
                (s) =>
                  `<option value="${esc(s)}" ${status === s ? "selected" : ""}>
                     ${esc(s)}
                   </option>`
              ).join("")}
            </select>
          </div>

          <div class="admin-field">
            <label class="sub" for="pts-${esc(order.id)}">Points to award</label>
            <input id="pts-${esc(order.id)}"
                   class="admin-points"
                   data-id="${esc(order.id)}"
                   type="number" min="0" max="500" step="5"
                   value="${esc(order.pointsAwarded ?? 10)}"/>
          </div>

          <div class="admin-field admin-field-btn">
            <button class="btn primary" type="button"
                    data-admin-save="${esc(order.id)}">
              Save
            </button>
          </div>
        </div>

        <div class="admin-row"
             style="margin-top:10px;padding-top:10px;
                    border-top:1px solid var(--line,#e2e8f0);">
          <div class="admin-field">
            <label class="sub" for="mode-${esc(order.id)}">Handoff mode</label>
            <select id="mode-${esc(order.id)}"
                    class="admin-delivery-mode"
                    data-id="${esc(order.id)}">
              <option value="pending"
                ${(order.deliveryMode || "pending") === "pending" ? "selected" : ""}>
                Not decided yet
              </option>
              <option value="pickup"
                ${order.deliveryMode === "pickup" ? "selected" : ""}>
                Customer pickup
              </option>
              <option value="staff"
                ${order.deliveryMode === "staff" ? "selected" : ""}>
                Staff delivers
              </option>
              <option value="self"
                ${order.deliveryMode === "self" ? "selected" : ""}>
                I handle it personally
              </option>
            </select>
          </div>

          <div class="admin-field">
            <label class="sub" for="staff-${esc(order.id)}">Assign to staff member</label>
            <select id="staff-${esc(order.id)}"
                    class="admin-staff-assign"
                    data-id="${esc(order.id)}">
              <option value="">— unassigned —</option>
              ${staffOptions}
            </select>
          </div>
        </div>

        <div class="order-meta" style="margin-top:10px;">
          <span class="sub">
            Points granted:
            ${order.pointsGranted
              ? `✅ ${order.grantedPointsAmount ?? 0} pts`
              : "Not yet"}
          </span>
          <span class="sub">Images: ${imageUrls.length}</span>
        </div>

        ${status === "Completed"
          ? `<div class="admin-row"
                  style="margin-top:10px;padding-top:10px;
                         border-top:1px solid var(--line,#e2e8f0);">
               <div class="admin-field">
                 <label class="sub" for="pu-date-${esc(order.id)}">Pickup date</label>
                 <input id="pu-date-${esc(order.id)}"
                        type="date"
                        class="admin-pickup-date"
                        data-id="${esc(order.id)}"
                        min="${todayISO()}"
                        value="${todayISO()}"/>
               </div>
               <div class="admin-field">
                 <label class="sub" for="pu-time-${esc(order.id)}">Pickup time</label>
                 <select id="pu-time-${esc(order.id)}"
                         class="admin-pickup-time"
                         data-id="${esc(order.id)}">
                   ${["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"]
                     .map((t) => `<option value="${t}">${t}</option>`)
                     .join("")}
                 </select>
               </div>
               <div class="admin-field admin-field-btn">
                 <button class="btn secondary" type="button"
                         data-send-pickup="${esc(order.id)}">
                   Send pickup summary
                 </button>
               </div>
             </div>`
          : ""}`
        : ""}
    </article>`;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 8b — SHARED PICKUP BUTTON HANDLER
//
//  Extracted into its own function so BOTH click listeners
//  (adminOrders AND document) can call it. This was the bug —
//  the button lives inside #adminOrders so the adminOrders
//  listener was catching the click before it could bubble up
//  to the document listener where the handler used to live.
// ─────────────────────────────────────────────────────────────

async function handlePickupBtn(pickupBtn) {
  const orderId    = pickupBtn.dataset.sendPickup;
  const dateEl     = document.querySelector(`.admin-pickup-date[data-id="${orderId}"]`);
  const timeEl     = document.querySelector(`.admin-pickup-time[data-id="${orderId}"]`);
  const pickupDate = dateEl?.value;
  const pickupTime = timeEl?.value;

  if (!pickupDate || !isValidDate(pickupDate)) {
    toast("Please select a valid pickup date.", "error");
    return;
  }

  pickupBtn.disabled    = true;
  pickupBtn.textContent = "Sending…";

  try {
    const snap = await withRetry(() => getDoc(doc(db, "orders", orderId)));
    if (!snap.exists()) { toast("Order not found", "error"); return; }
    const order = snap.data();

    await sendPickupSummaryEmail({
      recipientEmail:  order.customerEmail,
      recipientName:   order.customerName  || "Customer",
      orderId,
      locationName:    order.location      || "DKcleanedit",
      cleaningSummary: `${serviceLabel(order.service)} — your shoes are clean and ready.`,
      pickupDate:      formatDate(pickupDate),
      pickupTime,
    });

    toast(`Pickup summary sent to ${order.customerEmail} ✅`, "success");
    pickupBtn.textContent = "✅ Sent";
  } catch (err) {
    console.error("Pickup summary email failed:", err);
    toast("Email failed — check EmailJS template ID.", "error");
    pickupBtn.disabled    = false;
    pickupBtn.textContent = "Send pickup summary";
  }
}


// ─────────────────────────────────────────────────────────────
//  SECTION 9 — SAVE ORDER (admin)
// ─────────────────────────────────────────────────────────────

async function saveOrder(orderId) {
  const statusEl = document.querySelector(`.admin-status[data-id="${orderId}"]`);
  const pointsEl = document.querySelector(`.admin-points[data-id="${orderId}"]`);
  const modeEl   = document.querySelector(`.admin-delivery-mode[data-id="${orderId}"]`);
  const staffEl  = document.querySelector(`.admin-staff-assign[data-id="${orderId}"]`);

  if (!statusEl || !pointsEl) {
    toast("UI fields missing — please reload the page", "error");
    return;
  }

  const newStatus       = statusEl.value;
  const newPoints       = Math.max(0, Math.min(500, Number(pointsEl.value || 0)));
  const newDeliveryMode = modeEl?.value || "pending";
  const newStaff        = (staffEl?.value || "").trim();

  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) {
    toast("Order not found", "error");
    return;
  }

  const prev        = snap.data();
  const prevGranted = Number(prev.grantedPointsAmount || 0);
  const newGranted  = newStatus === "Completed" ? newPoints : 0;
  const pointsDelta = newGranted - prevGranted;

  const batch = writeBatch(db);

  if (prev.uid && pointsDelta !== 0) {
    batch.set(
      doc(db, "users", prev.uid),
      { points: increment(pointsDelta) },
      { merge: true }
    );
  }

  batch.update(ref, {
    status:              newStatus,
    pickedUp:            newStatus === "Completed",
    pointsAwarded:       newPoints,
    pointsGranted:       newGranted > 0,
    grantedPointsAmount: newGranted,
    deliveryMode:        newDeliveryMode,
    assignedStaff:       newStaff,
    updatedAt:           serverTimestamp(),
  });

  await withRetry(() => batch.commit());

  if (newStatus === "Completed" && prev.status !== "Completed") {
    if (!prev.customerEmail) {
      toast("Order saved — no email sent (no email address on this order).", "error");
    } else {
      try {
        await sendCleaningCompleteEmail({
          recipientEmail:  prev.customerEmail,
          recipientName:   prev.customerName  || "Customer",
          locationName:    prev.location      || "DKcleanedit",
          cleaningSummary: `${serviceLabel(prev.service)} for order ${orderId} is complete.`,
          completedAt:     new Date().toLocaleDateString("en-GB"),
        });
        toast("Completion email sent to customer ✅", "success");
      } catch (err) {
        console.error("❌ Customer email failed:", err);
        toast("Order saved — email failed. Check Console (F12).", "error");
      }
    }
  }

  toast("Order updated ✅", "success");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 10 — CANCEL & RESCHEDULE (customer side)
// ─────────────────────────────────────────────────────────────

async function cancelOrder(orderId) {
  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) { toast("Order not found", "error"); return; }

  const { status } = snap.data();
  if (!["Booked", "Received"].includes(status)) {
    toast("This order can no longer be cancelled");
    return;
  }
  if (!confirm("Cancel this booking? This cannot be undone.")) return;

  await withRetry(() =>
    updateDoc(ref, { status: "Cancelled", updatedAt: serverTimestamp() })
  );
  toast("Booking cancelled", "success");
}

async function rescheduleOrder(orderId) {
  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) { toast("Order not found", "error"); return; }

  const data = snap.data();
  if (!["Booked", "Received"].includes(data.status)) {
    toast("This order can no longer be rescheduled");
    return;
  }

  const newDate = prompt("New date (YYYY-MM-DD):", data.date || "");
  if (!newDate) return;
  const newTime = prompt("New time slot (HH:MM):", data.timeSlot || "");
  if (!newTime) return;

  if (!isValidDate(newDate.trim())) {
    toast("Invalid date format. Use YYYY-MM-DD.", "error");
    return;
  }
  if (!isValidTime(newTime.trim())) {
    toast("Invalid time format. Use HH:MM.", "error");
    return;
  }
  if (newDate.trim() < todayISO()) {
    toast("Cannot reschedule to a past date.", "error");
    return;
  }

  const available = await withRetry(() =>
    slotAvailable(newDate.trim(), data.location, newTime.trim())
  );
  if (!available) {
    toast("That slot is already taken. Please try another time.", "error");
    return;
  }

  await withRetry(() =>
    updateDoc(ref, {
      date:      newDate.trim(),
      timeSlot:  newTime.trim(),
      updatedAt: serverTimestamp(),
    })
  );
  toast("Booking rescheduled ✅", "success");
}

function wireOrderActions(containerEl) {
  containerEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !auth.currentUser) return;

    btn.disabled = true;
    try {
      if (btn.dataset.action === "cancel")     await cancelOrder(btn.dataset.id);
      if (btn.dataset.action === "reschedule") await rescheduleOrder(btn.dataset.id);
    } catch (err) {
      console.error("Order action failed:", err);
      toast("Action failed. Please try again.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 11 — SHARED CALENDAR BUILDER
// ─────────────────────────────────────────────────────────────

function buildCalendar({
  container,
  year,
  month,
  today,
  selectedDate,
  onPick,
  getCellClass,
}) {
  container.innerHTML = "";

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const append = (cls, text, onClick, tabIndex = -1) => {
    const cell = document.createElement("div");
    cell.className   = cls;
    cell.textContent = text;
    cell.setAttribute("role", "gridcell");
    if (tabIndex >= 0) cell.setAttribute("tabindex", tabIndex);
    if (onClick) {
      cell.addEventListener("click", onClick);
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      });
    }
    container.appendChild(cell);
    return cell;
  };

  for (let i = 0; i < firstDay; i++) {
    append("cal-cell cal-cell--other", daysInPrev - firstDay + 1 + i);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);

    const iso        = isoFromDate(date);
    const extra      = getCellClass ? getCellClass(date, iso) : "";
    const isPast     = date < today;
    const isToday    = date.toDateString() === today.toDateString();
    const isSelected = selectedDate && (
      typeof selectedDate === "string"
        ? iso === selectedDate
        : date.toDateString() === selectedDate.toDateString()
    );

    const cls = [
      "cal-cell",
      isPast     ? "cal-cell--past"     : "",
      isToday    ? "cal-cell--today"    : "",
      isSelected ? "cal-cell--selected" : "",
      extra,
    ]
      .filter(Boolean)
      .join(" ");

    const cell = append(
      cls,
      d,
      !isPast && onPick ? () => onPick(date, iso) : null,
      isPast ? -1 : 0
    );

    cell.setAttribute(
      "aria-label",
      `${formatDate(iso, { weekday: "long", day: "numeric", month: "long" })}${
        isSelected ? ", selected" : ""
      }`
    );
    if (isSelected) cell.setAttribute("aria-pressed", "true");
  }

  const remaining =
    (firstDay + daysInMonth) % 7 === 0
      ? 0
      : 7 - ((firstDay + daysInMonth) % 7);
  for (let i = 1; i <= remaining; i++) {
    append("cal-cell cal-cell--other", i);
  }
}


// ─────────────────────────────────────────────────────────────
//  SECTION 12 — NAV BAR
// ─────────────────────────────────────────────────────────────

async function setupNav(user) {
  const show = (id, visible) => {
    const el = $(id);
    if (el) el.hidden = !visible;
  };

  show("#navLogin",    !user);
  show("#navRegister", !user);
  show("#navLogout",   !!user);
  show("#navAdmin",    user ? isAdmin(user.email) : false);

  const adminOrStaff = user && (isAdmin(user.email) || isStaff(user.email));
  show("#navBooking", !adminOrStaff);
  show("#navHome",    !adminOrStaff);

  const navLogout = $("#navLogout");
  if (navLogout && !navLogout._wired) {
    navLogout._wired = true;
    navLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      toast("Logged out ✅");
      location.replace("home.html");
    });
  }

  const badge = $("#navPointsBadge");
  if (badge && user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const pts  = snap.exists() ? Number(snap.data().points || 0) : 0;
      badge.textContent = `${pts} pts`;
      badge.hidden = false;
      badge.setAttribute("aria-label", `You have ${pts} loyalty points`);
    } catch {
      badge.hidden = true;
    }
  }
}

document.addEventListener(
  "click",
  (e) => {
    const link = e.target?.closest?.("a[data-requires-auth='true']");
    if (!link || auth.currentUser) return;
    e.preventDefault();
    goLogin(link.getAttribute("href") || "home.html");
  },
  true
);


// ─────────────────────────────────────────────────────────────
//  SECTION 13 — SIGNUP OVERLAY
// ─────────────────────────────────────────────────────────────

function wireOverlay() {
  const overlay = $("#signupOverlay");
  if (!overlay || overlay._wired) return;
  overlay._wired = true;

  const hide = () => { overlay.hidden = true; };

  $("#closePopupBtn")?.addEventListener("click", (e) => { e.preventDefault(); hide(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) hide();
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 14 — LOGIN PAGE
// ─────────────────────────────────────────────────────────────

function initLogin() {
  const btn = $("#btnLogin");
  if (!btn) return;

  const next = new URL(location.href).searchParams.get("next");

  const AUTH_ERRORS = {
    "auth/invalid-credential":     "Wrong email or password.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = $("#logEmail")?.value.trim();
    const pass  = $("#logPass")?.value;

    if (!email) { setMsg("Please enter your email address."); return; }
    if (!pass)  { setMsg("Please enter your password.");      return; }

    btn.disabled    = true;
    btn.textContent = "Signing in…";
    setMsg("");

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast("Logged in ✅", "success");
      location.replace(next ? decodeURIComponent(next) : "customer.html");
    } catch (err) {
      const msg = AUTH_ERRORS[err?.code] ?? err.message ?? "Login failed.";
      setMsg(msg);
      toast(msg, "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = "Sign in";
    }
  });

  $("#logPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });

  $("#btnSendReset")?.addEventListener("click", async () => {
    const email = (
      $("#resetEmail")?.value || $("#logEmail")?.value || ""
    ).trim();
    if (!email) { setMsg("Enter your email address first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("Reset email sent ✅ Check your inbox.");
      toast("Reset email sent ✅", "success");
    } catch (err) {
      const msg =
        err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : err.message;
      setMsg(msg);
    }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 15 — REGISTER PAGE
// ─────────────────────────────────────────────────────────────

function initRegister() {
  const btn = $("#btnRegister");
  if (!btn) return;

  const next = new URL(location.href).searchParams.get("next");

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const name        = $("#regName")?.value.trim();
    const email       = $("#regEmail")?.value.trim();
    const phone       = $("#regPhone")?.value.trim();
    const pass        = $("#regPass")?.value;
    const passConfirm = $("#regPassConfirm")?.value;

    if (!name)               { setMsg("Please enter your name.");               return; }
    if (!email)              { setMsg("Please enter your email address.");       return; }
    if (!pass)               { setMsg("Please enter a password.");               return; }
    if (pass.length < 8)     { setMsg("Password must be at least 8 characters."); return; }
    if (passConfirm && pass !== passConfirm) {
      setMsg("Passwords do not match.");
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Creating account…";
    setMsg("");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      await Promise.all([
        updateProfile(cred.user, { displayName: name }),
        setDoc(doc(db, "users", cred.user.uid), {
          name,
          email,
          phone:     phone || "",
          points:    0,
          createdAt: serverTimestamp(),
        }),
      ]);

      toast("Account created ✅", "success");
      location.replace(next ? decodeURIComponent(next) : "customer.html");
    } catch (err) {
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "An account already exists with this email."
          : err.message ?? "Registration failed.";
      setMsg(msg);
      toast("Registration failed.", "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = "Create account";
    }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 16 — BOOKING PAGE
// ─────────────────────────────────────────────────────────────

function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook) return;

  wireOverlay();

  function getPrice() {
    return SERVICE_PRICES[$("#service")?.value] || "";
  }

  function updateSummary() {
    const svc    = $("#service")?.value  || "";
    const locKey = $("#location")?.value || "";
    const time   = $("#timeSlot")?.value || "";
    const date   = document.getElementById("date")?.value || "";
    const loc    = LOCATION_DATA[locKey]?.name || locKey || "—";

    if ($("#summaryService"))    $("#summaryService").textContent    = serviceLabel(svc) || "—";
    if ($("#summaryLocation"))   $("#summaryLocation").textContent   = loc;
    if ($("#summaryTime"))       $("#summaryTime").textContent       = time || "—";
    if ($("#selectedPriceText")) $("#selectedPriceText").textContent = getPrice() || "—";
    if ($("#summaryDate"))
      $("#summaryDate").textContent =
        date && isValidDate(date) ? formatDate(date) : "—";
  }

  async function refreshSlots(dateISO) {
    const loc  = $("#location")?.value || "";
    const btns = $$(".time-slot");
    if (!btns.length) return;

    btns.forEach((b) => { b.disabled = true; b.style.opacity = "0.5"; });

    try {
      const open = await withRetry(() => getOpenSlots(dateISO, loc));

      btns.forEach((btn) => {
        const available = open.includes(btn.dataset.time);
        btn.disabled                = !available;
        btn.style.opacity           = available ? "" : "0.4";
        btn.style.cursor            = available ? "" : "not-allowed";
        btn.style.textDecoration    = available ? "" : "line-through";
        btn.setAttribute("aria-disabled", String(!available));
        btn.classList.toggle("slot-unavailable", !available);
        if (!available) btn.classList.remove("active");
      });

      const timeSlot = $("#timeSlot");
      if (timeSlot && !open.includes(timeSlot.value)) {
        timeSlot.value = "";
        btns.forEach((b) => b.classList.remove("active"));
        updateSummary();
      }
    } catch (err) {
      console.error("Slot refresh failed:", err);
      toast("Could not load slot availability.", "error");
      btns.forEach((b) => { b.disabled = false; b.style.opacity = ""; });
    }
  }

  $$(".time-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      $$(".time-slot").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const sel = $("#timeSlot");
      if (sel) {
        sel.value = btn.dataset.time;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      updateSummary();
    });
  });

  const calBody  = document.getElementById("calBody");
  const calLabel = document.getElementById("calMonthLabel");
  const calPrev  = document.getElementById("calPrev");
  const calNext  = document.getElementById("calNext");

  if (calBody && calPrev && calNext) {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let viewYear     = todayDate.getFullYear();
    let viewMonth    = todayDate.getMonth();
    let selectedDate = null;

    function buildCal() {
      if (calLabel)
        calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

      buildCalendar({
        container:    calBody,
        year:         viewYear,
        month:        viewMonth,
        today:        todayDate,
        selectedDate,
        onPick: async (date, iso) => {
          selectedDate = date;

          const hiddenInput = document.getElementById("date");
          if (hiddenInput) {
            hiddenInput.value = iso;
            hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
          }

          const label = document.getElementById("selectedDateLabel");
          if (label)
            label.textContent = date.toLocaleDateString("en-GB", {
              weekday: "long",
              day:     "numeric",
              month:   "long",
              year:    "numeric",
            });

          buildCal();
          updateSummary();
          await refreshSlots(iso);
        },
      });
    }

    calPrev.addEventListener("click", () => {
      if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
      buildCal();
    });
    calNext.addEventListener("click", () => {
      if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
      buildCal();
    });

    buildCal();
  }

  $$("[data-service-card]").forEach((card) => {
    card.addEventListener("click", () => {
      $$("[data-service-card]").forEach((c) => {
        c.classList.remove("active");
        c.removeAttribute("aria-selected");
      });
      card.classList.add("active");
      card.setAttribute("aria-selected", "true");

      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      const sel = $("#service");
      if (sel) {
        sel.value = card.dataset.serviceCard;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      updateSummary();
    });
  });

  function updateMap() {
    const picked = LOCATION_DATA[$("#location")?.value];
    if (!picked) return;
    if ($("#selectedBranchName"))    $("#selectedBranchName").textContent    = picked.name;
    if ($("#selectedBranchAddress")) $("#selectedBranchAddress").textContent = picked.address;
    if ($("#bookingMapFrame"))       $("#bookingMapFrame").src               = picked.embed;
    if ($("#openMapsBtn"))           $("#openMapsBtn").href                  = picked.mapsLink;
  }

  $("#shoeImages")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please upload an image file.", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Image must be under 10 MB.", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if ($("#shoePreview"))     $("#shoePreview").src        = ev.target.result;
      if ($("#shoePreviewWrap")) $("#shoePreviewWrap").hidden = false;
    };
    reader.readAsDataURL(file);
  });

  $("#service")?.addEventListener("change", updateSummary);
  $("#location")?.addEventListener("change", () => {
    updateSummary();
    updateMap();
    const d = document.getElementById("date")?.value;
    if (d && isValidDate(d)) refreshSlots(d);
  });
  document.getElementById("date")?.addEventListener("change", updateSummary);

  updateSummary();
  updateMap();

  onAuthStateChanged(auth, async (user) => {
    const nameInput = $("#customerName");
    if (!user || !nameInput || nameInput.value.trim()) return;
    try {
      const snap      = await getDoc(doc(db, "users", user.uid));
      nameInput.value = snap.exists()
        ? snap.data().name || user.displayName || ""
        : user.displayName || "";
    } catch { /* non-critical */ }
  });

  btnBook.addEventListener("click", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      const overlay = $("#signupOverlay");
      if (overlay) overlay.hidden = false;
      toast("Please log in to book.");
      return;
    }

    const service   = $("#service")?.value;
    const loc       = $("#location")?.value;
    const date      = document.getElementById("date")?.value;
    const timeSlot  = $("#timeSlot")?.value;
    const price     = getPrice();
    const shoeNotes = $("#shoeNotes")?.value.trim() || "";
    const images    = Array.from($("#shoeImages")?.files || []);

    if (!service)  { setMsg("Please select a service.");      return; }
    if (!loc)      { setMsg("Please select a location.");     return; }
    if (!date)     { setMsg("Please pick a date.");           return; }
    if (!timeSlot) { setMsg("Please pick a time slot.");      return; }
    if (!price)    { setMsg("Please select a price option."); return; }
    if (date < todayISO()) { setMsg("Please select a future date."); return; }

    btnBook.disabled    = true;
    btnBook.textContent = "Checking availability…";
    setMsg("");

    try {
      const available = await withRetry(() => slotAvailable(date, loc, timeSlot));
      if (!available) {
        setMsg("That slot is no longer available. Please pick another time.");
        toast("Slot taken — please pick another.", "error");
        await refreshSlots(date);
        return;
      }

      btnBook.textContent = "Processing…";

      const userSnap      = await getDoc(doc(db, "users", user.uid));
      const userData      = userSnap.exists() ? userSnap.data() : {};
      const customerName  = $("#customerName")?.value.trim()
        || userData.name
        || user.displayName
        || "Customer";
      const customerEmail = userData.email  || user.email || "";
      const customerPhone = userData.phone  || "";

      const orderRef = await addDoc(collection(db, "orders"), {
        uid:           user.uid,
        customerName,
        customerEmail,
        customerPhone,
        service,
        serviceLabel:  serviceLabel(service),
        location:      loc,
        date,
        timeSlot,
        price,
        shoeNotes,
        status:        "Booked",
        pickedUp:      false,
        deliveryMode:  "pending",
        assignedStaff: "",
        pointsAwarded: 10,
        pointsGranted: false,
        grantedPointsAmount: 0,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });

      if (images.length) {
        try {
          const urls = await Promise.all(
            images.map(async (img, i) => {
              const ref = storageRef(
                storage,
                `orders/${orderRef.id}/${Date.now()}-${i}-${img.name}`
              );
              await uploadBytes(ref, img);
              return getDownloadURL(ref);
            })
          );
          await updateDoc(orderRef, {
            imageUrls: urls,
            updatedAt: serverTimestamp(),
          });
        } catch (uploadErr) {
          console.warn("Image upload failed (booking still saved):", uploadErr);
          toast("Images failed to upload, but your booking is confirmed.", "error");
        }
      }

      sendBookingEmail({
        customerName,
        customerEmail,
        orderId:     orderRef.id,
        service:     serviceLabel(service),
        location:    loc,
        bookingDate: date,
        bookingTime: timeSlot,
        price,
        shoeNotes,
      });

      toast("Booking confirmed ✅", "success");
      setMsg(`Booking confirmed! Order ID: ${orderRef.id}`);
      setTimeout(() => { location.href = "track.html"; }, 900);
    } catch (err) {
      console.error("Booking failed:", err);
      const msg =
        err?.code === "permission-denied"
          ? "Permission denied. Please log in again."
          : "Booking failed. Please try again.";
      setMsg(msg);
      toast(msg, "error");
    } finally {
      btnBook.disabled    = false;
      btnBook.textContent = "Confirm booking";
    }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 17 — TRACKING PAGE
// ─────────────────────────────────────────────────────────────

function initTracking() {
  const ordersEl = $("#orders");
  if (!ordersEl) return;

  wireOverlay();
  wireOrderActions(ordersEl);

  ordersEl.innerHTML = renderSkeletonOrders(2);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const overlay = $("#signupOverlay");
      if (overlay) overlay.hidden = false;
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">Please log in to view your orders</div>
          <a class="btn primary" href="login.html?next=track.html">Go to Login</a>
        </div>`;
      return;
    }

    if ($("#signupOverlay")) $("#signupOverlay").hidden = true;

    onSnapshot(
      query(collection(db, "orders"), where("uid", "==", user.uid)),
      (snap) => {
        const orders = [];
        snap.forEach((d) => orders.push({ id: d.id, ...d.data() }));
        orders.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        const active = orders.filter(
          (o) =>
            !["Completed", "Cancelled", "Delivered", "Collected"].includes(o.status)
        );

        ordersEl.innerHTML = active.length
          ? active.map(renderOrderCard).join("")
          : `<div class="order-card">
               <div class="order-title">No active orders</div>
               <p class="sub">Book a service to get started.</p>
               <a class="btn primary" href="booking.html">Book now</a>
             </div>`;
      },
      (err) => {
        console.error("Tracking snapshot error:", err);
        ordersEl.innerHTML = `
          <div class="order-card">
            <div class="order-title">Failed to load orders.</div>
          </div>`;
      }
    );
  });

  $("#btnRefresh")?.addEventListener("click", () => toast("Tracking is live ✅"));
}


// ─────────────────────────────────────────────────────────────
//  SECTION 18 — SKELETON LOADERS
// ─────────────────────────────────────────────────────────────

function renderSkeletonOrders(count = 3) {
  return Array.from(
    { length: count },
    () => `
    <div class="order-card" aria-hidden="true">
      <div class="sched-skeleton" style="height:22px;width:60%;margin-bottom:10px;"></div>
      <div class="sched-skeleton" style="height:14px;width:40%;margin-bottom:16px;"></div>
      <div class="sched-skeleton" style="height:10px;width:100%;border-radius:99px;"></div>
    </div>`
  ).join("");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 19 — CUSTOMER ACCOUNT PAGE
// ─────────────────────────────────────────────────────────────

function initCustomer() {
  if (!$("#custOrders") && !$("#btnChangePass") && !$("#custName")) return;

  const orderList = $("#custOrders");
  if (orderList) wireOrderActions(orderList);

  $("#btnCustRefresh")?.addEventListener("click", () => toast("Account data is live ✅"));

  onAuthStateChanged(auth, async (user) => {
    if (!user) { goLogin("customer.html"); return; }

    try {
      const snap     = await getDoc(doc(db, "users", user.uid));
      const userData = snap.exists() ? snap.data() : {};
      if ($("#custName"))   $("#custName").textContent   = userData.name   || user.displayName || "—";
      if ($("#custEmail"))  $("#custEmail").textContent  = userData.email  || user.email       || "—";
      if ($("#custPoints")) $("#custPoints").textContent = String(userData.points || 0);
    } catch (err) {
      console.warn("Could not load user profile:", err);
    }

    if (orderList) {
      orderList.innerHTML = renderSkeletonOrders(2);
      onSnapshot(
        query(collection(db, "orders"), where("uid", "==", user.uid)),
        (snap2) => {
          const orders = [];
          snap2.forEach((d) => orders.push({ id: d.id, ...d.data() }));
          orders.sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
          orderList.innerHTML =
            orders.slice(0, 5).map(renderOrderCard).join("") ||
            `<div class="order-card"><div class="order-title">No orders yet</div></div>`;
        }
      );
    }

    $("#btnChangePass")?.addEventListener("click", async () => {
      const currentPass = $("#curPass")?.value;
      const newPass     = $("#newPass")?.value;
      if (!currentPass) { setMsg("Enter your current password.", "passMsg"); return; }
      if (!newPass)     { setMsg("Enter a new password.", "passMsg"); return; }
      if (newPass.length < 8) {
        setMsg("New password must be at least 8 characters.", "passMsg");
        return;
      }
      try {
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, currentPass)
        );
        await updatePassword(user, newPass);
        setMsg("Password updated ✅", "passMsg");
        toast("Password updated ✅", "success");
        if ($("#curPass")) $("#curPass").value = "";
        if ($("#newPass")) $("#newPass").value = "";
      } catch (err) {
        const msg =
          err?.code === "auth/wrong-password"
            ? "Current password is incorrect."
            : err.message || "Failed.";
        setMsg(msg, "passMsg");
      }
    });
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 20 — ADMIN AVAILABILITY CALENDAR
// ─────────────────────────────────────────────────────────────

function initAvailabilityCalendar() {
  const calBody = document.getElementById("availCalBody");
  if (!calBody) return;

  const calLabel = document.getElementById("availMonthLabel");
  const editor   = document.getElementById("availSlotEditor");
  const selLabel = document.getElementById("availSelectedLabel");
  const slotGrid = document.getElementById("availSlotGrid");

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let viewYear     = todayDate.getFullYear();
  let viewMonth    = todayDate.getMonth();
  let selectedDate = null;
  let cache        = {};

  function getSlots(iso) {
    return cache[iso]
      ? { ...cache[iso] }
      : Object.fromEntries(TIME_SLOTS.map((s) => [s, true]));
  }

  async function loadMonth() {
    const m = pad(viewMonth + 1);
    try {
      const q = query(
        collection(db, "availability"),
        where("__name__", ">=", `${viewYear}-${m}-01`),
        where("__name__", "<=", `${viewYear}-${m}-31`)
      );
      (await getDocs(q)).forEach((d) => {
        cache[d.id] = d.data().slots || {};
      });
    } catch (err) {
      console.error("Failed to load availability:", err);
    }
  }

  function renderSlotEditor(iso) {
    if (!editor || !slotGrid || !selLabel) return;
    editor.style.display = "block";
    selLabel.textContent = formatDate(iso, {
      weekday: "short",
      day:     "numeric",
      month:   "short",
      year:    "numeric",
    });
    slotGrid.innerHTML = "";

    const slots = getSlots(iso);
    TIME_SLOTS.forEach((slot) => {
      const isOpen = slots[slot] !== false;
      const btn    = document.createElement("button");
      btn.type      = "button";
      btn.className = `avail-slot-btn ${isOpen ? "slot-open" : "slot-closed"}`;
      btn.innerHTML = `<span class="avail-slot-dot"></span>${slot}`;
      btn.setAttribute("aria-pressed", String(isOpen));
      btn.setAttribute("aria-label",   `${slot} — ${isOpen ? "open" : "closed"}`);
      btn.addEventListener("click", () => {
        if (!cache[iso]) cache[iso] = getSlots(iso);
        cache[iso][slot] = !isOpen;
        renderSlotEditor(iso);
        buildCal();
      });
      slotGrid.appendChild(btn);
    });
  }

  async function buildCal() {
    if (calLabel)
      calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonth();

    buildCalendar({
      container:    calBody,
      year:         viewYear,
      month:        viewMonth,
      today:        todayDate,
      selectedDate,
      onPick:       (date, iso) => { selectedDate = iso; buildCal(); renderSlotEditor(iso); },
      getCellClass: (date, iso) => {
        if (date < todayDate) return "avail-cell--past";
        const openCount = TIME_SLOTS.filter(
          (s) => getSlots(iso)[s] !== false
        ).length;
        return openCount === 0 ? "avail-cell--closed" : "avail-cell--open";
      },
    });

    [...calBody.children].forEach((cell) => {
      cell.className = cell.className.replace(/\bcal-cell\b/g, "avail-cell");
    });
  }

  const setAllSlots = (open) => {
    if (!selectedDate) return;
    if (!cache[selectedDate]) cache[selectedDate] = getSlots(selectedDate);
    TIME_SLOTS.forEach((s) => { cache[selectedDate][s] = open; });
    renderSlotEditor(selectedDate);
    buildCal();
  };

  document.getElementById("btnAvailOpenAll")?.addEventListener("click",  () => setAllSlots(true));
  document.getElementById("btnAvailCloseAll")?.addEventListener("click", () => setAllSlots(false));

  document.getElementById("btnAvailSave")?.addEventListener("click", async () => {
    if (!selectedDate) { toast("Select a date first."); return; }
    const btn = document.getElementById("btnAvailSave");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await withRetry(() =>
        setDoc(doc(db, "availability", selectedDate), {
          slots:     cache[selectedDate] || getSlots(selectedDate),
          updatedAt: serverTimestamp(),
        })
      );
      toast(`Saved for ${selectedDate} ✅`, "success");
      buildCal();
    } catch (err) {
      console.error(err);
      toast("Save failed. Please retry.", "error");
    } finally {
      btn.disabled = false; btn.textContent = "Save";
    }
  });

  document.getElementById("availPrev")?.addEventListener("click", async () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDate = null;
    if (editor) editor.style.display = "none";
    await buildCal();
  });
  document.getElementById("availNext")?.addEventListener("click", async () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDate = null;
    if (editor) editor.style.display = "none";
    await buildCal();
  });

  buildCal();
}


// ─────────────────────────────────────────────────────────────
//  SECTION 21 — CSV EXPORT
// ─────────────────────────────────────────────────────────────

function exportOrdersToCSV(orders) {
  if (!orders.length) { toast("No orders to export."); return; }

  const headers = [
    "Order ID", "Customer Name", "Email", "Phone",
    "Service", "Location", "Date", "Time", "Price",
    "Status", "Picked Up", "Points Awarded",
    "Delivery Mode", "Assigned Staff",
    "Notes", "Created",
  ];

  const rows = orders.map((o) => [
    o.id,
    o.customerName       || "",
    o.customerEmail      || "",
    o.customerPhone      || "",
    serviceLabel(o.service),
    o.location           || "",
    o.date               || "",
    o.timeSlot           || "",
    o.price              || "",
    o.status             || "",
    o.pickedUp           ? "Yes" : "No",
    o.pointsAwarded      || 0,
    o.deliveryMode       || "pending",
    o.assignedStaff      || "",
    (o.shoeNotes || "").replace(/"/g, '""'),
    o.createdAt?.toDate?.().toISOString?.() || "",
  ].map((v) => `"${v}"`));

  const csv  = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href:     url,
    download: `orders-${todayISO()}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Orders exported ✅", "success");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 22 — ADMIN PAGE
// ─────────────────────────────────────────────────────────────

function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders) return;

  initAvailabilityCalendar();

  // ── Tabs ──────────────────────────────────────────────────
  $$(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", activateTab.bind(null, tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateTab(tab);
      }
    });
  });

  function activateTab(tab) {
    $$(".admin-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    $$(".admin-tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    const key = tab.dataset.tab;
    document
      .getElementById(`tab${key.charAt(0).toUpperCase() + key.slice(1)}`)
      ?.classList.add("active");
  }

  const isoToday   = todayISO();
  const todayLabel = $("#todayLabel");
  const debugUid   = $("#debugUid");
  const debugRole  = $("#debugRole");
  if (todayLabel) todayLabel.textContent = `Today's bookings — ${formatDate(isoToday)}`;

  let allOrders   = [];
  let currentUser = null;

  // ── Load staff list ────────────────────────────────────────
  async function loadStaffList() {
    try {
      const snap = await getDocs(collection(db, "staff"));
      window._staffList = [];
      snap.forEach((d) => window._staffList.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Could not load staff list:", err);
      window._staffList = [];
    }
  }

  // ── Missed drop-offs tab ───────────────────────────────────
  function renderMissedTab() {
    const missedPanel = $("#tabAppointment");
    if (!missedPanel) return;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);

    const missed = allOrders.filter(
      (o) =>
        o.status === "Booked" &&
        o.date &&
        new Date(o.date + "T00:00:00") < cutoff
    );

    const badge = missed.length
      ? `<span class="badge danger" style="margin-left:8px;font-size:0.75rem;">
           ${missed.length}
         </span>`
      : "";

    const header = `
      <div class="card soft" style="margin-bottom:16px;padding:14px 18px;">
        <div class="card-title" style="font-size:0.95rem;">Missed Drop-offs ${badge}</div>
        <p class="sub" style="margin-top:4px;font-size:0.88rem;">
          Customers who booked but didn't arrive. Notify them to rebook or cancel.
        </p>
      </div>`;

    if (!missed.length) {
      missedPanel.innerHTML =
        header +
        `<div class="order-card">
           <div class="order-title">No missed drop-offs ✅</div>
         </div>`;
      return;
    }

    missedPanel.innerHTML =
      header +
      missed
        .map(
          (o) => `
        <div class="order-card" style="border-left:3px solid #ef4444;">
          <div class="order-top">
            <div>
              <div class="order-title">
                ${esc(o.customerName || "Customer")}
                &bull; ${esc(serviceLabel(o.service))}
              </div>
              <div class="sub">${esc(o.customerEmail || "No email on file")}</div>
              <div class="sub">${esc(o.location || "")}</div>
              <div class="sub">
                ${esc(formatDate(o.date))} at ${esc(o.timeSlot || "")}
                &bull; ${esc(o.price || "")}
              </div>
              <div class="sub">Order: <code>${esc(o.id)}</code></div>
              <div class="sub" style="color:#ef4444;font-weight:600;margin-top:4px;">
                ⚠ Did not drop off — appointment passed
              </div>
            </div>
            <span class="badge danger">No-show</span>
          </div>
          ${renderProgress(o.status)}
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn primary" type="button"
              data-notify-missed="${esc(o.id)}"
              data-name="${esc(o.customerName  || "Customer")}"
              data-email="${esc(o.customerEmail || "")}"
              data-date="${esc(o.date          || "")}"
              data-time="${esc(o.timeSlot      || "")}"
              data-loc="${esc(o.location       || "")}">
              Notify customer
            </button>
            <button class="btn secondary" type="button"
              data-cancel-missed="${esc(o.id)}">
              Cancel order
            </button>
          </div>
        </div>`
        )
        .join("");
  }

  // ── Main render ────────────────────────────────────────────
  const debouncedRender = debounce(() => renderAll(), 220);

  function renderAll() {
    const search = ($("#adminSearch")?.value || "").trim().toLowerCase();
    const filter = ($("#adminFilter")?.value || "") === "All"
      ? ""
      : ($("#adminFilter")?.value || "").trim();

    const conflicts   = findConflicts(allOrders);
    const conflictIds = new Set(conflicts.flat().map((o) => o.id));

    const conflictCount = $("#conflictCount");
    if (conflictCount) conflictCount.textContent = String(conflicts.length);

    const setText = (id, val) => {
      const el = $(id);
      if (el) el.textContent = String(val);
    };
    setText("#adminTotalOrders",     allOrders.length);
    setText("#adminOpenOrders",      allOrders.filter((o) => !["Completed","Cancelled"].includes(o.status)).length);
    setText("#adminCompletedOrders", allOrders.filter((o) => o.status === "Completed").length);
    setText("#adminWithImages",      allOrders.filter((o) => getImageUrls(o).length > 0).length);

    const conflictsList = $("#conflictsList");
    if (conflictsList) {
      conflictsList.innerHTML =
        conflicts.length === 0
          ? `<div class="order-card"><div class="order-title">No conflicts ✅</div></div>`
          : conflicts
              .map(
                (g) => `
                <div style="margin-bottom:18px;">
                  <div class="sub" style="font-weight:700;color:var(--warning);margin-bottom:8px;">
                    ${g.length} orders — ${esc(formatDate(g[0].date))}
                    &bull; ${esc(g[0].timeSlot)} &bull; ${esc(g[0].location)}
                  </div>
                  ${g.map((o) => renderAdminCard(o, currentUser, true)).join("")}
                </div>`
              )
              .join("");
    }

    const scheduleList = $("#scheduleList");
    if (scheduleList) {
      const todayOrders = allOrders
        .filter((o) => o.date === isoToday && o.status !== "Cancelled")
        .sort((a, b) => (a.timeSlot || "").localeCompare(b.timeSlot || ""));
      scheduleList.innerHTML = todayOrders.length
        ? todayOrders.map((o) => renderAdminCard(o, currentUser, conflictIds.has(o.id))).join("")
        : `<div class="order-card"><div class="order-title">No bookings today</div></div>`;
    }

    renderMissedTab();

    const filtered = allOrders.filter((o) => {
      const matchesFilter = !filter || o.status === filter;
      const haystack = [
        o.customerName, o.customerEmail, o.location,
        o.service, o.date, o.timeSlot, o.price, o.status, o.id,
      ]
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!search || haystack.includes(search));
    });

    adminOrders.innerHTML = filtered.length
      ? filtered.map((o) => renderAdminCard(o, currentUser, conflictIds.has(o.id))).join("")
      : `<div class="order-card"><div class="order-title">No matching orders</div></div>`;
  }

  // ── Admin controls ─────────────────────────────────────────
  $("#adminSearch")?.addEventListener("input", debouncedRender);
  $("#adminFilter")?.addEventListener("change", renderAll);
  $("#btnAdminRefresh")?.addEventListener("click", () => { renderAll(); toast("Refreshed ✅"); });
  $("#btnExportCSV")?.addEventListener("click", () => exportOrdersToCSV(allOrders));

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      const s = $("#adminSearch");
      if (s) { e.preventDefault(); s.focus(); s.select(); }
    }
  });

  // ── Save button + pickup button — main orders list ─────────
  // NOTE: data-send-pickup lives inside #adminOrders so it must
  // be handled HERE, not in the document listener below.
  adminOrders.addEventListener("click", async (e) => {
    if (!isAdmin(currentUser?.email)) return;

    // Pickup summary button
    const pickupBtn = e.target.closest("[data-send-pickup]");
    if (pickupBtn) {
      await handlePickupBtn(pickupBtn);
      return;
    }

    // Save button
    const saveBtn = e.target.closest("[data-admin-save]");
    if (!saveBtn) return;
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    try {
      await saveOrder(saveBtn.dataset.adminSave);
    } catch (err) {
      console.error(err);
      toast("Update failed. Please retry.", "error");
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = "Save";
    }
  });

  // ── Delegated handler for panels outside #adminOrders ──────
  document.addEventListener("click", async (e) => {
    if (!isAdmin(currentUser?.email)) return;

    // Notify missed customer
    const notifyBtn = e.target.closest("[data-notify-missed]");
    if (notifyBtn) {
      const email = notifyBtn.dataset.email;
      if (!email) { toast("No email address for this customer."); return; }
      notifyBtn.disabled = true; notifyBtn.textContent = "Sending…";
      try {
        await sendMissedEmail({
          customerName:  notifyBtn.dataset.name,
          customerEmail: email,
          orderId:       notifyBtn.dataset.notifyMissed,
          bookingDate:   notifyBtn.dataset.date,
          bookingTime:   notifyBtn.dataset.time,
          location:      notifyBtn.dataset.loc,
        });
        toast(`Reminder sent to ${email} ✅`, "success");
        notifyBtn.textContent = "✅ Sent";
      } catch (err) {
        console.error(err);
        toast("Email failed — check EmailJS template ID.", "error");
        notifyBtn.disabled = false; notifyBtn.textContent = "Notify customer";
      }
      return;
    }

   // Pickup summary email
    const pickupBtn = e.target.closest("[data-send-pickup]");
    if (pickupBtn) {
      const orderId    = pickupBtn.dataset.sendPickup;
      const dateEl     = document.querySelector(`.admin-pickup-date[data-id="${orderId}"]`);
      const timeEl     = document.querySelector(`.admin-pickup-time[data-id="${orderId}"]`);
      const pickupDate = dateEl?.value;
      const pickupTime = timeEl?.value;

      if (!pickupDate || !isValidDate(pickupDate)) {
        toast("Please select a valid pickup date.", "error");
        return;
      }

      pickupBtn.disabled = true;
      pickupBtn.textContent = "Sending…";

      try {
        const snap = await withRetry(() => getDoc(doc(db, "orders", orderId)));
        if (!snap.exists()) { toast("Order not found", "error"); return; }
        const order = snap.data();

        await sendPickupSummaryEmail({
          recipientEmail:  order.customerEmail,
          recipientName:   order.customerName  || "Customer",
          orderId,
          locationName:    order.location      || "DKcleanedit",
          cleaningSummary: `${serviceLabel(order.service)} — your shoes are clean and ready.`,
          pickupDate:      formatDate(pickupDate),
          pickupTime,
        });

        toast(`Pickup summary sent to ${order.customerEmail} ✅`, "success");
        pickupBtn.textContent = "✅ Sent";
      } catch (err) {
        console.error("Pickup summary email failed:", err);
        toast("Email failed — check EmailJS template ID.", "error");
        pickupBtn.disabled = false;
        pickupBtn.textContent = "Send pickup summary";
      }
      return;
    }
    // Cancel missed order
    const cancelBtn = e.target.closest("[data-cancel-missed]");
    if (cancelBtn) {
      if (!confirm("Cancel this no-show order?")) return;
      cancelBtn.disabled = true;
      try {
        await withRetry(() =>
          updateDoc(doc(db, "orders", cancelBtn.dataset.cancelMissed), {
            status:    "Cancelled",
            updatedAt: serverTimestamp(),
          })
        );
        toast("Order cancelled ✅", "success");
      } catch (err) {
        console.error(err);
        toast("Cancel failed. Please retry.", "error");
        cancelBtn.disabled = false;
      }
      return;
    }

    // Save button in conflicts / schedule tabs (outside #adminOrders)
    const saveBtn = e.target.closest("[data-admin-save]");
    if (saveBtn && !saveBtn.closest("#adminOrders")) {
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try {
        await saveOrder(saveBtn.dataset.adminSave);
      } catch (err) {
        console.error(err);
        toast("Update failed.", "error");
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = "Save";
      }
    }
  });

  // ── Auth gate ──────────────────────────────────────────────
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (debugUid)  debugUid.textContent  = user?.uid  || "—";
    if (debugRole) debugRole.textContent = user
      ? isAdmin(user.email) ? "Admin" : "User"
      : "—";

    if (!user) { goLogin("admin.html"); return; }
    if (!isAdmin(user.email)) {
      adminOrders.innerHTML =
        `<div class="order-card"><div class="order-title">Access denied</div></div>`;
      return;
    }

    adminOrders.innerHTML = renderSkeletonOrders(4);

    await loadStaffList();

    onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        allOrders = [];
        snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
        renderAll();
      },
      (err) => {
        console.error("Admin snapshot error:", err);
        toast("Failed to load orders.", "error");
      }
    );
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 23 — SCHEDULE PAGE
// ─────────────────────────────────────────────────────────────

function initSchedule() {
  const calGrid = document.getElementById("schedCalGrid");
  if (!calGrid) return;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let viewYear    = todayDate.getFullYear();
  let viewMonth   = todayDate.getMonth();
  let selectedISO = isoFromDate(todayDate);
  let allOrders   = [];
  let availCache  = {};

  const bookingsFor = (iso) =>
    allOrders.filter((o) => o.date === iso && o.status !== "Cancelled");

  const slotsFor = (iso) =>
    availCache[iso]
      ? { ...availCache[iso] }
      : Object.fromEntries(TIME_SLOTS.map((s) => [s, true]));

  async function loadMonthAvail() {
    const m = pad(viewMonth + 1);
    try {
      const q = query(
        collection(db, "availability"),
        where("__name__", ">=", `${viewYear}-${m}-01`),
        where("__name__", "<=", `${viewYear}-${m}-31`)
      );
      (await getDocs(q)).forEach((d) => {
        availCache[d.id] = d.data().slots || {};
      });
    } catch (err) {
      console.error("Availability load failed:", err);
    }
  }

  async function buildCal() {
    const monthLabel = document.getElementById("schedMonthLabel");
    if (monthLabel) monthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonthAvail();
    calGrid.innerHTML = "";

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

    const appendOther = (text) => {
      const cell = document.createElement("div");
      cell.className = "sched-cell sched-cell--other";
      cell.innerHTML = `<span class="sched-cell-num">${text}</span>`;
      calGrid.appendChild(cell);
    };

    for (let i = 0; i < firstDay; i++)
      appendOther(daysInPrev - firstDay + 1 + i);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      date.setHours(0, 0, 0, 0);
      const iso    = isoFromDate(date);
      const isPast = date < todayDate;

      const slots     = slotsFor(iso);
      const bks       = bookingsFor(iso);
      const bookedSet = new Set(bks.map((o) => o.timeSlot));
      const openCount = TIME_SLOTS.filter((s) => slots[s] !== false).length;
      const freeCount = TIME_SLOTS.filter(
        (s) => slots[s] !== false && !bookedSet.has(s)
      ).length;

      const cell = document.createElement("div");
      cell.className = [
        "sched-cell",
        isPast ? "sched-cell--past" : "",
        iso === isoFromDate(todayDate) ? "sched-cell--today" : "",
        iso === selectedISO ? "sched-cell--selected" : "",
        !isPast
          ? openCount === 0
            ? "sched-cell--all-closed"
            : freeCount === 0 || bks.length > 0
            ? "sched-cell--partial"
            : "sched-cell--all-open"
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      cell.setAttribute("tabindex", isPast ? "-1" : "0");
      cell.setAttribute("role", "button");
      cell.setAttribute(
        "aria-label",
        `${formatDate(iso, { weekday: "long", day: "numeric", month: "long" })}: ${bks.length} booking${bks.length !== 1 ? "s" : ""}`
      );

      const dots = TIME_SLOTS.map((s) => {
        const cls =
          slots[s] === false
            ? "sched-slot-dot--closed"
            : bookedSet.has(s)
            ? "sched-slot-dot--booked"
            : "";
        return `<span class="sched-slot-dot ${cls}" aria-hidden="true"></span>`;
      }).join("");

      cell.innerHTML = `
        <span class="sched-cell-num">${d}</span>
        ${bks.length ? `<span class="sched-cell-count">${bks.length}</span>` : ""}
        <div class="sched-cell-dots" aria-hidden="true">${dots}</div>`;

      if (!isPast) {
        const pick = () => selectDate(iso, date);
        cell.addEventListener("click", pick);
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
      }
      calGrid.appendChild(cell);
    }

    const remaining =
      (firstDay + daysInMonth) % 7 === 0
        ? 0
        : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= remaining; i++) appendOther(i);

    updateStats();
    buildWeek();
  }

  function selectDate(iso) {
    selectedISO = iso;
    buildCal();
    renderSlotEditor(iso);
    renderTimeline(iso);
  }

  function renderSlotEditor(iso) {
    const grid  = document.getElementById("schedSlotGrid");
    const title = document.getElementById("schedEditorTitle");
    if (!grid || !title) return;

    title.textContent = formatDate(iso, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    grid.innerHTML = "";

    const slots  = slotsFor(iso);
    const booked = new Set(bookingsFor(iso).map((o) => o.timeSlot));

    TIME_SLOTS.forEach((slot) => {
      const isBooked = booked.has(slot);
      const isOpen   = slots[slot] !== false;
      const count    = bookingsFor(iso).filter((o) => o.timeSlot === slot).length;

      const item = document.createElement("div");
      item.className = `sched-slot-item ${
        isBooked ? "slot-booked" : isOpen ? "slot-open" : "slot-closed"
      }`;
      item.setAttribute("role", isBooked ? "status" : "button");
      if (!isBooked) {
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-pressed", String(isOpen));
        item.setAttribute(
          "aria-label",
          `${slot}: ${isOpen ? "open, click to close" : "closed, click to open"}`
        );
      }

      item.innerHTML = `
        <div class="sched-slot-left">
          <div class="sched-slot-icon" aria-hidden="true">
            ${isBooked ? "●" : isOpen ? "○" : "✕"}
          </div>
          <span class="sched-slot-time">${slot}</span>
          ${isBooked
            ? `<span style="font-size:0.7rem;color:var(--text-3);margin-left:4px;">(${count})</span>`
            : ""}
        </div>
        <span class="sched-slot-status">
          ${isBooked ? `Booked (${count})` : isOpen ? "Open" : "Closed"}
        </span>`;

      if (!isBooked) {
        const toggle = () => {
          if (!availCache[iso]) availCache[iso] = slotsFor(iso);
          availCache[iso][slot] = !isOpen;
          renderSlotEditor(iso);
          buildCal();
        };
        item.style.cursor = "pointer";
        item.addEventListener("click", toggle);
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
      }
      grid.appendChild(item);
    });
  }

  function renderTimeline(iso) {
    const timeline = document.getElementById("schedTimeline");
    if (!timeline) return;

    const titleEl = document.getElementById("schedDayTitle");
    const isoEl   = document.getElementById("schedDayISO");
    const countEl = document.getElementById("schedDayCount");

    if (titleEl)
      titleEl.textContent =
        iso === isoFromDate(todayDate) ? "Today's Orders" : `Orders for ${formatDate(iso)}`;
    if (isoEl)
      isoEl.textContent = formatDate(iso, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });

    const bks = bookingsFor(iso);
    if (countEl)
      countEl.textContent = `${bks.length} order${bks.length !== 1 ? "s" : ""}`;

    if (!bks.length) {
      timeline.innerHTML =
        `<div class="sched-empty-day"><p>No orders for this date.</p></div>`;
      return;
    }

    const conflictIds = new Set(
      findConflicts(allOrders.filter((o) => o.date === iso))
        .flat()
        .map((o) => o.id)
    );

    const grouped = Object.fromEntries(TIME_SLOTS.map((s) => [s, []]));
    bks.forEach((o) => {
      (grouped[o.timeSlot] = grouped[o.timeSlot] || []).push(o);
    });

    timeline.innerHTML = "";
    Object.entries(grouped).forEach(([slot, orders]) => {
      if (!orders.length) return;

      const group = document.createElement("div");
      group.className = "sched-time-slot-group";

      const heading = document.createElement("div");
      heading.className   = "sched-time-heading";
      heading.textContent = slot;
      group.appendChild(heading);

      orders.forEach((o) => {
        const row     = document.createElement("div");
        row.className = `sched-order-row${conflictIds.has(o.id) ? " conflict-row" : ""}`;
        const initial = (o.customerName || "?").charAt(0).toUpperCase();
        const pickupTag = o.pickedUp
          ? `<span class="pickup-tag pickup-tag--done">Collected</span>`
          : o.status === "Awaiting Pickup"
          ? `<span class="pickup-tag pickup-tag--waiting">Ready for pickup</span>`
          : "";

        row.innerHTML = `
          <div class="sched-order-avatar" aria-hidden="true">${esc(initial)}</div>
          <div class="sched-order-info">
            <div class="sched-order-name">
              ${esc(o.customerName || "Customer")} ${pickupTag}
              ${conflictIds.has(o.id) ? `<span class="conflict-badge">Conflict</span>` : ""}
              ${o.assignedStaff
                ? `<span class="badge info" style="font-size:0.7rem;">
                     Staff: ${esc(o.assignedStaff)}
                   </span>`
                : ""}
            </div>
            <div class="sched-order-meta">
              ${esc(serviceLabel(o.service))} &bull; ${esc(o.location || "")}
            </div>
            ${o.deliveryMode && o.deliveryMode !== "pending"
              ? `<div class="sched-order-meta" style="color:var(--text-2);">
                   Handoff: ${esc(o.deliveryMode)}
                 </div>`
              : ""}
          </div>
          <div class="sched-order-status">
            <span class="${badgeClass(o.status)}"
                  style="font-size:0.72rem;padding:3px 8px;">
              ${esc(o.status)}
            </span>
          </div>`;

        group.appendChild(row);
      });
      timeline.appendChild(group);
    });
  }

  function buildWeek() {
    const weekGrid = document.getElementById("schedWeekGrid");
    if (!weekGrid) return;
    weekGrid.innerHTML = "";

    const counts = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() + i);
      return bookingsFor(isoFromDate(d)).length;
    });
    const max = Math.max(...counts, 1);

    counts.forEach((count, i) => {
      const d   = new Date(todayDate);
      d.setDate(todayDate.getDate() + i);
      const iso = isoFromDate(d);

      const cell = document.createElement("div");
      cell.className = [
        "sched-week-day",
        i === 0 ? "is-today" : "",
        iso === selectedISO ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute(
        "aria-label",
        `${DAYS_SHORT[d.getDay()]} ${d.getDate()}: ${count} orders`
      );

      const barPct = Math.max(Math.round((count / max) * 100), 8);
      cell.innerHTML = `
        <div class="sched-week-name" aria-hidden="true">${DAYS_SHORT[d.getDay()]}</div>
        <div class="sched-week-num"  aria-hidden="true">${d.getDate()}</div>
        <div class="sched-week-bar-wrap" aria-hidden="true">
          <div class="sched-week-bar" style="height:${barPct}%"></div>
        </div>
        <div class="sched-week-orders">
          ${count}
          <span style="font-size:0.62rem;font-weight:500">
            order${count !== 1 ? "s" : ""}
          </span>
        </div>`;

      const pick = () => selectDate(iso);
      cell.addEventListener("click", pick);
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
      weekGrid.appendChild(cell);
    });
  }

  function updateStats() {
    const isoTod    = isoFromDate(todayDate);
    const todayBks  = bookingsFor(isoTod);
    const slots     = slotsFor(isoTod);
    const bookedNow = new Set(todayBks.map((o) => o.timeSlot));
    const openNow   = TIME_SLOTS.filter(
      (s) => slots[s] !== false && !bookedNow.has(s)
    ).length;

    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() + i);
      weekTotal += bookingsFor(isoFromDate(d)).length;
    }

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setText("schedTodayCount", todayBks.length);
    setText("schedWeekCount",  weekTotal);
    setText("schedOpenSlots",  openNow);
    setText("schedConflicts",  findConflicts(allOrders).length);
  }

  const setAllSchedSlots = (open) => {
    if (!selectedISO) return;
    if (!availCache[selectedISO]) availCache[selectedISO] = slotsFor(selectedISO);
    TIME_SLOTS.forEach((s) => { availCache[selectedISO][s] = open; });
    renderSlotEditor(selectedISO);
    buildCal();
  };

  document.getElementById("btnSchedOpenAll")?.addEventListener("click",  () => setAllSchedSlots(true));
  document.getElementById("btnSchedCloseAll")?.addEventListener("click", () => setAllSchedSlots(false));

  document.getElementById("btnSchedSave")?.addEventListener("click", async () => {
    if (!selectedISO) { toast("Select a date first."); return; }
    const saveBtn = document.getElementById("btnSchedSave");
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    try {
      await withRetry(() =>
        setDoc(doc(db, "availability", selectedISO), {
          slots:     availCache[selectedISO] || slotsFor(selectedISO),
          updatedAt: serverTimestamp(),
        })
      );
      toast(`Availability saved for ${formatDate(selectedISO)} ✅`, "success");
      buildCal();
    } catch (err) {
      console.error(err);
      toast("Save failed. Please retry.", "error");
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = "Save";
    }
  });

  // ── Reschedule modal ───────────────────────────────────────
  document.getElementById("btnSchedReschedule")?.addEventListener("click", () => {
    const bks = bookingsFor(selectedISO);
    if (!bks.length) { toast("No bookings on this date."); return; }

    document.getElementById("reschedModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "reschedModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "rModalHeading");
    modal.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);" +
      "backdrop-filter:blur(6px);display:flex;align-items:center;" +
      "justify-content:center;padding:20px;";

    const box = document.createElement("div");
    box.style.cssText =
      "background:#fff;border-radius:18px;padding:28px 26px;" +
      "width:min(480px,100%);box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:inherit;";

    box.innerHTML = `
      <h2 id="rModalHeading"
          style="margin:0 0 6px;font-size:1.25rem;color:#111f3d;">
        Reschedule booking
      </h2>
      <p style="margin:0 0 20px;font-size:0.88rem;color:#69758b;">
        Choose an order, then pick a new date and time.
      </p>

      <label for="rModalOrder"
             style="display:block;font-size:0.8rem;font-weight:700;
                    color:#44506a;margin-bottom:5px;text-transform:uppercase;">
        Order
      </label>
      <select id="rModalOrder"
              style="width:100%;min-height:44px;padding:9px 12px;
                     border:1px solid #c7d3e3;border-radius:10px;
                     margin-bottom:16px;font:inherit;">
        ${bks.map((o) =>
          `<option value="${esc(o.id)}">
             ${esc(o.customerName || "Customer")}
             — ${esc(o.timeSlot)}
             — ${esc(serviceLabel(o.service))}
           </option>`
        ).join("")}
      </select>

      <label for="rModalDate"
             style="display:block;font-size:0.8rem;font-weight:700;
                    color:#44506a;margin-bottom:5px;text-transform:uppercase;">
        New date
      </label>
      <input id="rModalDate" type="date"
             value="${selectedISO}" min="${todayISO()}"
             style="width:100%;min-height:44px;padding:9px 12px;
                    border:1px solid #c7d3e3;border-radius:10px;
                    margin-bottom:16px;font:inherit;"/>

      <label for="rModalTime"
             style="display:block;font-size:0.8rem;font-weight:700;
                    color:#44506a;margin-bottom:5px;text-transform:uppercase;">
        New time slot
      </label>
      <select id="rModalTime"
              style="width:100%;min-height:44px;padding:9px 12px;
                     border:1px solid #c7d3e3;border-radius:10px;
                     margin-bottom:22px;font:inherit;">
        ${TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join("")}
      </select>

      <div style="display:flex;gap:10px;">
        <button id="rModalCancel" type="button"
                style="flex:1;min-height:44px;border-radius:10px;
                       border:1px solid #c7d3e3;background:#f5f9ff;
                       color:#44506a;font:inherit;font-weight:700;cursor:pointer;">
          Cancel
        </button>
        <button id="rModalConfirm" type="button"
                style="flex:1;min-height:44px;border-radius:10px;border:none;
                       background:linear-gradient(180deg,#1f74ea,#006ce4);
                       color:#fff;font:inherit;font-weight:700;cursor:pointer;">
          Confirm reschedule
        </button>
      </div>
      <p id="rModalMsg"
         style="margin:10px 0 0;font-size:0.82rem;color:#c93c3c;min-height:18px;"
         role="alert"></p>`;

    modal.appendChild(box);
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.getElementById("rModalCancel").addEventListener("click", closeModal);
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onEsc);
      }
    });

    document.getElementById("rModalConfirm").addEventListener("click", async () => {
      const orderId    = document.getElementById("rModalOrder").value;
      const newDate    = document.getElementById("rModalDate").value.trim();
      const newTime    = document.getElementById("rModalTime").value;
      const msgEl      = document.getElementById("rModalMsg");
      const confirmBtn = document.getElementById("rModalConfirm");

      msgEl.textContent = "";

      if (!isValidDate(newDate)) {
        msgEl.textContent = "Please enter a valid date.";
        return;
      }
      if (newDate < todayISO()) {
        msgEl.textContent = "Cannot reschedule to a past date.";
        return;
      }

      const order = bks.find((o) => o.id === orderId);
      if (!order) { msgEl.textContent = "Order not found."; return; }

      confirmBtn.disabled = true; confirmBtn.textContent = "Checking…";
      try {
        const available = await withRetry(() =>
          slotAvailable(newDate, order.location, newTime)
        );
        if (!available) {
          msgEl.textContent = "That slot is already taken. Please choose another.";
          confirmBtn.disabled = false; confirmBtn.textContent = "Confirm reschedule";
          return;
        }
        await withRetry(() =>
          updateDoc(doc(db, "orders", orderId), {
            date:      newDate,
            timeSlot:  newTime,
            updatedAt: serverTimestamp(),
          })
        );
        toast(`Rescheduled to ${formatDate(newDate)} at ${newTime} ✅`, "success");
        closeModal();
        renderTimeline(selectedISO);
        buildCal();
      } catch (err) {
        console.error(err);
        msgEl.textContent = "Reschedule failed. Please try again.";
        confirmBtn.disabled = false; confirmBtn.textContent = "Confirm reschedule";
      }
    });
  });

  document.getElementById("schedPrev")?.addEventListener("click", async () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
    await buildCal();
  });
  document.getElementById("schedNext")?.addEventListener("click", async () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
    await buildCal();
  });
  document.getElementById("btnWeekRefresh")?.addEventListener("click", () => {
    buildCal(); toast("Refreshed ✅");
  });

  onAuthStateChanged(auth, (user) => {
    if (!user || !isAdmin(user.email)) {
      calGrid.innerHTML =
        `<div style="grid-column:1/-1;padding:24px;text-align:center;
                     color:var(--text-3);">
           Admin access required.
         </div>`;
      return;
    }
    onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        allOrders = [];
        snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
        buildCal();
        renderSlotEditor(selectedISO);
        renderTimeline(selectedISO);
      },
      (err) => {
        console.error("Schedule snapshot error:", err);
        toast("Failed to load schedule.", "error");
      }
    );
  });

  buildCal();
  renderTimeline(selectedISO);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 24 — HOME PAGE CAROUSEL
// ─────────────────────────────────────────────────────────────

function initCarousel() {
  const track    = document.querySelector(".carousel-track");
  const dotsWrap = document.querySelector(".carousel-dots");
  if (!track || !dotsWrap) return;

  const slides = [...track.children];
  let index    = 0;
  let autoTimer;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsWrap.children].forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-pressed", String(i === index));
      dot.setAttribute("aria-label", `Slide ${i + 1}${i === index ? " (current)" : ""}`);
    });
    track.parentElement?.setAttribute(
      "aria-label",
      `Slide ${index + 1} of ${slides.length}`
    );
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    render();
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(index + 1), 5000);
  }

  dotsWrap.innerHTML = slides
    .map(
      (_, i) =>
        `<button type="button" aria-label="Go to slide ${i + 1}"${
          i === 0 ? ' class="active"' : ""
        }></button>`
    )
    .join("");

  [...dotsWrap.children].forEach((dot, i) =>
    dot.addEventListener("click", () => goTo(i))
  );

  document.querySelector(".carousel-btn.prev")?.addEventListener("click", () => goTo(index - 1));
  document.querySelector(".carousel-btn.next")?.addEventListener("click", () => goTo(index + 1));

  track.parentElement?.addEventListener("mouseenter", () => clearInterval(autoTimer));
  track.parentElement?.addEventListener("mouseleave", resetAuto);

  let touchStartX = 0;
  track.addEventListener(
    "touchstart",
    (e) => { touchStartX = e.touches[0].clientX; },
    { passive: true }
  );
  track.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? index + 1 : index - 1);
  });

  render();
  resetAuto();
}


// ─────────────────────────────────────────────────────────────
//  SECTION 25 — BOOTSTRAP
// ─────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  await setupNav(user);
});

wireOverlay();
initLogin();
initRegister();
initBooking();
initTracking();
initCustomer();
initAdmin();
initSchedule();
initCarousel();