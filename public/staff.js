



// ─── Firebase imports ──────────────────────────────────────────
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";


// ─── Constants ─────────────────────────────────────────────────
const ADMIN_EMAIL = "danielasouzu2@gmail.com";

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

const DELIVERY_MODE_LABELS = {
  staff:   "Staff delivers",
  pickup:  "Customer pickup",
  self:    "Owner handles",
  pending: "Not decided",
};

const SERVICE_LABELS = {
  standard_clean: "Standard Cleaning",
  express:        "Express Service",
  next_day:       "Next Day",
};

// Statuses that mean an order is still active (i.e. work is pending)
const DONE_STATUSES = new Set(["Completed", "Cancelled"]);


// ─── Helpers ───────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(val) {
  return String(val ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
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

function goLogin(next = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}

function serviceLabel(val) {
  return SERVICE_LABELS[val] ?? val ?? "—";
}

// Unified date formatter — accepts YYYY-MM-DD strings OR Firestore Timestamps.
// Previously we had two separate functions (formatDate + formatTimestamp) that
// did almost the same thing. Now one function handles both cases.
function formatDate(val) {
  if (!val) return "—";

  // Firestore Timestamp objects have a .toDate() method
  let d;
  if (val?.toDate) {
    d = val.toDate();
  } else if (typeof val === "string") {
    // Append T00:00:00 so the browser doesn't apply timezone offset
    d = new Date(val.includes("T") ? val : val + "T00:00:00");
  } else {
    d = new Date(val);
  }

  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// CSS class for a status badge
function statusBadgeClass(status) {
  if (status === "Completed")                                  return "badge success";
  if (status === "Cancelled")                                  return "badge danger";
  if (status === "Cleaning" || status === "Drying & Finish")   return "badge warning";
  if (status === "Ready"    || status === "Awaiting Pickup")   return "badge info";
  return "badge";
}

// Debounce — waits until the user stops typing before calling fn.
// Used on the search input so we don't re-filter on every keypress.
function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Retry an async function up to `attempts` times with exponential backoff.
// Wraps Firestore writes so a single bad network moment doesn't lose data.
async function withRetry(fn, attempts = 3, baseDelay = 400) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < attempts - 1)
        await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}


// ─── Toast ─────────────────────────────────────────────────────
// Self-contained so staff.js works whether app.js is loaded or not.
const _toastQueue   = [];
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


