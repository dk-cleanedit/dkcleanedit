// ═══════════════════════════════════════════════════════════════
//  app.js — DKcleanedit Web Application
//  University of Leicester CO3202 Entrepreneurial Project 2025/26
// ═══════════════════════════════════════════════════════════════
//
//  REFERENCES (IEEE format)
//
//  [1] MDN Web Docs (n.d.) Location.href. Available at:
//      https://developer.mozilla.org/en-US/docs/Web/API/Location/href
//      [Accessed: 27 Apr. 2026].
//      Used in: goLogin() redirect helper (Section 3).
//
//  [2] Anthropic (2025) Claude AI Assistant. Available at:
//      https://www.anthropic.com [Accessed: 27 Apr. 2026].
//      Used as a development aid for debugging and code structure guidance.
//      All final implementation decisions remain the author's own.
//
//  [3] GreatStack (n.d.) "Build a Complete Booking System with JavaScript".
//      Available at: https://greatstack.dev [Accessed: 27 Apr. 2026].
//      The calendar grid day-cell rendering pattern and slot open/closed
//      toggle UI approach in buildCalendar() (Section 11) and
//      initSchedule() (Section 23) were informed by this reference.
//
//  [4] GeeksforGeeks (n.d.) "Build a Todo App using HTML CSS and JavaScript".
//      Available at: https://www.geeksforgeeks.org/html/web-development-projects/
//      [Accessed: 27 Apr. 2026].
//      The debounced search filter pattern in debounce() (Section 3) and
//      renderAll() (Section 22) was informed by this reference.
//
//  [5] GitHub (n.d.) "firebase-js-sdk — Firestore runTransaction example".
//      Available at: https://github.com/topics/web-development-project
//      [Accessed: 27 Apr. 2026].
//      The atomic double-booking sentinel pattern in initBooking() (Section 16)
//      using runTransaction() was informed by this reference.
//
//  [6] CodingNepal (n.d.) "Responsive Image Slider in HTML CSS & JavaScript".
//      Available at: https://www.codingnepalweb.com/best-30-javascript-projects-with-source-code/
//      [Accessed: 27 Apr. 2026].
//      The carousel auto-advance timer and touch-swipe detection in
//      initCarousel() (Section 24) were informed by this reference.
//
//  [7] ProjectWorlds (n.d.) "Order Tracking System with Source Code".
//      Available at: https://projectworlds.com/500-coding-projects-with-source-code/
//      [Accessed: 27 Apr. 2026].
//      The order status progress-bar and tracking page flow in renderProgress()
//      and initTracking() (Sections 7, 17) were informed by this reference.
//
//  [8] 100 JS Projects (n.d.) "Real-time Form Validation".
//      Available at: https://www.100jsprojects.com [Accessed: 27 Apr. 2026].
//      The inline field validation pattern in initRegister() and
//      initBooking() (Sections 15, 16) was informed by this reference.
//
//  [9] Bootdey (n.d.) "2-step verification form inside a card". Available at:
//      https://www.bootdey.com/snippets/view/2-step-verification-form-inside-a-card#css
//      [Accessed: 23 Apr. 2026].
//      The 2FA input auto-focus behaviour and step-switch UI in initLogin()
//      (Section 14) was adapted from this snippet.
//
//  [10] MDN Web Docs (n.d.) "Window.localStorage." Available at:
//       https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
//       [Accessed: 27 Apr. 2026].
//       Used in: initTheme() (Section 25b) — reading and writing the "theme"
//       key to localStorage so the user's dark/light preference persists
//       across page loads and browser sessions. The getItem/setItem pattern
//       follows the MDN localStorage usage guide directly.
//
//  [11] MDN Web Docs (n.d.) "Element.classList." Available at:
//       https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
//       [Accessed: 27 Apr. 2026].
//       Used in: initTheme() (Section 25b) — classList.add("dark-mode") and
//       classList.remove("dark-mode") on document.documentElement to apply
//       the dark theme class, consistent with the inline flash-prevention
//       script present in every page's <head>.
//
//  [12] MDN Web Docs (n.d.) "HTMLElement.hidden." Available at:
//       https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/hidden
//       [Accessed: 27 Apr. 2026].
//       Used in: setupNav() (Section 12) — el.hidden = !visible applied to
//       each nav link to show or hide it based on the user's role without
//       removing the element from the DOM, preserving correct tab order.
//
//  [13] DKcleanedit (2026) Loyalty Tier Specification — internal project
//       design document. University of Leicester CO3202 Entrepreneurial
//       Project 2025/26.
//       Carbon tier (0–99 pts): no discount.
//       Stone tier (100–499 pts): 10% discount on the base service price,
//         automatically applied at booking submission.
//       Pearl tier (500+ pts): free standard clean (base price waived),
//         automatically applied at booking submission.
//       Used in: getTierDiscount(), getTotalPriceStr(), initBooking()
//       (Section 16), renderOrderCard() (Section 7), and renderAdminCard()
//       (Section 8). customer.html's own tier-progress UI (badge, bar,
//       hint text) is owned entirely by customer.js's applyTierUI().
//
// ═══════════════════════════════════════════════════════════════


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
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  collection,
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
  runTransaction,
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

const ADMIN_EMAIL = "dkcleaneditnotts@gmail.com";

const STATUS = [
  "Booked", "Received", "Cleaning", "Drying & Finish",
  "Ready", "Awaiting Pickup", "Completed", "Cancelled",
];

const TRACKABLE_STATUS = [
  "Booked", "Received", "Cleaning", "Drying & Finish",
  "Ready", "Awaiting Pickup", "Completed",
];

const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

// Shows the customer's actual home-pickup address instead of the branch
// name, for any order booked as "homepickup" — otherwise falls back to
// the branch's display name. Use this anywhere an order's "location" is
// shown to a customer or to staff (order cards, schedule rows, emails).
function orderLocationLabel(order) {
  if (!order) return "";
  if (order.collectionOption === "homepickup" && order.pickupAddress) {
    return `Home pickup — ${order.pickupAddress}`;
  }
  return LOCATION_DATA[order.location]?.name || order.location || "";
}

const ROLES = {
  pickup:   "Shoe pickup",
  delivery: "Deliver a pair of shoes",
  cleaning: "Shoe cleaning",
  both:     "Pickup + cleaning",
  manager:  "Floor manager",
};

const LOCATIONS = { leicester: "Leicester", "canada-water": "Canada Water" };

// The pair-count picker on booking.html is a basket-style stepper (any
// whole number ≥ 1), not fixed 1/3/10 tiers — but DK's real price list
// only fixes three points per service. priceForQuantity() below straight-
// line interpolates/extrapolates between those anchor points for any
// other quantity, exactly mirroring booking.html's own PRICING <script>
// (PAIR_PRICE_ANCHORS there). Keep the two in sync if the price list
// changes — this copy is the authoritative one for the Firestore write.
/**
 * Loyalty tier name for a given points total. Mirrors customer.js's
 * TIERS breakpoints (Carbon 0-99, Stone 100-499, Pearl 500+) so the
 * site-wide nav points badge can show the same tier everywhere,
 * not just on the account page.
 */
function tierNameForPoints(pts) {
  const n = Number(pts) || 0;
  if (n >= 500) return "Pearl";
  if (n >= 100) return "Stone";
  return "Carbon";
}

const PAIR_PRICE_ANCHORS = {
  standard_clean: [[1, 25], [3, 60], [10, 200]],  // £20/pair flat after 3 pairs
  express:        [[1, 30], [3, 70]],   // 10+ pairs quoted separately
  next_day:       [[1, 35], [3, 85]],   // 10+ pairs quoted separately
};
const PAIR_QUOTE_AT = { standard_clean: null, express: 10, next_day: 10 };
const MAX_PAIRS = 30;

/** Numeric price for `qty` pairs of `service`, or null when a manual quote is needed. */
function priceForQuantity(service, qty) {
  const anchors = PAIR_PRICE_ANCHORS[service];
  if (!anchors || !qty || qty < 1) return null;
  const quoteAt = PAIR_QUOTE_AT[service];
  if (quoteAt && qty >= quoteAt) return null;

  for (const [q, p] of anchors) if (q === qty) return p;

  let [loQ, loP] = anchors[0];
  let [hiQ, hiP] = anchors[anchors.length - 1];
  for (let j = 0; j < anchors.length - 1; j++) {
    if (qty >= anchors[j][0]) { [loQ, loP] = anchors[j]; [hiQ, hiP] = anchors[j + 1]; }
  }
  const rate = (hiP - loP) / (hiQ - loQ);
  return Math.max(0, Math.round(loP + (qty - loQ) * rate));
}

const PICKUP_FEE     = 10; // Home pickup — flat per order, on top of service + add-ons.
const DEPOSIT_AMOUNT = 10; // Fixed deposit; remaining balance is due on collection.

// Single source of truth for add-on configuration, shared by UI and booking
// submission. Centralising this prevents the duplicate-state bug where the
// inline <script> in booking.html maintained its own separate config that
// could drift out of sync with app.js. — Ref [4] (GeeksforGeeks, debounce /
// single-source-of-truth pattern informed this design decision).
const ADDON_CONFIG = {
  coin_painting: { label: "Coin Painting", price: 15, summaryId: "summaryAddonCoin"  },
  ux:            { label: "UX Treatment",  price: 15, summaryId: "summaryAddonUX"    },
  odour_removal: { label: "Odour Removal", price: 5,  summaryId: "summaryAddonOdour" },
};

const storage = getStorage();
window._staffList = [];


// ─────────────────────────────────────────────────────────────
//  SECTION 2b — 2FA SESSION + ROLE HELPERS
//
//  2FA state is stored in sessionStorage so it clears on tab close.
//  PAGE_ROLES maps each protected page to the roles that may access it.
//  These replace the separate auth-guard.js module — everything lives
//  in app.js so there is only one file to maintain.
// ─────────────────────────────────────────────────────────────

const PAGE_ROLES = {
  "admin.html":         ["admin"],
  "schedule.html":      ["admin"],
  "analytics.html":     ["admin"],
  "admin_account.html": ["admin"],
  "customer.html":      ["customer", "admin"],
  "booking.html":       ["customer", "admin"],
  "track.html":         ["customer", "admin"],
  "settings.html":      ["customer", "admin"],
};

// check the user has finished 2fa
function has2FA() {
  return sessionStorage.getItem("dk_2fa") === "1";
}

function mark2FAPassed() {
  sessionStorage.setItem("dk_2fa", "1");
}

function clear2FA() {
  sessionStorage.removeItem("dk_2fa");
}

// derive role from the signed-in user
function roleFor(user) {
  if (!user) return null;
  if (isAdmin(user.email)) return "admin";
  if (isStaff(user.email)) return "staff";
  return "customer";
}

// Require auth + 2FA on a protected page.
// Resolves with { user, role, userData } or redirects away.
function requireAuth(page) {
  page = page || location.pathname.split("/").pop() || "index.html";
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        goLogin(page);
        return;
      }
      // check the user has finished 2fa
      if (!has2FA()) {
        clear2FA();
        goLogin(page);
        return;
      }
      const role    = roleFor(user);
      const allowed = PAGE_ROLES[page];
      if (allowed && !allowed.includes(role)) {
        location.replace(role === "admin" ? "admin.html" : "customer.html");
        return;
      }
      let userData = {};
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) userData = snap.data();
      } catch { /* non-critical */ }
      resolve({ user, role, userData });
    });
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 3 — UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(val) {
  return String(val ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

/**
 * Only allow http(s) URLs through to href/src attributes. Firestore data
 * (e.g. uploaded photo URLs) is treated as untrusted — without this, a
 * tampered "imageUrl" field containing a javascript: URI could run script
 * when a staff member clicks the "view upload" link.
 */
function safeUrl(val) {
  const s = String(val ?? "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

function pad(n) { return String(n).padStart(2, "0"); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidDate(val) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val ?? ""))) return false;
  return !isNaN(new Date(val + "T00:00:00").getTime());
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
    (s) => String(s.email || "").trim().toLowerCase() === email.trim().toLowerCase()
  );
}

function serviceLabel(val) {
  return ({
    standard_clean: "Standard Cleaning",
    express:        "Express Service",
    next_day:       "Next Day",
  })[val] ?? val ?? "";
}

