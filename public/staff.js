// staff.js — DKcleanedit Staff Management (admin_account.html)
//
// Drives the whole page: auth-guard, sidebar profile, the staff
// directory (list/search/filter/add), shift assignment, and the
// per-staff shift + order history modal.
//
// Firestore schema (see firestore.rules for the matching rules):
//   staff/{staffId}  — name, email, role, location, status, createdAt
//   shifts/{shiftId} — staffId, staffName, role, location, date, start,
//                      end, createdAt
//   orders/{orderId} — already written by app.js; assignedStaff (a
//                      staff member's name) is what links an order back
//                      to a staff member for the history panel here.
//
// Every element id referenced below already exists in admin_account.html
// (see the "IDs match staff.js" comments throughout that file).

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, getDocs, addDoc, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const ADMIN_EMAIL = "dkcleaneditnotts@gmail.com";
const LOCATIONS   = { leicester: "Leicester", "canada-water": "Canada Water" };
const ROLES       = {
  cleaning: "Shoe cleaning", pickup: "Shoe pickup", delivery: "Deliver shoes",
  both: "Pickup + cleaning", manager: "Floor manager",
};

const $ = (id) => document.getElementById(id);

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Toast — same look/queue as app.js's toast() (that file isn't
// loaded on this page, so it's copied rather than duplicated via a
// shared import to keep this page's script list unchanged). ──
const _toastQueue = [];
let _toastRunning = false;
function toast(text, type = "default") {
  _toastQueue.push({ text, type });
  if (!_toastRunning) _drainToasts();
}
function _drainToasts() {
  if (!_toastQueue.length) { _toastRunning = false; return; }
  _toastRunning = true;
  const { text, type } = _toastQueue.shift();
  let host = $("toastHost");
  if (!host) {
    host = Object.assign(document.createElement("div"), { id: "toastHost" });
    document.body.appendChild(host);
  }
  const t = Object.assign(document.createElement("div"), {
    className: `toast toast--${type}`, textContent: text, role: "status",
  });
  t.setAttribute("aria-live", "polite");
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => { t.remove(); _drainToasts(); }, 220);
  }, 2400);
}

// ── State ──
let allStaff     = [];
let allShifts    = [];
let activeStaffId = null; // staff member the shift/history modals are open for

// ── Staff list rendering ──
function staffCard(s) {
  const statusBadge = s.status === "inactive"
    ? `<span class="badge" style="opacity:0.7;">Inactive</span>`
    : `<span class="badge success">Active</span>`;
  const roleLabel = ROLES[s.role] || s.role || "—";
  const locLabel  = LOCATIONS[s.location] || s.location || "—";
  const shiftsToday = allShifts.filter((sh) => sh.staffId === s.id && sh.date === todayISO()).length;

  return `
    <div class="order-card" data-staff-card="${esc(s.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(s.name || "Unnamed")}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="sub">${esc(s.email || "No email")}</div>
      <div class="sub">${esc(roleLabel)} &bull; ${esc(locLabel)}</div>
      ${shiftsToday ? `<div class="sub">Shifts today: <strong>${shiftsToday}</strong></div>` : ""}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button class="btn" type="button" data-assign-shift="${esc(s.id)}">Assign shift</button>
        <button class="btn" type="button" data-view-history="${esc(s.id)}">History</button>
      </div>
    </div>`;
}