// ─── Nav ────────────────────────────────────────────────────────
async function setupNav(user) {
  const show = (id, visible) => { const el = $(id); if (el) el.hidden = !visible; };

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
      const { signOut } = await import(
        "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js"
      );
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


// ─── Module-level state ────────────────────────────────────────
// These live outside initStaff() so renderStaffCard() and updateStats()
// can read them without needing them passed as arguments.

// { "Sam Jones": [order, order, …] } — rebuilt on every orders snapshot
let _ordersByStaff = {};

// { [staffId]: staffDocData } — rebuilt on every staff snapshot
// Used by updateStats() and refreshCard() without touching the DOM
let _staffData = {};

// Track the active assignment count per staff member so we can diff
// and only re-render cards that actually changed.
// { [staffId]: activeCount }
let _prevAssignCounts = {};

// Unsubscribe functions for Firestore listeners.
// Stored so we can tear them down before re-subscribing on auth change,
// which would otherwise create duplicate listeners.
let _unsubOrders = null;
let _unsubStaff  = null;

// The staff member whose shift modal is currently open
let _currentShiftId = null;

// Abort controller for the history modal fetch —
// if admin closes the modal before the data loads we cancel the fetch
let _historyAbort = null;


// ─── Staff card rendering ──────────────────────────────────────
function renderStaffCard(staff) {
  const roleLabel = ROLES[staff.role]         ?? staff.role     ?? "—";
  const locLabel  = LOCATIONS[staff.location] ?? staff.location ?? "—";
  const isActive  = staff.status === "active";

  // Active assignments for this staff member
  const assigned = _ordersByStaff[staff.name] || [];
  const active   = assigned.filter((o) => !DONE_STATUSES.has(o.status));

  // Badge — only shown when there's at least one active order
  const assignBadge = active.length
    ? `<span class="staff-assign-badge"
             title="${active.length} active order(s)">
         📦 ${active.length} order${active.length !== 1 ? "s" : ""} assigned
       </span>`
    : "";

  // Most urgent active order (earliest date first)
  const latest = [...active].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "")
  )[0];

  const latestBlock = latest
    ? `<div class="staff-latest-order">
         <span class="staff-latest-label">Current job</span>
         <span class="staff-latest-detail">
           ${esc(serviceLabel(latest.service))}
           for ${esc(latest.customerName || "Customer")}
           &bull; ${esc(formatDate(latest.date))}
           &bull; <span class="${statusBadgeClass(latest.status)}"
                         style="font-size:0.72rem;padding:2px 7px;">
                    ${esc(latest.status)}
                  </span>
         </span>
       </div>`
    : "";

  return `
    <div class="staff-card"
         data-id="${esc(staff.id)}"
         data-name="${esc(staff.name)}"
         data-role="${esc(staff.role)}"
         data-location="${esc(staff.location)}"
         data-status="${esc(staff.status)}">

      <img class="avatar-img"
           src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
           alt="Staff avatar" width="50" height="50" loading="lazy" />

      <div class="staff-info">
        <h3 class="staff-name">${esc(staff.name)}</h3>
        <p class="staff-email">${esc(staff.email)}</p>

        <div class="staff-status-row">
          <p class="staff-status ${isActive ? "staff-status--active" : "staff-status--off"}">
            ${isActive ? "🟢 Active" : "⚪ Off today"}
          </p>
          ${assignBadge}
        </div>

        <p class="staff-role">${esc(roleLabel)}</p>
        <p class="staff-location">📍 ${esc(locLabel)}</p>
        <p class="staff-shift">
          ⏰ ${esc(staff.shiftStart || "—")} – ${esc(staff.shiftEnd || "—")}
        </p>

        ${latestBlock}

        <div class="staff-btn-row">
          <button type="button" class="btn-assign-shift btn primary"
                  data-id="${esc(staff.id)}">Assign shift</button>
          <button type="button" class="btn-view-history btn secondary"
                  data-id="${esc(staff.id)}">History</button>
          <button type="button" class="btn-remove-staff btn danger"
                  data-id="${esc(staff.id)}">Remove</button>
        </div>
      </div>
    </div>`;
}


// ─── Stats ──────────────────────────────────────────────────────
// Reads from _staffData cache — no DOM scraping needed.
function updateStats() {
  const staff  = Object.values(_staffData);
  const total  = staff.length;
  const active = staff.filter((s) => s.status === "active").length;
  const off    = staff.filter((s) => s.status !== "active").length;

  // "Shifts assigned" = staff with at least one active (non-done) order
  const withJobs = staff.filter((s) =>
    (_ordersByStaff[s.name] || []).some((o) => !DONE_STATUSES.has(o.status))
  ).length;

  const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = String(val);
  };
  setText("#statTotalStaff",  total);
  setText("#statActiveStaff", active);
  setText("#statOffStaff",    off);
  setText("#statShiftsToday", withJobs);
}


// ─── Search + filter ────────────────────────────────────────────
// Called directly (by the filter dropdowns) or via the debounced
// wrapper (by the search input). Reads only from data-* attributes
// and text content — no Firestore read needed.
function applyFilters() {
  const search   = ($("#staffSearch")?.value   || "").toLowerCase().trim();
  const role     = $("#staffFilterRole")?.value     || "all";
  const location = $("#staffFilterLocation")?.value || "all";
  let visible    = 0;

  $$(".staff-card").forEach((card) => {
    const name   = (card.dataset.name  || "").toLowerCase();
    const email  = (card.querySelector(".staff-email")?.textContent || "").toLowerCase();
    const matchQ = !search || name.includes(search) || email.includes(search);
    const matchR = role     === "all" || card.dataset.role     === role;
    const matchL = location === "all" || card.dataset.location === location;

    const show = matchQ && matchR && matchL;
    card.hidden = !show;
    if (show) visible++;
  });

  const empty = $("#staffEmpty");
  if (empty) empty.hidden = visible > 0;
}

// Debounced version for the search input
const applyFiltersDebounced = debounce(applyFilters, 300);


// ─── Event delegation on #staffList ────────────────────────────
// One listener on the parent handles ALL button clicks inside it.
// Previously we added 3 listeners per card — expensive at scale.
// This approach works even when cards are replaced in the DOM.
function wireStaffList(staffList) {
  if (staffList._delegated) return; // only attach once
  staffList._delegated = true;

  staffList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btn-assign-shift"))  openShiftModal(id);
    if (btn.classList.contains("btn-view-history"))  openHistoryModal(id);
    if (btn.classList.contains("btn-remove-staff"))  removeStaff(id);
  });
}


