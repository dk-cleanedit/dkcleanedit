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

/* helpers for the main page, has variables */
const $ = (selector) => document.querySelector(selector);

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

/* helpers for the progress such as the progress bar */
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

/* login page,the login in helpers */
function getNextFromUrl() {
  const url = new URL(location.href);
  const next = url.searchParams.get("next");
  return next ? decodeURIComponent(next) : null;
}

function goLogin(nextFile = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(nextFile)}`;
}

/* the points and user function */
async function getPoints(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? Number(snap.data().points || 0) : 0;
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

function badgeClass(status) {
  if (status === "Completed") return "badge success";
  if (status === "Cancelled") return "badge danger";
  if (status === "Ready") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

/* the overlay */
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

/* the links */
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

/* the navigation section */
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

/* the login page */
function initLoginPage() {
  const btnLogin = $("#btnLogin");
  const btnRegisterGo = $("#btnRegisterGo");

  if (btnLogin && btnLogin.dataset.bound !== "1") {
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
        setMsg("");
        toast("Logged in ✅");
        location.replace(next);
      } catch (err) {
        console.error(err);

        if (err?.code === "auth/invalid-credential") {
          setMsg("Wrong email or password, or account not registered.");
          toast("Wrong email or password");
        } else if (err?.code === "auth/invalid-email") {
          setMsg("Enter a valid email address.");
          toast("Invalid email");
        } else if (err?.code === "auth/too-many-requests") {
          setMsg("Too many attempts. Try again later.");
          toast("Too many attempts");
        } else {
          setMsg(err.message || "Login failed");
          toast("Login failed");
        }
      }
    });
  }

  if (btnRegisterGo && btnRegisterGo.dataset.bound !== "1") {
    btnRegisterGo.dataset.bound = "1";

    btnRegisterGo.addEventListener("click", (e) => {
      e.preventDefault();
      const next = getNextFromUrl();
      location.href = next
        ? `register.html?next=${encodeURIComponent(next)}`
        : "register.html";
    });
  }

  const btnSendReset = $("#btnSendReset");
  if (btnSendReset && btnSendReset.dataset.bound !== "1") {
    btnSendReset.dataset.bound = "1";

    btnSendReset.addEventListener("click", async (e) => {
      e.preventDefault();

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

        if (err?.code === "auth/invalid-email") {
          setMsg("Enter a valid email address");
          toast("Invalid email");
        } else if (err?.code === "auth/user-not-found") {
          setMsg("No account found with that email");
          toast("Email not found");
        } else {
          setMsg(err.message || "Could not send reset email");
          toast("Reset failed");
        }
      }
    });
  }
}

/* the register page */
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

    if (pass.length < 6) {
      setMsg("Password must be at least 6 characters");
      toast("Password too short");
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

      setMsg("");
      toast("Registered ✅");
      location.replace(next);
    } catch (err) {
      console.error(err);

      if (err?.code === "auth/email-already-in-use") {
        setMsg("That email is already registered");
        toast("Email already in use");
      } else if (err?.code === "auth/invalid-email") {
        setMsg("Enter a valid email address");
        toast("Invalid email");
      } else if (err?.code === "auth/weak-password") {
        setMsg("Password is too weak");
        toast("Weak password");
      } else {
        setMsg(err.message || "Register failed");
        toast("Register failed");
      }
    }
  });
}

/* price service change */
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
  const summaryService = $("#summaryService");
  const summaryLocation = $("#summaryLocation");
  const summaryDate = $("#summaryDate");
  const summaryTime = $("#summaryTime");
  const summaryPrice = $("#selectedPriceText");

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
  const expressGroup = $("#expressPrices");
  const nextdayGroup = $("#nextdayPrices");

  if (!standardGroup || !expressGroup || !nextdayGroup) return;

  standardGroup.hidden = service !== "standard_clean";
  expressGroup.hidden = service !== "express";
  nextdayGroup.hidden = service !== "next_day";

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

function initProfessionalBookingUI() {
  const serviceSelect = $("#service");
  const timeSlotSelect = $("#timeSlot");
  const locationSelect = $("#location");
  const dateInput = $("#date");

  const serviceCards = document.querySelectorAll("[data-service-card]");
  const timeButtons = document.querySelectorAll(".time-slot");

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

  if (dateInput && dateInput.dataset.summaryBound !== "1") {
    dateInput.dataset.summaryBound = "1";
    dateInput.addEventListener("change", updateBookingSummary);
  }

  updateBookingSummary();
}

/* the booking page */
function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook || btnBook.dataset.bound === "1") return;
  btnBook.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  initServicePriceSync();
  initProfessionalBookingUI();
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

    const service = $("#service")?.value;
    const locationVal = $("#location")?.value;
    const date = $("#date")?.value;
    const timeSlot = $("#timeSlot")?.value;
    const selectedPrice = getSelectedPrice();

    if (!service || !locationVal || !date || !timeSlot || !selectedPrice) {
      setMsg("Select service, location, date, time and price");
      toast("Select service, location, date, time and price");
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const order = {
        uid: user.uid,
        customerName: userData.name || user.displayName || "",
        customerEmail: userData.email || user.email || "",
        customerPhone: userData.phone || "",
        service,
        serviceLabel: serviceLabel(service),
        location: locationVal,
        date,
        timeSlot,
        price: selectedPrice,
        status: "Booked",
        pointsAwarded: 10,
        pointsGranted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, "orders"), order);

      toast("Booking confirmed ✅");
      setMsg(`Order ID: ${ref.id}`);
      updateBookingSummary();

      setTimeout(() => {
        location.href = "track.html";
      }, 400);
    } catch (err) {
      console.error(err);
      setMsg("Booking failed");
      toast("Booking failed");
    }
  });
}

/* =========================
   ORDER ACTIONS
========================= */
function renderOrderActions(order) {
  if (!isCustomerEditableStatus(order.status)) return "";

  return `
    <div class="order-actions">
      <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
      <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
    </div>
  `;
}

/* the customer order */
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

/* cancel the order */
async function cancelOrderByCustomer(orderId, user) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    toast("Order not found");
    return;
  }

  const data = snap.data();

  if (data.uid !== user.uid && !isAdminEmail(user.email)) {
    toast("Not allowed");
    return;
  }

  if (!isCustomerEditableStatus(data.status)) {
    toast("This order can no longer be cancelled");
    return;
  }

  const ok = confirm("Cancel this booking?");
  if (!ok) return;

  await updateDoc(ref, {
    status: "Cancelled",
    updatedAt: serverTimestamp()
  });

  toast("Booking cancelled");
}

/* the reschedule function */
async function rescheduleOrderByCustomer(orderId, user) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    toast("Order not found");
    return;
  }

  const data = snap.data();

  if (data.uid !== user.uid && !isAdminEmail(user.email)) {
    toast("Not allowed");
    return;
  }

  if (!isCustomerEditableStatus(data.status)) {
    toast("This order can no longer be rescheduled");
    return;
  }

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

  await updateDoc(ref, {
    date: cleanDate,
    timeSlot: cleanTime,
    updatedAt: serverTimestamp()
  });

  toast("Booking rescheduled");
}

/* customer order actions */
function wireCustomerOrderActions(listEl) {
  if (!listEl || listEl.dataset.orderActionsBound === "1") return;
  listEl.dataset.orderActionsBound = "1";

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const orderId = btn.getAttribute("data-id");
    const user = auth.currentUser;

    if (!user) {
      goLogin();
      return;
    }

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

/* tracking page helpers */
function formatTrackingDate(value) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getTrackingStatusNote(status) {
  if (status === "Booked") return "Your booking has been placed and is waiting for collection or drop-off.";
  if (status === "Received") return "Your item has been received and is now in the queue.";
  if (status === "Cleaning") return "Your item is currently being cleaned.";
  if (status === "Drying & Finish") return "Your item is in the drying and finishing stage.";
  if (status === "Ready") return "Your item is ready for collection or delivery.";
  if (status === "Completed") return "This order has been completed successfully.";
  if (status === "Cancelled") return "This order has been cancelled.";
  return "Tracking update available.";
}

function renderTrackingSelectedOrder(order) {
  if (!order) {
    return `
      <section class="card">
        <div class="order-title">No order selected</div>
        <p class="sub">Choose an order below, search by order ID, or open your latest order.</p>
      </section>
    `;
  }

  const pct = progressPercent(order.status || "Booked");

  return `
    <section class="card selected-order-card">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(serviceLabel(order.service))} • ${esc(order.location || "-")}</div>
          <div class="sub">Order ID: ${esc(order.id)} • ${esc(order.price || "")}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>

      <div class="tracking-summary-grid">
        <div class="summary-row"><strong>Service:</strong> <span>${esc(serviceLabel(order.service))}</span></div>
        <div class="summary-row"><strong>Location:</strong> <span>${esc(order.location || "-")}</span></div>
        <div class="summary-row"><strong>Date:</strong> <span>${esc(formatTrackingDate(order.date))}</span></div>
        <div class="summary-row"><strong>Time:</strong> <span>${esc(order.timeSlot || "-")}</span></div>
        <div class="summary-row"><strong>Price:</strong> <span>${esc(order.price || "-")}</span></div>
        <div class="summary-row"><strong>Progress:</strong> <span>${pct}%</span></div>
      </div>

      ${renderStepProgress(order.status || "Booked")}

      <div class="order-meta">
        <span class="sub">Status note: ${esc(getTrackingStatusNote(order.status || "Booked"))}</span>
      </div>

      ${renderOrderActions(order)}
    </section>
  `;
}

function renderTrackingListCard(order, isSelected = false) {
  const pct = progressPercent(order.status || "Booked");

  return `
    <div class="order-card ${isSelected ? "selected" : ""}" data-id="${esc(order.id)}" data-track-open="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(serviceLabel(order.service))} • ${esc(order.location || "")}</div>
          <div class="sub">${esc(order.date || "")} • ${esc(order.timeSlot || "")} • ${esc(order.price || "")}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>

      ${renderStepProgress(order.status || "Booked")}

      <div class="order-meta">
        <span class="sub">Order ID: ${esc(order.id)}</span>
        <span class="sub">${pct}%</span>
      </div>

      <div class="order-actions">
        <button class="btn" type="button" data-track-open="${esc(order.id)}">View details</button>
        ${isCustomerEditableStatus(order.status)
          ? `
            <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
            <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
          `
          : ""
        }
      </div>
    </div>
  `;
}

/* the tracking page */
function initTracking() {
  const ordersEl = $("#orders");
  const selectedEl = $("#trackingSelectedOrder");
  const inputEl = $("#trackOrderSearch");
  const btnFindOrder = $("#btnFindOrder");
  const btnShowLatest = $("#btnShowLatest");
  const btnRefresh = $("#btnRefresh");

  if (!ordersEl || ordersEl.dataset.bound === "1") return;
  ordersEl.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  wireCustomerOrderActions(ordersEl);

  let unsubOrders = null;
  let currentOrders = [];
  let selectedOrderId = null;

  function renderSelected() {
    const selectedOrder =
      currentOrders.find((item) => item.id === selectedOrderId) ||
      currentOrders[0] ||
      null;

    if (!selectedOrderId && selectedOrder) {
      selectedOrderId = selectedOrder.id;
    }

    if (selectedEl) {
      selectedEl.innerHTML = renderTrackingSelectedOrder(selectedOrder);
    }
  }

  function renderOrders() {
    if (!currentOrders.length) {
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">No orders yet</div>
          <p class="sub">Book a service to start tracking.</p>
          <a class="btn primary" href="booking.html">Go to Booking</a>
        </div>
      `;

      if (selectedEl) {
        selectedEl.innerHTML = renderTrackingSelectedOrder(null);
      }
      return;
    }

    ordersEl.innerHTML = currentOrders
      .map((order) => renderTrackingListCard(order, order.id === selectedOrderId))
      .join("");

    renderSelected();
  }

  function selectOrderById(orderId, showMessage = true) {
    const found = currentOrders.find((item) => item.id === orderId);

    if (!found) {
      setMsg("Order not found", "trackLookupMsg");
      if (showMessage) toast("Order not found");
      return;
    }

    selectedOrderId = found.id;
    renderOrders();
    setMsg(`Showing order ${found.id}`, "trackLookupMsg");

    const card = ordersEl.querySelector(`[data-id="${CSS.escape(found.id)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  ordersEl.innerHTML = `
    <div class="order-card">
      <div class="order-title">Loading…</div>
      <p class="sub">Checking your account.</p>
    </div>
  `;

  if (selectedEl) {
    selectedEl.innerHTML = renderTrackingSelectedOrder(null);
  }

  ordersEl.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-track-open]");
    if (!openBtn) return;

    const orderId = openBtn.getAttribute("data-track-open");
    if (!orderId) return;

    selectOrderById(orderId, false);
  });

  if (btnFindOrder && btnFindOrder.dataset.bound !== "1") {
    btnFindOrder.dataset.bound = "1";
    btnFindOrder.addEventListener("click", () => {
      const value = String(inputEl?.value || "").trim();
      if (!value) {
        setMsg("Enter an order ID", "trackLookupMsg");
        toast("Enter an order ID");
        return;
      }
      selectOrderById(value);
    });
  }

  if (inputEl && inputEl.dataset.bound !== "1") {
    inputEl.dataset.bound = "1";
    inputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      btnFindOrder?.click();
    });
  }

  if (btnShowLatest && btnShowLatest.dataset.bound !== "1") {
    btnShowLatest.dataset.bound = "1";
    btnShowLatest.addEventListener("click", () => {
      if (!currentOrders.length) {
        setMsg("No orders available", "trackLookupMsg");
        toast("No orders available");
        return;
      }

      selectedOrderId = currentOrders[0].id;
      renderOrders();
      setMsg(`Showing latest order ${currentOrders[0].id}`, "trackLookupMsg");
      toast("Latest order opened");
    });
  }

  if (btnRefresh && btnRefresh.dataset.bound !== "1") {
    btnRefresh.dataset.bound = "1";
    btnRefresh.addEventListener("click", () => {
      renderOrders();
      toast("Tracking refreshed ✅");
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (typeof unsubOrders === "function") {
      unsubOrders();
      unsubOrders = null;
    }

    currentOrders = [];
    selectedOrderId = null;

    if (!user) {
      showSignupOverlay();

      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">Please log in</div>
          <p class="sub">You must be signed in to see tracking.</p>
          <a class="btn primary" href="login.html?next=track.html">Go to Login</a>
        </div>
      `;

      if (selectedEl) {
        selectedEl.innerHTML = renderTrackingSelectedOrder(null);
      }

      return;
    }

    hideSignupOverlay();

    const q = query(collection(db, "orders"), where("uid", "==", user.uid));

    unsubOrders = onSnapshot(
      q,
      (snap) => {
        currentOrders = [];
        snap.forEach((d) => currentOrders.push({ id: d.id, ...d.data() }));
        currentOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (selectedOrderId && !currentOrders.some((item) => item.id === selectedOrderId)) {
          selectedOrderId = currentOrders[0]?.id || null;
        }

        if (!selectedOrderId && currentOrders.length) {
          selectedOrderId = currentOrders[0].id;
        }

        renderOrders();
        setMsg("", "trackLookupMsg");
      },
      (err) => {
        console.error(err);
        setMsg("Tracking failed");
        setMsg("Tracking failed", "trackLookupMsg");
        toast("Tracking failed");
      }
    );
  });
}