function badgeClass(status) {
  if (status === "Completed")                               return "badge success";
  if (status === "Cancelled")                               return "badge danger";
  if (status === "Ready" || status === "Awaiting Pickup")   return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function setMsg(text, id = "msg") {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

// Debounce pattern informed by Ref [4] (GeeksforGeeks — used for the
// admin search field in renderAll() to avoid excessive re-renders).
function debounce(fn, wait = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

function formatDate(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!iso || !isValidDate(iso)) return iso ?? "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts);
}

async function withRetry(fn, attempts = 3, baseDelay = 400) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}

// Redirect helper — uses Location.href per Ref [1] (MDN Web Docs).
function goLogin(next = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 3b — PRICING / ADD-ON HELPERS
//
//  booking.html's own inline "PRICING" <script> is the single owner of
//  the booking page's live UI wiring: it reads pairCount/serviceCard/
//  collectionOption/paymentOption/addon checkboxes, toggles the .active
//  card classes, and writes the un-discounted price into
//  #selectedPriceText, #barPriceText, #summaryDueNow, #amountDueNow etc.
//  every time recalc() runs. It then fires a "dk:price-recalculated"
//  DOM event so app.js can react.
//
//  app.js does NOT re-wire those same inputs (that was the old
//  duplicate-state bug — two listeners fighting over the same DOM,
//  one of them using stale flat pricing). Instead app.js listens for
//  "dk:price-recalculated" and layers the loyalty-tier discount on top
//  of whatever booking.html's script just computed — see
//  applyTierDiscountedPricing() in SECTION 16. The functions below are
//  the shared, pairs-aware pricing math used both for that overlay and
//  for the authoritative numbers written to Firestore at submit time.
// ─────────────────────────────────────────────────────────────

/** Numeric total of currently checked add-ons. */
function getAddonsTotal() {
  let total = 0;
  document.querySelectorAll('.addon-opt input[type="checkbox"]').forEach((cb) => {
    if (cb.checked && ADDON_CONFIG[cb.value]) total += ADDON_CONFIG[cb.value].price;
  });
  return total;
}

/** Array of selected add-on objects saved to Firestore. */
function getSelectedAddons() {
  const out = [];
  document.querySelectorAll('.addon-opt input[type="checkbox"]').forEach((cb) => {
    if (cb.checked && ADDON_CONFIG[cb.value]) {
      out.push({
        key:   cb.value,
        label: ADDON_CONFIG[cb.value].label,
        price: ADDON_CONFIG[cb.value].price,
      });
    }
  });
  return out;
}

/** How many pairs are currently selected (1 | 3 | 10). */
function currentPairCount() {
  const n = Math.floor(Number($("#pairCount")?.value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAIRS);
}

/** "dropoff" | "homepickup" — general collection method. */
function currentCollectionOption() {
  return $("#collectionOption")?.value === "homepickup" ? "homepickup" : "dropoff";
}

/** "full" | "deposit" — payment method chosen for this booking. */
function currentPaymentOption() {
  return $("#paymentOption")?.value === "deposit" ? "deposit" : "full";
}

/**
 * Numeric base price for the selected pair count + service, or null when
 * that combination has no fixed price and must be quoted (mirrors
 * booking.html's priceForQuantity()/#quoteRequired exactly).
 */
function getBasePrice() {
  const svc = $("#service")?.value;
  return priceForQuantity(svc, currentPairCount());
}

/** True when the current pair/service combination needs a manual quote. */
function priceNeedsQuote() {
  return getBasePrice() === null;
}

/**
 * Returns the discount multiplier and label for a given tier.
 * Stone = 10% off, Pearl = 100% off (free clean on base price only).
 * Carbon = no discount.
 *
 * Ref [13] DKcleanedit loyalty tier specification (project design doc):
 *   Stone tier (100–499 pts) — 10% discount applied to base service price.
 *   Pearl tier (500+ pts)    — free standard clean (base price = £0).
 *   Carbon tier (0–99 pts)   — no discount.
 */
function getTierDiscount(tier) {
  if (tier === "Pearl") return { pct: 100, label: "Pearl tier — free clean!" };
  if (tier === "Stone") return { pct: 10,  label: "Stone tier — 10% off" };
  return { pct: 0, label: "" };
}

/**
 * Full numeric total including add-ons, home-pickup fee and tier
 * discount, or null when the combination needs a manual quote.
 */
function getTotalPriceNumeric(tierDiscount = 0) {
  const base = getBasePrice();
  if (base === null) return null;
  const addons   = getAddonsTotal();
  const pickup   = currentCollectionOption() === "homepickup" ? PICKUP_FEE : 0;
  const discount = Math.round(base * (tierDiscount / 100));
  return Math.max(0, base - discount + addons + pickup);
}

/** Full price string, e.g. "£36" or "Enquire" when a quote is needed. */
function getTotalPriceStr(tierDiscount = 0) {
  const total = getTotalPriceNumeric(tierDiscount);
  return total === null ? "Enquire" : "£" + total;
}

/**
 * Amount actually due right now, honouring the deposit/full choice and
 * the tier discount. Null when a quote is required (nothing is charged
 * until DKcleanedit follows up with a price).
 */
function getAmountDueNowNumeric(tierDiscount = 0) {
  const total = getTotalPriceNumeric(tierDiscount);
  if (total === null) return null;
  return currentPaymentOption() === "deposit" ? Math.min(DEPOSIT_AMOUNT, total) : total;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 4 — TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

const _toastQueue  = [];
let   _toastRunning = false;

function toast(text, type = "default") {
  _toastQueue.push({ text, type });
  if (!_toastRunning) _drainToasts();
}

function _drainToasts() {
  if (!_toastQueue.length) { _toastRunning = false; return; }
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
    setTimeout(() => { t.remove(); _drainToasts(); }, 220);
  }, 2400);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 5 — EMAIL FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Send booking confirmation email.
 * Now accepts and includes addons in the email payload so customers
 * see a full breakdown of what they booked.
 */
function sendBookingEmail({
  customerName, customerEmail, orderId, service,
  location, bookingDate, bookingTime, price, shoeNotes, addons,
  pairCount, collectionMethod, pickupAddress, paymentMethod, amountDueNow,
}) {
  if (!window.emailjs) return;
  const addonText = addons?.length
    ? addons.map((a) => `${a.label} (+£${a.price})`).join(", ")
    : "None";
  window.emailjs.send(EMAILJS_SERVICE, "template_qca25sq", {
    customer_name:  customerName  || "Customer",
    customer_email: customerEmail || "",
    order_id:       orderId       || "",
    service:        service       || "",
    location:       location      || "",
    booking_date:   bookingDate   || "",
    booking_time:   bookingTime   || "",
    price:          price         || "",
    shoe_notes:     shoeNotes     || "",
    addons:         addonText,
    // New merge fields — add matching placeholders to the EmailJS
    // template (template_qca25sq) if you want these to show up in the
    // confirmation email; harmless if the template ignores them.
    pair_count:       pairCount || 1,
    collection_method: collectionMethod || "Drop off at branch",
    pickup_address:    pickupAddress    || "",
    payment_method:    paymentMethod    || "",
    amount_due_now:    amountDueNow     || "",
  }).catch((err) => console.warn("Booking email failed:", err));
}

async function sendCleaningCompleteEmail({
  recipientEmail, recipientName, locationName, cleaningSummary, completedAt,
}) {
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  if (!recipientEmail) throw new Error("No recipient email");
  return window.emailjs.send(EMAILJS_SERVICE, "template_cleaning_done", {
    to_email:         recipientEmail,
    recipient_name:   recipientName  || "Customer",
    location_name:    locationName   || "DKcleanedit",
    cleaning_summary: cleaningSummary || "Your shoes have been cleaned.",
    completed_date:   completedAt    || new Date().toLocaleDateString("en-GB"),
    sender_name:      "DKcleanedit",
  });
}

async function sendMissedEmail({
  customerName, customerEmail, orderId, bookingDate, bookingTime, location,
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

async function sendPickupSummaryEmail({
  recipientEmail, recipientName, orderId, locationName, cleaningSummary, pickupDate, pickupTime,
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

async function sendHomeCollectionEmail({
  customerEmail, customerName, orderId, pickupAddress, bookingDate, bookingTime, service, pairCount,
}) {
  if (!window.emailjs) return;
  if (!customerEmail) return;
  return window.emailjs.send(EMAILJS_SERVICE, "template_home_collection", {
    to_email:       customerEmail,
    customer_name:  customerName  || "Customer",
    order_id:       orderId       || "",
    pickup_address: pickupAddress || "",
    booking_date:   bookingDate   || "",
    booking_time:   bookingTime   || "",
    service:        service       || "",
    pair_count:     pairCount     || 1,
  }).catch((err) => console.warn("Home collection email failed:", err));
}

async function sendRescheduleEmail({
  customerEmail, customerName, orderId, bookingDate, bookingTime, service, location,
}) {
  if (!window.emailjs) return;
  if (!customerEmail) return;
  return window.emailjs.send(EMAILJS_SERVICE, "template_reschedule_confirmed", {
    to_email:      customerEmail,
    customer_name: customerName || "Customer",
    order_id:      orderId      || "",
    booking_date:  bookingDate  || "",
    booking_time:  bookingTime  || "",
    service:       service      || "",
    location:      location     || "",
  }).catch((err) => console.warn("Reschedule email failed:", err));
}

async function sendCancellationEmail({
  customerEmail, customerName, orderId, bookingDate, bookingTime, location,
}) {
  if (!window.emailjs) return;
  if (!customerEmail) return;
  return window.emailjs.send(EMAILJS_SERVICE, "template_booking_cancelled", {
    to_email:      customerEmail,
    customer_name: customerName || "Customer",
    order_id:      orderId      || "",
    booking_date:  bookingDate  || "",
    booking_time:  bookingTime  || "",
    location:      location     || "",
  }).catch((err) => console.warn("Cancellation email failed:", err));
}

async function sendWelcomeEmail({ customerEmail, customerName }) {
  if (!window.emailjs) return;
  if (!customerEmail) return;
  return window.emailjs.send(EMAILJS_SERVICE, "template_welcome", {
    to_email:      customerEmail,
    customer_name: customerName || "there",
  }).catch((err) => console.warn("Welcome email failed:", err));
}

async function sendTierUpgradeEmail({ recipientEmail, recipientName, newTier, totalPoints }) {
  if (!window.emailjs) return;
  if (!recipientEmail) return;
  return window.emailjs.send(EMAILJS_SERVICE, "template_tier_upgrade", {
    to_email:       recipientEmail,
    customer_name:  recipientName || "Customer",
    new_tier:       newTier       || "",
    total_points:   totalPoints ?? 0,
  }).catch((err) => console.warn("Tier upgrade email failed:", err));
}


// ─────────────────────────────────────────────────────────────
//  SECTION 6 — AVAILABILITY
// ─────────────────────────────────────────────────────────────

async function getOpenSlots(dateISO, locationKey) {
  const [availSnap, bookingSnap] = await Promise.all([
    getDoc(doc(db, "availability", dateISO)).catch(() => null),
    getDocs(
      query(
        collection(db, "orders"),
        where("date", "==", dateISO),
        where("location", "==", locationKey)
      )
    ).catch(() => null),
  ]);
  const slots = availSnap?.exists() ? availSnap.data().slots ?? {} : {};
  const taken = new Set();
  bookingSnap?.forEach((d) => {
    const data = d.data();
    if (data.status !== "Cancelled" && data.timeSlot) taken.add(data.timeSlot);
  });
  return TIME_SLOTS.filter((s) => slots[s] !== false && !taken.has(s));
}

async function slotAvailable(dateISO, locationKey, timeSlot) {
  return (await getOpenSlots(dateISO, locationKey)).includes(timeSlot);
}

function watchOpenSlots(dateISO, locationKey, onChange) {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("date", "==", dateISO),
      where("location", "==", locationKey)
    ),
    async () => {
      try { onChange(await getOpenSlots(dateISO, locationKey)); }
      catch (err) { console.error("watchOpenSlots error:", err); }
    },
    (err) => console.error("watchOpenSlots snapshot error:", err)
  );
}


// ─────────────────────────────────────────────────────────────
//  SECTION 7 — ORDER CARD RENDERING (customer)
//
//  Progress-bar and tracking page flow informed by Ref [7]
//  (ProjectWorlds — Order Tracking System).
// ─────────────────────────────────────────────────────────────

function progressPercent(status) {
  if (status === "Cancelled") return 0;
  return Math.round(
    (Math.max(0, TRACKABLE_STATUS.indexOf(status)) / (TRACKABLE_STATUS.length - 1)) * 100
  );
}

function renderProgress(status) {
  const activeIndex = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  const steps = TRACKABLE_STATUS.map((stage, i) => {
    const cls = status === "Cancelled" ? "cancelled" : i <= activeIndex ? "active" : "";
    return `<div class="step ${cls}" aria-label="${esc(stage)}: ${cls || "pending"}">
              <span class="circle"></span>
              <span class="label">${esc(stage)}</span>
            </div>`;
  }).join("");
  return `<div class="order-tracker" role="list" aria-label="Order progress">${steps}</div>`;
}

function renderPickupBanner(order) {
  if (order.status === "Awaiting Pickup")
    return `<div class="pickup-notice" role="alert">
              <strong>Your shoes are ready!</strong>
              Please collect them from ${esc(order.location || "the branch")}.
            </div>`;
  if (order.pickedUp) return `<div class="pickup-collected">✅ Shoes collected</div>`;
  return "";
}

function renderOrderCard(order) {
  const pct    = progressPercent(order.status || "Booked");
  const status = order.status || "Booked";
  const apptMs = new Date(`${order.date}T${order.timeSlot || "00:00"}:00`).getTime();
  const withinWindow = apptMs - Date.now() < 24 * 60 * 60 * 1000;
  const canEdit = ["Booked", "Received"].includes(status) && !withinWindow;

  const cancelledBanner = status === "Cancelled"
    ? `<div class="cancelled-notice" role="alert"
           style="margin:10px 0;padding:10px 14px;border-radius:8px;background:#fef2f2;
                  border:1px solid #fecaca;color:#b91c1c;font-size:0.88rem;">
         ✕ This booking was cancelled.${
           order.cancelledAt
             ? ` Cancelled on ${new Date(order.cancelledAt).toLocaleDateString("en-GB")}.`
             : ""
         }
       </div>` : "";

  const windowNotice = !["Cancelled", "Completed"].includes(status) && withinWindow
    ? `<div class="sub" style="margin-top:8px;color:#92400e;font-size:0.82rem;">
         ⚠ Changes are no longer possible within 24 hours of your appointment.
       </div>` : "";

  // Add-ons shown on the customer order card so customers can verify their extras.
  const addonsHtml = order.addons?.length
    ? `<div class="sub" style="margin-top:4px;">
         Add-ons: ${order.addons.map((a) => esc(a.label)).join(", ")}
       </div>` : "";

  // Tier discount badge — shown when a discount was applied — Ref [13] (tier spec).
  const discountHtml = order.discountApplied && order.discountPct > 0
    ? `<div class="sub" style="margin-top:4px;color:var(--gold,#c69a17);font-weight:600;">
         🏅 ${esc(order.tierApplied)} discount applied (${order.discountPct}% off — saved £${order.discountSaving || 0})
       </div>` : "";

  return `<article class="order-card" data-id="${esc(order.id)}" aria-label="Order ${esc(order.id)}">
    <div class="order-top">
      <div>
        <div class="order-title">${esc(serviceLabel(order.service))} &bull; ${esc(orderLocationLabel(order))}</div>
        <div class="sub">${esc(formatDate(order.date))} &bull; ${esc(order.timeSlot)} &bull; ${esc(order.price || "")}</div>
        ${addonsHtml}
        ${discountHtml}
      </div>
      <span class="${badgeClass(status)}">${esc(status)}</span>
    </div>
    ${cancelledBanner}
    ${renderProgress(status)}
    ${renderPickupBanner(order)}
    ${windowNotice}
    <div class="order-meta">
      <span class="sub">Order ID: <code>${esc(order.id)}</code></span>
      <span class="sub" aria-label="${pct}% complete">${pct}%</span>
    </div>
    ${canEdit ? `<div class="order-actions">
      <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
      <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
    </div>` : ""}
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
    if (Array.isArray(v)) v.forEach((u) => { if (typeof u === "string" && u.trim()) urls.push(u.trim()); });
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

  // Add-ons shown in admin card with price breakdown for staff awareness.
  const addonsHtml = order.addons?.length
    ? `<div class="sub">Add-ons: ${order.addons.map((a) => `${esc(a.label)} (+£${a.price})`).join(", ")}</div>`
    : "";

  // Tier discount shown in admin card — Ref [13] (DKcleanedit tier spec).
  const discountHtml = order.discountApplied && order.discountPct > 0
    ? `<div class="sub" style="color:var(--gold,#c69a17);">
         🏅 ${esc(order.tierApplied)} discount: ${order.discountPct}% off base (saved £${order.discountSaving || 0})
       </div>` : "";

  const imageBlock = imageUrls.length
    ? `<div class="admin-images" style="margin-top:12px;">
         <div class="sub" style="margin-bottom:8px;">Customer Uploads (${imageUrls.length})</div>
         <div style="display:flex;gap:10px;flex-wrap:wrap;">
           ${imageUrls.map((url, i) =>
             `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" aria-label="View upload ${i + 1}">
                <img src="${esc(safeUrl(url))}" alt="Upload ${i + 1}"
                     style="width:88px;height:88px;object-fit:cover;border-radius:10px;border:1px solid var(--line);"
                     loading="lazy"/>
              </a>`
           ).join("")}
         </div>
       </div>` : "";

  const staffOptions = (window._staffList || []).map((s) =>
    `<option value="${esc(s.name)}" ${order.assignedStaff === s.name ? "selected" : ""}>
       ${esc(s.name)} (${esc(LOCATIONS[s.location] || s.location || "")})
     </option>`
  ).join("");

  const dismissBtn = canEdit && status === "Cancelled"
    ? `<button class="dismiss-btn" type="button"
           data-dismiss-order="${esc(order.id)}"
           aria-label="Move to history" title="Move to history"
           style="position:absolute;top:10px;right:10px;width:28px;height:28px;
                  border-radius:50%;border:1px solid var(--line,#e2e8f0);
                  background:var(--bg,#fff);color:#94a3b8;font-size:17px;
                  line-height:1;cursor:pointer;display:flex;align-items:center;
                  justify-content:center;">×</button>` : "";

  return `<article class="order-card${conflict ? " conflict-card" : ""}"
              data-id="${esc(order.id)}" style="position:relative;">
    ${dismissBtn}
    <div class="order-top">
      <div>
        <div class="order-title">
          ${esc(order.customerName || "Customer")} &bull; ${esc(serviceLabel(order.service))}
          ${conflict ? `<span class="conflict-badge">Double-booked</span>` : ""}
        </div>
        <div class="sub">${esc(order.customerEmail || "")}${order.customerPhone ? ` &bull; ${esc(order.customerPhone)}` : ""}</div>
        <div class="sub">${esc(orderLocationLabel(order))}</div>
        <div class="sub">${esc(dateStr)} &bull; ${esc(order.timeSlot || "")} &bull; ${esc(order.price || "")}</div>
        ${addonsHtml}
        ${discountHtml}
        <div class="sub">Order ID: <code>${esc(order.id)}</code></div>
        <div class="sub">Collected: ${order.pickedUp ? "✅ Yes" : "No"}</div>
        ${order.assignedStaff ? `<div class="sub">Assigned: <strong>${esc(order.assignedStaff)}</strong></div>` : ""}
      </div>
      <span class="${badgeClass(status)}">${esc(status)}</span>
    </div>
    ${renderProgress(status)}
    ${imageBlock}
    ${canEdit ? `
    <div class="admin-row" style="margin-top:14px;">
      <div class="admin-field">
        <label class="sub" for="status-${esc(order.id)}">Status</label>
        <select id="status-${esc(order.id)}" class="admin-status" data-id="${esc(order.id)}">
          ${STATUS.map((s) => `<option value="${esc(s)}" ${status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
      </div>
      <div class="admin-field">
        <label class="sub" for="pts-${esc(order.id)}">Points to award</label>
        <input id="pts-${esc(order.id)}" class="admin-points" data-id="${esc(order.id)}"
               type="number" min="0" max="500" step="5"
               value="${esc(order.pointsAwarded ?? 10)}"/>
      </div>
      <div class="admin-field admin-field-btn">
        <button class="btn primary" type="button" data-admin-save="${esc(order.id)}">Save</button>
      </div>
    </div>
    <div class="admin-row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#e2e8f0);">
      <div class="admin-field">
        <label class="sub" for="mode-${esc(order.id)}">Handoff mode</label>
        <select id="mode-${esc(order.id)}" class="admin-delivery-mode" data-id="${esc(order.id)}">
          <option value="pending" ${(order.deliveryMode || "pending") === "pending" ? "selected" : ""}>Not decided yet</option>
          <option value="pickup"  ${order.deliveryMode === "pickup"  ? "selected" : ""}>Customer pickup</option>
          <option value="staff"   ${order.deliveryMode === "staff"   ? "selected" : ""}>Staff delivers</option>
          <option value="self"    ${order.deliveryMode === "self"    ? "selected" : ""}>I handle it personally</option>
        </select>
      </div>
      <div class="admin-field">
        <label class="sub" for="staff-${esc(order.id)}">Assign to staff member</label>
        <select id="staff-${esc(order.id)}" class="admin-staff-assign" data-id="${esc(order.id)}">
          <option value="">— unassigned —</option>${staffOptions}
        </select>
      </div>
    </div>
    <div class="order-meta" style="margin-top:10px;">
      <span class="sub">Points granted: ${order.pointsGranted ? `✅ ${order.grantedPointsAmount ?? 0} pts` : "Not yet"}</span>
      <span class="sub">Images: ${imageUrls.length}</span>
    </div>
    ${status === "Completed" ? `
    <div class="admin-row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#e2e8f0);">
      <div class="admin-field">
        <label class="sub" for="pu-date-${esc(order.id)}">Pickup date</label>
        <input id="pu-date-${esc(order.id)}" type="date"
               class="admin-pickup-date" data-id="${esc(order.id)}"
               min="${todayISO()}" value="${todayISO()}"/>
      </div>
      <div class="admin-field">
        <label class="sub" for="pu-time-${esc(order.id)}">Pickup time</label>
        <select id="pu-time-${esc(order.id)}" class="admin-pickup-time" data-id="${esc(order.id)}">
          ${["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"]
            .map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>
      <div class="admin-field admin-field-btn">
        <button class="btn secondary" type="button" data-send-pickup="${esc(order.id)}">
          Send pickup summary
        </button>
      </div>
    </div>` : ""}` : ""}
  </article>`;
}


// ─────────────────────────────────────────────────────────────
//  SECTION 8b — PICKUP BUTTON HANDLER
// ─────────────────────────────────────────────────────────────

async function handlePickupBtn(pickupBtn) {
  const orderId  = pickupBtn.dataset.sendPickup;
  const dateEl   = document.querySelector(`.admin-pickup-date[data-id="${orderId}"]`);
  const timeEl   = document.querySelector(`.admin-pickup-time[data-id="${orderId}"]`);
  const pickupDate = dateEl?.value;
  const pickupTime = timeEl?.value;
  if (!pickupDate || !isValidDate(pickupDate)) {
    toast("Please select a valid pickup date.", "error"); return;
  }
  pickupBtn.disabled = true; pickupBtn.textContent = "Sending…";
  try {
    const snap = await withRetry(() => getDoc(doc(db, "orders", orderId)));
    if (!snap.exists()) { toast("Order not found", "error"); return; }
    const order = snap.data();
    await sendPickupSummaryEmail({
      recipientEmail: order.customerEmail,
      recipientName:  order.customerName || "Customer",
      orderId,
      locationName:   order.location || "DKcleanedit",
      cleaningSummary: `${serviceLabel(order.service)} — your shoes are clean and ready.`,
      pickupDate: formatDate(pickupDate),
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
  if (!statusEl || !pointsEl) { toast("UI fields missing — please reload", "error"); return; }

  const newStatus       = statusEl.value;
  const newPoints       = Math.max(0, Math.min(500, Number(pointsEl.value || 0)));
  const newDeliveryMode = modeEl?.value || "pending";
  const newStaff        = (staffEl?.value || "").trim();

  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) { toast("Order not found", "error"); return; }

  const prev         = snap.data();
  const prevGranted  = Number(prev.grantedPointsAmount || 0);
  const newGranted   = newStatus === "Completed" ? newPoints : 0;
  const pointsDelta  = newGranted - prevGranted;

  // read the customer's current points before the batch so a tier-crossing
  // upgrade email can fire right after (increment() is write-only — it
  // doesn't hand back the resulting total, so we snapshot "before" here).
  let pointsBefore = null;
  let userEmailForTier = null, userNameForTier = null;
  if (prev.uid && pointsDelta > 0) {
    try {
      const userSnap = await withRetry(() => getDoc(doc(db, "users", prev.uid)));
      if (userSnap.exists()) {
        const u = userSnap.data();
        pointsBefore     = Number(u.points || 0);
        userEmailForTier = u.email || prev.customerEmail;
        userNameForTier  = u.name  || prev.customerName;
      }
    } catch (err) { console.warn("Tier check: couldn't read user points", err); }
  }

  const batch = writeBatch(db);
  if (prev.uid && pointsDelta !== 0) {
    batch.set(doc(db, "users", prev.uid), { points: increment(pointsDelta) }, { merge: true });
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

  if (pointsBefore !== null) {
    const pointsAfter = pointsBefore + pointsDelta;
    const tierBefore   = _settingsTierFor(pointsBefore);
    const tierAfter    = _settingsTierFor(pointsAfter);
    if (tierAfter !== tierBefore) {
      sendTierUpgradeEmail({
        recipientEmail: userEmailForTier,
        recipientName:  userNameForTier,
        newTier:        tierAfter,
        totalPoints:    pointsAfter,
      });
    }
  }

  if (newStatus === "Completed" && prev.status !== "Completed") {
    if (!prev.customerEmail) {
      toast("Order saved — no email sent (no email address).", "error");
    } else {
      try {
        await sendCleaningCompleteEmail({
          recipientEmail: prev.customerEmail,
          recipientName:  prev.customerName || "Customer",
          locationName:   prev.location || "DKcleanedit",
          cleaningSummary: `${serviceLabel(prev.service)} for order ${orderId} is complete.`,
          completedAt: new Date().toLocaleDateString("en-GB"),
        });
        toast("Completion email sent ✅", "success");
      } catch (err) {
        console.error("Customer email failed:", err);
        toast("Order saved — email failed. Check Console (F12).", "error");
      }
    }
  }
  toast("Order updated ✅", "success");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 10 — CANCEL & RESCHEDULE (customer)
// ─────────────────────────────────────────────────────────────

async function cancelOrder(orderId) {
  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) { toast("Order not found", "error"); return; }
  const data = snap.data();
  const { status, date, timeSlot } = data;
  if (!["Booked", "Received"].includes(status)) {
    toast("This order can no longer be cancelled."); return;
  }
  const apptMs = new Date(`${date}T${timeSlot || "00:00"}:00`).getTime();
  if (apptMs - Date.now() < 24 * 60 * 60 * 1000) {
    toast("Cancellations must be made more than 24 hours before your appointment.", "error"); return;
  }
  if (!confirm("Cancel this booking? This cannot be undone.")) return;
  await withRetry(() => updateDoc(ref, {
    status: "Cancelled", cancelledAt: Date.now(), updatedAt: serverTimestamp(),
  }));
  sendCancellationEmail({
    customerEmail: data.customerEmail,
    customerName:  data.customerName,
    orderId,
    bookingDate: date,
    bookingTime: timeSlot,
    location:    orderLocationLabel(data),
  });
  toast("Booking cancelled", "success");
}

async function rescheduleOrder(orderId) {
  const ref  = doc(db, "orders", orderId);
  const snap = await withRetry(() => getDoc(ref));
  if (!snap.exists()) { toast("Order not found", "error"); return; }
  const data = snap.data();
  if (!["Booked", "Received"].includes(data.status)) {
    toast("This order can no longer be rescheduled"); return;
  }
  const apptMs = new Date(`${data.date}T${data.timeSlot || "00:00"}:00`).getTime();
  if (apptMs - Date.now() < 24 * 60 * 60 * 1000) {
    toast("Reschedules must be made more than 24 hours before your appointment.", "error"); return;
  }
  openCustomerRescheduleModal(orderId, data);
}

// Customer-facing reschedule modal — replaces the old prompt()-based flow,
// which forced customers to type an exact "YYYY-MM-DD" / "HH:MM" string
// with no guidance and constantly failed validation. This reuses the same
// date input + time-slot dropdown pattern as the staff reschedule modal.
function openCustomerRescheduleModal(orderId, data) {
  document.getElementById("custReschedModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "custReschedModal";
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "crModalHeading");
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(10,17,32,.60);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;";
  const box = document.createElement("div");
  box.style.cssText = "background:#ffffff;border-radius:18px;padding:28px 26px;width:min(440px,100%);box-shadow:0 20px 60px rgba(10,17,32,.35);font-family:inherit;";
  box.innerHTML = `
    <h2 id="crModalHeading" style="margin:0 0 6px;font-size:1.2rem;color:#0a1120;">Reschedule your booking</h2>
    <p style="margin:0 0 20px;font-size:0.88rem;color:#5a6b85;">${esc(serviceLabel(data.service))} — currently ${esc(formatDate(data.date))} at ${esc(data.timeSlot || "")}.</p>
    <label for="crModalDate" style="display:block;font-size:0.78rem;font-weight:700;color:#3a4a63;margin-bottom:5px;text-transform:uppercase;letter-spacing:.03em;">New date</label>
    <input id="crModalDate" type="date" value="${esc(data.date || "")}" min="${todayISO()}" style="width:100%;min-height:46px;padding:9px 12px;border:1px solid #d8e0ea;border-radius:10px;margin-bottom:16px;font:inherit;"/>
    <label for="crModalTime" style="display:block;font-size:0.78rem;font-weight:700;color:#3a4a63;margin-bottom:5px;text-transform:uppercase;letter-spacing:.03em;">New time slot</label>
    <select id="crModalTime" style="width:100%;min-height:46px;padding:9px 12px;border:1px solid #d8e0ea;border-radius:10px;margin-bottom:22px;font:inherit;">
      ${TIME_SLOTS.map((s) => `<option value="${s}" ${s === data.timeSlot ? "selected" : ""}>${s}</option>`).join("")}
    </select>
    <div style="display:flex;gap:10px;">
      <button id="crModalCancel"  type="button" style="flex:1;min-height:46px;border-radius:10px;border:1px solid #d8e0ea;background:#f6f8fb;color:#3a4a63;font:inherit;font-weight:700;cursor:pointer;">Cancel</button>
      <button id="crModalConfirm" type="button" style="flex:1;min-height:46px;border-radius:10px;border:none;background:linear-gradient(135deg,#e8c97a,#c9a84c);color:#0a1120;font:inherit;font-weight:700;cursor:pointer;">Confirm</button>
    </div>
    <p id="crModalMsg" style="margin:10px 0 0;font-size:0.82rem;color:#c93c3c;min-height:18px;" role="alert"></p>`;
  modal.appendChild(box); document.body.appendChild(modal);
  const closeModal = () => modal.remove();
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.getElementById("crModalCancel").addEventListener("click", closeModal);
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", onEsc); }
  });
  document.getElementById("crModalConfirm").addEventListener("click", async () => {
    const newDate    = document.getElementById("crModalDate").value.trim();
    const newTime    = document.getElementById("crModalTime").value;
    const msgEl      = document.getElementById("crModalMsg");
    const confirmBtn = document.getElementById("crModalConfirm");
    msgEl.textContent = "";
    if (!isValidDate(newDate)) { msgEl.textContent = "Please choose a valid date."; return; }
    if (newDate < todayISO())  { msgEl.textContent = "Cannot reschedule to a past date."; return; }
    confirmBtn.disabled = true; confirmBtn.textContent = "Checking…";
    try {
      const available = await withRetry(() => slotAvailable(newDate, data.location, newTime));
      if (!available) {
        msgEl.textContent = "That slot is already taken. Please choose another.";
        confirmBtn.disabled = false; confirmBtn.textContent = "Confirm"; return;
      }
      await withRetry(() => updateDoc(doc(db, "orders", orderId), {
        date: newDate, timeSlot: newTime, rescheduledAt: Date.now(), updatedAt: serverTimestamp(),
      }));
      sendRescheduleEmail({
        customerEmail: data.customerEmail,
        customerName:  data.customerName,
        orderId,
        bookingDate: newDate,
        bookingTime: newTime,
        service:     serviceLabel(data.service),
        location:    orderLocationLabel(data),
      });
      toast(`Rescheduled to ${formatDate(newDate)} at ${newTime} ✅`, "success");
      closeModal();
    } catch (err) {
      console.error(err);
      msgEl.textContent = "Reschedule failed. Please try again.";
      confirmBtn.disabled = false; confirmBtn.textContent = "Confirm";
    }
  });
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
    } finally { btn.disabled = false; }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 11 — SHARED CALENDAR BUILDER
//
//  Calendar grid day-cell rendering pattern informed by
//  Ref [3] (GreatStack — Booking System with JavaScript).
// ─────────────────────────────────────────────────────────────

function buildCalendar({ container, year, month, today, selectedDate, onPick, getCellClass }) {
  container.innerHTML = "";
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const append = (cls, text, onClick, tabIndex = -1) => {
    const cell = document.createElement("div");
    cell.className = cls;
    cell.textContent = text;
    cell.setAttribute("role", "gridcell");
    if (tabIndex >= 0) cell.setAttribute("tabindex", tabIndex);
    if (onClick) {
      cell.addEventListener("click", onClick);
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      });
    }
    container.appendChild(cell);
    return cell;
  };

  for (let i = 0; i < firstDay; i++)
    append("cal-cell cal-cell--other", daysInPrev - firstDay + 1 + i);

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
    const cls = ["cal-cell",
      isPast     ? "cal-cell--past"     : "",
      isToday    ? "cal-cell--today"    : "",
      isSelected ? "cal-cell--selected" : "",
      extra,
    ].filter(Boolean).join(" ");

    const cell = append(cls, d, !isPast && onPick ? () => onPick(date, iso) : null, isPast ? -1 : 0);
    cell.setAttribute("aria-label",
      `${formatDate(iso, { weekday: "long", day: "numeric", month: "long" })}${isSelected ? ", selected" : ""}`
    );
    if (isSelected) cell.setAttribute("aria-pressed", "true");
  }

  const remaining = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
  for (let i = 1; i <= remaining; i++) append("cal-cell cal-cell--other", i);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 12 — NAV BAR
// ─────────────────────────────────────────────────────────────

async function setupNav(user) {
  // Ref [1] (MDN Web Docs, Location.href) — used in goLogin() called from nav redirect.
  // Ref [12] (MDN Web Docs, "Element.hidden." Available at:
  //   https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/hidden
  //   [Accessed: 27 Apr. 2026]. Used for: showing/hiding nav items per role.)
  const show = (id, visible) => { const el = $(id); if (el) el.hidden = !visible; };
  const role = user ? roleFor(user) : null;

  // Auth links — always show login/register when not signed in
  show("#navLogin",    !user);
  show("#navRegister", !user);
  show("#navLogout",   !!user);

  // Home, Booking, Tracking visible to everyone (logged-in and logged-out customers).
  // Admins see admin-only navigation instead — no booking/tracking/account links.
  // This fixes the bug where logged-out users could not see the Booking nav link.
  const isAdminRole = role === "admin";
  show("#navHome",     !isAdminRole);
  show("#navBooking",  !isAdminRole);
  show("#navTracking", !isAdminRole);

  // My Account only shown when signed in as customer
  show("#navAccount",  role === "customer");

  // Admin-only links
  show("#navAdmin",     isAdminRole);
  show("#navSchedule",  isAdminRole);
  show("#navAnalytics", isAdminRole);
  show("#navStaff",     isAdminRole);

  // Logout handler — clears 2FA session flag before signing out
  const navLogout = $("#navLogout");
  if (navLogout && !navLogout._wired) {
    navLogout._wired = true;
    navLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      clear2FA();
      await signOut(auth);
      toast("Logged out ✅");
      location.replace("login.html");
    });
  }

  // Points badge — customers only, reads from Firestore
  // Ref [12] (MDN, Element.hidden) used to show/hide badge per role.
  const badge = $("#navPointsBadge");
  if (badge && user && role === "customer") {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const pts  = snap.exists() ? Number(snap.data().points || 0) : 0;
      const tierName = tierNameForPoints(pts);
      badge.innerHTML = `<span class="np-dot" aria-hidden="true"></span><span class="np-tier">${esc(tierName)}</span><span class="np-sep" aria-hidden="true">&middot;</span><span class="np-pts">${esc(String(pts))} pts</span>`;
      badge.dataset.tier = tierName;
      badge.hidden = false;
      badge.setAttribute("aria-label", `${tierName} tier — ${pts} loyalty points`);
    } catch { badge.hidden = true; }
  } else if (badge) {
    badge.hidden = true;
  }
}

// Guard links marked data-requires-auth.
// Only admin pages need a fully authenticated + 2FA session before navigation.
// Booking and tracking are open to all — auth is checked when the user
// tries to submit, not when they navigate to the page.
// Ref [1] (MDN Web Docs, Location.href) used in goLogin().
document.addEventListener("click", (e) => {
  const link = e.target?.closest?.("a[data-requires-auth='true']");
  if (!link) return;
  const href = link.getAttribute("href") || "";

  // Only block navigation to admin-only pages
  const adminOnly = ["admin.html", "schedule.html", "analytics.html", "admin_account.html"];
  if (adminOnly.some((p) => href.includes(p)) && !(auth.currentUser && has2FA())) {
    e.preventDefault();
    goLogin(href);
    return;
  }

  // My Account and Settings — require being signed in but not 2FA check on nav
  const needsSignIn = ["customer.html", "settings.html"];
  if (needsSignIn.some((p) => href.includes(p)) && !auth.currentUser) {
    e.preventDefault();
    goLogin(href);
  }
}, true);


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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) hide(); });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 14 — LOGIN PAGE
//
//  2FA input auto-focus and step-switch UI adapted from
//  Ref [9] (Bootdey — 2-step verification form inside a card).
// ─────────────────────────────────────────────────────────────

function initLogin() {
  const btn = $("#btnLogin");
  if (!btn) return;

  // if already signed in and 2FA done, skip to dashboard
  const params = new URLSearchParams(location.search);
  const next   = params.get("next");
  onAuthStateChanged(auth, (user) => {
    if (user && has2FA()) location.replace(next || "customer.html");
  });

  const loginStep = document.getElementById("loginStep");
  const twoFAStep = document.getElementById("twoFactorStep");
  const emailHint = document.getElementById("twoFAEmailHint");
  const loginMsg  = document.getElementById("loginMsg");
  const twofaMsg  = document.getElementById("twofaMsg");
  const verifyBtn = document.getElementById("btnVerify2FA");
  const resendBtn = document.getElementById("resendCode");
  const otpInputs = [...document.querySelectorAll(".twofa-input")];
  let pendingUser = null, expectedCode = "";

  const AUTH_ERRORS = {
    "auth/invalid-credential":    "Incorrect email or password.",
    "auth/too-many-requests":     "Too many attempts — try again later.",
    "auth/user-disabled":         "This account has been disabled.",
    "auth/network-request-failed":"Network error — check your connection.",
  };

  function showLoginMsg(el, text, isErr = true) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isErr ? "var(--danger,#f08888)" : "var(--success,#3dc98a)";
  }

  const generateCode = () => String(Math.floor(1000 + Math.random() * 9000));

  // email-only 2FA — Ref [9] (Bootdey 2FA pattern)
  async function sendOTPEmail(email, code) {
    if (!window.emailjs) throw new Error("EmailJS not loaded");
    return window.emailjs.send("service_6ep5ahh", "template_2fa_code", { to_email: email, code });
  }

  const loginForm = document.getElementById("loginForm");
  const doLogin = async (e) => {
    e?.preventDefault();
    const email = $("#logEmail")?.value.trim();
    const pass  = $("#logPass")?.value;
    if (!email) { showLoginMsg(loginMsg, "Enter your email address."); return; }
    if (!pass)  { showLoginMsg(loginMsg, "Enter your password."); return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    showLoginMsg(loginMsg, "");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      pendingUser  = cred.user;
      expectedCode = generateCode();
      await sendOTPEmail(email, expectedCode);
      if (loginStep) loginStep.style.display = "none";
      if (twoFAStep) twoFAStep.hidden = false;
      if (emailHint) emailHint.textContent = email;
      otpInputs[0]?.focus();
    } catch (err) {
      showLoginMsg(loginMsg, AUTH_ERRORS[err?.code] ?? "Sign-in failed. Please try again.");
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  };

  loginForm?.addEventListener("submit", doLogin);
  btn.addEventListener("click", doLogin);
  $("#logPass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  // OTP digit auto-advance — Ref [9] (Bootdey 2FA pattern)
  otpInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.slice(-1).replace(/\D/, "");
      if (input.value && i < otpInputs.length - 1) otpInputs[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) otpInputs[i - 1].focus();
    });
  });

  verifyBtn?.addEventListener("click", () => {
    const code = otpInputs.map((i) => i.value).join("");
    if (code.length !== 4) { showLoginMsg(twofaMsg, "Enter the 4-digit code."); return; }
    if (code !== expectedCode) {
      showLoginMsg(twofaMsg, "Incorrect code — please try again.");
      otpInputs.forEach((i) => (i.value = ""));
      otpInputs[0]?.focus();
      return;
    }
    // mark 2FA complete in session
    mark2FAPassed();
    location.replace(next || "customer.html");
  });

  resendBtn?.addEventListener("click", async () => {
    if (!pendingUser) return;
    showLoginMsg(twofaMsg, "Sending…", false);
    try {
      expectedCode = generateCode();
      await sendOTPEmail(pendingUser.email, expectedCode);
      showLoginMsg(twofaMsg, "New code sent.", false);
    } catch {
      showLoginMsg(twofaMsg, "Could not resend — please try again.");
    }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 15 — REGISTER PAGE
//
//  Inline field validation pattern informed by
//  Ref [8] (100 JS Projects — Real-time Form Validation).
// ─────────────────────────────────────────────────────────────

function initRegister() {
  if (!$("#btnRegister")) return;

  const msgEl  = document.getElementById("registerMsg");
  const btn    = $("#btnRegister");

  function showErr(msg) {
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.style.color = "var(--danger,#f08888)";
  }

  const form = document.getElementById("registerForm");
  const doRegister = async (e) => {
    e?.preventDefault();
    if (msgEl) msgEl.textContent = "";

    const name        = $("#regName")?.value.trim();
    const email       = $("#regEmail")?.value.trim();
    const phone       = $("#regPhone")?.value.trim() || "";
    const pass        = $("#regPass")?.value ?? "";
    const passConfirm = $("#regPassConfirm")?.value ?? "";

    if (!name)           { showErr("Please enter your full name."); return; }
    if (!email)          { showErr("Please enter your email address."); return; }
    if (!pass)           { showErr("Please choose a password."); return; }
    // block weak passwords — Ref [8] (100 JS Projects, form validation)
    if (pass.length < 8) { showErr("Password must be at least 8 characters."); $("#regPass")?.focus(); return; }
    if (passConfirm && pass !== passConfirm) { showErr("Passwords do not match."); $("#regPassConfirm")?.focus(); return; }

    btn.disabled = true; btn.textContent = "Creating account…";
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await Promise.all([
        updateProfile(cred.user, { displayName: name }),
        setDoc(doc(db, "users", cred.user.uid), {
          name, email, phone, points: 0, tier: "Carbon", createdAt: serverTimestamp(),
        }),
      ]);
      sendWelcomeEmail({ customerEmail: email, customerName: name });
      // send to login so they complete 2FA before accessing the app
      location.replace("login.html?registered=1");
    } catch (err) {
      const msgs = {
        "auth/email-already-in-use":  "An account with this email already exists.",
        "auth/invalid-email":         "That email address isn't valid.",
        "auth/weak-password":         "Password must be at least 8 characters.",
        "auth/network-request-failed":"Network error — check your connection.",
      };
      showErr(msgs[err?.code] ?? err.message ?? "Registration failed.");
    } finally { btn.disabled = false; btn.textContent = "Create account"; }
  };

  form?.addEventListener("submit", doRegister);
  btn.addEventListener("click", doRegister);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 16 — BOOKING PAGE
//
//  Ownership split with booking.html's inline <script>s (avoids the old
//  duplicate-state race between the two):
//    - booking.html's "PRICING" script owns pairs/service/collection/
//      payment/add-on selection UI and the un-discounted price display,
//      and fires "dk:price-recalculated" after every recalc().
//    - booking.html's "OPENING HOURS + TIME SLOTS" script owns building
//      and click-wiring the .time-slot buttons for the selected date,
//      and fires "dk:timeslots-rendered" after every rebuild.
//    - app.js listens for both events: it layers the loyalty-tier
//      discount on top of the displayed price (applyTierDiscountedPricing,
//      SECTION 3b has the shared pairs-aware pricing math) and greys out
//      slots that are admin-closed or already booked (refreshSlots).
//    - app.js remains the sole owner of Firestore access: the calendar,
//      availability queries/watchers, and the atomic double-booking
//      transaction that actually creates the order.
//
//  Booking transaction saves pairCount, collectionOption/pickupAddress/
//  collectionMode, paymentOption/depositAmount/amountDueNow and
//  quoteRequired alongside the existing fields, and sendBookingEmail
//  forwards all of it so the confirmation email can show it too.
//
//  Atomic double-booking sentinel pattern — Ref [5]
//  (GitHub firebase-js-sdk runTransaction example).
//  Form validation — Ref [8] (100 JS Projects).
// ─────────────────────────────────────────────────────────────

function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook) return;

  wireOverlay();

  let _slotWatcherUnsub = null;
  // User's tier discount loaded once auth resolves — Ref [13] (tier discount spec).
  let _userTierDiscount = 0;
  let _userTierLabel    = "";
  let _userTier         = "Carbon";

  // Date/time labels only. #summaryService and #summaryLocation are NOT
  // touched here — booking.html's own recalc() owns those two (it needs
  // to show "Home pickup — see address below" instead of the branch name
  // once home pickup is chosen, which this function has no way to know).
  // Writing to them here as well used to let this function win a race
  // right after recalc() ran (via "dk:price-recalculated") and silently
  // stomp that home-pickup message back to the branch name.
  function updateSummary() {
    const time = $("#timeSlot")?.value || "";
    const date = document.getElementById("date")?.value || "";
    if ($("#summaryTime")) $("#summaryTime").textContent = time || "—";
    if ($("#summaryDate")) $("#summaryDate").textContent = date && isValidDate(date) ? formatDate(date) : "—";
  }

  /**
   * Layers the loyalty-tier discount on top of whatever booking.html's
   * own PRICING script just computed. Runs whenever that script
   * recalculates (service/pairs/collection/payment/add-on changes fire
   * "dk:price-recalculated" — see booking.html) and once tier data has
   * loaded via onAuthStateChanged below. Ref [13] (tier discount spec).
   *
   * When the current pair/service combination needs a manual quote, or
   * the customer has no discount, booking.html's own numbers are already
   * correct and this leaves them alone.
   */
  function applyTierDiscountedPricing() {
    const svc  = $("#service")?.value || "";
    const base = getBasePrice();

    const discountRow = document.getElementById("summaryDiscount");
    if (discountRow) {
      if (_userTierDiscount > 0 && svc && base !== null) {
        const saving = Math.round(base * (_userTierDiscount / 100));
        discountRow.textContent = `${_userTierLabel} (-£${saving})`;
        discountRow.hidden = false;
      } else {
        discountRow.hidden = true;
      }
    }

    if (_userTierDiscount <= 0 || base === null) return;

    const total      = getTotalPriceNumeric(_userTierDiscount);
    const dueNow     = getAmountDueNowNumeric(_userTierDiscount);
    const isDeposit  = currentPaymentOption() === "deposit";

    const priceEl   = document.getElementById("selectedPriceText");
    const barEl     = document.getElementById("barPriceText");
    const dueRow    = document.getElementById("summaryDueRow");
    const dueEl     = document.getElementById("summaryDueNow");
    const amountEl  = document.getElementById("amountDueNow");
    const fullBadge = document.getElementById("paymentFullBadge");

    if (priceEl)  priceEl.textContent  = "£" + total;
    if (barEl)    barEl.textContent    = "£" + total;
    if (amountEl) amountEl.value       = String(dueNow);
    if (fullBadge && !isDeposit) fullBadge.textContent = "£" + total;
    if (dueRow)   dueRow.hidden        = !isDeposit;
    if (dueEl)    dueEl.textContent    = "£" + dueNow;
  }

  async function refreshSlots(dateISO) {
    const loc  = $("#location")?.value || "";
    const btns = $$(".time-slot");
    if (!btns.length || !loc) return;
    btns.forEach((b) => { b.disabled = true; b.style.opacity = "0.5"; });
    try {
      const [availSnap, bookingSnap] = await Promise.all([
        getDoc(doc(db, "availability", dateISO)).catch(() => null),
        getDocs(
          query(collection(db, "orders"),
            where("date", "==", dateISO),
            where("location", "==", loc))
        ).catch(() => null),
      ]);
      const adminSlots  = availSnap?.exists() ? availSnap.data().slots ?? {} : {};
      const bookedTimes = new Set();
      bookingSnap?.forEach((d) => {
        const data = d.data();
        if (data.status !== "Cancelled" && data.timeSlot) bookedTimes.add(data.timeSlot);
      });
      btns.forEach((btn) => {
        const slotTime  = btn.dataset.time;
        const available = adminSlots[slotTime] !== false && !bookedTimes.has(slotTime);
        btn.disabled    = !available;
        btn.classList.remove("active", "slot-unavailable", "slot-booked", "slot-admin-closed");
        btn.style.opacity = btn.style.cursor = btn.style.textDecoration = "";
        btn.removeAttribute("aria-disabled");
        btn.querySelector(".slot-booked-label")?.remove();
        if (!available) {
          btn.style.opacity = "0.4"; btn.style.cursor = "not-allowed";
          btn.style.textDecoration = "line-through";
          btn.setAttribute("aria-disabled", "true");
          btn.classList.add("slot-unavailable");
          const label = document.createElement("span");
          label.className = "slot-booked-label"; label.setAttribute("aria-hidden", "true");
          if (bookedTimes.has(slotTime)) { btn.classList.add("slot-booked"); label.textContent = "Booked"; }
          else { btn.classList.add("slot-admin-closed"); label.textContent = "Unavailable"; }
          btn.appendChild(label);
          if (btn.classList.contains("active")) {
            btn.classList.remove("active");
            const hi = $("#timeSlot"); if (hi) hi.value = "";
            updateSummary();
            toast("Your selected time slot is no longer available.", "error");
          }
        }
      });
    } catch (err) {
      console.error("Slot refresh failed:", err);
      toast("Could not load slot availability. Please refresh.", "error");
      btns.forEach((b) => { b.disabled = false; b.style.opacity = ""; });
    }
  }

  function applyOpenSlots() {
    const dateISO = document.getElementById("date")?.value;
    const loc     = $("#location")?.value || "";
    if (dateISO && loc) refreshSlots(dateISO);
  }

  // booking.html's own "OPENING HOURS + TIME SLOTS" <script> owns building
  // and click-wiring the .time-slot buttons (it regenerates them from
  // scratch whenever #date changes, since opening hours vary by day). It
  // dispatches "dk:timeslots-rendered" right after doing so, which is our
  // cue to grey out/label whichever of those fresh buttons are already
  // booked or admin-closed. This replaces polling for #date changes,
  // which raced with that rebuild and could momentarily show a booked
  // slot as available again.
  document.addEventListener("dk:timeslots-rendered", (e) => {
    const dateISO = e?.detail?.date || document.getElementById("date")?.value;
    if (dateISO) refreshSlots(dateISO);
  });

  // booking.html's PRICING script owns the pairs/service/collection/
  // payment/add-on UI and dispatches this after every recalculation.
  document.addEventListener("dk:price-recalculated", () => {
    updateSummary();
    applyTierDiscountedPricing();
  });

  // Calendar — Ref [3] (GreatStack, calendar grid pattern).
  const calBody  = document.getElementById("calBody");
  const calLabel = document.getElementById("calMonthLabel");
  const calPrev  = document.getElementById("calPrev");
  const calNext  = document.getElementById("calNext");

  if (calBody && calPrev && calNext) {
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    let viewYear = todayDate.getFullYear(), viewMonth = todayDate.getMonth(), selectedDate = null;

    function buildCal() {
      if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
      buildCalendar({
        container: calBody, year: viewYear, month: viewMonth,
        today: todayDate, selectedDate,
        onPick: async (date, iso) => {
          selectedDate = date;
          const hiddenInput = document.getElementById("date");
          if (hiddenInput) {
            hiddenInput.value = iso;
            hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const label = document.getElementById("selectedDateLabel");
          if (label) label.textContent = date.toLocaleDateString("en-GB",
            { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          // Clear slotHint text when date is picked.
          const hint = document.getElementById("slotHint");
          if (hint) hint.textContent = "";
          buildCal(); updateSummary();
          // refreshSlots() runs via the "dk:timeslots-rendered" listener
          // above once booking.html finishes rebuilding the day's
          // .time-slot buttons for this new date — no need to call it
          // here too (that used to race the buttons' own rebuild).
          if (_slotWatcherUnsub) { _slotWatcherUnsub(); _slotWatcherUnsub = null; }
          const loc = $("#location")?.value || "";
          if (loc) _slotWatcherUnsub = watchOpenSlots(iso, loc, applyOpenSlots);
        },
      });
    }
    calPrev.addEventListener("click", () => {
      if (--viewMonth < 0) { viewMonth = 11; viewYear--; } buildCal();
    });
    calNext.addEventListener("click", () => {
      if (++viewMonth > 11) { viewMonth = 0; viewYear++; } buildCal();
    });
    buildCal();
  }

  // NOTE: service/pair-count cards are plain <label> elements wrapping
  // their radio inputs, so clicking one already checks the radio natively
  // and fires booking.html's own recalc() (which toggles .active and
  // aria-selected on [data-service-card]/[data-collection-card]/
  // [data-payment-card] and dispatches "dk:price-recalculated", handled
  // above). A second click handler here used to duplicate that wiring
  // with flat (non-pairs) pricing and could win the race against it.

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
    if (!file.type.startsWith("image/")) { toast("Please upload an image file.", "error"); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024)   { toast("Image must be under 10 MB.", "error");   e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if ($("#shoePreview"))     $("#shoePreview").src        = ev.target.result;
      if ($("#shoePreviewWrap")) $("#shoePreviewWrap").hidden = false;
    };
    reader.readAsDataURL(file);
  });

  // Photo remove button wired here, not in a separate inline module.
  document.getElementById("btnRemovePhoto")?.addEventListener("click", () => {
    const input = document.getElementById("shoeImages");
    const wrap  = document.getElementById("shoePreviewWrap");
    const img   = document.getElementById("shoePreview");
    if (input) input.value = "";
    if (img)   img.src     = "";
    if (wrap)  wrap.hidden = true;
  });

  $("#service")?.addEventListener("change", updateSummary);
  $("#location")?.addEventListener("change", () => {
    updateSummary(); updateMap();
    const d   = document.getElementById("date")?.value;
    const loc = $("#location")?.value || "";
    if (d && isValidDate(d)) {
      refreshSlots(d);
      if (_slotWatcherUnsub) { _slotWatcherUnsub(); _slotWatcherUnsub = null; }
      if (loc) _slotWatcherUnsub = watchOpenSlots(d, loc, applyOpenSlots);
    }
  });
  document.getElementById("date")?.addEventListener("change", updateSummary);

  updateSummary(); updateMap();

  onAuthStateChanged(auth, async (user) => {
    const nameInput = $("#customerName");
    if (!user) return;

    try {
      const snap     = await getDoc(doc(db, "users", user.uid));
      const userData = snap.exists() ? snap.data() : {};

      // Pre-fill name field if empty
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = userData.name || user.displayName || "";
      }

      // Load tier and calculate discount — Ref [13] (DKcleanedit loyalty tier spec).
      const pts      = Number(userData.points || 0);
      _userTier      = userData.tier || (pts >= 500 ? "Pearl" : pts >= 100 ? "Stone" : "Carbon");
      const disc     = getTierDiscount(_userTier);
      _userTierDiscount = disc.pct;
      _userTierLabel    = disc.label;

      // Show tier discount banner on the booking page — Ref [13].
      if (_userTierDiscount > 0) {
        let banner = document.getElementById("tierDiscountBanner");
        if (!banner) {
          banner = document.createElement("div");
          banner.id = "tierDiscountBanner";
          banner.setAttribute("role", "status");
          banner.style.cssText = [
            "margin-bottom:16px", "padding:12px 16px", "border-radius:12px",
            "background:var(--gold-bg,rgba(240,184,67,0.12))",
            "border:1px solid var(--gold-border,rgba(240,184,67,0.35))",
            "color:var(--gold,#c69a17)", "font-size:0.88rem", "font-weight:600",
            "display:flex", "align-items:center", "gap:10px",
          ].join(";");
          // Insert before the booking form's first field — Ref [13].
          const form = $("#btnBook")?.closest("form") || $("#btnBook")?.parentElement;
          if (form) form.insertBefore(banner, form.firstChild);
        }
        banner.innerHTML = `🏅 <span>${_userTierLabel} — your discount will be applied automatically.</span>`;
        applyTierDiscountedPricing(); // Refresh price display with discount.
      }
    } catch { /* non-critical */ }
  });

  btnBook.addEventListener("click", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      const ov = $("#signupOverlay"); if (ov) ov.hidden = false;
      toast("Please log in to book."); return;
    }

    const service   = $("#service")?.value;
    const loc       = $("#location")?.value;
    const date      = document.getElementById("date")?.value;
    const timeSlot  = $("#timeSlot")?.value;
    const shoeNotes = $("#shoeNotes")?.value.trim() || "";
    const images    = Array.from($("#shoeImages")?.files || []);

    // Collection / payment choices — owned by booking.html's own PRICING
    // and OPENING HOURS scripts; read straight from the DOM here so the
    // Firestore write always matches what the customer actually saw.
    const pairs            = currentPairCount();
    const collectionOption = currentCollectionOption();      // "dropoff" | "homepickup"
    const collectionMode   = $("#collectionMode")?.value === "courier" ? "courier" : "dropoff";
    const paymentOption    = currentPaymentOption();          // "full" | "deposit"
    const pickupAddress    = $("#pickupAddress")?.value.trim() || "";
    const isPickup         = collectionOption === "homepickup";
    const pickupFee        = isPickup ? PICKUP_FEE : 0;

    // Capture add-ons and total price at submission time.
    // Tier discount applied here — Ref [13] (DKcleanedit loyalty tier spec).
    const needsQuote       = priceNeedsQuote();
    const selectedAddons   = getSelectedAddons();
    const totalPriceNumeric = needsQuote ? null : getTotalPriceNumeric(_userTierDiscount);
    const totalPrice        = needsQuote ? "Enquire" : "£" + totalPriceNumeric;
    const basePrice         = getBasePrice(); // null when needsQuote
    const discountSaving    = (!needsQuote && _userTierDiscount > 0)
      ? Math.round(basePrice * (_userTierDiscount / 100)) : 0;
    const discountApplied   = !needsQuote && _userTierDiscount > 0;
    const amountDueNow      = needsQuote ? null : getAmountDueNowNumeric(_userTierDiscount);

    // Field validation — Ref [8] (100 JS Projects, form validation pattern).
    if (!service)  { setMsg("Please select a service.");  return; }
    if (!loc)      { setMsg("Please select a location."); return; }
    if (!date)     { setMsg("Please pick a date.");       return; }
    if (!timeSlot) { setMsg("Please pick a time slot.");  return; }
    if (date < todayISO()) { setMsg("Please select a future date."); return; }
    if (isPickup && !pickupAddress) { setMsg("Please enter your pickup address."); return; }

    btnBook.disabled = true;
    btnBook.textContent = needsQuote ? "Sending quote request…" : "Checking availability…";
    setMsg("");

    try {
      const userSnap      = await getDoc(doc(db, "users", user.uid));
      const userData      = userSnap.exists() ? userSnap.data() : {};
      const customerName  = $("#customerName")?.value.trim() || userData.name || user.displayName || "Customer";
      const customerEmail = userData.email || user.email || "";
      const customerPhone = userData.phone || "";
      let newOrderId;

      // Atomic double-booking check — Ref [5] (GitHub firebase-js-sdk
      // runTransaction example used for the sentinel pattern below).
      await runTransaction(db, async (transaction) => {
        const availRef  = doc(db, "availability", date);
        const availSnap = await transaction.get(availRef);
        const slotMap   = availSnap.exists() ? availSnap.data().slots ?? {} : {};
        if (slotMap[timeSlot] === false) throw new Error("SLOT_UNAVAILABLE");

        const slotSentinelRef = doc(db, "bookingSlots", `${date}_${loc}_${timeSlot.replace(":", "")}`);
        const sentinelSnap    = await transaction.get(slotSentinelRef);
        const currentCount    = sentinelSnap.exists() ? Number(sentinelSnap.data().count || 0) : 0;
        if (currentCount >= 1) throw new Error("SLOT_UNAVAILABLE");

        const orderRef = doc(collection(db, "orders"));
        newOrderId = orderRef.id;

        transaction.set(orderRef, {
          uid: user.uid, customerName, customerEmail, customerPhone,
          service, serviceLabel: serviceLabel(service), pairCount: pairs,
          location: loc, date, timeSlot,
          price:     totalPrice,       // Total after tier discount + add-ons, e.g. "£36", or "Enquire".
          basePrice: basePrice,        // null when quoteRequired is true.
          addons:    selectedAddons,   // [{key, label, price}, …]
          quoteRequired: needsQuote,
          // Collection method — Ref: home-pickup feature.
          collectionOption,                              // "dropoff" | "homepickup"
          pickupAddress: isPickup ? pickupAddress : "",
          pickupFee,
          collectionMode,                                 // "dropoff" | "courier" (same-day)
          // Payment choice — Ref: deposit/pay-in-full feature.
          paymentOption:  needsQuote ? "quote" : paymentOption,
          depositAmount:  (!needsQuote && paymentOption === "deposit") ? DEPOSIT_AMOUNT : 0,
          amountDueNow,                                   // null when quoteRequired is true.
          // Tier discount fields — Ref [13] (DKcleanedit loyalty tier spec).
          tierApplied:     _userTier,
          discountPct:     _userTierDiscount,
          discountSaving:  discountSaving,
          discountApplied: discountApplied,
          shoeNotes, status: "Booked", pickedUp: false,
          deliveryMode: "pending", assignedStaff: "",
          pointsAwarded: 10, pointsGranted: false, grantedPointsAmount: 0,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        transaction.set(slotSentinelRef, {
          count: currentCount + 1, date, location: loc,
          timeSlot, updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      btnBook.textContent = "Processing…";

      if (images.length) {
        try {
          const urls = await Promise.all(images.map(async (img, i) => {
            const ref = storageRef(storage, `orders/${newOrderId}/${Date.now()}-${i}-${img.name}`);
            await uploadBytes(ref, img);
            return getDownloadURL(ref);
          }));
          await updateDoc(doc(db, "orders", newOrderId), { imageUrls: urls, updatedAt: serverTimestamp() });
        } catch (uploadErr) {
          console.warn("Image upload failed (booking saved):", uploadErr);
          toast("Images failed to upload, but booking is confirmed.", "error");
        }
      }

      sendBookingEmail({
        customerName, customerEmail,
        orderId:     newOrderId,
        service:     serviceLabel(service),
        location:    loc,
        bookingDate: date,
        bookingTime: timeSlot,
        price:       totalPrice,
        shoeNotes,
        addons:      selectedAddons,
        pairCount:        pairs,
        collectionMethod: isPickup ? "Home pickup (+£10)" : "Drop off at branch",
        pickupAddress,
        paymentMethod:    needsQuote ? "Arranged after quote" : (paymentOption === "deposit" ? `£${DEPOSIT_AMOUNT} deposit now, balance on collection` : "Paid in full now"),
        amountDueNow:     needsQuote ? "" : `£${amountDueNow}`,
      });

      if (isPickup) {
        sendHomeCollectionEmail({
          customerEmail, customerName,
          orderId:       newOrderId,
          pickupAddress,
          bookingDate:   date,
          bookingTime:   timeSlot,
          service:       serviceLabel(service),
          pairCount:     pairs,
        });
      }

      if (_slotWatcherUnsub) { _slotWatcherUnsub(); _slotWatcherUnsub = null; }
      toast(needsQuote ? "Quote request sent ✅" : "Booking confirmed ✅", "success");
      setMsg(needsQuote
        ? `Quote request sent! We'll be in touch about pricing. Order ID: ${newOrderId}`
        : `Booking confirmed! Order ID: ${newOrderId}`);
      setTimeout(() => { location.href = "track.html"; }, 900);

    } catch (err) {
      console.error("Booking failed:", err);
      let msg;
      if (err?.message === "SLOT_UNAVAILABLE") {
        msg = "That time slot was just taken. Please choose a different time.";
        const d = document.getElementById("date")?.value, l = $("#location")?.value;
        if (d && l) await refreshSlots(d);
      } else if (err?.code === "permission-denied") {
        msg = "Permission denied. Please log in again.";
      } else {
        msg = "Booking failed. Please try again.";
      }
      setMsg(msg); toast(msg, "error");
    } finally { btnBook.disabled = false; btnBook.textContent = "Confirm booking"; }
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 17 — TRACKING PAGE
//
//  Tracking page flow informed by Ref [7]
//  (ProjectWorlds — Order Tracking System with Source Code).
//  Cancelled orders shown for 7 days after cancellation so
//  customers can confirm their cancellation was processed.
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
      ordersEl.innerHTML = `<div class="order-card">
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
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const active = orders.filter((o) => {
          if (!["Completed", "Cancelled", "Delivered", "Collected"].includes(o.status)) return true;
          if (o.status === "Cancelled") {
            const cancelledMs = o.cancelledAt
              ? Number(o.cancelledAt)
              : (o.updatedAt?.seconds ? o.updatedAt.seconds * 1000 : 0);
            return Date.now() - cancelledMs < sevenDaysMs;
          }
          return false;
        });

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
        ordersEl.innerHTML = `<div class="order-card"><div class="order-title">Failed to load orders.</div></div>`;
      }
    );
  });

  $("#btnRefresh")?.addEventListener("click", () => toast("Tracking is live ✅"));
}


// ─────────────────────────────────────────────────────────────
//  SECTION 18 — SKELETON LOADERS
// ─────────────────────────────────────────────────────────────

function renderSkeletonOrders(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="order-card" aria-hidden="true">
      <div class="sched-skeleton" style="height:22px;width:60%;margin-bottom:10px;"></div>
      <div class="sched-skeleton" style="height:14px;width:40%;margin-bottom:16px;"></div>
      <div class="sched-skeleton" style="height:10px;width:100%;border-radius:99px;"></div>
    </div>`).join("");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 19 — CUSTOMER ACCOUNT PAGE
// ─────────────────────────────────────────────────────────────

function initCustomer() {
  // guard — only runs on customer.html, not settings.html
  if (!document.getElementById("custName") && !document.getElementById("custOrders")) return;
  if (document.getElementById("sName")) return;

  const orderList = $("#custOrders");

  onAuthStateChanged(auth, async (user) => {
    if (!user) { goLogin("customer.html"); return; }

    // load user data
    let userData = {};
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) userData = snap.data();
    } catch (err) { console.warn("initCustomer: profile load failed", err); }

    const points = Number(userData.points || 0);

    // populate profile strip
    if ($("#custName"))   $("#custName").textContent   = userData.name   || user.displayName || "—";
    if ($("#custEmail"))  $("#custEmail").textContent  = userData.email  || user.email       || "—";
    if ($("#custPoints")) $("#custPoints").textContent = String(points);
    if ($("#statSince"))  $("#statSince").textContent  =
      userData.createdAt?.toDate?.().toLocaleDateString("en-GB") ?? "—";

    // avatar — load saved photo
    const avatarImg = document.getElementById("custAvatar");
    const savedPhoto = userData.photoURL || user.photoURL;
    if (avatarImg && savedPhoto) avatarImg.src = savedPhoto;

    // Tier progress UI (badge, bar, hint text) is rendered by
    // customer.js's applyTierUI() — this page also loads that script.

    // nav points badge
    const badge = document.getElementById("navPointsBadge");
    if (badge) {
      const tierName = tierNameForPoints(points);
      badge.innerHTML = `<span class="np-dot" aria-hidden="true"></span><span class="np-tier">${esc(tierName)}</span><span class="np-sep" aria-hidden="true">&middot;</span><span class="np-pts">${esc(String(points))} pts</span>`;
      badge.dataset.tier = tierName;
      badge.hidden = false;
      badge.setAttribute("aria-label", `${tierName} tier — ${points} loyalty points`);
    }

    // avatar upload — Ref [2] MDN FileReader
    const avatarInput = document.getElementById("avatarUpload");
    if (avatarInput && !avatarInput._wired) {
      avatarInput._wired = true;
      avatarInput.addEventListener("change", async function () {
        const file = this.files?.[0];
        if (!file) return;
        if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
          toast("Please select a JPEG, PNG, or WebP image.", "error"); return;
        }
        if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5 MB.", "error"); return; }
        // local preview
        const reader = new FileReader();
        reader.onload = (ev) => { if (avatarImg) avatarImg.src = ev.target.result; };
        reader.readAsDataURL(file);
        try {
          // save to Firebase Storage
          const ref = storageRef(storage, `avatars/${user.uid}`);
          await uploadBytes(ref, file);
          const photoURL = await getDownloadURL(ref);
          await updateProfile(user, { photoURL });
          await updateDoc(doc(db, "users", user.uid), { photoURL, updatedAt: serverTimestamp() });
          if (avatarImg) avatarImg.src = photoURL;
          toast("Profile photo updated ✅", "success");
        } catch (err) {
          console.error("Avatar upload failed:", err);
          let msg = "Upload failed — please try again.";
          if (err?.code === "storage/unauthorized" || err?.code === "storage/unauthenticated") {
            msg = "Upload blocked by storage permissions — contact support.";
          } else if (err?.code === "storage/canceled" || err?.code === "storage/retry-limit-exceeded") {
            msg = "Upload was interrupted — check your connection and try again.";
          }
          toast(msg, "error");
        }
      });
    }

    // recent orders
    if (orderList) {
      wireOrderActions(orderList);
      orderList.innerHTML = renderSkeletonOrders(2);
      const q = query(
        collection(db, "orders"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      onSnapshot(q, (snap2) => {
        const orders = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        if ($("#statTotal"))     $("#statTotal").textContent     = orders.length;
        if ($("#statCompleted")) $("#statCompleted").textContent =
          orders.filter((o) => o.status === "Completed").length;
        orderList.innerHTML = orders.length
          ? orders.map(renderOrderCard).join("")
          : `<p class="acct-empty">No orders yet. <a href="booking.html">Book your first clean</a>.</p>`;
      });
    }

    // change password — block passwords under 8 characters
    const passBtn = document.getElementById("btnChangePass");
    if (passBtn && !passBtn._wired) {
      passBtn._wired = true;
      passBtn.addEventListener("click", async () => {
        const curPass  = $("#curPass")?.value ?? "";
        const newPass  = $("#newPass")?.value ?? "";
        const confPass = $("#confirmPass")?.value ?? "";
        const msgEl    = document.getElementById("passMsg");
        const showPassMsg = (msg, ok) => {
          if (!msgEl) return;
          msgEl.textContent = msg;
          msgEl.style.color = ok ? "var(--success,#3dc98a)" : "var(--danger,#f08888)";
        };
        if (!curPass)           { showPassMsg("Enter your current password."); return; }
        if (!newPass)           { showPassMsg("Enter a new password."); return; }
        // block weak passwords
        if (newPass.length < 8) { showPassMsg("Password must be at least 8 characters."); $("#newPass")?.focus(); return; }
        if (confPass && newPass !== confPass) { showPassMsg("Passwords do not match."); return; }
        passBtn.disabled = true; passBtn.textContent = "Updating…";
        try {
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, curPass));
          await updatePassword(user, newPass);
          showPassMsg("Password updated.", true);
          toast("Password updated ✅", "success");
          ["curPass","newPass","confirmPass"].forEach((id) => { const el = $("#" + id); if (el) el.value = ""; });
        } catch (err) {
          const msgs = {
            "auth/wrong-password":     "Current password is incorrect.",
            "auth/invalid-credential": "Current password is incorrect.",
            "auth/weak-password":      "Password must be at least 8 characters.",
          };
          showPassMsg(msgs[err?.code] ?? "Update failed — please try again.");
        } finally { passBtn.disabled = false; passBtn.textContent = "Update password"; }
      });
    }
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

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  let viewYear = todayDate.getFullYear(), viewMonth = todayDate.getMonth();
  let selectedDate = null, cache = {};

  function getSlots(iso) {
    return cache[iso] ? { ...cache[iso] } : Object.fromEntries(TIME_SLOTS.map((s) => [s, true]));
  }

  async function loadMonth() {
    const m = pad(viewMonth + 1);
    try {
      const q = query(collection(db, "availability"),
        where("__name__", ">=", `${viewYear}-${m}-01`),
        where("__name__", "<=", `${viewYear}-${m}-31`));
      (await getDocs(q)).forEach((d) => { cache[d.id] = d.data().slots || {}; });
    } catch (err) { console.error("Failed to load availability:", err); }
  }

  function renderSlotEditor(iso) {
    if (!editor || !slotGrid || !selLabel) return;
    editor.style.display = "block";
    selLabel.textContent = formatDate(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    slotGrid.innerHTML = "";
    const slots = getSlots(iso);
    TIME_SLOTS.forEach((slot) => {
      const isOpen = slots[slot] !== false;
      const btn    = document.createElement("button");
      btn.type = "button";
      btn.className = `avail-slot-btn ${isOpen ? "slot-open" : "slot-closed"}`;
      btn.innerHTML = `<span class="avail-slot-dot"></span>${slot}`;
      btn.setAttribute("aria-pressed", String(isOpen));
      btn.setAttribute("aria-label", `${slot} — ${isOpen ? "open" : "closed"}`);
      btn.addEventListener("click", () => {
        if (!cache[iso]) cache[iso] = getSlots(iso);
        cache[iso][slot] = !isOpen;
        renderSlotEditor(iso); buildCal();
      });
      slotGrid.appendChild(btn);
    });
  }

  async function buildCal() {
    if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonth();
    buildCalendar({
      container: calBody, year: viewYear, month: viewMonth,
      today: todayDate, selectedDate,
      onPick: (date, iso) => { selectedDate = iso; buildCal(); renderSlotEditor(iso); },
      getCellClass: (date, iso) => {
        if (date < todayDate) return "avail-cell--past";
        const openCount = TIME_SLOTS.filter((s) => getSlots(iso)[s] !== false).length;
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
    renderSlotEditor(selectedDate); buildCal();
  };

  document.getElementById("btnAvailOpenAll")?.addEventListener("click",  () => setAllSlots(true));
  document.getElementById("btnAvailCloseAll")?.addEventListener("click", () => setAllSlots(false));

  document.getElementById("btnAvailSave")?.addEventListener("click", async () => {
    if (!selectedDate) { toast("Select a date first."); return; }
    const btn = document.getElementById("btnAvailSave");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await withRetry(() => setDoc(doc(db, "availability", selectedDate), {
        slots: cache[selectedDate] || getSlots(selectedDate), updatedAt: serverTimestamp(),
      }));
      toast(`Saved for ${selectedDate} ✅`, "success"); buildCal();
    } catch (err) { console.error(err); toast("Save failed. Please retry.", "error"); }
    finally { btn.disabled = false; btn.textContent = "Save"; }
  });

  document.getElementById("availPrev")?.addEventListener("click", async () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDate = null; if (editor) editor.style.display = "none"; await buildCal();
  });
  document.getElementById("availNext")?.addEventListener("click", async () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDate = null; if (editor) editor.style.display = "none"; await buildCal();
  });

  buildCal();
}


// ─────────────────────────────────────────────────────────────
//  SECTION 21 — CSV EXPORT
//  Includes Base Price, Add-ons, and Total Price columns.
// ─────────────────────────────────────────────────────────────

function exportOrdersToCSV(orders) {
  if (!orders.length) { toast("No orders to export."); return; }

  const headers = [
    "Order ID", "Customer Name", "Email", "Phone",
    "Service", "Location", "Pickup Address", "Date", "Time",
    "Base Price", "Add-ons", "Total Price",
    "Status", "Picked Up", "Points Awarded",
    "Delivery Mode", "Assigned Staff", "Notes", "Created",
  ];

  const rows = orders.map((o) => {
    const addonsStr = Array.isArray(o.addons) && o.addons.length
      ? o.addons.map((a) => `${a.label} (+£${a.price})`).join("; ")
      : "None";
    return [
      o.id,
      o.customerName  || "",
      o.customerEmail || "",
      o.customerPhone || "",
      serviceLabel(o.service),
      o.location      || "",
      o.pickupAddress || "",
      o.date          || "",
      o.timeSlot      || "",
      o.basePrice ? `£${o.basePrice}` : "",
      addonsStr,
      o.price         || "",
      o.status        || "",
      o.pickedUp      ? "Yes" : "No",
      o.pointsAwarded || 0,
      o.deliveryMode  || "pending",
      o.assignedStaff || "",
      (o.shoeNotes || "").replace(/"/g, '""'),
      o.createdAt?.toDate?.().toISOString?.() || "",
    ].map((v) => `"${v}"`);
  });

  const csv  = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: `orders-${todayISO()}.csv`,
  });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Orders exported ✅", "success");
}


// ─────────────────────────────────────────────────────────────
//  SECTION 22 — ADMIN PAGE
//
//  Debounced search filter pattern — Ref [4]
//  (GeeksforGeeks — Todo App, debounce pattern).
// ─────────────────────────────────────────────────────────────

function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders) return;

  initAvailabilityCalendar();

  $$(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateTab(tab); }
    });
  });

  function activateTab(tab) {
    $$(".admin-tab").forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    $$(".admin-tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active"); tab.setAttribute("aria-selected", "true");
    const key = tab.dataset.tab;
    document.getElementById(`tab${key.charAt(0).toUpperCase() + key.slice(1)}`)?.classList.add("active");
  }

  const isoToday   = todayISO();
  const todayLabel = $("#todayLabel");
  const debugUid   = $("#debugUid");
  const debugRole  = $("#debugRole");
  if (todayLabel) todayLabel.textContent = `Today's bookings — ${formatDate(isoToday)}`;

  let allOrders   = [];
  let currentUser = null;

  async function loadStaffList() {
    try {
      const snap = await getDocs(collection(db, "staff"));
      window._staffList = [];
      snap.forEach((d) => window._staffList.push({ id: d.id, ...d.data() }));
    } catch (err) { console.warn("Could not load staff list:", err); window._staffList = []; }
  }

  function renderHistoryPanel(dismissedOrders) {
    const historyEl      = document.getElementById("cancelledHistory");
    const historyCountEl = document.getElementById("cancelledHistoryCount");
    if (!historyEl) return;
    if (historyCountEl) historyCountEl.textContent = dismissedOrders.length ? `(${dismissedOrders.length})` : "";
    historyEl.innerHTML = dismissedOrders.length
      ? dismissedOrders.map((o) => renderAdminCard(o, currentUser)).join("")
      : `<div class="order-card"><div class="order-title" style="color:var(--text-3,#94a3b8);">No archived orders</div></div>`;
  }

  function renderMissedTab() {
    const missedPanel = $("#tabAppointment");
    if (!missedPanel) return;
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
    const missed = allOrders.filter((o) =>
      o.status === "Booked" && o.date && new Date(o.date + "T00:00:00") < cutoff
    );
    const badge  = missed.length
      ? `<span class="badge danger" style="margin-left:8px;font-size:0.75rem;">${missed.length}</span>` : "";
    const header = `<div class="card soft" style="margin-bottom:16px;padding:14px 18px;">
      <div class="card-title" style="font-size:0.95rem;">Missed Drop-offs ${badge}</div>
      <p class="sub" style="margin-top:4px;font-size:0.88rem;">Customers who booked but didn't arrive. Notify them to rebook or cancel.</p>
    </div>`;
    if (!missed.length) {
      missedPanel.innerHTML = header + `<div class="order-card"><div class="order-title">No missed drop-offs ✅</div></div>`;
      return;
    }
    missedPanel.innerHTML = header + missed.map((o) => `
      <div class="order-card" style="border-left:3px solid #ef4444;">
        <div class="order-top">
          <div>
            <div class="order-title">${esc(o.customerName || "Customer")} &bull; ${esc(serviceLabel(o.service))}</div>
            <div class="sub">${esc(o.customerEmail || "No email on file")}</div>
            <div class="sub">${esc(orderLocationLabel(o))}</div>
            <div class="sub">${esc(formatDate(o.date))} at ${esc(o.timeSlot || "")} &bull; ${esc(o.price || "")}</div>
            <div class="sub">Order: <code>${esc(o.id)}</code></div>
            <div class="sub" style="color:#ef4444;font-weight:600;margin-top:4px;">⚠ Did not drop off — appointment passed</div>
          </div>
          <span class="badge danger">No-show</span>
        </div>
        ${renderProgress(o.status)}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn primary" type="button"
            data-notify-missed="${esc(o.id)}" data-name="${esc(o.customerName || "Customer")}"
            data-email="${esc(o.customerEmail || "")}" data-date="${esc(o.date || "")}"
            data-time="${esc(o.timeSlot || "")}" data-loc="${esc(o.location || "")}">
            Notify customer
          </button>
          <button class="btn secondary" type="button" data-cancel-missed="${esc(o.id)}">Cancel order</button>
        </div>
      </div>`).join("");
  }

  // Debounced search — Ref [4] (GeeksforGeeks, debounce / event-filter pattern).
  const debouncedRender = debounce(() => renderAll(), 220);

  function renderAll() {
    const search = ($("#adminSearch")?.value || "").trim().toLowerCase();
    const filter = ($("#adminFilter")?.value || "") === "All" ? "" : ($("#adminFilter")?.value || "").trim();

    const conflicts   = findConflicts(allOrders);
    const conflictIds = new Set(conflicts.flat().map((o) => o.id));
    const conflictCount = $("#conflictCount");
    if (conflictCount) conflictCount.textContent = String(conflicts.length);

    const setText = (id, val) => { const el = $(id); if (el) el.textContent = String(val); };
    setText("#adminTotalOrders",     allOrders.length);
    setText("#adminOpenOrders",      allOrders.filter((o) => !["Completed", "Cancelled"].includes(o.status)).length);
    setText("#adminCompletedOrders", allOrders.filter((o) => o.status === "Completed").length);
    setText("#adminWithImages",      allOrders.filter((o) => getImageUrls(o).length > 0).length);

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

    const visible   = allOrders.filter((o) => !o.dismissed);
    const dismissed = allOrders.filter((o) => !!o.dismissed);
    renderHistoryPanel(dismissed);

    const filtered = visible.filter((o) => {
      const matchesFilter = !filter || o.status === filter;
      const haystack = [
        o.customerName, o.customerEmail, o.location, o.pickupAddress, o.service,
        o.date, o.timeSlot, o.price, o.status, o.id,
      ].join(" ").toLowerCase();
      return matchesFilter && (!search || haystack.includes(search));
    });

    adminOrders.innerHTML = filtered.length
      ? filtered.map((o) => renderAdminCard(o, currentUser, conflictIds.has(o.id))).join("")
      : `<div class="order-card"><div class="order-title">No matching orders</div></div>`;
  }

  $("#adminSearch")?.addEventListener("input", debouncedRender);
  $("#adminFilter")?.addEventListener("change", renderAll);
  $("#btnAdminRefresh")?.addEventListener("click", () => { renderAll(); toast("Refreshed ✅"); });
  $("#btnExportCSV")?.addEventListener("click", () => exportOrdersToCSV(allOrders));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      const s = $("#adminSearch"); if (s) { e.preventDefault(); s.focus(); s.select(); }
    }
  });

  // ── Delegated click handler ─────────────────────────────────
  adminOrders.addEventListener("click", async (e) => {
    if (!isAdmin(currentUser?.email)) return;

    const dismissBtn = e.target.closest("[data-dismiss-order]");
    if (dismissBtn) {
      const oid = dismissBtn.dataset.dismissOrder;
      dismissBtn.disabled = true; dismissBtn.textContent = "…";
      try {
        await withRetry(() => updateDoc(doc(db, "orders", oid), { dismissed: true, updatedAt: serverTimestamp() }));
        toast("Moved to history ✓", "success");
      } catch (err) {
        console.error("Dismiss failed:", err);
        toast("Could not dismiss order. Please retry.", "error");
        dismissBtn.disabled = false; dismissBtn.textContent = "×";
      }
      return;
    }

    const pickupBtn = e.target.closest("[data-send-pickup]");
    if (pickupBtn) { await handlePickupBtn(pickupBtn); return; }

    const saveBtn = e.target.closest("[data-admin-save]");
    if (!saveBtn) return;
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    try { await saveOrder(saveBtn.dataset.adminSave); }
    catch (err) { console.error(err); toast("Update failed. Please retry.", "error"); }
    finally { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
  });

  // Delegated handler for elements outside adminOrders (missed/history panels).
  document.addEventListener("click", async (e) => {
    if (!isAdmin(currentUser?.email)) return;

    const dismissBtn = e.target.closest("[data-dismiss-order]");
    if (dismissBtn && !dismissBtn.closest("#adminOrders")) {
      const oid = dismissBtn.dataset.dismissOrder;
      dismissBtn.disabled = true; dismissBtn.textContent = "…";
      try {
        await withRetry(() => updateDoc(doc(db, "orders", oid), { dismissed: true, updatedAt: serverTimestamp() }));
        toast("Moved to history ✓", "success");
      } catch (err) {
        console.error("Dismiss failed:", err);
        toast("Could not dismiss order.", "error");
        dismissBtn.disabled = false; dismissBtn.textContent = "×";
      }
      return;
    }

    const notifyBtn = e.target.closest("[data-notify-missed]");
    if (notifyBtn) {
      const email = notifyBtn.dataset.email;
      if (!email) { toast("No email address for this customer."); return; }
      notifyBtn.disabled = true; notifyBtn.textContent = "Sending…";
      try {
        await sendMissedEmail({
          customerName: notifyBtn.dataset.name, customerEmail: email,
          orderId: notifyBtn.dataset.notifyMissed,
          bookingDate: notifyBtn.dataset.date, bookingTime: notifyBtn.dataset.time,
          location: notifyBtn.dataset.loc,
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

    const pickupBtn = e.target.closest("[data-send-pickup]");
    if (pickupBtn && !pickupBtn.closest("#adminOrders")) { await handlePickupBtn(pickupBtn); return; }

    const cancelBtn = e.target.closest("[data-cancel-missed]");
    if (cancelBtn) {
      if (!confirm("Cancel this no-show order?")) return;
      cancelBtn.disabled = true;
      const cancelId = cancelBtn.dataset.cancelMissed;
      try {
        const cancelSnap = await withRetry(() => getDoc(doc(db, "orders", cancelId)));
        const cancelData = cancelSnap.exists() ? cancelSnap.data() : {};
        await withRetry(() => updateDoc(doc(db, "orders", cancelId), {
          status: "Cancelled", cancelledAt: Date.now(), updatedAt: serverTimestamp(),
        }));
        sendCancellationEmail({
          customerEmail: cancelData.customerEmail,
          customerName:  cancelData.customerName,
          orderId:       cancelId,
          bookingDate:   cancelData.date,
          bookingTime:   cancelData.timeSlot,
          location:      orderLocationLabel(cancelData),
        });
        toast("Order cancelled ✅", "success");
      } catch (err) {
        console.error(err); toast("Cancel failed. Please retry.", "error");
        cancelBtn.disabled = false;
      }
      return;
    }

    const saveBtn = e.target.closest("[data-admin-save]");
    if (saveBtn && !saveBtn.closest("#adminOrders")) {
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try { await saveOrder(saveBtn.dataset.adminSave); }
      catch (err) { console.error(err); toast("Update failed.", "error"); }
      finally { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
    }
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (debugUid)  debugUid.textContent  = user?.uid  || "—";
    if (debugRole) debugRole.textContent = user ? (isAdmin(user.email) ? "Admin" : "User") : "—";
    if (!user) { goLogin("admin.html"); return; }
    if (!isAdmin(user.email)) {
      adminOrders.innerHTML = `<div class="order-card"><div class="order-title">Access denied</div></div>`;
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
      (err) => { console.error("Admin snapshot error:", err); toast("Failed to load orders.", "error"); }
    );
  });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 23 — SCHEDULE PAGE
//
//  Calendar grid and slot-toggle UI informed by
//  Ref [3] (GreatStack — Booking System with JavaScript).
//  Add-ons badge shown on each order row in the timeline.
// ─────────────────────────────────────────────────────────────

function initSchedule() {
  const calGrid = document.getElementById("schedCalGrid");
  if (!calGrid) return;

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
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
      const q = query(collection(db, "availability"),
        where("__name__", ">=", `${viewYear}-${m}-01`),
        where("__name__", "<=", `${viewYear}-${m}-31`));
      (await getDocs(q)).forEach((d) => { availCache[d.id] = d.data().slots || {}; });
    } catch (err) { console.error("Availability load failed:", err); }
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

    for (let i = 0; i < firstDay; i++) appendOther(daysInPrev - firstDay + 1 + i);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d); date.setHours(0, 0, 0, 0);
      const iso  = isoFromDate(date);
      const isPast = date < todayDate;

      const slots     = slotsFor(iso);
      const bks       = bookingsFor(iso);
      const bookedSet = new Set(bks.map((o) => o.timeSlot));
      const openCount = TIME_SLOTS.filter((s) => slots[s] !== false).length;
      const freeCount = TIME_SLOTS.filter((s) => slots[s] !== false && !bookedSet.has(s)).length;

      const cell = document.createElement("div");
      cell.className = [
        "sched-cell",
        isPast ? "sched-cell--past" : "",
        iso === isoFromDate(todayDate)  ? "sched-cell--today"    : "",
        iso === selectedISO             ? "sched-cell--selected"  : "",
        !isPast
          ? openCount === 0     ? "sched-cell--all-closed"
          : freeCount === 0 || bks.length > 0 ? "sched-cell--partial"
          : "sched-cell--all-open"
          : "",
      ].filter(Boolean).join(" ");

      cell.setAttribute("tabindex", isPast ? "-1" : "0");
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label",
        `${formatDate(iso, { weekday: "long", day: "numeric", month: "long" })}: ${bks.length} booking${bks.length !== 1 ? "s" : ""}`
      );

      const dots = TIME_SLOTS.map((s) => {
        const cls = slots[s] === false ? "sched-slot-dot--closed"
          : bookedSet.has(s) ? "sched-slot-dot--booked" : "";
        return `<span class="sched-slot-dot ${cls}" aria-hidden="true"></span>`;
      }).join("");

      cell.innerHTML = `
        <span class="sched-cell-num">${d}</span>
        ${bks.length ? `<span class="sched-cell-count">${bks.length}</span>` : ""}
        <div class="sched-cell-dots" aria-hidden="true">${dots}</div>`;

      if (!isPast) {
        const pick = () => selectDate(iso);
        cell.addEventListener("click", pick);
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
        });
      }
      calGrid.appendChild(cell);
    }

    const remaining = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= remaining; i++) appendOther(i);

    updateStats(); buildWeek();
  }

  function selectDate(iso) { selectedISO = iso; buildCal(); renderSlotEditor(iso); renderTimeline(iso); }

  function renderSlotEditor(iso) {
    const grid  = document.getElementById("schedSlotGrid");
    const title = document.getElementById("schedEditorTitle");
    if (!grid || !title) return;
    title.textContent = formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    grid.innerHTML = "";
    const slots  = slotsFor(iso);
    const booked = new Set(bookingsFor(iso).map((o) => o.timeSlot));
    TIME_SLOTS.forEach((slot) => {
      const isBooked = booked.has(slot);
      const isOpen   = slots[slot] !== false;
      const count    = bookingsFor(iso).filter((o) => o.timeSlot === slot).length;
      const item     = document.createElement("div");
      item.className = `sched-slot-item ${isBooked ? "slot-booked" : isOpen ? "slot-open" : "slot-closed"}`;
      item.setAttribute("role", isBooked ? "status" : "button");
      if (!isBooked) {
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-pressed", String(isOpen));
        item.setAttribute("aria-label", `${slot}: ${isOpen ? "open, click to close" : "closed, click to open"}`);
      }
      item.innerHTML = `
        <div class="sched-slot-left">
          <div class="sched-slot-icon" aria-hidden="true">${isBooked ? "●" : isOpen ? "○" : "✕"}</div>
          <span class="sched-slot-time">${slot}</span>
          ${isBooked ? `<span style="font-size:0.7rem;color:var(--text-3);margin-left:4px;">(${count})</span>` : ""}
        </div>
        <span class="sched-slot-status">${isBooked ? `Booked (${count})` : isOpen ? "Open" : "Closed"}</span>`;
      if (!isBooked) {
        const toggle = () => {
          if (!availCache[iso]) availCache[iso] = slotsFor(iso);
          availCache[iso][slot] = !isOpen;
          renderSlotEditor(iso); buildCal();
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

  // renderTimeline shows add-ons badge on each order row — Ref [3] (GreatStack).
  function renderTimeline(iso) {
    const timeline = document.getElementById("schedTimeline");
    if (!timeline) return;
    const titleEl = document.getElementById("schedDayTitle");
    const isoEl   = document.getElementById("schedDayISO");
    const countEl = document.getElementById("schedDayCount");
    if (titleEl) titleEl.textContent = iso === isoFromDate(todayDate) ? "Today's Orders" : `Orders for ${formatDate(iso)}`;
    if (isoEl)   isoEl.textContent   = formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const bks = bookingsFor(iso);
    if (countEl) countEl.textContent = `${bks.length} order${bks.length !== 1 ? "s" : ""}`;
    if (!bks.length) { timeline.innerHTML = `<div class="sched-empty-day"><p>No orders for this date.</p></div>`; return; }
    const conflictIds = new Set(findConflicts(allOrders.filter((o) => o.date === iso)).flat().map((o) => o.id));
    const grouped = Object.fromEntries(TIME_SLOTS.map((s) => [s, []]));
    bks.forEach((o) => { (grouped[o.timeSlot] = grouped[o.timeSlot] || []).push(o); });
    timeline.innerHTML = "";
    Object.entries(grouped).forEach(([slot, orders]) => {
      if (!orders.length) return;
      const group   = document.createElement("div"); group.className = "sched-time-slot-group";
      const heading = document.createElement("div"); heading.className = "sched-time-heading"; heading.textContent = slot;
      group.appendChild(heading);
      orders.forEach((o) => {
        const row     = document.createElement("div");
        row.className = `sched-order-row${conflictIds.has(o.id) ? " conflict-row" : ""}`;
        const initial = (o.customerName || "?").charAt(0).toUpperCase();
        const pickupTag = o.pickedUp
          ? `<span class="pickup-tag pickup-tag--done">Collected</span>`
          : o.status === "Awaiting Pickup"
          ? `<span class="pickup-tag pickup-tag--waiting">Ready for pickup</span>` : "";
        // Add-ons badge on schedule timeline — Ref [3] (GreatStack, booking UI pattern).
        const addonsTag = (o.addons && o.addons.length)
          ? `<span class="badge info" style="font-size:0.68rem;margin-left:4px;">
               +${o.addons.map((a) => esc(a.label)).join(", ")}
             </span>` : "";
        row.innerHTML = `
          <div class="sched-order-avatar" aria-hidden="true">${esc(initial)}</div>
          <div class="sched-order-info">
            <div class="sched-order-name">
              ${esc(o.customerName || "Customer")} ${pickupTag} ${addonsTag}
              ${conflictIds.has(o.id) ? `<span class="conflict-badge">Double-booked</span>` : ""}
              ${o.assignedStaff ? `<span class="badge info" style="font-size:0.7rem;">Staff: ${esc(o.assignedStaff)}</span>` : ""}
            </div>
            <div class="sched-order-meta">
              ${esc(serviceLabel(o.service))} &bull; ${esc(orderLocationLabel(o))} &bull; ${esc(o.price || "")}
            </div>
            ${o.deliveryMode && o.deliveryMode !== "pending"
              ? `<div class="sched-order-meta" style="color:var(--text-2);">Handoff: ${esc(o.deliveryMode)}</div>` : ""}
          </div>
          <div class="sched-order-status">
            <span class="${badgeClass(o.status)}" style="font-size:0.72rem;padding:3px 8px;">${esc(o.status)}</span>
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
      const d = new Date(todayDate); d.setDate(todayDate.getDate() + i);
      return bookingsFor(isoFromDate(d)).length;
    });
    const max = Math.max(...counts, 1);
    counts.forEach((count, i) => {
      const d   = new Date(todayDate); d.setDate(todayDate.getDate() + i);
      const iso = isoFromDate(d);
      const cell = document.createElement("div");
      cell.className = ["sched-week-day", i === 0 ? "is-today" : "", iso === selectedISO ? "is-selected" : ""].filter(Boolean).join(" ");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `${DAYS_SHORT[d.getDay()]} ${d.getDate()}: ${count} orders`);
      const barPct = Math.max(Math.round((count / max) * 100), 8);
      cell.innerHTML = `
        <div class="sched-week-name"  aria-hidden="true">${DAYS_SHORT[d.getDay()]}</div>
        <div class="sched-week-num"   aria-hidden="true">${d.getDate()}</div>
        <div class="sched-week-bar-wrap" aria-hidden="true"><div class="sched-week-bar" style="height:${barPct}%"></div></div>
        <div class="sched-week-orders">${count}<span style="font-size:0.62rem;font-weight:500"> order${count !== 1 ? "s" : ""}</span></div>`;
      const pick = () => selectDate(iso);
      cell.addEventListener("click", pick);
      cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      weekGrid.appendChild(cell);
    });
  }

  function updateStats() {
    const isoTod    = isoFromDate(todayDate);
    const todayBks  = bookingsFor(isoTod);
    const slots     = slotsFor(isoTod);
    const bookedNow = new Set(todayBks.map((o) => o.timeSlot));
    const openNow   = TIME_SLOTS.filter((s) => slots[s] !== false && !bookedNow.has(s)).length;
    let weekTotal   = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate); d.setDate(todayDate.getDate() + i);
      weekTotal += bookingsFor(isoFromDate(d)).length;
    }
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
    setText("schedTodayCount", todayBks.length);
    setText("schedWeekCount",  weekTotal);
    setText("schedOpenSlots",  openNow);
    setText("schedConflicts",  findConflicts(allOrders).length);
  }

  const setAllSchedSlots = (open) => {
    if (!selectedISO) return;
    if (!availCache[selectedISO]) availCache[selectedISO] = slotsFor(selectedISO);
    TIME_SLOTS.forEach((s) => { availCache[selectedISO][s] = open; });
    renderSlotEditor(selectedISO); buildCal();
  };

  document.getElementById("btnSchedOpenAll")?.addEventListener("click",  () => setAllSchedSlots(true));
  document.getElementById("btnSchedCloseAll")?.addEventListener("click", () => setAllSchedSlots(false));

  document.getElementById("btnSchedSave")?.addEventListener("click", async () => {
    if (!selectedISO) { toast("Select a date first."); return; }
    const saveBtn = document.getElementById("btnSchedSave");
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";
    try {
      await withRetry(() => setDoc(doc(db, "availability", selectedISO), {
        slots: availCache[selectedISO] || slotsFor(selectedISO), updatedAt: serverTimestamp(),
      }));
      toast(`Availability saved for ${formatDate(selectedISO)} ✅`, "success"); buildCal();
    } catch (err) { console.error(err); toast("Save failed. Please retry.", "error"); }
    finally { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
  });

  // ── Reschedule modal ──────────────────────────────────────
  document.getElementById("btnSchedReschedule")?.addEventListener("click", () => {
    const bks = bookingsFor(selectedISO);
    if (!bks.length) { toast("No bookings on this date."); return; }
    document.getElementById("reschedModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "reschedModal";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "rModalHeading");
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:18px;padding:28px 26px;width:min(480px,100%);box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:inherit;";
    box.innerHTML = `
      <h2 id="rModalHeading" style="margin:0 0 6px;font-size:1.25rem;color:#111f3d;">Reschedule booking</h2>
      <p style="margin:0 0 20px;font-size:0.88rem;color:#69758b;">Choose an order, then pick a new date and time.</p>
      <label for="rModalOrder" style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;">Order</label>
      <select id="rModalOrder" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:16px;font:inherit;">
        ${bks.map((o) => `<option value="${esc(o.id)}">${esc(o.customerName || "Customer")} — ${esc(o.timeSlot)} — ${esc(serviceLabel(o.service))}</option>`).join("")}
      </select>
      <label for="rModalDate" style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;">New date</label>
      <input id="rModalDate" type="date" value="${selectedISO}" min="${todayISO()}" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:16px;font:inherit;"/>
      <label for="rModalTime" style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;">New time slot</label>
      <select id="rModalTime" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:22px;font:inherit;">
        ${TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join("")}
      </select>
      <div style="display:flex;gap:10px;">
        <button id="rModalCancel"  type="button" style="flex:1;min-height:44px;border-radius:10px;border:1px solid #c7d3e3;background:#f5f9ff;color:#44506a;font:inherit;font-weight:700;cursor:pointer;">Cancel</button>
        <button id="rModalConfirm" type="button" style="flex:1;min-height:44px;border-radius:10px;border:none;background:linear-gradient(135deg,#e8c97a,#c9a84c);color:#0a1120;font:inherit;font-weight:700;cursor:pointer;">Confirm reschedule</button>
      </div>
      <p id="rModalMsg" style="margin:10px 0 0;font-size:0.82rem;color:#c93c3c;min-height:18px;" role="alert"></p>`;
    modal.appendChild(box); document.body.appendChild(modal);
    const closeModal = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.getElementById("rModalCancel").addEventListener("click", closeModal);
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", onEsc); }
    });
    document.getElementById("rModalConfirm").addEventListener("click", async () => {
      const orderId    = document.getElementById("rModalOrder").value;
      const newDate    = document.getElementById("rModalDate").value.trim();
      const newTime    = document.getElementById("rModalTime").value;
      const msgEl      = document.getElementById("rModalMsg");
      const confirmBtn = document.getElementById("rModalConfirm");
      msgEl.textContent = "";
      if (!isValidDate(newDate)) { msgEl.textContent = "Please enter a valid date."; return; }
      if (newDate < todayISO())  { msgEl.textContent = "Cannot reschedule to a past date."; return; }
      const order = bks.find((o) => o.id === orderId);
      if (!order) { msgEl.textContent = "Order not found."; return; }
      confirmBtn.disabled = true; confirmBtn.textContent = "Checking…";
      try {
        const available = await withRetry(() => slotAvailable(newDate, order.location, newTime));
        if (!available) {
          msgEl.textContent = "That slot is already taken. Please choose another.";
          confirmBtn.disabled = false; confirmBtn.textContent = "Confirm reschedule"; return;
        }
        await withRetry(() => updateDoc(doc(db, "orders", orderId), {
          date: newDate, timeSlot: newTime, rescheduledAt: Date.now(), updatedAt: serverTimestamp(),
        }));
        sendRescheduleEmail({
          customerEmail: order.customerEmail,
          customerName:  order.customerName,
          orderId,
          bookingDate: newDate,
          bookingTime: newTime,
          service:     serviceLabel(order.service),
          location:    orderLocationLabel(order),
        });
        toast(`Rescheduled to ${formatDate(newDate)} at ${newTime} ✅`, "success");
        closeModal(); renderTimeline(selectedISO); buildCal();
      } catch (err) {
        console.error(err);
        msgEl.textContent = "Reschedule failed. Please try again.";
        confirmBtn.disabled = false; confirmBtn.textContent = "Confirm reschedule";
      }
    });
  });

  document.getElementById("schedPrev")?.addEventListener("click", async () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; } await buildCal();
  });
  document.getElementById("schedNext")?.addEventListener("click", async () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; } await buildCal();
  });
  document.getElementById("btnWeekRefresh")?.addEventListener("click", () => { buildCal(); toast("Refreshed ✅"); });

  onAuthStateChanged(auth, (user) => {
    if (!user || !isAdmin(user.email)) {
      calGrid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-3);">Admin access required.</div>`;
      return;
    }
    onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        allOrders = []; snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
        buildCal(); renderSlotEditor(selectedISO); renderTimeline(selectedISO);
      },
      (err) => { console.error("Schedule snapshot error:", err); toast("Failed to load schedule.", "error"); }
    );
  });

  buildCal(); renderTimeline(selectedISO);
}


// ─────────────────────────────────────────────────────────────
//  SECTION 24 — HOME PAGE CAROUSEL
//
//  Auto-advance timer and touch-swipe detection informed by
//  Ref [6] (CodingNepal — Responsive Image Slider in HTML CSS
//  & JavaScript).
// ─────────────────────────────────────────────────────────────

function initCarousel() {
  const track    = document.querySelector(".carousel-track");
  const dotsWrap = document.querySelector(".carousel-dots");
  if (!track || !dotsWrap) return;

  const slides = [...track.children];
  let index = 0, autoTimer;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsWrap.children].forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-pressed", String(i === index));
      dot.setAttribute("aria-label", `Slide ${i + 1}${i === index ? " (current)" : ""}`);
    });
    track.parentElement?.setAttribute("aria-label", `Slide ${index + 1} of ${slides.length}`);
  }

  function goTo(i) { index = (i + slides.length) % slides.length; render(); resetAuto(); }

  // Auto-advance pattern — Ref [6] (CodingNepal, carousel timer).
  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(index + 1), 5000);
  }

  dotsWrap.innerHTML = slides.map((_, i) =>
    `<button type="button" aria-label="Go to slide ${i + 1}"${i === 0 ? ' class="active"' : ""}></button>`
  ).join("");

  [...dotsWrap.children].forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
  document.querySelector(".carousel-btn.prev")?.addEventListener("click", () => goTo(index - 1));
  document.querySelector(".carousel-btn.next")?.addEventListener("click", () => goTo(index + 1));
  track.parentElement?.addEventListener("mouseenter", () => clearInterval(autoTimer));
  track.parentElement?.addEventListener("mouseleave", resetAuto);

  // Touch-swipe detection — Ref [6] (CodingNepal, touch-swipe pattern).
  let touchStartX = 0;
  track.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend",   (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? index + 1 : index - 1);
  });

  render(); resetAuto();
}



