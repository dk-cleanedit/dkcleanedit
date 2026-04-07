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
  if (!window.emailjs) {
    console.warn("EmailJS not loaded");
    return;
  }

  const params = {
    customer_name: customerName || "Customer",
    customer_email: customerEmail || "",
    order_id: orderId || "",
    service: service || "",
    location: location || "",
    booking_date: bookingDate || "",
    booking_time: bookingTime || "",
    price: price || "",
    shoe_notes: shoeNotes || ""
  };

  await window.emailjs.send(
    "service_6ep5ahh",
    "template_qca25sq",
    params
  );
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
    return `
      <div class="order-tracker">
        ${TRACKABLE_STATUS.map((stage) => `
          <div class="step cancelled">
            <span class="circle"></span>
            <span class="label">${esc(stage)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  const currentIndex = TRACKABLE_STATUS.indexOf(status);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;

  return `
    <div class="order-tracker">
      ${TRACKABLE_STATUS.map((stage, i) => `
        <div class="step ${i <= safeIndex ? "active" : ""}">
          <span class="circle"></span>
          <span class="label">${esc(stage)}</span>
        </div>
      `).join("")}
    </div>
  `;
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
  const overlay = $("#signupOverlay");
  if (overlay) overlay.hidden = true;
}

function showSignupOverlay() {
  const overlay = $("#signupOverlay");
  if (overlay) overlay.hidden = false;
}

function wireOverlayExitButtonsSafe() {
  const overlay = $("#signupOverlay");
  if (!overlay || overlay.dataset.bound === "1") return;
  overlay.dataset.bound = "1";

  const closeBtn = $("#closePopupBtn");

  const hide = () => {
    overlay.hidden = true;
  };

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    hide();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hide();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.hidden === false) hide();
  });
}

function wireAuthRequiredLinks() {
  if (document.body.dataset.authLinksBound === "1") return;
  document.body.dataset.authLinksBound = "1";

  document.addEventListener(
    "click",
    (e) => {
      const link = e.target?.closest?.("a[data-requires-auth='true']");
      if (!link) return;
      if (auth.currentUser) return;

      e.preventDefault();
      const href = link.getAttribute("href") || "home.html";
      goLogin(href);
    },
    true
  );
}

async function setupNav(user) {
  const navAdmin = $("#navAdmin");
  const navLogin = $("#navLogin");
  const navRegister = $("#navRegister");
  const navLogout = $("#navLogout");

  if (!user) {
    if (navLogin) navLogin.hidden = false;
    if (navRegister) navRegister.hidden = false;
    if (navLogout) navLogout.hidden = true;
    if (navAdmin) navAdmin.hidden = true;
    return;
  }

  if (navLogin) navLogin.hidden = true;
  if (navRegister) navRegister.hidden = true;
  if (navAdmin) navAdmin.hidden = !isAdminEmail(user.email);

  if (navLogout) {
    navLogout.hidden = false;

    if (navLogout.dataset.bound !== "1") {
      navLogout.dataset.bound = "1";
      navLogout.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        toast("Logged out ✅");
        location.replace("home.html");
      });
    }
  }
}

async function updatePointsBadge(user) {
  const badge = $("#navPointsBadge");
  if (!badge) return;

  if (!user) {
    badge.hidden = true;
    return;
  }

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
    const pass = $("#logPass")?.value;

    if (!email || !pass) {
      setMsg("Enter email and password");
      toast("Enter email and password");
      return;
    }

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

      if (!email) {
        setMsg("Enter your email to reset password");
        toast("Enter your email");
        return;
      }

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

    const name = $("#regName")?.value.trim();
    const email = $("#regEmail")?.value.trim();
    const phone = $("#regPhone")?.value.trim();
    const pass = $("#regPass")?.value;

    if (!name || !email || !pass) {
      setMsg("Fill in name, email and password");
      toast("Fill in name, email and password");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });

      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        phone: phone || "",
        points: 0,
        createdAt: serverTimestamp()
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

/* -------------------------
   booking helpers
------------------------- */
function getBookingFileInput() {
  return $("#shoeImages") || $("#orderImages") || $("#uploadImages");
}

