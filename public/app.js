/* =========================
   app.js
========================= */

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
  reauthenticateWithCredential
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
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

/* helpers */
const $ = (selector) => document.querySelector(selector);

const storage = getStorage();

const STATUS = [
  "Booked",
  "Received",
  "Cleaning",
  "Drying & Finish",
  "Ready",
  "Completed",
  "Cancelled"
];

const TRACKABLE_STATUS = [
  "Booked",
  "Received",
  "Cleaning",
  "Drying & Finish",
  "Ready",
  "Completed"
];

/* All bookable time slots — single source of truth */
const ALL_TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00"];

const CUSTOMER_EDITABLE_STATUS = ["Booked", "Received"];
const ADMIN_EMAIL = "danielasouzu2@gmail.com";

/* -------------------------
   basic ui helpers
------------------------- */
function setMsg(text, id = "msg") {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function toast(text) {
  const host =
    $("#toastHost") ||
    (() => {
      const d = document.createElement("div");
      d.id = "toastHost";
      document.body.appendChild(d);
      return d;
    })();

  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  host.appendChild(t);

  requestAnimationFrame(() => t.classList.add("show"));

  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 220);
  }, 2200);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function serviceLabel(value) {
  if (value === "standard_clean") return "Standard Cleaning";
  if (value === "express") return "Express Service";
  if (value === "next_day") return "Next Day";
  return value || "";
}

function badgeClass(status) {
  if (status === "Completed") return "badge success";
  if (status === "Cancelled") return "badge danger";
  if (status === "Ready") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === String(ADMIN_EMAIL).trim().toLowerCase();
}

function isCustomerEditableStatus(status) {
  return CUSTOMER_EDITABLE_STATUS.includes(String(status || ""));
}

function isValidDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isValidTimeInput(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* -------------------------
   EmailJS
------------------------- */
async function sendBookingEmail({
  customerName,
  customerEmail,
  orderId,
  service,
  location,
  bookingDate,
  bookingTime,
  price,
  shoeNotes
}) {
  if (!window.emailjs) { console.warn("EmailJS not loaded"); return; }

  await window.emailjs.send("service_6ep5ahh", "template_qca25sq", {
    customer_name:  customerName  || "Customer",
    customer_email: customerEmail || "",
    order_id:       orderId       || "",
    service:        service       || "",
    location:       location      || "",
    booking_date:   bookingDate   || "",
    booking_time:   bookingTime   || "",
    price:          price         || "",
    shoe_notes:     shoeNotes     || ""
  });
}

/* -------------------------
   progress
------------------------- */
function progressPercent(status) {
  if (status === "Cancelled") return 0;
  const index = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  return Math.round((index / (TRACKABLE_STATUS.length - 1)) * 100);
}

function renderStepProgress(status) {
  if (status === "Cancelled") {
    return `<div class="order-tracker">
      ${TRACKABLE_STATUS.map(stage => `
        <div class="step cancelled">
          <span class="circle"></span>
          <span class="label">${esc(stage)}</span>
        </div>`).join("")}
    </div>`;
  }

  const safeIndex = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  return `<div class="order-tracker">
    ${TRACKABLE_STATUS.map((stage, i) => `
      <div class="step ${i <= safeIndex ? "active" : ""}">
        <span class="circle"></span>
        <span class="label">${esc(stage)}</span>
      </div>`).join("")}
  </div>`;
}

/* -------------------------
   auth navigation helpers
------------------------- */
function getNextFromUrl() {
  const url = new URL(location.href);
  const next = url.searchParams.get("next");
  return next ? decodeURIComponent(next) : null;
}

function goLogin(nextFile = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(nextFile)}`;
}

async function getPoints(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? Number(snap.data().points || 0) : 0;
}

function hideSignupOverlay() {
  const o = $("#signupOverlay");
  if (o) o.hidden = true;
}

function showSignupOverlay() {
  const o = $("#signupOverlay");
  if (o) o.hidden = false;
}

function wireOverlayExitButtonsSafe() {
  const overlay = $("#signupOverlay");
  if (!overlay || overlay.dataset.bound === "1") return;
  overlay.dataset.bound = "1";

  const hide = () => { overlay.hidden = true; };
  $("#closePopupBtn")?.addEventListener("click", (e) => { e.preventDefault(); hide(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) hide(); });
}

function wireAuthRequiredLinks() {
  if (document.body.dataset.authLinksBound === "1") return;
  document.body.dataset.authLinksBound = "1";

  document.addEventListener("click", (e) => {
    const link = e.target?.closest?.("a[data-requires-auth='true']");
    if (!link || auth.currentUser) return;
    e.preventDefault();
    goLogin(link.getAttribute("href") || "home.html");
  }, true);
}

async function setupNav(user) {
  const navAdmin    = $("#navAdmin");
  const navLogin    = $("#navLogin");
  const navRegister = $("#navRegister");
  const navLogout   = $("#navLogout");

  if (!user) {
    if (navLogin)    navLogin.hidden    = false;
    if (navRegister) navRegister.hidden = false;
    if (navLogout)   navLogout.hidden   = true;
    if (navAdmin)    navAdmin.hidden    = true;
    return;
  }

  if (navLogin)    navLogin.hidden    = true;
  if (navRegister) navRegister.hidden = true;
  if (navAdmin)    navAdmin.hidden    = !isAdminEmail(user.email);

  if (navLogout && navLogout.dataset.bound !== "1") {
    navLogout.dataset.bound = "1";
    navLogout.hidden = false;
    navLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      toast("Logged out ✅");
      location.replace("home.html");
    });
  } else if (navLogout) {
    navLogout.hidden = false;
  }
}

async function updatePointsBadge(user) {
  const badge = $("#navPointsBadge");
  if (!badge) return;
  if (!user) { badge.hidden = true; return; }

  try {
    const points = await getPoints(user.uid);
    badge.textContent = `Points: ${points}`;
    badge.hidden = false;
  } catch {
    badge.hidden = true;
  }
}

/* -------------------------
   login page
------------------------- */
function initLoginPage() {
  const btnLogin = $("#btnLogin");
  if (!btnLogin || btnLogin.dataset.bound === "1") return;
  btnLogin.dataset.bound = "1";

  const next = getNextFromUrl() || "customer.html";

  btnLogin.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("#logEmail")?.value.trim();
    const pass  = $("#logPass")?.value;

    if (!email || !pass) { setMsg("Enter email and password"); toast("Enter email and password"); return; }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast("Logged in ✅");
      location.replace(next);
    } catch (err) {
      console.error(err);
      if (err?.code === "auth/invalid-credential") {
        setMsg("Wrong email or password, or account not registered.");
        toast("Wrong email or password");
      } else {
        setMsg(err.message || "Login failed");
        toast("Login failed");
      }
    }
  });

  const btnSendReset = $("#btnSendReset");
  if (btnSendReset && btnSendReset.dataset.bound !== "1") {
    btnSendReset.dataset.bound = "1";
    btnSendReset.addEventListener("click", async () => {
      const email = ($("#resetEmail")?.value || $("#logEmail")?.value || "").trim();
      if (!email) { setMsg("Enter your email to reset password"); toast("Enter your email"); return; }
      try {
        await sendPasswordResetEmail(auth, email);
        setMsg("Reset email sent ✅ Check inbox or spam.");
        toast("Reset email sent ✅");
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Could not send reset email");
        toast("Reset failed");
      }
    });
  }
}

/* -------------------------
   register page
------------------------- */
function initRegisterPage() {
  const btnRegister = $("#btnRegister");
  if (!btnRegister || btnRegister.dataset.bound === "1") return;
  btnRegister.dataset.bound = "1";

  const next = getNextFromUrl() || "customer.html";

  btnRegister.addEventListener("click", async (e) => {
    e.preventDefault();
    const name  = $("#regName")?.value.trim();
    const email = $("#regEmail")?.value.trim();
    const phone = $("#regPhone")?.value.trim();
    const pass  = $("#regPass")?.value;

    if (!name || !email || !pass) {
      setMsg("Fill in name, email and password");
      toast("Fill in name, email and password");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        name, email, phone: phone || "", points: 0, createdAt: serverTimestamp()
      });
      toast("Registered ✅");
      location.replace(next);
    } catch (err) {
      console.error(err);
      setMsg(err.message || "Register failed");
      toast("Register failed");
    }
  });
}

/* =========================================================
   AVAILABILITY HELPERS
   Firestore path: availability/{YYYY-MM-DD}
   Document shape: { slots: { "10:00": true, "12:00": false, … } }
   true = open/bookable, false = blocked by admin
   ========================================================= */

/** Fetch availability doc for a given ISO date. Returns slot map or null. */
async function fetchAvailability(dateISO) {
  try {
    const snap = await getDoc(doc(db, "availability", dateISO));
    return snap.exists() ? snap.data().slots || {} : null;
  } catch (err) {
    console.error("fetchAvailability:", err);
    return null;
  }
}

/**
 * Returns the set of slots that are OPEN (admin-available AND not double-booked).
 * Called from the booking page before confirming a slot.
 * @param {string} dateISO   e.g. "2026-04-10"
 * @param {string} location  location value from the select
 * @returns {Promise<string[]>} array of open slot strings e.g. ["10:00","14:00"]
 */
async function getOpenSlots(dateISO, location) {
  // 1. Admin availability (if doc exists, use it; otherwise all slots are open by default)
  const availData = await fetchAvailability(dateISO);

  // 2. Existing bookings for that date + location (non-cancelled)
  const q = query(
    collection(db, "orders"),
    where("date",     "==", dateISO),
    where("location", "==", location)
  );
  const snap = await getDocs(q);
  const bookedSlots = new Set();
  snap.forEach(d => {
    const data = d.data();
    if (data.status !== "Cancelled") bookedSlots.add(data.timeSlot);
  });

  // 3. Filter
  return ALL_TIME_SLOTS.filter(slot => {
    const adminOpen = availData ? availData[slot] !== false : true;
    const notBooked = !bookedSlots.has(slot);
    return adminOpen && notBooked;
  });
}

/**
 * Check whether a specific slot is still available just before confirming.
 * Returns true if free, false if taken or blocked.
 */
async function isSlotAvailable(dateISO, location, timeSlot) {
  const open = await getOpenSlots(dateISO, location);
  return open.includes(timeSlot);
}

/* =========================================================
   BOOKING HELPERS
   ========================================================= */
function getBookingFileInput() {
  return $("#shoeImages") || $("#orderImages") || $("#uploadImages");
}

async function uploadOrderImages(files, orderId) {
  const uploadedUrls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const path    = `orders/${orderId}/${Date.now()}-${i}-${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    uploadedUrls.push(await getDownloadURL(fileRef));
  }
  return uploadedUrls;
}