// ─────────────────────────────────────────────────────────────
//  SECTION 25b — THEME / DARK MODE
//
//  Handles the dark-mode toggle switch wired in settings.html and
//  on any page that includes a #themeToggle checkbox element.
//
//  The initial dark-mode class is applied by an inline <script> in
//  each page's <head> before the browser paints, which prevents the
//  flash of unstyled content (FOUC). This function then syncs the
//  checkbox state to that already-applied class, and wires the
//  change event so subsequent toggles are persisted.
//
//  REFERENCES for this section:
//
//  localStorage.getItem / setItem — Ref [10]
//  (MDN Web Docs, Window.localStorage).
//  The "theme" key stores either "dark" or "light" as a string so
//  the preference survives page navigation and browser restarts.
//
//  classList.add / classList.remove — Ref [11]
//  (MDN Web Docs, Element.classList).
//  Applied to document.documentElement (the <html> element) so the
//  .dark-mode class cascades to every CSS variable defined in
//  token.css and global.css via the html.dark-mode selector.
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the dark-mode toggle.
 *
 * Reads the current class state set by the inline <head> script
 * (Ref [10] MDN localStorage, Ref [11] MDN classList) and wires
 * the #themeToggle checkbox so any user change is immediately
 * applied to <html> and persisted to localStorage.
 *
 * Safe to call on pages that have no #themeToggle — the early
 * return prevents errors.
 *
 * Exported as both initTheme() and initSettings() for backwards
 * compatibility with older page scripts that call initSettings().
 */