async function uploadOrderImages(files, orderId) {
  const uploadedUrls = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    const path = `orders/${orderId}/${Date.now()}-${i}-${file.name}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

function getActivePriceSelect() {
  const service = $("#service")?.value;

  if (service === "standard_clean") return $("#standardPrice");
  if (service === "express") return $("#expressPrice");
  if (service === "next_day") return $("#nextdayPrice");

  return null;
}

function getSelectedPrice() {
  return getActivePriceSelect()?.value || "";
}

function formatBookingDate(value) {
  if (!value) return "Not selected";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function updateBookingSummary() {
  const summaryService  = $("#summaryService");
  const summaryLocation = $("#summaryLocation");
  const summaryDate     = $("#summaryDate");
  const summaryTime     = $("#summaryTime");
  const summaryPrice    = $("#selectedPriceText");

  if (summaryService) {
    summaryService.textContent = serviceLabel($("#service")?.value || "");
  }

  if (summaryLocation) {
    summaryLocation.textContent = $("#location")?.value || "-";
  }

  if (summaryDate) {
    summaryDate.textContent = formatBookingDate($("#date")?.value || "");
  }

  if (summaryTime) {
    summaryTime.textContent = $("#timeSlot")?.value || "-";
  }

  if (summaryPrice && summaryPrice.closest(".summary-row")) {
    summaryPrice.textContent = getSelectedPrice() || "£0";
  }
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
  const service = $("#service")?.value;

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

  ["#standardPrice", "#expressPrice", "#nextdayPrice"].forEach((selector) => {
    const el = $(selector);
    if (!el || el.dataset.boundPrice === "1") return;
    el.dataset.boundPrice = "1";
    el.addEventListener("change", () => {
      updateSelectedPriceText();
      updateBookingSummary();
    });
  });

  syncServicePriceUI();
}

/* -------------------------
   calendar UI
   Builds and manages the interactive date-picker grid.
   Writes the chosen date into the hidden #date input so all
   existing booking validation / Firestore logic works unchanged.
------------------------- */
function initCalendarUI() {
  const calBody    = document.getElementById("calBody");
  const calLabel   = document.getElementById("calMonthLabel");
  const dateLabel  = document.getElementById("selectedDateLabel");
  const hiddenDate = document.getElementById("date");
  const prevBtn    = document.getElementById("calPrev");
  const nextBtn    = document.getElementById("calNext");

  // Only run on pages that include the calendar widget
  if (!calBody || !prevBtn || !nextBtn) return;

  // Guard against double-init if an inline script already ran
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

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatDisplay(d) {
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function buildCalendar() {
    if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    calBody.innerHTML = "";

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

    // Previous-month filler cells
    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell cal-cell--other";
      cell.textContent = daysInPrev - firstDay + 1 + i;
      calBody.appendChild(cell);
    }

    // Current-month cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell";
      cell.textContent = d;

      const thisDate = new Date(viewYear, viewMonth, d);
      thisDate.setHours(0, 0, 0, 0);

      if (thisDate < today) {
        cell.classList.add("cal-cell--past");
      } else {
        cell.addEventListener("click", () => selectDate(thisDate));
      }

      if (thisDate.toDateString() === today.toDateString()) {
        cell.classList.add("cal-cell--today");
      }

      if (selectedDate && thisDate.toDateString() === selectedDate.toDateString()) {
        cell.classList.add("cal-cell--selected");
      }

      calBody.appendChild(cell);
    }

    // Next-month filler cells
    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell cal-cell--other";
      cell.textContent = i;
      calBody.appendChild(cell);
    }
  }

  function selectDate(date) {
    selectedDate = date;

    // Write ISO value into the hidden #date input so all existing
    // booking logic (validation, Firestore, summary) picks it up
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (hiddenDate) {
      hiddenDate.value = iso;
      hiddenDate.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Update the "selected date" label shown above the time slots
    if (dateLabel) {
      dateLabel.textContent = formatDisplay(date);
    }

    // Re-render to show the selected highlight
    buildCalendar();

    // Keep the booking summary sidebar in sync
    updateBookingSummary();
  }

  prevBtn.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    buildCalendar();
  });

  nextBtn.addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    buildCalendar();
  });

  // If the hidden #date already has a value (e.g. set by an earlier
  // inline script), restore the visual selection state
  if (hiddenDate?.value && isValidDateInput(hiddenDate.value)) {
    const parts = hiddenDate.value.split("-");
    const pre   = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    pre.setHours(0, 0, 0, 0);
    selectedDate = pre;
    viewYear     = pre.getFullYear();
    viewMonth    = pre.getMonth();
  }

  buildCalendar();
}

/* -------------------------
   shoe image preview
------------------------- */
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
    reader.onload = (e) => {
      previewImg.src   = e.target.result;
      previewWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  });
}

/* -------------------------
   professional booking UI
------------------------- */
function initProfessionalBookingUI() {
  const serviceSelect  = $("#service");
  const timeSlotSelect = $("#timeSlot");
  const locationSelect = $("#location");
  const dateInput      = $("#date");

  const serviceCards = document.querySelectorAll("[data-service-card]");
  const timeButtons  = document.querySelectorAll(".time-slot");

  // Service card clicks
  if (serviceCards.length) {
    serviceCards.forEach((card) => {
      if (card.dataset.bound === "1") return;
      card.dataset.bound = "1";

      card.addEventListener("click", () => {
        const value = card.getAttribute("data-service-card");
        if (!value || !serviceSelect) return;

        serviceCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");

        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        serviceSelect.value = value;
        serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));

        updateBookingSummary();
      });
    });
  }

  // Time slot button clicks — syncs the hidden #timeSlot select
  if (timeButtons.length) {
    timeButtons.forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";

      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-time");
        if (!value || !timeSlotSelect) return;

        timeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        timeSlotSelect.value = value;
        timeSlotSelect.dispatchEvent(new Event("change", { bubbles: true }));

        updateBookingSummary();
      });
    });
  }

  // Keep service cards in sync when hidden select changes
  if (serviceSelect && serviceSelect.dataset.summaryBound !== "1") {
    serviceSelect.dataset.summaryBound = "1";
    serviceSelect.addEventListener("change", () => {
      const current = serviceSelect.value;
      serviceCards.forEach((card) => {
        const isActive = card.getAttribute("data-service-card") === current;
        card.classList.toggle("active", isActive);
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = isActive;
      });
      updateBookingSummary();
    });
  }

  // Keep time slot buttons in sync when hidden select changes
  if (timeSlotSelect && timeSlotSelect.dataset.summaryBound !== "1") {
    timeSlotSelect.dataset.summaryBound = "1";
    timeSlotSelect.addEventListener("change", () => {
      const current = timeSlotSelect.value;
      timeButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-time") === current);
      });
      updateBookingSummary();
    });
  }

  if (locationSelect && locationSelect.dataset.summaryBound !== "1") {
    locationSelect.dataset.summaryBound = "1";
    locationSelect.addEventListener("change", updateBookingSummary);
  }

  // #date is written by the calendar; listen for its change event
  // to keep the summary sidebar live without any extra wiring
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

  // Keyed by the select option values in booking.html
  const locations = {
    charles_street_leicester: {
      name: "Charles Street, Leicester",
      address: "Charles Street, Leicester, UK",
      mapsLink: "https://www.google.com/maps/search/?api=1&query=Charles+Street+Leicester+UK",
      embed: "https://www.google.com/maps?q=Charles%20Street%20Leicester%20UK&z=15&output=embed"
    },
    canada_water: {
      name: "Canada Water, London",
      address: "Canada Water, London, UK",
      mapsLink: "https://www.google.com/maps/search/?api=1&query=Canada+Water+London+UK",
      embed: "https://www.google.com/maps?q=Canada%20Water%20London%20UK&z=15&output=embed"
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
      if (!input.value.trim()) {
        input.value = userData.name || user.displayName || "";
      }
    } catch (err) {
      console.error(err);
    }
  });
}

/* -------------------------
   booking page
------------------------- */
function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook || btnBook.dataset.bound === "1") return;
  btnBook.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  initServicePriceSync();
  initProfessionalBookingUI();
  initCalendarUI();        // interactive calendar grid
  initShoeImagePreview();  // live image preview
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
    if (!user) {
      showSignupOverlay();
      toast("Please log in or register to book.");
      return;
    }

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

    try {
      btnBook.disabled    = true;
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

      let uploadedImageUrls = [];

      if (imageFiles.length) {
        try {
          uploadedImageUrls = await uploadOrderImages(imageFiles, orderRef.id);
          await updateDoc(orderRef, {
            imageUrls: uploadedImageUrls,
            updatedAt: serverTimestamp()
          });
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

      setTimeout(() => {
        location.href = "track.html";
      }, 700);
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

/* -------------------------
   order rendering
------------------------- */
function renderOrderActions(order) {
  if (!isCustomerEditableStatus(order.status)) return "";

  return `
    <div class="order-actions">
      <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
      <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
    </div>
  `;
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
    </div>
  `;
}