function getActivePriceSelect() {
  const service = $("#service")?.value;
  if (service === "standard_clean") return $("#standardPrice");
  if (service === "express")        return $("#expressPrice");
  if (service === "next_day")       return $("#nextdayPrice");
  return null;
}

function getSelectedPrice() {
  return getActivePriceSelect()?.value || "";
}

function formatBookingDate(value) {
  if (!value) return "Not selected";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function updateBookingSummary() {
  const ss = $("#summaryService");
  const sl = $("#summaryLocation");
  const sd = $("#summaryDate");
  const st = $("#summaryTime");
  const sp = $("#selectedPriceText");

  if (ss) ss.textContent = serviceLabel($("#service")?.value || "");
  if (sl) sl.textContent = $("#location")?.value || "-";
  if (sd) sd.textContent = formatBookingDate($("#date")?.value || "");
  if (st) st.textContent = $("#timeSlot")?.value || "-";
  if (sp && sp.closest(".summary-row")) sp.textContent = getSelectedPrice() || "£0";
}

function updateSelectedPriceText() {
  const priceText = $("#selectedPriceText");
  if (!priceText) return;
  const price = getSelectedPrice();
  if (priceText.closest(".summary-row")) {
    priceText.textContent = price || "£0";
  } else {
    priceText.textContent = price ? `Selected price: ${price}` : "Selected price:";
  }
  updateBookingSummary();
}

function syncServicePriceUI() {
  const service       = $("#service")?.value;
  const standardGroup = $("#standardPrices");
  const expressGroup  = $("#expressPrices");
  const nextdayGroup  = $("#nextdayPrices");
  if (!standardGroup || !expressGroup || !nextdayGroup) return;

  standardGroup.hidden = service !== "standard_clean";
  expressGroup.hidden  = service !== "express";
  nextdayGroup.hidden  = service !== "next_day";

  updateSelectedPriceText();
  updateBookingSummary();
}

function initServicePriceSync() {
  const serviceEl = $("#service");
  if (!serviceEl || serviceEl.dataset.boundPrice === "1") return;
  serviceEl.dataset.boundPrice = "1";
  serviceEl.addEventListener("change", syncServicePriceUI);

  ["#standardPrice","#expressPrice","#nextdayPrice"].forEach(sel => {
    const el = $(sel);
    if (!el || el.dataset.boundPrice === "1") return;
    el.dataset.boundPrice = "1";
    el.addEventListener("change", () => { updateSelectedPriceText(); updateBookingSummary(); });
  });

  syncServicePriceUI();
}

/* =========================================================
   CALENDAR UI  (booking page)
   ========================================================= */
function initCalendarUI() {
  const calBody    = document.getElementById("calBody");
  const calLabel   = document.getElementById("calMonthLabel");
  const dateLabel  = document.getElementById("selectedDateLabel");
  const hiddenDate = document.getElementById("date");
  const prevBtn    = document.getElementById("calPrev");
  const nextBtn    = document.getElementById("calNext");

  if (!calBody || !prevBtn || !nextBtn) return;
  if (calBody.dataset.appBound === "1") return;
  calBody.dataset.appBound = "1";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = null;

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  function formatDisplay(d) {
    return d.toLocaleDateString("en-GB", {
      weekday:"long", day:"numeric", month:"long", year:"numeric"
    });
  }

  async function buildCalendar() {
    if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    calBody.innerHTML = "";

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className   = "cal-cell cal-cell--other";
      cell.textContent = daysInPrev - firstDay + 1 + i;
      calBody.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell     = document.createElement("div");
      cell.className = "cal-cell";
      cell.textContent = d;

      const thisDate = new Date(viewYear, viewMonth, d);
      thisDate.setHours(0, 0, 0, 0);

      if (thisDate < today) {
        cell.classList.add("cal-cell--past");
      } else {
        cell.addEventListener("click", () => selectDate(thisDate));
      }

      if (thisDate.toDateString() === today.toDateString()) cell.classList.add("cal-cell--today");
      if (selectedDate && thisDate.toDateString() === selectedDate.toDateString()) cell.classList.add("cal-cell--selected");

      calBody.appendChild(cell);
    }

    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement("div");
      cell.className   = "cal-cell cal-cell--other";
      cell.textContent = i;
      calBody.appendChild(cell);
    }
  }

  async function selectDate(date) {
    selectedDate = date;
    const iso = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;

    if (hiddenDate) {
      hiddenDate.value = iso;
      hiddenDate.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (dateLabel) dateLabel.textContent = formatDisplay(date);

    await buildCalendar();
    updateBookingSummary();

    // Refresh time slots to reflect availability + bookings for this date
    await refreshTimeSlots(iso);
  }

  prevBtn.addEventListener("click", async () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    await buildCalendar();
  });

  nextBtn.addEventListener("click", async () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    await buildCalendar();
  });

  if (hiddenDate?.value && isValidDateInput(hiddenDate.value)) {
    const parts = hiddenDate.value.split("-");
    const pre   = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
    pre.setHours(0,0,0,0);
    selectedDate = pre;
    viewYear     = pre.getFullYear();
    viewMonth    = pre.getMonth();
  }

  buildCalendar();
}