function initTheme() {
  // Find the toggle checkbox — present in settings.html, optional elsewhere.
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  // Sync checkbox to the class already set by the inline <head> script.
  // Reading classList instead of localStorage avoids a second storage
  // lookup and stays in sync with the flash-prevention script.
  // Ref [11] (MDN Web Docs, Element.classList).
  toggle.checked = document.documentElement.classList.contains("dark-mode");

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      // Apply dark theme — Ref [11] (MDN Web Docs, classList.add).
      document.documentElement.classList.add("dark-mode");
      // Persist preference — Ref [10] (MDN Web Docs, localStorage.setItem).
      localStorage.setItem("theme", "dark");
    } else {
      // Remove dark theme — Ref [11] (MDN Web Docs, classList.remove).
      document.documentElement.classList.remove("dark-mode");
      // Persist preference — Ref [10] (MDN Web Docs, localStorage.setItem).
      localStorage.setItem("theme", "light");
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  SECTION 25a — SETTINGS PAGE
//
//  Profile info, avatar upload, password change, theme/motion toggles.
//  Uses getApps() so it shares the existing Firebase singleton rather
//  than creating a second auth instance (which caused empty fields).
//
//  Ref [9] Bootdey "Profile Edit Settings" — layout adapted in settings.html
//  Ref [10] MDN localStorage — theme + reduce-motion persistence
//  Ref [11] MDN classList — dark-mode class toggling
// ─────────────────────────────────────────────────────────────

function initSettings() {
  // guard — only runs on settings.html which has #sName
  if (!document.getElementById("sName")) return;

  // redirect if not signed in or 2FA not done
  onAuthStateChanged(auth, (user) => {
    if (!user || !has2FA()) { location.replace("login.html?next=settings.html"); return; }
    _settingsLoad(user);
    _settingsWireButtons(user);
  });

  // tab switching — Ref [9] (Bootdey nav-tabs pattern)
  document.querySelectorAll(".settings-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach((b) => {
        b.classList.remove("active"); b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active"); btn.setAttribute("aria-selected", "true");
      const panel = document.getElementById(btn.dataset.panel);
      if (panel) panel.classList.add("active");
    });
  });

  // theme toggle — Ref [10] (MDN localStorage), Ref [11] (MDN classList)
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const isDark = localStorage.getItem("theme") === "dark";
    themeToggle.checked = isDark;
    document.documentElement.classList.toggle("dark-mode", isDark);
    themeToggle.addEventListener("change", function () {
      document.documentElement.classList.toggle("dark-mode", this.checked);
      localStorage.setItem("theme", this.checked ? "dark" : "light");
    });
  }

  // reduce motion toggle — Ref [10] (MDN localStorage)
  const rmToggle = document.getElementById("reduceMotionToggle");
  if (rmToggle) {
    const reduced = localStorage.getItem("reduceMotion") === "true";
    rmToggle.checked = reduced;
    document.documentElement.classList.toggle("reduce-motion", reduced);
    rmToggle.addEventListener("change", function () {
      document.documentElement.classList.toggle("reduce-motion", this.checked);
      localStorage.setItem("reduceMotion", String(this.checked));
    });
  }

  // avatar preview — MDN FileReader
  document.getElementById("sAvatarInput")?.addEventListener("change", function () {
    const file = this.files?.[0];
    const fb   = document.getElementById("sUploadFeedback");
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      if (fb) fb.textContent = "Please select a JPEG, PNG, or WebP image."; return;
    }
    if (file.size > 5 * 1024 * 1024) { if (fb) fb.textContent = "Image must be under 5 MB."; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.getElementById("sAvatarImg");
      if (img) img.src = ev.target.result;
      if (fb)  fb.textContent = file.name;
    };
    reader.readAsDataURL(file);
  });
}