/* the customer page, my account */
function initCustomer() {
  const page = $("#custOrders") || $("#btnChangePass") || $("#custName");
  if (!page || page.dataset.customerInit === "1") return;
  page.dataset.customerInit = "1";

  const nameEl = $("#custName");
  const emailEl = $("#custEmail");
  const ptsEl = $("#custPoints");
  const listEl = $("#custOrders");
  const btnCustRefresh = $("#btnCustRefresh");
  const btnChangePass = $("#btnChangePass");

  let unsub = null;

  if (btnCustRefresh && btnCustRefresh.dataset.bound !== "1") {
    btnCustRefresh.dataset.bound = "1";
    btnCustRefresh.addEventListener("click", () => toast("Account is live ✅"));
  }

  if (listEl) wireCustomerOrderActions(listEl);

  onAuthStateChanged(auth, async (user) => {
    if (typeof unsub === "function") {
      unsub();
      unsub = null;
    }

    if (!user) {
      goLogin("customer.html");
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    if (nameEl) nameEl.textContent = userData.name || user.displayName || "-";
    if (emailEl) emailEl.textContent = userData.email || user.email || "-";
    if (ptsEl) ptsEl.textContent = String(userData.points || 0);

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

/* admin page */
function renderAdminOrderCard(order, currentUser) {
  const isAdmin = isAdminEmail(currentUser?.email);

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(order.customerName || "Customer")} • ${esc(serviceLabel(order.service))}</div>
          <div class="sub">${esc(order.customerEmail || "")} • ${esc(order.location || "")}</div>
          <div class="sub">${esc(order.date || "")} • ${esc(order.timeSlot || "")} • ${esc(order.price || "")}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>

      ${renderStepProgress(order.status || "Booked")}

      ${
        isAdmin
          ? `
          <div class="admin-row">
            <div class="admin-field">
              <label class="sub" for="status-${esc(order.id)}">Status</label>
              <select id="status-${esc(order.id)}" class="admin-status" data-id="${esc(order.id)}">
                ${STATUS.map((status) => `
                  <option value="${esc(status)}" ${order.status === status ? "selected" : ""}>${esc(status)}</option>
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
        `
          : ""
      }
    </div>
  `;
}

async function saveAdminOrder(orderId) {
  const statusEl = document.querySelector(`.admin-status[data-id="${orderId}"]`);
  const pointsEl = document.querySelector(`.admin-points[data-id="${orderId}"]`);

  if (!statusEl || !pointsEl) {
    toast("Missing admin fields");
    return;
  }

  const status = statusEl.value;
  const pointsAwarded = Math.max(0, Number(pointsEl.value || 0));

  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    toast("Order not found");
    return;
  }

  const prev = snap.data();
  const updates = {
    status,
    pointsAwarded,
    updatedAt: serverTimestamp()
  };

  await updateDoc(ref, updates);

  if (
    status === "Completed" &&
    !prev.pointsGranted &&
    prev.uid &&
    Number(pointsAwarded) > 0
  ) {
    await updateDoc(doc(db, "users", prev.uid), {
      points: increment(pointsAwarded)
    });

    await updateDoc(ref, {
      pointsGranted: true,
      updatedAt: serverTimestamp()
    });
  }

  toast("Order updated ✅");
}

function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders || adminOrders.dataset.bound === "1") return;
  adminOrders.dataset.bound = "1";

  const adminSearch = $("#adminSearch");
  const adminFilter = $("#adminFilter");

  let allOrders = [];
  let currentUser = null;
  let unsub = null;

  function render() {
    const search = String(adminSearch?.value || "").trim().toLowerCase();
    const filter = String(adminFilter?.value || "").trim();

    const items = allOrders.filter((order) => {
      const matchesFilter = !filter || order.status === filter;

      const haystack = [
        order.customerName,
        order.customerEmail,
        order.location,
        order.service,
        order.serviceLabel,
        order.date,
        order.timeSlot,
        order.id
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      return matchesFilter && matchesSearch;
    });

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

  adminOrders.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-admin-save]");
    if (!btn) return;

    if (!currentUser || !isAdminEmail(currentUser.email)) {
      toast("Admin only");
      return;
    }

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

    if (typeof unsub === "function") {
      unsub();
      unsub = null;
    }

    if (!user) {
      goLogin("admin.html");
      return;
    }

    if (!isAdminEmail(user.email)) {
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

/* home page */
function initHomePage() {
  const track = $(".carousel-track");
  const dotsWrap = $(".carousel-dots");
  const prevBtn = $(".carousel-btn.prev");
  const nextBtn = $(".carousel-btn.next");

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
      .map(
        (_, i) => `<button type="button" aria-label="Go to slide ${i + 1}" ${i === 0 ? 'class="active"' : ""}></button>`
      )
      .join("");

    [...dotsWrap.children].forEach((dot, i) => {
      dot.addEventListener("click", () => {
        index = i;
        renderCarousel();
      });
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

/* app bootstrap */
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