// ─── Smart card refresh ─────────────────────────────────────────
// Called after _ordersByStaff is rebuilt. Instead of re-rendering
// every card on every orders snapshot, we:
//   1. Compute the current active count for each staff member
//   2. Compare to the previous counts stored in _prevAssignCounts
//   3. Only replace cards where the count changed
//
// This means if 10 orders come in and only 1 affects "Sam Jones",
// only Sam's card gets replaced in the DOM.
function smartRefreshCards() {
  Object.values(_staffData).forEach((staff) => {
    const current = (_ordersByStaff[staff.name] || []).filter(
      (o) => !DONE_STATUSES.has(o.status)
    ).length;
    const prev = _prevAssignCounts[staff.id] ?? -1; // -1 forces first render

    if (current === prev) return; // nothing changed — skip
    _prevAssignCounts[staff.id] = current;

    // Replace just this card in the DOM
    const existing = document.querySelector(`.staff-card[data-id="${staff.id}"]`);
    if (!existing) return;

    const tmp = document.createElement("div");
    tmp.innerHTML = renderStaffCard(staff);
    existing.replaceWith(tmp.firstElementChild);
    // No need to re-attach listeners — delegation handles it
  });
}


// ─── Shift modal ───────────────────────────────────────────────
function openShiftModal(id) {
  _currentShiftId = id;
  const card = document.querySelector(`.staff-card[data-id="${id}"]`);
  const name = card?.dataset.name || "Staff";

  const titleEl = document.getElementById("shiftModalTitle");
  if (titleEl) titleEl.textContent = `Assign shift — ${name}`;

  const roleEl = document.getElementById("shiftRole");
  const locEl  = document.getElementById("shiftLocation");
  if (roleEl && card?.dataset.role)     roleEl.value = card.dataset.role;
  if (locEl  && card?.dataset.location) locEl.value  = card.dataset.location;

  const dateEl = document.getElementById("shiftDate");
  if (dateEl) dateEl.valueAsDate = new Date();

  document.getElementById("shiftModal").hidden = false;
  // Move focus into the modal for keyboard / screen reader users
  document.getElementById("shiftRole")?.focus();
}

function closeShiftModal() {
  document.getElementById("shiftModal").hidden = true;
  _currentShiftId = null;
}


// ─── History modal ──────────────────────────────────────────────
// Merges shift history (staffShifts collection) and order assignments
// (orders collection) into one unified timeline, sorted by date desc.
//
// If the admin closes the modal before the data loads, we cancel the
// in-flight fetch via an AbortController flag so the stale data
// never gets written to the content div.

async function openHistoryModal(id) {
  // Cancel any in-progress history fetch for a previous card
  if (_historyAbort) _historyAbort.cancelled = true;
  const abort = { cancelled: false };
  _historyAbort = abort;

  const staff = _staffData[id];
  const name  = staff?.name || document.querySelector(`.staff-card[data-id="${id}"] .staff-name`)?.textContent || "Staff";

  const titleEl = document.getElementById("historyModalTitle");
  if (titleEl) titleEl.textContent = `Shift & order history — ${name}`;

  const content = document.getElementById("historyContent");
  if (content) content.innerHTML = `<p class="history-empty">Loading…</p>`;
  document.getElementById("historyModal").hidden = false;
  document.getElementById("btnCloseHistory")?.focus();

  try {
    // Fetch shift records and assigned orders in parallel
    const [shiftSnap, orderSnap] = await Promise.all([
      getDocs(query(
        collection(db, "staffShifts"),
        where("staffId", "==", id),
        orderBy("createdAt", "desc")
      )),
      getDocs(query(
        collection(db, "orders"),
        where("assignedStaff", "==", name)
      )),
    ]);

    // Bail out if the modal was closed while we were fetching
    if (abort.cancelled) return;

    // ── Build normalised row objects ─────────────────────────────
    // Both types get a `sortKey` (YYYY-MM-DD) so we can sort them
    // together in one array without type-specific comparators.

    const shiftRows = [];
    shiftSnap.forEach((d) => {
      const s = d.data();
      shiftRows.push({
        type:     "shift",
        sortKey:  s.shiftDate || "",
        date:     s.shiftDate || "",
        role:     ROLES[s.role] ?? s.role ?? "—",
        location: LOCATIONS[s.location] ?? s.location ?? "—",
        start:    s.shiftStart || "—",
        end:      s.shiftEnd   || "—",
      });
    });

    const orderRows = [];
    orderSnap.forEach((d) => {
      const o = d.data();
      orderRows.push({
        type:         "order",
        sortKey:      o.date || "",
        orderId:      d.id,
        date:         o.date || "",
        customerName: o.customerName || "Customer",
        service:      serviceLabel(o.service),
        location:     o.location  || "—",
        status:       o.status    || "—",
        deliveryMode: DELIVERY_MODE_LABELS[o.deliveryMode] ?? o.deliveryMode ?? "—",
        price:        o.price     || "",
        timeSlot:     o.timeSlot  || "",
      });
    });

    // Merge and sort newest first
    const rows = [...shiftRows, ...orderRows].sort(
      (a, b) => b.sortKey.localeCompare(a.sortKey)
    );

    if (!content) return;

    if (rows.length === 0) {
      content.innerHTML = `<p class="history-empty">No shifts or orders recorded yet.</p>`;
      return;
    }

    content.innerHTML = rows.map(renderHistoryRow).join("");

  } catch (err) {
    if (abort.cancelled) return; // modal was closed — silently drop the error
    console.error("Failed to load staff history:", err);
    if (content) content.innerHTML =
      `<p class="history-empty">Could not load history. Please try again.</p>`;
    toast("Failed to load history.", "error");
  }
}