function _settingsTierFor(pts) {
  if (pts >= 500) return "Pearl";
  if (pts >= 100) return "Stone";
  return "Carbon";
}

function _settingsSetTxt(id, val) { const el = document.getElementById(id); if (el) el.textContent = String(val ?? ""); }
function _settingsSetVal(id, val) { const el = document.getElementById(id); if (el) el.value = String(val ?? ""); }
function _settingsStatus(id, msg, ok) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = msg; el.style.color = ok ? "var(--success,#3dc98a)" : "var(--danger,#f08888)";
}

async function _settingsLoad(user) {
  // phase 1 — show Auth data immediately so fields aren't blank
  _settingsSetVal("sName",  user.displayName || "");
  _settingsSetVal("sEmail", user.email || "");
  _settingsSetTxt("sDisplayName",  user.displayName || "—");
  _settingsSetTxt("sDisplayEmail", user.email || "—");

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const d      = snap.data();
    const name   = d.name  || user.displayName || "";
    const email  = d.email || user.email || "";
    const phone  = d.phone || "";
    const points = Number(d.points || 0);
    const tier   = _settingsTierFor(points);
    const photo  = d.photoURL || user.photoURL || "";

    _settingsSetTxt("sDisplayName",   name  || "—");
    _settingsSetTxt("sDisplayEmail",  email || "—");
    _settingsSetTxt("sDisplayTier",   tier);
    _settingsSetTxt("sDisplayPoints", String(points));

    if (photo) { const img = document.getElementById("sAvatarImg"); if (img) img.src = photo; }

    _settingsSetVal("sName",   name);
    _settingsSetVal("sPhone",  phone);
    _settingsSetVal("sEmail",  email);
    _settingsSetVal("sTier",   tier);
    _settingsSetVal("sPoints", points + " pts");
  } catch (err) { console.error("settings load:", err); }
}