/* -------------------------
   customer order actions
------------------------- */
async function cancelOrderByCustomer(orderId, user) {
  const ref  = doc(db, "orders", orderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) { toast("Order not found"); return; }

  const data = snap.data();

  if (data.uid !== user.uid && !isAdminEmail(user.email)) { toast("Not allowed"); return; }
  if (!isCustomerEditableStatus(data.status)) { toast("This order can no longer be cancelled"); return; }

  const ok = confirm("Cancel this booking?");
  if (!ok) return;

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

  if (!isValidDateInput(cleanDate) || !isValidTimeInput(cleanTime)) {
    toast("Use YYYY-MM-DD and HH:MM");
    return;
  }

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
      if (action === "cancel") {
        await cancelOrderByCustomer(orderId, user);
      } else if (action === "reschedule") {
        await rescheduleOrderByCustomer(orderId, user);
      }
    } catch (err) {
      console.error(err);
      toast(action === "cancel" ? "Cancel failed" : "Reschedule failed");
    }
  });
}

/* -------------------------
   tracking page
------------------------- */
function initTracking() {
  const ordersEl = $("#orders");
  if (!ordersEl || ordersEl.dataset.bound === "1") return;
  ordersEl.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  wireCustomerOrderActions(ordersEl);

  ordersEl.innerHTML = `
    <div class="order-card">
      <div class="order-title">Loading…</div>
      <p class="sub">Checking your active orders.</p>
    </div>
  `;

  let unsubOrders = null;

  const ACTIVE_STATUSES = [
    "Booked","Received","In Progress","Cleaning","Repairing",
    "Ready","Out for Delivery","Dispatched","Shipped","Pending"
  ];

  const HISTORY_STATUSES = ["Completed","Delivered","Collected","Cancelled"];

  function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function isHistoryOrder(order) {
    return HISTORY_STATUSES.map(s => s.toLowerCase()).includes(normalizeStatus(order.status));
  }

  function isActiveOrder(order) {
    const status = normalizeStatus(order.status);
    if (HISTORY_STATUSES.map(s => s.toLowerCase()).includes(status)) return false;
    return true;
  }

  onAuthStateChanged(auth, (user) => {
    if (typeof unsubOrders === "function") { unsubOrders(); unsubOrders = null; }

    if (!user) {
      showSignupOverlay();
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">Please log in</div>
          <p class="sub">You must be signed in to see tracking.</p>
          <a class="btn primary" href="login.html?next=track.html">Go to Login</a>
        </div>
      `;
      return;
    }

    hideSignupOverlay();

    const q = query(collection(db, "orders"), where("uid", "==", user.uid));

    unsubOrders = onSnapshot(
      q,
      (snap) => {
        const items = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const activeItems  = items.filter(isActiveOrder);
        const historyItems = items.filter(isHistoryOrder);

        ordersEl.innerHTML = activeItems.length
          ? activeItems.map(renderOrderCard).join("")
          : `
            <div class="order-card">
              <div class="order-title">No current orders</div>
              <p class="sub">
                You have no active orders to track right now.
                ${historyItems.length
                  ? "Your previous orders are in My Account > Order History."
                  : "Book a service to get started."}
              </p>
              <div class="stack-sm">
                <a class="btn primary" href="booking.html">Go to Booking</a>
                <a class="btn secondary" href="customer.html">My Account</a>
              </div>
            </div>
          `;
      },
      (err) => {
        console.error(err);
        setMsg("Tracking failed");
        toast("Tracking failed");
      }
    );
  });

  const btnRefresh = $("#btnRefresh");
  if (btnRefresh && btnRefresh.dataset.bound !== "1") {
    btnRefresh.dataset.bound = "1";
    btnRefresh.addEventListener("click", () => toast("Tracking is live ✅"));
  }
}

/* -------------------------
   customer page
------------------------- */
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
        snap2.forEach((d) => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        listEl.innerHTML =
          items.slice(0, 4).map(renderOrderCard).join("") ||
          `
            <div class="order-card">
              <div class="order-title">No orders yet</div>
              <p class="sub">Book a service to start.</p>
            </div>
          `;
      });
    }

    if (btnChangePass && btnChangePass.dataset.bound !== "1") {
      btnChangePass.dataset.bound = "1";

      btnChangePass.addEventListener("click", async () => {
        const curPass = $("#curPass")?.value || "";
        const newPass = $("#newPass")?.value || "";

        if (!curPass || !newPass) {
          setMsg("Enter current and new password", "passMsg");
          toast("Enter current and new password");
          return;
        }

        try {
          const credential = EmailAuthProvider.credential(user.email, curPass);
          await reauthenticateWithCredential(user, credential);
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

/* -------------------------
   admin helpers
------------------------- */
function getOrderImageUrls(order) {
  const urls = [];

  const possibleSingleFields = [
    "imageUrl","photoUrl","uploadUrl","beforeImage",
    "beforeImageUrl","customerImage","customerImageUrl"
  ];

  const possibleArrayFields = ["imageUrls","photos","uploads","images"];

  possibleSingleFields.forEach((field) => {
    const value = order?.[field];
    if (typeof value === "string" && value.trim()) urls.push(value.trim());
  });

  possibleArrayFields.forEach((field) => {
    const value = order?.[field];
    if (Array.isArray(value)) {
      value.forEach((u) => {
        if (typeof u === "string" && u.trim()) urls.push(u.trim());
      });
    }
  });

  return [...new Set(urls)];
}

function renderAdminImages(order) {
  const urls = getOrderImageUrls(order);
  if (!urls.length) return "";

  return `
    <div class="admin-images" style="margin-top:12px;">
      <div class="sub" style="margin-bottom:8px;">Customer Uploads</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${urls.map((url, i) => `
          <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Open image ${i + 1}">
            <img
              src="${esc(url)}"
              alt="Customer upload ${i + 1}"
              style="width:90px; height:90px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,.12);"
              loading="lazy"
            />
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAdminOrderCard(order, currentUser) {
  const isAdmin     = isAdminEmail(currentUser?.email);
  const orderStatus = order.status || "Booked";
  const imageUrls   = getOrderImageUrls(order);

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(order.customerName || "Customer")} • ${esc(serviceLabel(order.service))}</div>
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
              ${STATUS.map((status) => `
                <option value="${esc(status)}" ${orderStatus === status ? "selected" : ""}>${esc(status)}</option>
              `).join("")}
            </select>
          </div>

          <div class="admin-field">
            <label class="sub" for="points-${esc(order.id)}">Points to award</label>
            <input
              id="points-${esc(order.id)}"
              class="admin-points"
              data-id="${esc(order.id)}"
              type="number"
              min="0"
              step="1"
              value="${esc(order.pointsAwarded ?? 10)}"
            />
          </div>

          <div class="admin-field admin-field-btn">
            <button class="btn primary" type="button" data-admin-save="${esc(order.id)}">Save</button>
          </div>
        </div>

        <div class="order-meta" style="margin-top:10px;">
          <span class="sub">Points granted: ${order.pointsGranted ? "Yes" : "No"}</span>
          <span class="sub">Images: ${imageUrls.length}</span>
        </div>
      ` : ""}
    </div>
  `;
}

function updateAdminStats(orders) {
  const totalEl      = $("#adminTotalOrders");
  const openEl       = $("#adminOpenOrders");
  const completedEl  = $("#adminCompletedOrders");
  const withImagesEl = $("#adminWithImages");

  const total      = orders.length;
  const open       = orders.filter((o) => !["Completed","Cancelled"].includes(o.status)).length;
  const completed  = orders.filter((o) => o.status === "Completed").length;
  const withImages = orders.filter((o) => getOrderImageUrls(o).length > 0).length;

  if (totalEl)      totalEl.textContent      = String(total);
  if (openEl)       openEl.textContent       = String(open);
  if (completedEl)  completedEl.textContent  = String(completed);
  if (withImagesEl) withImagesEl.textContent = String(withImages);
}

function renderAdminAnalytics(orders) {
  const revenueEl           = $("#adminRevenue");
  const bookedEl            = $("#adminBookedCount");
  const receivedEl          = $("#adminReceivedCount");
  const cleaningEl          = $("#adminCleaningCount");
  const readyEl             = $("#adminReadyCount");
  const cancelledEl         = $("#adminCancelledCount");
  const locationBreakdownEl = $("#adminLocationBreakdown");
  const serviceBreakdownEl  = $("#adminServiceBreakdown");

  const parseMoney = (value) => {
    const n = parseFloat(String(value || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const completedOrders = orders.filter((o) => o.status === "Completed");
  const revenue = completedOrders.reduce((sum, o) => sum + parseMoney(o.price), 0);

  const statusCounts = {
    Booked: 0, Received: 0, Cleaning: 0,
    "Drying & Finish": 0, Ready: 0, Completed: 0, Cancelled: 0
  };

  const locationCounts = {};
  const serviceCounts  = {};

  orders.forEach((o) => {
    const status = o.status || "Booked";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const location = o.location || "Unknown";
    locationCounts[location] = (locationCounts[location] || 0) + 1;

    const service = serviceLabel(o.service || o.serviceLabel || "Unknown");
    serviceCounts[service] = (serviceCounts[service] || 0) + 1;
  });

  if (revenueEl)   revenueEl.textContent   = `£${revenue.toFixed(2)}`;
  if (bookedEl)    bookedEl.textContent    = String(statusCounts.Booked   || 0);
  if (receivedEl)  receivedEl.textContent  = String(statusCounts.Received || 0);
  if (cleaningEl)  cleaningEl.textContent  = String((statusCounts.Cleaning || 0) + (statusCounts["Drying & Finish"] || 0));
  if (readyEl)     readyEl.textContent     = String((statusCounts.Ready    || 0) + (statusCounts.Completed         || 0));
  if (cancelledEl) cancelledEl.textContent = String(statusCounts.Cancelled || 0);

  if (locationBreakdownEl) {
    locationBreakdownEl.innerHTML = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<div class="sub">${esc(name)}: ${count}</div>`)
      .join("");
  }

  if (serviceBreakdownEl) {
    serviceBreakdownEl.innerHTML = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<div class="sub">${esc(name)}: ${count}</div>`)
      .join("");
  }
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
    status,
    pointsAwarded,
    pointsGranted: nextGrantedAmount > 0,
    grantedPointsAmount: nextGrantedAmount,
    updatedAt: serverTimestamp()
  });

  toast("Order updated ✅");
}

/* -------------------------
   admin page
------------------------- */
function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders || adminOrders.dataset.bound === "1") return;
  adminOrders.dataset.bound = "1";

  const adminSearch     = $("#adminSearch");
  const adminFilter     = $("#adminFilter");
  const btnAdminRefresh = $("#btnAdminRefresh");
  const debugUid        = $("#debugUid");
  const debugRole       = $("#debugRole");

  let allOrders   = [];
  let currentUser = null;
  let unsub       = null;

  function render() {
    const search    = String(adminSearch?.value || "").trim().toLowerCase();
    const rawFilter = String(adminFilter?.value || "").trim();
    const filter    = rawFilter === "All" ? "" : rawFilter;

    const items = allOrders.filter((order) => {
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
      ? items.map((order) => renderAdminOrderCard(order, currentUser)).join("")
      : `
        <div class="order-card">
          <div class="order-title">No matching orders</div>
          <p class="sub">Try changing the search or filter.</p>
        </div>
      `;
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

    const orderId = btn.getAttribute("data-admin-save");
    try {
      await saveAdminOrder(orderId);
    } catch (err) {
      console.error(err);
      toast("Admin update failed");
    }
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
      adminOrders.innerHTML = `
        <div class="order-card">
          <div class="order-title">Access denied</div>
          <p class="sub">You do not have permission to view the admin page.</p>
        </div>
      `;
      return;
    }

    const q = query(collection(db, "orders"));

    unsub = onSnapshot(
      q,
      (snap) => {
        allOrders = [];
        snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
        allOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        render();
      },
      (err) => {
        console.error(err);
        toast("Admin load failed");
      }
    );
  });
}

/* -------------------------
   home page
------------------------- */
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
      .map((_, i) => `<button type="button" aria-label="Go to slide ${i + 1}" ${i === 0 ? 'class="active"' : ""}></button>`)
      .join("");

    [...dotsWrap.children].forEach((dot, i) => {
      dot.addEventListener("click", () => { index = i; renderCarousel(); });
    });
  }

  prevBtn?.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    renderCarousel();
  });

  nextBtn?.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    renderCarousel();
  });

  renderCarousel();
}

/* -------------------------
   bootstrap
------------------------- */
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