/**
 * Refresh the visible time slot buttons based on admin availability
 * and existing bookings for the selected date + location.
 */
async function refreshTimeSlots(dateISO) {
  const locationEl = $("#location");
  const location   = locationEl?.value || "";
  const timeButtons = document.querySelectorAll(".time-slot");
  if (!timeButtons.length) return;

  const openSlots = await getOpenSlots(dateISO, location);

  timeButtons.forEach(btn => {
    const slot = btn.getAttribute("data-time");
    const isOpen = openSlots.includes(slot);

    btn.disabled = !isOpen;
    btn.title    = isOpen ? "" : "This slot is unavailable";

    if (!isOpen) {
      btn.classList.remove("active");
      btn.classList.add("slot-unavailable");
      btn.style.opacity        = "0.4";
      btn.style.cursor         = "not-allowed";
      btn.style.textDecoration = "line-through";
    } else {
      btn.classList.remove("slot-unavailable");
      btn.style.opacity        = "";
      btn.style.cursor         = "";
      btn.style.textDecoration = "";
    }
  });

  // If the currently selected time slot became unavailable, deselect it
  const timeSlotSelect = $("#timeSlot");
  if (timeSlotSelect && !openSlots.includes(timeSlotSelect.value)) {
    timeButtons.forEach(b => b.classList.remove("active"));
    timeSlotSelect.value = "";
    updateBookingSummary();
  }
}

/* =========================================================
   SHOE IMAGE PREVIEW
   ========================================================= */
function initShoeImagePreview() {
  const input       = $("#shoeImages");
  const previewImg  = $("#shoePreview");
  const previewWrap = $("#shoePreviewWrap");

  if (!input || input.dataset.previewBound === "1") return;
  input.dataset.previewBound = "1";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file || !previewImg || !previewWrap) return;
    const reader = new FileReader();
    reader.onload = (e) => { previewImg.src = e.target.result; previewWrap.hidden = false; };
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   PROFESSIONAL BOOKING UI
   ========================================================= */
function initProfessionalBookingUI() {
  const serviceSelect  = $("#service");
  const timeSlotSelect = $("#timeSlot");
  const locationSelect = $("#location");
  const dateInput      = $("#date");

  const serviceCards = document.querySelectorAll("[data-service-card]");
  const timeButtons  = document.querySelectorAll(".time-slot");

  if (serviceCards.length) {
    serviceCards.forEach(card => {
      if (card.dataset.bound === "1") return;
      card.dataset.bound = "1";
      card.addEventListener("click", () => {
        const value = card.getAttribute("data-service-card");
        if (!value || !serviceSelect) return;
        serviceCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        serviceSelect.value = value;
        serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
        updateBookingSummary();
      });
    });
  }

  if (timeButtons.length) {
    timeButtons.forEach(btn => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const value = btn.getAttribute("data-time");
        if (!value || !timeSlotSelect) return;
        timeButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        timeSlotSelect.value = value;
        timeSlotSelect.dispatchEvent(new Event("change", { bubbles: true }));
        updateBookingSummary();
      });
    });
  }

  if (serviceSelect && serviceSelect.dataset.summaryBound !== "1") {
    serviceSelect.dataset.summaryBound = "1";
    serviceSelect.addEventListener("change", () => {
      const current = serviceSelect.value;
      serviceCards.forEach(card => {
        const isActive = card.getAttribute("data-service-card") === current;
        card.classList.toggle("active", isActive);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isActive;
      });
      updateBookingSummary();
    });
  }

  if (timeSlotSelect && timeSlotSelect.dataset.summaryBound !== "1") {
    timeSlotSelect.dataset.summaryBound = "1";
    timeSlotSelect.addEventListener("change", () => {
      const current = timeSlotSelect.value;
      timeButtons.forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-time") === current));
      updateBookingSummary();
    });
  }

  if (locationSelect && locationSelect.dataset.summaryBound !== "1") {
    locationSelect.dataset.summaryBound = "1";
    locationSelect.addEventListener("change", () => {
      updateBookingSummary();
      // Re-check slots when location changes
      const dateISO = dateInput?.value;
      if (dateISO && isValidDateInput(dateISO)) refreshTimeSlots(dateISO);
    });
  }

  if (dateInput && dateInput.dataset.summaryBound !== "1") {
    dateInput.dataset.summaryBound = "1";
    dateInput.addEventListener("change", updateBookingSummary);
  }

  updateBookingSummary();
}

function initBookingMap() {
  const locationSelect = $("#location");
  const branchName     = $("#selectedBranchName");
  const branchAddress  = $("#selectedBranchAddress");
  const mapFrame       = $("#bookingMapFrame");
  const openMapsBtn    = $("#openMapsBtn");

  if (!locationSelect || locationSelect.dataset.mapBound === "1") return;
  locationSelect.dataset.mapBound = "1";

  const locations = {
    charles_street_leicester: {
      name:      "Charles Street, Leicester",
      address:   "Charles Street, Leicester, UK",
      mapsLink:  "https://www.google.com/maps/search/?api=1&query=Charles+Street+Leicester+UK",
      embed:     "https://www.google.com/maps?q=Charles%20Street%20Leicester%20UK&z=15&output=embed"
    },
    canada_water: {
      name:      "Canada Water, London",
      address:   "Canada Water, London, UK",
      mapsLink:  "https://www.google.com/maps/search/?api=1&query=Canada+Water+London+UK",
      embed:     "https://www.google.com/maps?q=Canada%20Water%20London%20UK&z=15&output=embed"
    }
  };

  function updateMap() {
    const selected = locations[locationSelect.value];
    if (!selected) return;
    if (branchName)    branchName.textContent   = selected.name;
    if (branchAddress) branchAddress.textContent = selected.address;
    if (mapFrame)      mapFrame.src              = selected.embed;
    if (openMapsBtn)   openMapsBtn.href          = selected.mapsLink;
  }

  locationSelect.addEventListener("change", updateMap);
  updateMap();
}