function _settingsWireButtons(user) {
  const saveBtn = document.getElementById("btnSaveProfile");
  if (saveBtn && !saveBtn._wired) {
    saveBtn._wired = true;
    saveBtn.addEventListener("click", () => _settingsSave(user));
  }
  const passBtn = document.getElementById("btnChangePass");
  if (passBtn && !passBtn._wired) {
    passBtn._wired = true;
    passBtn.addEventListener("click", () => _settingsChangePass(user));
  }
}

async function _settingsSave(user) {
  const name  = document.getElementById("sName")?.value.trim();
  const phone = document.getElementById("sPhone")?.value.trim() || "";
  if (!name) { _settingsStatus("profileMsg", "Name cannot be empty."); return; }

  const btn = document.getElementById("btnSaveProfile");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  try {
    const updates   = { name, phone, updatedAt: serverTimestamp() };
    const fileInput = document.getElementById("sAvatarInput");
    const file      = fileInput?.files?.[0];

    if (file) {
      // save profile picture to Firebase Storage
      const ref = storageRef(storage, `avatars/${user.uid}`);
      await uploadBytes(ref, file);
      const photoURL = await getDownloadURL(ref);
      updates.photoURL = photoURL;
      await updateProfile(user, { displayName: name, photoURL });
      const img = document.getElementById("sAvatarImg");
      if (img) img.src = photoURL;
    } else {
      await updateProfile(user, { displayName: name });
    }

    await updateDoc(doc(db, "users", user.uid), updates);
    _settingsSetTxt("sDisplayName", name);
    if (fileInput) fileInput.value = "";
    const fb = document.getElementById("sUploadFeedback");
    if (fb) fb.textContent = "";
    _settingsStatus("profileMsg", "Saved.", true);
    toast("Profile saved ✅", "success");
  } catch (err) {
    console.error("settings save:", err);
    let msg = "Save failed — try again.";
    if (err?.code === "storage/unauthorized" || err?.code === "storage/unauthenticated") {
      msg = "Couldn't upload photo — storage permissions are blocking it. Contact support.";
    } else if (err?.code === "permission-denied") {
      msg = "Couldn't save — permission denied.";
    } else if (err?.code === "storage/canceled" || err?.code === "storage/retry-limit-exceeded") {
      msg = "Upload was interrupted — check your connection and try again.";
    }
    _settingsStatus("profileMsg", msg);
    const fb = document.getElementById("sUploadFeedback");
    if (fb && err?.code?.startsWith?.("storage/")) fb.textContent = "Photo upload failed — profile details were not saved.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save changes"; }
  }
}