function applyFilters() {
  const search = ($("staffSearch")?.value || "").trim().toLowerCase();
  const role   = $("staffFilterRole")?.value || "all";
  const loc    = $("staffFilterLocation")?.value || "all";

  const filtered = allStaff.filter((s) => {
    if (role !== "all" && s.role !== role) return false;
    if (loc  !== "all" && s.location !== loc) return false;
    if (search) {
      const hay = `${s.name || ""} ${s.email || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const listEl  = $("staffList");
  const emptyEl = $("staffEmpty");
  if (listEl) listEl.innerHTML = filtered.map(staffCard).join("");
  if (emptyEl) emptyEl.style.display = filtered.length ? "none" : "block";
}

function updateStats() {
  const total  = allStaff.length;
  const active = allStaff.filter((s) => s.status !== "inactive").length;
  const off    = total - active;
  const today  = todayISO();
  const shiftsToday = allShifts.filter((sh) => sh.date === today).length;

  const set = (id, val) => { const el = $(id); if (el) el.textContent = String(val); };
  set("statTotalStaff",   total);
  set("statActiveStaff",  active);
  set("statOffStaff",     off);
  set("statShiftsToday",  shiftsToday);
}

async function loadShifts() {
  try {
    const snap = await getDocs(collection(db, "shifts"));
    allShifts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Could not load shifts:", err);
    allShifts = [];
  }
}

async function loadStaff() {
  const listEl = $("staffList");
  if (listEl) listEl.innerHTML = `<div class="order-card"><div class="order-title">Loading staff…</div></div>`;
  try {
    const [staffSnap] = await Promise.all([getDocs(collection(db, "staff")), loadShifts()]);
    allStaff = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Could not load staff list:", err);
    allStaff = [];
    toast("Could not load staff list.", "error");
  }
  applyFilters();
  updateStats();
}

// ── Add staff member ──
async function handleAddStaff() {
  const nameEl  = $("newStaffName");
  const emailEl = $("newStaffEmail");
  const roleEl  = $("newStaffRole");
  const locEl   = $("newStaffLocation");
  const statEl  = $("newStaffStatus");
  const btn     = $("btnAddStaff");

  const name  = nameEl?.value.trim();
  const email = emailEl?.value.trim();
  if (!name)  { toast("Enter a name.", "error");  nameEl?.focus();  return; }
  if (!email) { toast("Enter an email.", "error"); emailEl?.focus(); return; }

  if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
  try {
    await addDoc(collection(db, "staff"), {
      name, email,
      role:     roleEl?.value || "cleaning",
      location: locEl?.value  || "leicester",
      status:   statEl?.value || "active",
      createdAt: serverTimestamp(),
    });
    toast(`${name} added to staff ✅`, "success");
    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    document.querySelector('.admin-tab[data-tab="list"]')?.click();
    await loadStaff();
  } catch (err) {
    console.error("Add staff failed:", err);
    toast("Could not add staff member. Check Console (F12).", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Add staff member"; }
  }
}

// ── Shift modal ──
function openShiftModal(staffId) {
  const staffMember = allStaff.find((s) => s.id === staffId);
  if (!staffMember) return;
  activeStaffId = staffId;
  const roleEl = $("shiftRole"), locEl = $("shiftLocation"), dateEl = $("shiftDate");
  if (roleEl) roleEl.value = staffMember.role || "cleaning";
  if (locEl)  locEl.value  = staffMember.location || "leicester";
  if (dateEl) dateEl.value = todayISO();
  const title = $("shiftModalTitle");
  if (title) title.textContent = `Assign shift — ${staffMember.name || "Staff"}`;
  const modal = $("shiftModal");
  if (modal) modal.hidden = false;
}
function closeShiftModal() {
  activeStaffId = null;
  const modal = $("shiftModal");
  if (modal) modal.hidden = true;
}

async function handleSaveShift() {
  if (!activeStaffId) return;
  const staffMember = allStaff.find((s) => s.id === activeStaffId);
  const date  = $("shiftDate")?.value;
  const start = $("shiftStart")?.value || "09:00";
  const end   = $("shiftEnd")?.value   || "17:00";
  if (!date) { toast("Pick a date.", "error"); return; }

  const btn = $("btnSaveShift");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    await addDoc(collection(db, "shifts"), {
      staffId:   activeStaffId,
      staffName: staffMember?.name || "",
      role:      $("shiftRole")?.value || "cleaning",
      location:  $("shiftLocation")?.value || "leicester",
      date, start, end,
      createdAt: serverTimestamp(),
    });
    toast("Shift assigned ✅", "success");
    closeShiftModal();
    await loadShifts();
    applyFilters();
    updateStats();
  } catch (err) {
    console.error("Save shift failed:", err);
    toast("Could not save shift. Check Console (F12).", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save shift"; }
  }
}

// ── History modal — shifts + completed orders for one staff member ──
async function openHistoryModal(staffId) {
  const staffMember = allStaff.find((s) => s.id === staffId);
  if (!staffMember) return;
  const title   = $("historyModalTitle");
  const content = $("historyContent");
  if (title) title.textContent = `Shift & order history — ${staffMember.name || "Staff"}`;
  if (content) content.innerHTML = `<p class="history-empty sub">Loading…</p>`;
  const modal = $("historyModal");
  if (modal) modal.hidden = false;

  const shifts = allShifts
    .filter((sh) => sh.staffId === staffId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  let orders = [];
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), where("assignedStaff", "==", staffMember.name || ""))
    );
    orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch (err) {
    console.warn("Could not load order history:", err);
  }

  if (!content) return;
  if (!shifts.length && !orders.length) {
    content.innerHTML = `<p class="history-empty sub">No shifts or orders on record yet.</p>`;
    return;
  }

  const shiftsHtml = shifts.length ? `
    <div>
      <div class="sub" style="margin-bottom:6px;font-weight:600;">Shifts</div>
      ${shifts.map((sh) => `
        <div class="sub" style="padding:6px 0;border-bottom:1px solid var(--line);">
          ${esc(sh.date)} &bull; ${esc(sh.start)}–${esc(sh.end)} &bull; ${esc(LOCATIONS[sh.location] || sh.location || "")}
        </div>`).join("")}
    </div>` : "";

  const ordersHtml = orders.length ? `
    <div style="margin-top:14px;">
      <div class="sub" style="margin-bottom:6px;font-weight:600;">Orders</div>
      ${orders.map((o) => `
        <div class="sub" style="padding:6px 0;border-bottom:1px solid var(--line);">
          ${esc(o.date || "")} &bull; ${esc(o.customerName || "Customer")} &bull; ${esc(o.status || "")}
        </div>`).join("")}
    </div>` : "";

  content.innerHTML = shiftsHtml + ordersHtml;
}
function closeHistoryModal() {
  const modal = $("historyModal");
  if (modal) modal.hidden = true;
}

// ── Wiring ──
function wireEvents() {
  $("staffSearch")?.addEventListener("input", applyFilters);
  $("staffFilterRole")?.addEventListener("change", applyFilters);
  $("staffFilterLocation")?.addEventListener("change", applyFilters);
  $("btnAddStaff")?.addEventListener("click", handleAddStaff);

  $("staffList")?.addEventListener("click", (e) => {
    const shiftBtn = e.target.closest("[data-assign-shift]");
    if (shiftBtn) { openShiftModal(shiftBtn.dataset.assignShift); return; }
    const histBtn = e.target.closest("[data-view-history]");
    if (histBtn) { openHistoryModal(histBtn.dataset.viewHistory); return; }
  });

  $("btnSaveShift")?.addEventListener("click", handleSaveShift);
  $("btnCancelShift")?.addEventListener("click", closeShiftModal);
  $("shiftModal")?.addEventListener("click", (e) => { if (e.target.id === "shiftModal") closeShiftModal(); });

  $("btnCloseHistory")?.addEventListener("click", closeHistoryModal);
  $("historyModal")?.addEventListener("click", (e) => { if (e.target.id === "historyModal") closeHistoryModal(); });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeShiftModal();
    closeHistoryModal();
  });

  // "Edit profile" opens the shared account-settings page (same one
  // linked from customer.html) rather than duplicating a profile-edit
  // form here.
  $("btnEditAdmin")?.addEventListener("click", () => { location.href = "settings.html"; });
}

// ── Auth guard + sidebar profile — same pattern as analytics.js ──
onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = "login.html?next=admin_account.html";
    return;
  }
  if (!isAdminEmail(user.email)) {
    location.href = "customer.html";
    return;
  }

  const nameEl  = $("adminName");
  const emailEl = $("adminEmail");
  const uidEl   = $("debugUid");
  const roleEl  = $("debugRole");
  if (nameEl)  nameEl.textContent  = user.displayName || "Admin";
  if (emailEl) emailEl.textContent = user.email || "";
  if (uidEl)   uidEl.textContent   = user.uid || "—";
  if (roleEl)  roleEl.textContent  = "Admin";

  const navLogout = $("navLogout");
  if (navLogout) {
    navLogout.hidden = false;
    navLogout.addEventListener("click", (e) => {
      e.preventDefault();
      auth.signOut().then(() => { location.href = "login.html"; });
    });
  }

  wireEvents();
  loadStaff();
});