function initCustomerNameAutofill() {
  const input = $("#customerName");
  if (!input || input.dataset.bound === "1") return;
  input.dataset.bound = "1";

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const snap     = await getDoc(doc(db, "users", user.uid));
      const userData = snap.exists() ? snap.data() : {};
      if (!input.value.trim()) input.value = userData.name || user.displayName || "";
    } catch (err) { console.error(err); }
  });
}

/* =========================================================
   BOOKING PAGE
   ========================================================= */
function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook || btnBook.dataset.bound === "1") return;
  btnBook.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  initServicePriceSync();
  initProfessionalBookingUI();
  initCalendarUI();
  initShoeImagePreview();
  initBookingMap();
  initCustomerNameAutofill();
  updateBookingSummary();

  const btnGoTrack = $("#btnGoTrack");
  if (btnGoTrack && btnGoTrack.dataset.bound !== "1") {
    btnGoTrack.dataset.bound = "1";
    btnGoTrack.addEventListener("click", () => {
      if (!auth.currentUser) return goLogin("track.html");
      location.href = "track.html";
    });
  }

  const btnGoAdmin = $("#btnGoAdmin");
  if (btnGoAdmin && btnGoAdmin.dataset.bound !== "1") {
    btnGoAdmin.dataset.bound = "1";
    btnGoAdmin.addEventListener("click", () => {
      if (!auth.currentUser) return goLogin("admin.html");
      location.href = "admin.html";
    });
  }

  btnBook.addEventListener("click", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) { showSignupOverlay(); toast("Please log in or register to book."); return; }
    hideSignupOverlay();

    const manualCustomerName = $("#customerName")?.value.trim();
    const service            = $("#service")?.value;
    const locationVal        = $("#location")?.value;
    const date               = $("#date")?.value;
    const timeSlot           = $("#timeSlot")?.value;
    const selectedPrice      = getSelectedPrice();
    const shoeNotes          = $("#shoeNotes")?.value.trim() || "";
    const imageInput         = getBookingFileInput();
    const imageFiles         = imageInput?.files ? Array.from(imageInput.files) : [];

    if (!service || !locationVal || !date || !timeSlot || !selectedPrice) {
      setMsg("Select service, location, date, time and price");
      toast("Select service, location, date, time and price");
      return;
    }

    // ── Double-booking check ──────────────────────────────
    try {
      btnBook.disabled    = true;
      btnBook.textContent = "Checking availability…";

      const available = await isSlotAvailable(date, locationVal, timeSlot);
      if (!available) {
        setMsg("Sorry, that slot is no longer available. Please choose another time.");
        toast("Slot unavailable — please pick another time");
        // Refresh the calendar slots so customer sees updated state
        await refreshTimeSlots(date);
        return;
      }
    } catch (err) {
      console.error("Availability check failed:", err);
      // Don't block booking if availability check errors — proceed with caution
    }

    try {
      btnBook.textContent = "Processing...";

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const finalCustomerName  = manualCustomerName || userData.name  || user.displayName || "Customer";
      const finalCustomerEmail = userData.email     || user.email     || "";
      const finalCustomerPhone = userData.phone     || "";

      const order = {
        uid: user.uid,
        customerName:  finalCustomerName,
        customerEmail: finalCustomerEmail,
        customerPhone: finalCustomerPhone,
        service,
        serviceLabel: serviceLabel(service),
        location: locationVal,
        date,
        timeSlot,
        price: selectedPrice,
        shoeNotes,
        status: "Booked",
        pointsAwarded: 10,
        pointsGranted: false,
        grantedPointsAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const orderRef = await addDoc(collection(db, "orders"), order);

      if (imageFiles.length) {
        try {
          const urls = await uploadOrderImages(imageFiles, orderRef.id);
          await updateDoc(orderRef, { imageUrls: urls, updatedAt: serverTimestamp() });
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          toast("Booking saved, but image upload failed");
        }
      }

      try {
        await sendBookingEmail({
          customerName:  finalCustomerName,
          customerEmail: finalCustomerEmail,
          orderId:       orderRef.id,
          service:       serviceLabel(service),
          location:      locationVal,
          bookingDate:   date,
          bookingTime:   timeSlot,
          price:         selectedPrice,
          shoeNotes
        });
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        toast("Booking saved, but email failed to send");
      }

      toast("Booking confirmed ✅");
      setMsg(`Order ID: ${orderRef.id}`);
      updateBookingSummary();
      setTimeout(() => { location.href = "track.html"; }, 700);

    } catch (err) {
      console.error(err);
      setMsg("Booking failed");
      toast("Booking failed");
    } finally {
      btnBook.disabled    = false;
      btnBook.textContent = "Confirm booking";
    }
  });
}

/* =========================================================
   ORDER RENDERING
   ========================================================= */
function renderOrderActions(order) {
  if (!isCustomerEditableStatus(order.status)) return "";
  return `
    <div class="order-actions">
      <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
      <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
    </div>`;
}