async function _settingsChangePass(user) {
  const cur     = document.getElementById("curPass")?.value ?? "";
  const newP    = document.getElementById("newPass")?.value ?? "";
  const confirm = document.getElementById("confirmPass")?.value ?? "";

  if (!cur)  { _settingsStatus("passMsg", "Enter your current password."); return; }
  if (!newP) { _settingsStatus("passMsg", "Enter a new password."); return; }
  // block weak passwords
  if (newP.length < 8) { _settingsStatus("passMsg", "Password must be at least 8 characters."); document.getElementById("newPass")?.focus(); return; }
  if (newP !== confirm) { _settingsStatus("passMsg", "Passwords do not match."); return; }

  const btn = document.getElementById("btnChangePass");
  if (btn) { btn.disabled = true; btn.textContent = "Updating…"; }

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
    await updatePassword(user, newP);
    _settingsStatus("passMsg", "Password updated.", true);
    toast("Password updated ✅", "success");
    ["curPass","newPass","confirmPass"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  } catch (err) {
    const msgs = {
      "auth/wrong-password":     "Current password is incorrect.",
      "auth/invalid-credential": "Current password is incorrect.",
      "auth/weak-password":      "Password must be at least 8 characters.",
    };
    _settingsStatus("passMsg", msgs[err?.code] ?? "Update failed.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Update password"; }
  }
}