// Renders one row in the history modal — extracted so openHistoryModal stays readable
function renderHistoryRow(row) {
  if (row.type === "shift") {
    return `
      <div class="history-row history-row--shift">
        <div class="history-row-type">
          <span class="history-type-badge history-type-badge--shift">Shift</span>
          <span class="history-date">${esc(formatDate(row.date))}</span>
        </div>
        <p class="history-detail">
          <strong>${esc(row.role)}</strong> &bull; ${esc(row.location)}
        </p>
        <p class="history-detail">⏰ ${esc(row.start)} – ${esc(row.end)}</p>
      </div>`;
  }

  // Order assignment row
  return `
    <div class="history-row history-row--order">
      <div class="history-row-type">
        <span class="history-type-badge history-type-badge--order">Order assigned</span>
        <span class="history-date">${esc(formatDate(row.date))}</span>
      </div>
      <p class="history-detail">
        <strong>${esc(row.customerName)}</strong>
        &bull; ${esc(row.service)}
        &bull; ${esc(row.timeSlot)}
      </p>
      <p class="history-detail">
        📍 ${esc(row.location)} &bull; ${esc(row.price)}
      </p>
      <p class="history-detail">
        Handoff: <em>${esc(row.deliveryMode)}</em>
        &bull; Status:
        <span class="${statusBadgeClass(row.status)}"
              style="font-size:0.75rem;padding:2px 7px;">
          ${esc(row.status)}
        </span>
      </p>
      <p class="history-detail" style="font-size:0.75rem;color:var(--text-3);">
        Order ID: <code>${esc(row.orderId)}</code>
      </p>
    </div>`;
}

function closeHistoryModal() {
  // Mark any in-flight fetch as cancelled
  if (_historyAbort) { _historyAbort.cancelled = true; _historyAbort = null; }
  document.getElementById("historyModal").hidden = true;
}