function renderOrderCard(order) {
  const pct = progressPercent(order.status || "Booked");
  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(serviceLabel(order.service))} • ${esc(order.location)}</div>
          <div class="sub">${esc(order.date)} • ${esc(order.timeSlot)} • ${esc(order.price || "")}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>
      ${renderStepProgress(order.status || "Booked")}
      <div class="order-meta">
        <span class="sub">Order ID: ${esc(order.id)}</span>
        <span class="sub">${pct}%</span>
      </div>
      ${renderOrderActions(order)}
    </div>`;
}

/* =========================================================
   CUSTOMER ORDER ACTIONS
   ========================================================= */
async function cancelOrderByCustomer(orderId, user) {
  const ref  = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { toast("Order not found"); return; }
  const data = snap.data();
  if (data.uid !== user.uid && !isAdminEmail(user.email)) { toast("Not allowed"); return; }
  if (!isCustomerEditableStatus(data.status)) { toast("This order can no longer be cancelled"); return; }
  if (!confirm("Cancel this booking?")) return;
  await updateDoc(ref, { status: "Cancelled", updatedAt: serverTimestamp() });
  toast("Booking cancelled");
}

async function rescheduleOrderByCustomer(orderId, user) {
  const ref  = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { toast("Order not found"); return; }
  const data = snap.data();
  if (data.uid !== user.uid && !isAdminEmail(user.email)) { toast("Not allowed"); return; }
  if (!isCustomerEditableStatus(data.status)) { toast("This order can no longer be rescheduled"); return; }

  const newDate = prompt("Enter new date (YYYY-MM-DD)", data.date || "");
  if (newDate === null) return;
  const newTime = prompt("Enter new time (HH:MM)", data.timeSlot || "");
  if (newTime === null) return;

  const cleanDate = String(newDate).trim();
  const cleanTime = String(newTime).trim();
  if (!isValidDateInput(cleanDate) || !isValidTimeInput(cleanTime)) { toast("Use YYYY-MM-DD and HH:MM"); return; }

  // Double-booking check for reschedule
  const available = await isSlotAvailable(cleanDate, data.location, cleanTime);
  if (!available) { toast("That slot is already taken. Please choose another."); return; }

  await updateDoc(ref, { date: cleanDate, timeSlot: cleanTime, updatedAt: serverTimestamp() });
  toast("Booking rescheduled");
}

function wireCustomerOrderActions(listEl) {
  if (!listEl || listEl.dataset.orderActionsBound === "1") return;
  listEl.dataset.orderActionsBound = "1";

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action  = btn.getAttribute("data-action");
    const orderId = btn.getAttribute("data-id");
    const user    = auth.currentUser;
    if (!user) { goLogin(); return; }
    try {
      if (action === "cancel")      await cancelOrderByCustomer(orderId, user);
      if (action === "reschedule")  await rescheduleOrderByCustomer(orderId, user);
    } catch (err) {
      console.error(err);
      toast(action === "cancel" ? "Cancel failed" : "Reschedule failed");
    }
  });
}

/* =========================================================
   TRACKING PAGE
   ========================================================= */
function initTracking() {
  const ordersEl = $("#orders");
  if (!ordersEl || ordersEl.dataset.bound === "1") return;
  ordersEl.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  wireCustomerOrderActions(ordersEl);

  ordersEl.innerHTML = `<div class="order-card"><div class="order-title">Loading…</div><p class="sub">Checking your active orders.</p></div>`;

  let unsubOrders = null;
  const HISTORY_STATUSES = ["Completed","Delivered","Collected","Cancelled"];

  function normalizeStatus(s) { return String(s || "").trim().toLowerCase(); }
  function isHistoryOrder(o)  { return HISTORY_STATUSES.map(s => s.toLowerCase()).includes(normalizeStatus(o.status)); }
  function isActiveOrder(o)   { return !isHistoryOrder(o); }

  onAuthStateChanged(auth, (user) => {
    if (typeof unsubOrders === "function") { unsubOrders(); unsubOrders = null; }

    if (!user) {
      showSignupOverlay();
      ordersEl.innerHTML = `<div class="order-card"><div class="order-title">Please log in</div><p class="sub">You must be signed in to see tracking.</p><a class="btn primary" href="login.html?next=track.html">Go to Login</a></div>`;
      return;
    }
    hideSignupOverlay();

    const q = query(collection(db, "orders"), where("uid", "==", user.uid));
    unsubOrders = onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const activeItems  = items.filter(isActiveOrder);
      const historyItems = items.filter(isHistoryOrder);

      ordersEl.innerHTML = activeItems.length
        ? activeItems.map(renderOrderCard).join("")
        : `<div class="order-card">
            <div class="order-title">No current orders</div>
            <p class="sub">${historyItems.length ? "Your previous orders are in My Account > Order History." : "Book a service to get started."}</p>
            <div class="stack-sm">
              <a class="btn primary" href="booking.html">Go to Booking</a>
              <a class="btn secondary" href="customer.html">My Account</a>
            </div>
          </div>`;
    }, (err) => { console.error(err); setMsg("Tracking failed"); toast("Tracking failed"); });
  });

  const btnRefresh = $("#btnRefresh");
  if (btnRefresh && btnRefresh.dataset.bound !== "1") {
    btnRefresh.dataset.bound = "1";
    btnRefresh.addEventListener("click", () => toast("Tracking is live ✅"));
  }
}

/* =========================================================
   CUSTOMER PAGE
   ========================================================= */
function initCustomer() {
  const page = $("#custOrders") || $("#btnChangePass") || $("#custName");
  if (!page || page.dataset.customerInit === "1") return;
  page.dataset.customerInit = "1";

  const nameEl         = $("#custName");
  const emailEl        = $("#custEmail");
  const ptsEl          = $("#custPoints");
  const listEl         = $("#custOrders");
  const btnCustRefresh = $("#btnCustRefresh");
  const btnChangePass  = $("#btnChangePass");

  let unsub = null;
  if (btnCustRefresh && btnCustRefresh.dataset.bound !== "1") {
    btnCustRefresh.dataset.bound = "1";
    btnCustRefresh.addEventListener("click", () => toast("Account is live ✅"));
  }
  if (listEl) wireCustomerOrderActions(listEl);

  onAuthStateChanged(auth, async (user) => {
    if (typeof unsub === "function") { unsub(); unsub = null; }
    if (!user) { goLogin("customer.html"); return; }

    const snap     = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    if (nameEl)  nameEl.textContent  = userData.name  || user.displayName || "-";
    if (emailEl) emailEl.textContent = userData.email || user.email       || "-";
    if (ptsEl)   ptsEl.textContent   = String(userData.points || 0);

    if (listEl) {
      const q = query(collection(db, "orders"), where("uid", "==", user.uid));
      unsub = onSnapshot(q, (snap2) => {
        const items = [];
        snap2.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        listEl.innerHTML = items.slice(0,4).map(renderOrderCard).join("") ||
          `<div class="order-card"><div class="order-title">No orders yet</div><p class="sub">Book a service to start.</p></div>`;
      });
    }

    if (btnChangePass && btnChangePass.dataset.bound !== "1") {
      btnChangePass.dataset.bound = "1";
      btnChangePass.addEventListener("click", async () => {
        const curPass = $("#curPass")?.value || "";
        const newPass = $("#newPass")?.value || "";
        if (!curPass || !newPass) { setMsg("Enter current and new password", "passMsg"); toast("Enter current and new password"); return; }
        try {
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, curPass));
          await updatePassword(user, newPass);
          setMsg("Password updated ✅", "passMsg");
          toast("Password updated ✅");
          if ($("#curPass")) $("#curPass").value = "";
          if ($("#newPass")) $("#newPass").value = "";
        } catch (err) {
          console.error(err);
          setMsg(err.message || "Password update failed", "passMsg");
          toast("Password update failed");
        }
      });
    }
  });
}

/* =========================================================
   ADMIN HELPERS
   ========================================================= */
function getOrderImageUrls(order) {
  const urls = [];
  ["imageUrl","photoUrl","uploadUrl","beforeImage","beforeImageUrl","customerImage","customerImageUrl"]
    .forEach(f => { const v = order?.[f]; if (typeof v === "string" && v.trim()) urls.push(v.trim()); });
  ["imageUrls","photos","uploads","images"]
    .forEach(f => { const v = order?.[f]; if (Array.isArray(v)) v.forEach(u => { if (typeof u === "string" && u.trim()) urls.push(u.trim()); }); });
  return [...new Set(urls)];
}

function renderAdminImages(order) {
  const urls = getOrderImageUrls(order);
  if (!urls.length) return "";
  return `<div class="admin-images" style="margin-top:12px;">
    <div class="sub" style="margin-bottom:8px;">Customer Uploads</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${urls.map((url, i) => `
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Open image ${i+1}">
          <img src="${esc(url)}" alt="Customer upload ${i+1}"
            style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);"
            loading="lazy"/>
        </a>`).join("")}
    </div>
  </div>`;
}

function renderAdminOrderCard(order, currentUser, conflictFlag = false) {
  const isAdmin     = isAdminEmail(currentUser?.email);
  const orderStatus = order.status || "Booked";
  const imageUrls   = getOrderImageUrls(order);

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title" style="display:flex;align-items:center;gap:8px;">
            ${esc(order.customerName || "Customer")} • ${esc(serviceLabel(order.service))}
            ${conflictFlag ? `<span class="conflict-badge">⚠ Conflict</span>` : ""}
          </div>
          <div class="sub">${esc(order.customerEmail || "")}${order.customerPhone ? ` • ${esc(order.customerPhone)}` : ""}</div>
          <div class="sub">${esc(order.location || "")}</div>
          <div class="sub">${esc(order.date || "")} • ${esc(order.timeSlot || "")} • ${esc(order.price || "")}</div>
          <div class="sub">Order ID: ${esc(order.id)}</div>
        </div>
        <span class="${badgeClass(orderStatus)}">${esc(orderStatus)}</span>
      </div>

      ${renderStepProgress(orderStatus)}
      ${renderAdminImages(order)}

      ${isAdmin ? `
        <div class="admin-row" style="margin-top:14px;">
          <div class="admin-field">
            <label class="sub" for="status-${esc(order.id)}">Status</label>
            <select id="status-${esc(order.id)}" class="admin-status" data-id="${esc(order.id)}">
              ${STATUS.map(s => `<option value="${esc(s)}" ${orderStatus === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
            </select>
          </div>
          <div class="admin-field">
            <label class="sub" for="points-${esc(order.id)}">Points to award</label>
            <input id="points-${esc(order.id)}" class="admin-points" data-id="${esc(order.id)}"
              type="number" min="0" step="1" value="${esc(order.pointsAwarded ?? 10)}" />
          </div>
          <div class="admin-field admin-field-btn">
            <button class="btn primary" type="button" data-admin-save="${esc(order.id)}">Save</button>
          </div>
        </div>
        <div class="order-meta" style="margin-top:10px;">
          <span class="sub">Points granted: ${order.pointsGranted ? "Yes" : "No"}</span>
          <span class="sub">Images: ${imageUrls.length}</span>
        </div>` : ""}
    </div>`;
}

function updateAdminStats(orders) {
  const totalEl      = $("#adminTotalOrders");
  const openEl       = $("#adminOpenOrders");
  const completedEl  = $("#adminCompletedOrders");
  const withImagesEl = $("#adminWithImages");

  if (totalEl)      totalEl.textContent      = String(orders.length);
  if (openEl)       openEl.textContent       = String(orders.filter(o => !["Completed","Cancelled"].includes(o.status)).length);
  if (completedEl)  completedEl.textContent  = String(orders.filter(o => o.status === "Completed").length);
  if (withImagesEl) withImagesEl.textContent = String(orders.filter(o => getOrderImageUrls(o).length > 0).length);
}

function renderAdminAnalytics(orders) {
  const parseMoney = v => { const n = parseFloat(String(v || "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

  const completedOrders = orders.filter(o => o.status === "Completed");
  const revenue = completedOrders.reduce((sum, o) => sum + parseMoney(o.price), 0);

  const statusCounts = { Booked:0, Received:0, Cleaning:0, "Drying & Finish":0, Ready:0, Completed:0, Cancelled:0 };
  const locationCounts = {}, serviceCounts = {};

  orders.forEach(o => {
    const s = o.status || "Booked";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    const loc = o.location || "Unknown";
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    const svc = serviceLabel(o.service || o.serviceLabel || "Unknown");
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  });

  const s = id => document.getElementById(id);
  if (s("adminRevenue"))   s("adminRevenue").textContent   = `£${revenue.toFixed(2)}`;
  if (s("adminBookedCount"))   s("adminBookedCount").textContent   = String(statusCounts.Booked   || 0);
  if (s("adminReceivedCount")) s("adminReceivedCount").textContent = String(statusCounts.Received || 0);
  if (s("adminCleaningCount")) s("adminCleaningCount").textContent = String((statusCounts.Cleaning || 0) + (statusCounts["Drying & Finish"] || 0));
  if (s("adminReadyCount"))    s("adminReadyCount").textContent    = String((statusCounts.Ready || 0) + (statusCounts.Completed || 0));
  if (s("adminCancelledCount")) s("adminCancelledCount").textContent = String(statusCounts.Cancelled || 0);

  const lbEl = s("adminLocationBreakdown");
  if (lbEl) lbEl.innerHTML = Object.entries(locationCounts).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<div class="sub">${esc(n)}: ${c}</div>`).join("");
  const sbEl = s("adminServiceBreakdown");
  if (sbEl) sbEl.innerHTML = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<div class="sub">${esc(n)}: ${c}</div>`).join("");
}

async function saveAdminOrder(orderId) {
  const statusEl = document.querySelector(`.admin-status[data-id="${orderId}"]`);
  const pointsEl = document.querySelector(`.admin-points[data-id="${orderId}"]`);
  if (!statusEl || !pointsEl) { toast("Missing admin fields"); return; }

  const status        = statusEl.value;
  const pointsAwarded = Math.max(0, Number(pointsEl.value || 0));

  const orderRef = doc(db, "orders", orderId);
  const snap     = await getDoc(orderRef);
  if (!snap.exists()) { toast("Order not found"); return; }

  const prev                    = snap.data();
  const previouslyGrantedAmount = Number(prev.grantedPointsAmount || 0);
  const nextGrantedAmount       = status === "Completed" ? pointsAwarded : 0;
  const delta                   = nextGrantedAmount - previouslyGrantedAmount;

  if (prev.uid && delta !== 0) {
    await setDoc(doc(db, "users", prev.uid), { points: increment(delta) }, { merge: true });
  }

  await updateDoc(orderRef, {
    status, pointsAwarded,
    pointsGranted: nextGrantedAmount > 0,
    grantedPointsAmount: nextGrantedAmount,
    updatedAt: serverTimestamp()
  });

  toast("Order updated ✅");
}

/* =========================================================
   DETECT CONFLICTS  (double bookings)
   Two orders conflict if: same date + same timeSlot + same location
   and neither is Cancelled.
   ========================================================= */
function findConflicts(orders) {
  const active = orders.filter(o => o.status !== "Cancelled");
  const map    = {};

  active.forEach(o => {
    const key = `${o.date}__${o.timeSlot}__${o.location}`;
    if (!map[key]) map[key] = [];
    map[key].push(o);
  });

  // Return groups with more than one booking
  return Object.values(map).filter(group => group.length > 1);
}

/* =========================================================
   ADMIN AVAILABILITY MANAGER  (sidebar calendar)
   ========================================================= */
function initAdminAvailability() {
  const calBody   = document.getElementById("availCalBody");
  const calLabel  = document.getElementById("availMonthLabel");
  const prevBtn   = document.getElementById("availPrev");
  const nextBtn   = document.getElementById("availNext");
  const editor    = document.getElementById("availSlotEditor");
  const selLabel  = document.getElementById("availSelectedLabel");
  const slotGrid  = document.getElementById("availSlotGrid");
  const btnOpen   = document.getElementById("btnAvailOpenAll");
  const btnClose  = document.getElementById("btnAvailCloseAll");
  const btnSave   = document.getElementById("btnAvailSave");

  if (!calBody) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDateISO = null;

  // Local state: { [dateISO]: { [slot]: boolean } }
  // true = open, false = closed
  let availCache = {};

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  function formatDisplay(d) {
    return d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
  }

  /** Load availability from Firestore for the current view month */
  async function loadMonthAvailability() {
    // Load all docs for current month range
    const year  = String(viewYear);
    const month = pad(viewMonth + 1);
    const start = `${year}-${month}-01`;
    const end   = `${year}-${month}-31`; // Firestore will just stop at real last day

    try {
      // We query the availability collection for docs in this month
      const q = query(
        collection(db, "availability"),
        where("__name__", ">=", start),
        where("__name__", "<=", end)
      );
      const snap = await getDocs(q);
      snap.forEach(d => { availCache[d.id] = d.data().slots || {}; });
    } catch (err) {
      console.error("loadMonthAvailability:", err);
    }
  }

  /** Get slot map for a date, defaulting to all-open if no doc */
  function getSlotsForDate(dateISO) {
    if (availCache[dateISO]) return { ...availCache[dateISO] };
    // Default: all slots open
    const defaults = {};
    ALL_TIME_SLOTS.forEach(s => { defaults[s] = true; });
    return defaults;
  }

  /** How many open slots on a date (for calendar cell indicator) */
  function openSlotCount(dateISO) {
    const slots = getSlotsForDate(dateISO);
    return ALL_TIME_SLOTS.filter(s => slots[s] !== false).length;
  }

  async function buildCalendar() {
    if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonthAvailability();
    calBody.innerHTML = "";

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className   = "avail-cell avail-cell--other";
      cell.textContent = daysInPrev - firstDay + 1 + i;
      calBody.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell     = document.createElement("div");
      cell.className = "avail-cell";

      const thisDate = new Date(viewYear, viewMonth, d);
      thisDate.setHours(0,0,0,0);
      const iso = `${viewYear}-${pad(viewMonth+1)}-${pad(d)}`;

      cell.textContent = d;

      if (thisDate < today) {
        cell.classList.add("avail-cell--past");
      } else {
        const open  = openSlotCount(iso);
        const total = ALL_TIME_SLOTS.length;
        if (open === 0)     cell.classList.add("avail-cell--closed");
        else if (open > 0)  cell.classList.add("avail-cell--open");

        cell.addEventListener("click", () => selectAvailDate(iso, thisDate));
      }

      if (thisDate.toDateString() === today.toDateString()) cell.classList.add("avail-cell--today");
      if (selectedDateISO === iso) cell.classList.add("avail-cell--selected");

      calBody.appendChild(cell);
    }

    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement("div");
      cell.className   = "avail-cell avail-cell--other";
      cell.textContent = i;
      calBody.appendChild(cell);
    }
  }

  function selectAvailDate(iso, dateObj) {
    selectedDateISO = iso;
    buildCalendar(); // re-render to show selected highlight
    renderSlotEditor(iso, dateObj);
  }

  function renderSlotEditor(iso, dateObj) {
    if (!editor || !slotGrid || !selLabel) return;
    editor.style.display = "block";
    selLabel.textContent = formatDisplay(dateObj);
    slotGrid.innerHTML   = "";

    const slots = getSlotsForDate(iso);

    ALL_TIME_SLOTS.forEach(slot => {
      const isOpen = slots[slot] !== false;
      const btn    = document.createElement("button");
      btn.type      = "button";
      btn.className = `avail-slot-btn ${isOpen ? "slot-open" : "slot-closed"}`;
      btn.innerHTML = `<span class="avail-slot-dot"></span>${slot}`;
      btn.dataset.slot = slot;

      btn.addEventListener("click", () => {
        // Toggle
        if (!availCache[iso]) availCache[iso] = getSlotsForDate(iso);
        availCache[iso][slot] = !isOpen;
        renderSlotEditor(iso, dateObj); // re-render editor
        buildCalendar();                // update calendar indicators
      });

      slotGrid.appendChild(btn);
    });
  }

  btnOpen?.addEventListener("click", () => {
    if (!selectedDateISO) return;
    if (!availCache[selectedDateISO]) availCache[selectedDateISO] = getSlotsForDate(selectedDateISO);
    ALL_TIME_SLOTS.forEach(s => { availCache[selectedDateISO][s] = true; });
    const d = new Date(selectedDateISO + "T00:00:00");
    renderSlotEditor(selectedDateISO, d);
    buildCalendar();
  });

  btnClose?.addEventListener("click", () => {
    if (!selectedDateISO) return;
    if (!availCache[selectedDateISO]) availCache[selectedDateISO] = getSlotsForDate(selectedDateISO);
    ALL_TIME_SLOTS.forEach(s => { availCache[selectedDateISO][s] = false; });
    const d = new Date(selectedDateISO + "T00:00:00");
    renderSlotEditor(selectedDateISO, d);
    buildCalendar();
  });

  btnSave?.addEventListener("click", async () => {
    if (!selectedDateISO) { toast("Select a date first"); return; }
    btnSave.disabled    = true;
    btnSave.textContent = "Saving…";
    try {
      const slots = availCache[selectedDateISO] || getSlotsForDate(selectedDateISO);
      await setDoc(doc(db, "availability", selectedDateISO), {
        slots,
        updatedAt: serverTimestamp()
      });
      toast(`Availability saved for ${selectedDateISO} ✅`);
      buildCalendar();
    } catch (err) {
      console.error(err);
      toast("Save failed");
    } finally {
      btnSave.disabled    = false;
      btnSave.textContent = "Save";
    }
  });

  prevBtn?.addEventListener("click", async () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDateISO = null;
    if (editor) editor.style.display = "none";
    await buildCalendar();
  });

  nextBtn?.addEventListener("click", async () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDateISO = null;
    if (editor) editor.style.display = "none";
    await buildCalendar();
  });

  buildCalendar();
}

/* =========================================================
   ADMIN PAGE TABS
   ========================================================= */
function initAdminTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".admin-tab-panel").forEach(p => p.classList.remove("active"));
      const panel = document.getElementById(`tab${target.charAt(0).toUpperCase() + target.slice(1)}`);
      if (panel) panel.classList.add("active");
    });
  });
}

/* =========================================================
   ADMIN PAGE
   ========================================================= */
function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders || adminOrders.dataset.bound === "1") return;
  adminOrders.dataset.bound = "1";

  initAdminTabs();
  initAdminAvailability();

  const adminSearch     = $("#adminSearch");
  const adminFilter     = $("#adminFilter");
  const btnAdminRefresh = $("#btnAdminRefresh");
  const conflictsList   = $("#conflictsList");
  const conflictCount   = $("#conflictCount");
  const scheduleList    = $("#scheduleList");
  const todayLabel      = $("#todayLabel");
  const debugUid        = $("#debugUid");
  const debugRole       = $("#debugRole");

  let allOrders   = [];
  let currentUser = null;
  let unsub       = null;

  const isoToday = todayISO();
  if (todayLabel) todayLabel.textContent = `Today's bookings — ${isoToday}`;

  function render() {
    const search    = String(adminSearch?.value || "").trim().toLowerCase();
    const rawFilter = String(adminFilter?.value || "").trim();
    const filter    = rawFilter === "All" ? "" : rawFilter;

    // Detect conflicts
    const conflicts    = findConflicts(allOrders);
    const conflictIds  = new Set(conflicts.flat().map(o => o.id));
    if (conflictCount) conflictCount.textContent = String(conflicts.length);

    // Render conflicts tab
    if (conflictsList) {
      if (conflicts.length === 0) {
        conflictsList.innerHTML = `<div class="order-card"><div class="order-title">No conflicts ✅</div><p class="sub">All bookings are unique — no double-booking detected.</p></div>`;
      } else {
        conflictsList.innerHTML = conflicts.map(group =>
          `<div style="margin-bottom:18px;">
            <div class="sub" style="margin-bottom:8px;font-weight:700;color:var(--warning);">⚠ ${group.length} orders — ${esc(group[0].date)} • ${esc(group[0].timeSlot)} • ${esc(group[0].location)}</div>
            ${group.map(o => renderAdminOrderCard(o, currentUser, true)).join("")}
          </div>`
        ).join("");
      }
    }

    // Render today's schedule tab
    if (scheduleList) {
      const todayOrders = allOrders.filter(o => o.date === isoToday && o.status !== "Cancelled");
      todayOrders.sort((a,b) => (a.timeSlot || "").localeCompare(b.timeSlot || ""));
      if (todayOrders.length === 0) {
        scheduleList.innerHTML = `<div class="order-card"><div class="order-title">No bookings today</div><p class="sub">Nothing scheduled for ${isoToday}.</p></div>`;
      } else {
        scheduleList.innerHTML = todayOrders.map(o => renderAdminOrderCard(o, currentUser, conflictIds.has(o.id))).join("");
      }
    }

    // Main orders tab
    const items = allOrders.filter(order => {
      const matchesFilter = !filter || order.status === filter;
      const imageText     = getOrderImageUrls(order).join(" ");
      const haystack      = [
        order.customerName, order.customerEmail, order.customerPhone,
        order.location, order.service, order.serviceLabel,
        order.date, order.timeSlot, order.price, order.status, order.id, imageText
      ].join(" ").toLowerCase();
      return matchesFilter && (!search || haystack.includes(search));
    });

    updateAdminStats(allOrders);
    renderAdminAnalytics(allOrders);

    adminOrders.innerHTML = items.length
      ? items.map(o => renderAdminOrderCard(o, currentUser, conflictIds.has(o.id))).join("")
      : `<div class="order-card"><div class="order-title">No matching orders</div><p class="sub">Try changing the search or filter.</p></div>`;
  }

  if (adminSearch && adminSearch.dataset.bound !== "1") {
    adminSearch.dataset.bound = "1";
    adminSearch.addEventListener("input", render);
  }

  if (adminFilter && adminFilter.dataset.bound !== "1") {
    adminFilter.dataset.bound = "1";
    adminFilter.addEventListener("change", render);
  }

  if (btnAdminRefresh && btnAdminRefresh.dataset.bound !== "1") {
    btnAdminRefresh.dataset.bound = "1";
    btnAdminRefresh.addEventListener("click", () => { render(); toast("Admin list refreshed ✅"); });
  }

  adminOrders.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-admin-save]");
    if (!btn) return;
    if (!currentUser || !isAdminEmail(currentUser.email)) { toast("Admin only"); return; }
    try {
      await saveAdminOrder(btn.getAttribute("data-admin-save"));
    } catch (err) { console.error(err); toast("Admin update failed"); }
  });

  // Also wire save buttons in conflict and schedule tabs
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-admin-save]");
    if (!btn) return;
    if (btn.closest("#adminOrders")) return; // already handled above
    if (!currentUser || !isAdminEmail(currentUser.email)) { toast("Admin only"); return; }
    try {
      await saveAdminOrder(btn.getAttribute("data-admin-save"));
    } catch (err) { console.error(err); toast("Admin update failed"); }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (debugUid)  debugUid.textContent  = user?.uid || "-";
    if (debugRole) debugRole.textContent = user ? (isAdminEmail(user.email) ? "Admin" : "User") : "-";

    if (typeof unsub === "function") { unsub(); unsub = null; }
    if (!user) { goLogin("admin.html"); return; }

    if (!isAdminEmail(user.email)) {
      updateAdminStats([]);
      renderAdminAnalytics([]);
      adminOrders.innerHTML = `<div class="order-card"><div class="order-title">Access denied</div><p class="sub">You do not have permission to view the admin page.</p></div>`;
      return;
    }

    unsub = onSnapshot(
      query(collection(db, "orders")),
      (snap) => {
        allOrders = [];
        snap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
        allOrders.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        render();
      },
      (err) => { console.error(err); toast("Admin load failed"); }
    );
  });
}