// ─────────────────────────────────────────────────────────────
//  SECTION 25b — ANALYTICS PAGE
//
//  All Chart.js chart building for admin analytics.
//  Admin-only: requireAuth redirects non-admins away.
//  Ref [1] Chart.js — https://www.chartjs.org
// ─────────────────────────────────────────────────────────────

function initAnalytics() {
  // guard — only runs on analytics.html
  if (!document.getElementById("kpiTotal")) return;

  requireAuth("analytics.html").then(({ user, role }) => {
    // show logout
    const logoutBtn = document.getElementById("navLogout");
    if (logoutBtn) logoutBtn.hidden = false;
    _loadAnalytics();
  });
}

let _analyticsCharts = [];

function _analyticsParsePrice(price) {
  return Number(String(price ?? "0").replace(/[^\d.]/g, "")) || 0;
}

function _analyticsServiceName(s) {
  return ({ standard_clean:"Standard Cleaning", express:"Express Service", next_day:"Next Day" })[s] || s || "Unknown";
}

function _analyticsDestroy() {
  _analyticsCharts.forEach((c) => c.destroy());
  _analyticsCharts = [];
}

function _analyticsChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  const c = new window.Chart(canvas, config);
  _analyticsCharts.push(c);
}

function _analyticsSortDesc(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

async function _loadAnalytics() {
  _analyticsDestroy();
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val ?? "—"); };

  let orders = [];
  try {
    const snap = await getDocs(collection(db, "orders"));
    orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) { console.error("analytics: Firestore read failed:", err); return; }

  if (!orders.length) { setTxt("kpiTotal", "0"); return; }

  const statusData = {}, serviceData = {}, locationData = {}, dayData = {},
        slotData = {}, custData = {};
  let totalRev = 0, compRev = 0, totalPts = 0, cancelled = 0, completed = 0;

  orders.forEach((o) => {
    const status  = o.status || "Unknown";
    const service = _analyticsServiceName(o.service);
    const loc     = o.location || "Unknown";
    const day     = o.date || "Unknown";
    const slot    = o.timeSlot || "Unknown";
    const price   = _analyticsParsePrice(o.price);
    const cust    = o.uid || o.customerEmail || "unknown";

    statusData[status]   = (statusData[status]   || 0) + 1;
    serviceData[service] = (serviceData[service] || 0) + 1;
    locationData[loc]    = (locationData[loc]    || 0) + 1;
    dayData[day]         = (dayData[day]         || 0) + 1;
    slotData[slot]       = (slotData[slot]       || 0) + 1;
    custData[cust]       = (custData[cust]       || 0) + 1;

    totalRev += price;
    totalPts += Number(o.grantedPointsAmount || 0);
    if (status === "Completed") { compRev += price; completed++; }
    if (status === "Cancelled") cancelled++;
  });

  const cancelRate = ((cancelled / orders.length) * 100).toFixed(1) + "%";

  setTxt("kpiTotal",           orders.length);
  setTxt("kpiCompletedInline", completed);
  setTxt("kpiRevenue",         `£${totalRev.toFixed(2)}`);
  setTxt("kpiCompletedRevenue",`£${compRev.toFixed(2)}`);
  setTxt("kpiCustomers",       Object.keys(custData).length);
  setTxt("kpiPoints",          totalPts);
  setTxt("kpiCancelled",       cancelled);
  setTxt("kpiCancelRate",      cancelRate);

  const cd = {
    plugins: { legend: { labels: { color: "#c0d8f0" } } },
    scales: {
      x: { ticks: { color: "#6485a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#6485a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  const statusE = _analyticsSortDesc(statusData);
  _analyticsChart("chartStatus", { type:"doughnut", data:{
    labels: statusE.map(([k])=>k),
    datasets:[{ data: statusE.map(([,v])=>v),
      backgroundColor:["#1f74ea","#3dc98a","#f08888","#f0b84a","#9b8ef0","#4acef0","#e07ef0","#6485a6"] }],
  }, options:{ plugins: cd.plugins } });

  const dayE = Object.entries(dayData).sort(([a],[b])=>a.localeCompare(b)).slice(-30);
  _analyticsChart("chartRevenue", { type:"line", data:{
    labels: dayE.map(([k])=>k),
    datasets:[{ label:"Orders", data: dayE.map(([,v])=>v),
      borderColor:"#1f74ea", backgroundColor:"rgba(31,116,234,0.12)", tension:0.4, fill:true }],
  }, options: cd });

  const svcE = _analyticsSortDesc(serviceData);
  _analyticsChart("chartService", { type:"bar", data:{
    labels: svcE.map(([k])=>k), datasets:[{ label:"Orders", data: svcE.map(([,v])=>v), backgroundColor:"#1f74ea" }],
  }, options: cd });

  const locE = _analyticsSortDesc(locationData);
  _analyticsChart("chartLocation", { type:"bar", data:{
    labels: locE.map(([k])=>k), datasets:[{ label:"Orders", data: locE.map(([,v])=>v), backgroundColor:"#3dc98a" }],
  }, options: cd });

  const slotE = _analyticsSortDesc(slotData);
  _analyticsChart("chartTimeSlot", { type:"bar", data:{
    labels: slotE.map(([k])=>k), datasets:[{ label:"Bookings", data: slotE.map(([,v])=>v), backgroundColor:"#f0b84a" }],
  }, options: cd });

  const custE = _analyticsSortDesc(custData).slice(0,10);
  _analyticsChart("chartCustomers", { type:"bar", data:{
    labels: custE.map(([k])=>k.substring(0,12)+(k.length>12?"…":"")),
    datasets:[{ label:"Orders", data: custE.map(([,v])=>v), backgroundColor:"#9b8ef0" }],
  }, options:{ ...cd, indexAxis:"y" } });
}


// ─────────────────────────────────────────────────────────────
//  SECTION 25c — THEME / DARK MODE
//
//  initTheme() handles the #themeToggle on pages other than settings.
//  Ref [10] MDN localStorage / Ref [11] MDN classList.
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
//  SECTION 25 — BOOTSTRAP
//
//  Initialise all page functions. Each init function guards itself
//  with an early return if its root element is absent, so all can
//  be called safely on every page without branching here.
//
//  initTheme() is called last so the toggle (if present) reflects
//  the auth state that setupNav() may have just rendered.
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
initSettings();
initAnalytics();

// initTheme must run after the DOM is ready. If this module is loaded
// as type="module" (deferred by default) the DOM is always ready here.
// The guard handles the rare case where the module executes before
// DOMContentLoaded (e.g. bundler output without defer).
// Ref [10] (MDN Web Docs, localStorage) / Ref [11] (MDN, classList).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}

// Named exports allow other modules (e.g. future settings.js) to
// import these functions directly without duplicating logic.
export { initTheme, initSettings };