// ─── Remove staff ───────────────────────────────────────────────
async function removeStaff(id) {
  if (!confirm("Remove this staff member? This cannot be undone.")) return;

  const btn = document.querySelector(`.btn-remove-staff[data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Removing…"; }

  try {
    await withRetry(() => deleteDoc(doc(db, "staff", id)));

    // Remove from in-memory cache immediately
    delete _staffData[id];
    delete _prevAssignCounts[id];
    window._staffList = Object.values(_staffData);

    document.querySelector(`.staff-card[data-id="${id}"]`)?.remove();
    updateStats();
    applyFilters();
    toast("Staff member removed ✅", "success");
  } catch (err) {
    console.error("Remove staff failed:", err);
    toast("Could not remove staff member. Please try again.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
  }
}


// ─── Modal wiring (shared setup, called once) ───────────────────
function wireModals() {
  // Shift modal
  document.getElementById("btnCancelShift")?.addEventListener("click", closeShiftModal);
  document.getElementById("shiftModal")?.addEventListener("click", function (e) {
    if (e.target === this) closeShiftModal();
  });

  // History modal
  document.getElementById("btnCloseHistory")?.addEventListener("click", closeHistoryModal);
  document.getElementById("historyModal")?.addEventListener("click", function (e) {
    if (e.target === this) closeHistoryModal();
  });

  // Escape key closes whichever modal is open
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("shiftModal")?.hidden)   closeShiftModal();
    if (!document.getElementById("historyModal")?.hidden) closeHistoryModal();
  });
}


// ─── initStaff ──────────────────────────────────────────────────
function initStaff() {
  const staffList = document.getElementById("staffList");
  if (!staffList) return;

  // Wire delegation and modals once — not inside the auth callback
  wireStaffList(staffList);
  wireModals();

  // ── Auth listener ────────────────────────────────────────────
  onAuthStateChanged(auth, async (user) => {
    await setupNav(user);

    // Tear down any previous Firestore listeners before re-subscribing.
    // Without this, logging out and back in would create a second set of
    // listeners that both update the DOM at the same time.
    if (_unsubOrders) { _unsubOrders(); _unsubOrders = null; }
    if (_unsubStaff)  { _unsubStaff();  _unsubStaff  = null; }

    if (!user) { goLogin("staff.html"); return; }

    if (!isAdmin(user.email)) {
      staffList.innerHTML = `
        <div class="staff-card">
          <div class="staff-info">
            <h3 class="staff-name">Access denied</h3>
            <p class="staff-email">Admin access required.</p>
          </div>
        </div>`;
      return;
    }

    // ── Admin profile ────────────────────────────────────────────
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        const adminName  = document.getElementById("adminName");
        const adminEmail = document.getElementById("adminEmail");
        if (adminName)  adminName.textContent  = d.name  || user.displayName || "Admin";
        if (adminEmail) adminEmail.textContent = d.email || user.email       || "—";
      }
    } catch (err) {
      console.warn("Could not load admin profile:", err);
    }

    // ── Orders listener ──────────────────────────────────────────
    // Rebuilds _ordersByStaff and smartly refreshes only the cards
    // whose active order count actually changed.
    staffList.innerHTML = `<p style="padding:1rem;color:var(--text-3);">Loading staff…</p>`;

    _unsubOrders = onSnapshot(
      collection(db, "orders"),
      (snap) => {
        _ordersByStaff = {};
        snap.forEach((d) => {
          const o    = { id: d.id, ...d.data() };
          const name = o.assignedStaff;
          if (!name) return;
          (_ordersByStaff[name] = _ordersByStaff[name] || []).push(o);
        });
        smartRefreshCards();
        updateStats();
      },
      (err) => console.error("Orders listener error (staff page):", err)
    );

    // ── Staff listener ───────────────────────────────────────────
    // Full re-render only when the staff collection itself changes
    // (someone added, edited, or removed a staff member).
    _unsubStaff = onSnapshot(
      query(collection(db, "staff"), orderBy("createdAt", "desc")),
      (snap) => {
        // Rebuild cache first
        _staffData = {};
        snap.forEach((d) => {
          const staff = { id: d.id, ...d.data() };
          _staffData[staff.id] = staff;
        });
        window._staffList = Object.values(_staffData);
        // Reset diff counters so cards get a fresh render
        _prevAssignCounts = {};

        staffList.innerHTML = "";
        if (snap.empty) {
          staffList.innerHTML = `<p class="staff-empty">No staff added yet.</p>`;
          updateStats();
          return;
        }

        snap.forEach((d) => {
          const staff = _staffData[d.id];
          const tmp   = document.createElement("div");
          tmp.innerHTML = renderStaffCard(staff);
          staffList.appendChild(tmp.firstElementChild);
          // No per-card listener needed — wireStaffList delegation handles it
        });

        // Store initial assignment counts so smartRefreshCards has a baseline
        Object.values(_staffData).forEach((s) => {
          _prevAssignCounts[s.id] = (_ordersByStaff[s.name] || []).filter(
            (o) => !DONE_STATUSES.has(o.status)
          ).length;
        });

        updateStats();
        applyFilters();
      },
      (err) => {
        console.error("Staff snapshot error:", err);
        staffList.innerHTML = `<p class="staff-empty">Failed to load staff. Please refresh.</p>`;
        toast("Failed to load staff.", "error");
      }
    );
  });

  // ── Add staff ────────────────────────────────────────────────
  document.getElementById("btnAddStaff")?.addEventListener("click", async () => {
    const nameEl   = document.getElementById("newStaffName");
    const emailEl  = document.getElementById("newStaffEmail");
    const roleEl   = document.getElementById("newStaffRole");
    const locEl    = document.getElementById("newStaffLocation");
    const statusEl = document.getElementById("newStaffStatus");
    const btn      = document.getElementById("btnAddStaff");

    const name   = nameEl?.value.trim()  || "";
    const email  = emailEl?.value.trim() || "";
    const role   = roleEl?.value         || "cleaning";
    const loc    = locEl?.value          || "leicester";
    const status = statusEl?.value       || "active";

    if (!name)  { toast("Please enter a name.", "error");   return; }
    if (!email) { toast("Please enter an email.", "error"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("Please enter a valid email address.", "error");
      return;
    }

    // Check for duplicate email in the current staff list
    const duplicate = Object.values(_staffData).some(
      (s) => s.email?.toLowerCase() === email.toLowerCase()
    );
    if (duplicate) {
      toast("A staff member with this email already exists.", "error");
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Adding…";

    try {
      await withRetry(() => addDoc(collection(db, "staff"), {
        name, email, role, location: loc, status,
        shiftStart: "09:00",
        shiftEnd:   "17:00",
        shiftDate:  "",
        createdAt:  serverTimestamp(),
      }));

      nameEl.value  = "";
      emailEl.value = "";
      nameEl.focus();
      toast(`${name} added ✅`, "success");
    } catch (err) {
      console.error("Add staff failed:", err);
      toast("Could not add staff member. Please try again.", "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = "Add staff member";
    }
  });

  // ── Save shift ───────────────────────────────────────────────
  document.getElementById("btnSaveShift")?.addEventListener("click", async () => {
    if (!_currentShiftId) return;

    const role     = document.getElementById("shiftRole")?.value     || "";
    const location = document.getElementById("shiftLocation")?.value || "";
    const start    = document.getElementById("shiftStart")?.value    || "";
    const end      = document.getElementById("shiftEnd")?.value      || "";
    const date     = document.getElementById("shiftDate")?.value     || "";
    const btn      = document.getElementById("btnSaveShift");

    if (!date)       { toast("Please pick a date.",              "error"); return; }
    if (!start)      { toast("Please set a start time.",         "error"); return; }
    if (!end)        { toast("Please set an end time.",          "error"); return; }
    if (start >= end){ toast("End time must be after start time.", "error"); return; }

    btn.disabled    = true;
    btn.textContent = "Saving…";

    try {
      // Update the staff document and append to shift history atomically-ish.
      // We do them as two separate writes because Firestore batch writes
      // don't support addDoc (auto-ID). The shift history write is non-critical
      // so we don't block the success toast on it.
      await withRetry(() => updateDoc(doc(db, "staff", _currentShiftId), {
        role, location,
        shiftStart: start,
        shiftEnd:   end,
        shiftDate:  date,
        updatedAt:  serverTimestamp(),
      }));

      // History record — fire and move on; if it fails we log but don't block
      withRetry(() => addDoc(collection(db, "staffShifts"), {
        staffId:    _currentShiftId,
        role, location,
        shiftStart: start,
        shiftEnd:   end,
        shiftDate:  date,
        createdAt:  serverTimestamp(),
      })).catch((err) => console.warn("Shift history write failed:", err));

      toast("Shift saved ✅", "success");
      closeShiftModal();
    } catch (err) {
      console.error("Save shift failed:", err);
      toast("Could not save shift. Please try again.", "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = "Save shift";
    }
  });

  // ── Search + filter ──────────────────────────────────────────
  // Search is debounced; dropdowns fire immediately
  document.getElementById("staffSearch")
    ?.addEventListener("input", applyFiltersDebounced);
  document.getElementById("staffFilterRole")
    ?.addEventListener("change", applyFilters);
  document.getElementById("staffFilterLocation")
    ?.addEventListener("change", applyFilters);

  // ── Edit admin profile (placeholder) ────────────────────────
  document.getElementById("btnEditAdmin")
    ?.addEventListener("click", () => toast("Edit profile coming soon."));
}


// ─── Bootstrap ────────────────────────────────────────────────
initStaff();