/* =========================================================
   HOME PAGE CAROUSEL
   ========================================================= */
function initHomePage() {
  const track    = $(".carousel-track");
  const dotsWrap = $(".carousel-dots");
  const prevBtn  = $(".carousel-btn.prev");
  const nextBtn  = $(".carousel-btn.next");

  if (!track || !dotsWrap) return;
  const slides = [...track.children];
  if (!slides.length) return;

  let index = 0;

  function renderCarousel() {
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsWrap.children].forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-pressed", i === index ? "true" : "false");
    });
  }

  if (!dotsWrap.dataset.bound) {
    dotsWrap.dataset.bound = "1";
    dotsWrap.innerHTML = slides
      .map((_,i) => `<button type="button" aria-label="Go to slide ${i+1}" ${i===0?'class="active"':""}></button>`)
      .join("");
    [...dotsWrap.children].forEach((dot, i) => {
      dot.addEventListener("click", () => { index = i; renderCarousel(); });
    });
  }

  prevBtn?.addEventListener("click", () => { index = (index-1+slides.length)%slides.length; renderCarousel(); });
  nextBtn?.addEventListener("click", () => { index = (index+1)%slides.length; renderCarousel(); });

  renderCarousel();
}

/* =========================================================
   BOOTSTRAP
   ========================================================= */
function initApp() {
  wireAuthRequiredLinks();
  wireOverlayExitButtonsSafe();

  onAuthStateChanged(auth, async (user) => {
    await setupNav(user);
    await updatePointsBadge(user);
  });

  initLoginPage();
  initRegisterPage();
  initBooking();
  initTracking();
  initCustomer();
  initAdmin();
  initHomePage();
}

initApp();