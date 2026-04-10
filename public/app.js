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
  onSnapshot,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const ADMIN_EMAIL = "danielasouzu2@gmail.com";

const STATUS = [
  "Booked", "Received", "Cleaning", "Drying & Finish",
  "Ready", "Awaiting Pickup", "Completed", "Cancelled",
];

const TRACKABLE_STATUS = [
  "Booked", "Received", "Cleaning", "Drying & Finish",
  "Ready", "Awaiting Pickup", "Completed",
];

const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00"];

const storage = getStorage();

const $ = (sel) => document.querySelector(sel);

function esc(val) {
  return String(val ?? "").replace(/[&<>"']/g, (c) =>
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

function serviceLabel(val) {
  if (val === "standard_clean") return "Standard Cleaning";
  if (val === "express") return "Express Service";
  if (val === "next_day") return "Next Day";
  return val || "";
}

function badgeClass(status) {
  if (status === "Completed") return "badge success";
  if (status === "Cancelled") return "badge danger";
  if (status === "Ready" || status === "Awaiting Pickup") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function isAdmin(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function isValidDate(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(val || ""));
}

function isValidTime(val) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(val || ""));
}

function setMsg(text, id = "msg") {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function toast(text) {
  let host = $("#toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    document.body.appendChild(host);
  }
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

// EmailJS — keeps template IDs in one place
function sendBookingEmail({ customerName, customerEmail, orderId, service, location, bookingDate, bookingTime, price, shoeNotes }) {
  if (!window.emailjs) return;
  window.emailjs.send("service_6ep5ahh", "template_qca25sq", {
    customer_name: customerName || "Customer",
    customer_email: customerEmail || "",
    order_id: orderId || "",
    service: service || "",
    location: location || "",
    booking_date: bookingDate || "",
    booking_time: bookingTime || "",
    price: price || "",
    shoe_notes: shoeNotes || "",
  }).catch(console.error);
}

// Missed drop-off reminder — customer booked but never showed up
// EmailJS template ID: template_missed_appt
// Template needs: {{customer_name}} {{customer_email}} {{order_id}} {{booking_date}} {{booking_time}} {{location}}
async function sendMissedEmail({ customerName, customerEmail, orderId, bookingDate, bookingTime, location }) {
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  await window.emailjs.send("service_6ep5ahh", "template_missed_appt", {
    customer_name: customerName || "Customer",
    customer_email: customerEmail || "",
    order_id: orderId || "",
    booking_date: bookingDate || "",
    booking_time: bookingTime || "",
    location: location || "",
  });
}

// Availability — checks the admin availability doc then cross-references existing bookings
async function getOpenSlots(dateISO, location) {
  const availSnap = await getDoc(doc(db, "availability", dateISO)).catch(() => null);
  const slots = availSnap?.exists() ? availSnap.data().slots || {} : {};

  const bookingSnap = await getDocs(
    query(collection(db, "orders"), where("date", "==", dateISO), where("location", "==", location))
  );
  const taken = new Set();
  bookingSnap.forEach((d) => {
    if (d.data().status !== "Cancelled") taken.add(d.data().timeSlot);
  });

  return TIME_SLOTS.filter((s) => slots[s] !== false && !taken.has(s));
}

async function slotAvailable(dateISO, location, timeSlot) {
  const open = await getOpenSlots(dateISO, location);
  return open.includes(timeSlot);
}

// Order card rendering — used on tracking, customer account, and admin pages
function progressPercent(status) {
  if (status === "Cancelled") return 0;
  const index = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  return Math.round((index / (TRACKABLE_STATUS.length - 1)) * 100);
}

function renderProgress(status) {
  const activeIndex = Math.max(0, TRACKABLE_STATUS.indexOf(status));
  const steps = TRACKABLE_STATUS.map((stage, i) => `
    <div class="step ${status === "Cancelled" ? "cancelled" : i <= activeIndex ? "active" : ""}">
      <span class="circle"></span>
      <span class="label">${esc(stage)}</span>
    </div>`).join("");
  return `<div class="order-tracker">${steps}</div>`;
}

function renderPickupBanner(order) {
  if (order.status === "Awaiting Pickup") {
    return `<div class="pickup-notice">
      <strong>Your shoes are ready for collection!</strong>
      Please pick them up from ${esc(order.location || "the branch")}.
    </div>`;
  }
  if (order.pickedUp) {
    return `<div class="pickup-collected">✅ Shoes collected</div>`;
  }
  return "";
}

function renderOrderCard(order) {
  const pct = progressPercent(order.status || "Booked");
  const canEdit = ["Booked", "Received"].includes(order.status);

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(serviceLabel(order.service))} &bull; ${esc(order.location)}</div>
          <div class="sub">${esc(order.date)} &bull; ${esc(order.timeSlot)} &bull; ${esc(order.price || "")}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>
      ${renderProgress(order.status || "Booked")}
      ${renderPickupBanner(order)}
      <div class="order-meta">
        <span class="sub">Order ID: ${esc(order.id)}</span>
        <span class="sub">${pct}%</span>
      </div>
      ${canEdit ? `
        <div class="order-actions">
          <button class="btn" type="button" data-action="reschedule" data-id="${esc(order.id)}">Reschedule</button>
          <button class="btn danger" type="button" data-action="cancel" data-id="${esc(order.id)}">Cancel</button>
        </div>` : ""}
    </div>`;
}

// Nav — shows/hides links based on whether the user is logged in or is admin
function goLogin(next = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}

async function setupNav(user) {
  const navLogin = $("#navLogin");
  const navRegister = $("#navRegister");
  const navLogout = $("#navLogout");
  const navAdmin = $("#navAdmin");

  if (!user) {
    if (navLogin) navLogin.hidden = false;
    if (navRegister) navRegister.hidden = false;
    if (navLogout) navLogout.hidden = true;
    if (navAdmin) navAdmin.hidden = true;
    return;
  }

  if (navLogin) navLogin.hidden = true;
  if (navRegister) navRegister.hidden = true;
  if (navAdmin) navAdmin.hidden = !isAdmin(user.email);

  if (navLogout && !navLogout._wired) {
    navLogout._wired = true;
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

  const badge = $("#navPointsBadge");
  if (badge) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const pts = snap.exists() ? Number(snap.data().points || 0) : 0;
      badge.textContent = `Points: ${pts}`;
      badge.hidden = false;
    } catch {
      badge.hidden = true;
    }
  }
}

// Redirect if a nav link needs auth and nobody is logged in
document.addEventListener("click", (e) => {
  const link = e.target?.closest?.("a[data-requires-auth='true']");
  if (!link || auth.currentUser) return;
  e.preventDefault();
  goLogin(link.getAttribute("href") || "home.html");
}, true);

function wireOverlay() {
  const overlay = $("#signupOverlay");
  if (!overlay) return;
  const hide = () => { overlay.hidden = true; };
  $("#closePopupBtn")?.addEventListener("click", (e) => { e.preventDefault(); hide(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) hide(); });
}

// Login page
function initLogin() {
  const btn = $("#btnLogin");
  if (!btn) return;

  const next = new URL(location.href).searchParams.get("next");

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("#logEmail")?.value.trim();
    const pass = $("#logPass")?.value;
    if (!email || !pass) { setMsg("Enter email and password"); return; }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast("Logged in ✅");
      location.replace(next ? decodeURIComponent(next) : "customer.html");
    } catch (err) {
      const msg = err?.code === "auth/invalid-credential" ? "Wrong email or password" : err.message;
      setMsg(msg);
      toast(msg);
    }
  });

  $("#btnSendReset")?.addEventListener("click", async () => {
    const email = ($("#resetEmail")?.value || $("#logEmail")?.value || "").trim();
    if (!email) { setMsg("Enter your email first"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("Reset email sent ✅ Check your inbox.");
      toast("Reset email sent ✅");
    } catch (err) {
      setMsg(err.message);
    }
  });
}

// Register page
function initRegister() {
  const btn = $("#btnRegister");
  if (!btn) return;

  const next = new URL(location.href).searchParams.get("next");

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const name = $("#regName")?.value.trim();
    const email = $("#regEmail")?.value.trim();
    const phone = $("#regPhone")?.value.trim();
    const pass = $("#regPass")?.value;

    if (!name || !email || !pass) {
      setMsg("Fill in name, email and password");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        name, email, phone: phone || "", points: 0, createdAt: serverTimestamp(),
      });
      toast("Registered ✅");
      location.replace(next ? decodeURIComponent(next) : "customer.html");
    } catch (err) {
      setMsg(err.message);
      toast("Register failed");
    }
  });
}

// Booking page
function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook) return;

  wireOverlay();

  function getPrice() {
    const svc = $("#service")?.value;
    if (svc === "standard_clean") return $("#standardPrice")?.value;
    if (svc === "express") return $("#expressPrice")?.value;
    if (svc === "next_day") return $("#nextdayPrice")?.value;
    return "";
  }

  function syncServiceUI() {
    const svc = $("#service")?.value;
    if ($("#standardPrices")) $("#standardPrices").hidden = svc !== "standard_clean";
    if ($("#expressPrices")) $("#expressPrices").hidden = svc !== "express";
    if ($("#nextdayPrices")) $("#nextdayPrices").hidden = svc !== "next_day";
    updateSummary();
  }

  function updateSummary() {
    const date = $("#date")?.value;
    const price = getPrice();

    if ($("#summaryService")) $("#summaryService").textContent = serviceLabel($("#service")?.value || "");
    if ($("#summaryLocation")) $("#summaryLocation").textContent = $("#location")?.value || "-";
    if ($("#summaryTime")) $("#summaryTime").textContent = $("#timeSlot")?.value || "-";
    if ($("#selectedPriceText") && $("#selectedPriceText").closest(".summary-row")) {
      $("#selectedPriceText").textContent = price || "£0";
    }
    if ($("#summaryDate") && date) {
      const d = new Date(date + "T00:00:00");
      $("#summaryDate").textContent = isNaN(d) ? date : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }

  async function refreshSlots(dateISO) {
    const loc = $("#location")?.value || "";
    const btns = document.querySelectorAll(".time-slot");
    if (!btns.length) return;

    const open = await getOpenSlots(dateISO, loc);
    btns.forEach((btn) => {
      const slot = btn.getAttribute("data-time");
      const available = open.includes(slot);
      btn.disabled = !available;
      btn.classList.toggle("slot-unavailable", !available);
      btn.style.opacity = available ? "" : "0.4";
      btn.style.cursor = available ? "" : "not-allowed";
      btn.style.textDecoration = available ? "" : "line-through";
      if (!available) btn.classList.remove("active");
    });

    const timeSlot = $("#timeSlot");
    if (timeSlot && !open.includes(timeSlot.value)) {
      timeSlot.value = "";
      btns.forEach((b) => b.classList.remove("active"));
      updateSummary();
    }
  }

  // Calendar
  const calBody = document.getElementById("calBody");
  const calLabel = document.getElementById("calMonthLabel");
  const calPrev = document.getElementById("calPrev");
  const calNext = document.getElementById("calNext");

  if (calBody && calPrev && calNext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let selectedDate = null;

    function buildCal() {
      if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
      calBody.innerHTML = "";

      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

      for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement("div");
        cell.className = "cal-cell cal-cell--other";
        cell.textContent = daysInPrev - firstDay + 1 + i;
        calBody.appendChild(cell);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        const date = new Date(viewYear, viewMonth, d);
        date.setHours(0, 0, 0, 0);
        cell.className = "cal-cell";
        cell.textContent = d;

        if (date < today) {
          cell.classList.add("cal-cell--past");
        } else {
          cell.addEventListener("click", () => pickDate(date));
        }

        if (date.toDateString() === today.toDateString()) cell.classList.add("cal-cell--today");
        if (selectedDate && date.toDateString() === selectedDate.toDateString()) cell.classList.add("cal-cell--selected");
        calBody.appendChild(cell);
      }

      const remaining = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
      for (let i = 1; i <= remaining; i++) {
        const cell = document.createElement("div");
        cell.className = "cal-cell cal-cell--other";
        cell.textContent = i;
        calBody.appendChild(cell);
      }
    }

    async function pickDate(date) {
      selectedDate = date;
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const hiddenInput = document.getElementById("date");
      if (hiddenInput) {
        hiddenInput.value = iso;
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const label = document.getElementById("selectedDateLabel");
      if (label) label.textContent = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      buildCal();
      updateSummary();
      await refreshSlots(iso);
    }

    calPrev.addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      buildCal();
    });

    calNext.addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      buildCal();
    });

    buildCal();
  }

  // Service cards
  document.querySelectorAll("[data-service-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const val = card.getAttribute("data-service-card");
      document.querySelectorAll("[data-service-card]").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      const svcSelect = $("#service");
      if (svcSelect) {
        svcSelect.value = val;
        svcSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      updateSummary();
    });
  });

  // Time slot buttons
  document.querySelectorAll(".time-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document.querySelectorAll(".time-slot").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const timeSelect = $("#timeSlot");
      if (timeSelect) {
        timeSelect.value = btn.getAttribute("data-time");
        timeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      updateSummary();
    });
  });

  $("#service")?.addEventListener("change", syncServiceUI);
  ["#standardPrice", "#expressPrice", "#nextdayPrice"].forEach((s) => $(s)?.addEventListener("change", updateSummary));
  $("#location")?.addEventListener("change", () => {
    updateSummary();
    const d = document.getElementById("date")?.value;
    if (d && isValidDate(d)) refreshSlots(d);
  });
  document.getElementById("date")?.addEventListener("change", updateSummary);
  syncServiceUI();

  // Map
  const locationData = {
    charles_street_leicester: {
      name: "Charles Street, Leicester",
      address: "Charles Street, Leicester, UK",
      mapsLink: "https://www.google.com/maps/search/?api=1&query=Charles+Street+Leicester+UK",
      embed: "https://www.google.com/maps?q=Charles%20Street%20Leicester%20UK&z=15&output=embed",
    },
    canada_water: {
      name: "Canada Water, London",
      address: "Canada Water, London, UK",
      mapsLink: "https://www.google.com/maps/search/?api=1&query=Canada+Water+London+UK",
      embed: "https://www.google.com/maps?q=Canada%20Water%20London%20UK&z=15&output=embed",
    },
  };

  function updateMap() {
    const picked = locationData[$("#location")?.value];
    if (!picked) return;
    if ($("#selectedBranchName")) $("#selectedBranchName").textContent = picked.name;
    if ($("#selectedBranchAddress")) $("#selectedBranchAddress").textContent = picked.address;
    if ($("#bookingMapFrame")) $("#bookingMapFrame").src = picked.embed;
    if ($("#openMapsBtn")) $("#openMapsBtn").href = picked.mapsLink;
  }
  $("#location")?.addEventListener("change", updateMap);
  updateMap();

  // Shoe image preview
  const imgInput = $("#shoeImages");
  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file = imgInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        if ($("#shoePreview")) $("#shoePreview").src = e.target.result;
        if ($("#shoePreviewWrap")) $("#shoePreviewWrap").hidden = false;
      };
      reader.readAsDataURL(file);
    });
  }

  // Pre-fill customer name if they have an account
  onAuthStateChanged(auth, async (user) => {
    const nameInput = $("#customerName");
    if (!user || !nameInput || nameInput.value.trim()) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      nameInput.value = snap.exists() ? snap.data().name || user.displayName || "" : user.displayName || "";
    } catch {
      // not critical, ignore
    }
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

    const service = $("#service")?.value;
    const loc = $("#location")?.value;
    const date = document.getElementById("date")?.value;
    const timeSlot = $("#timeSlot")?.value;
    const price = getPrice();
    const shoeNotes = $("#shoeNotes")?.value.trim() || "";
    const images = Array.from($("#shoeImages")?.files || []);

    if (!service || !loc || !date || !timeSlot || !price) {
      setMsg("Select service, location, date, time and price");
      return;
    }

    btnBook.disabled = true;
    btnBook.textContent = "Checking availability…";

    try {
      if (!(await slotAvailable(date, loc, timeSlot))) {
        setMsg("That slot is no longer available. Pick another time.");
        toast("Slot unavailable");
        await refreshSlots(date);
        return;
      }

      btnBook.textContent = "Processing...";

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const customerName = $("#customerName")?.value.trim() || userData.name || user.displayName || "Customer";
      const customerEmail = userData.email || user.email || "";
      const customerPhone = userData.phone || "";

      const orderRef = await addDoc(collection(db, "orders"), {
        uid: user.uid,
        customerName,
        customerEmail,
        customerPhone,
        service,
        serviceLabel: serviceLabel(service),
        location: loc,
        date,
        timeSlot,
        price,
        shoeNotes,
        status: "Booked",
        pickedUp: false,
        pointsAwarded: 10,
        pointsGranted: false,
        grantedPointsAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (images.length) {
        const urls = [];
        for (let i = 0; i < images.length; i++) {
          const ref = storageRef(storage, `orders/${orderRef.id}/${Date.now()}-${i}-${images[i].name}`);
          await uploadBytes(ref, images[i]);
          urls.push(await getDownloadURL(ref));
        }
        await updateDoc(orderRef, { imageUrls: urls, updatedAt: serverTimestamp() });
      }

      sendBookingEmail({
        customerName, customerEmail, orderId: orderRef.id,
        service: serviceLabel(service), location: loc,
        bookingDate: date, bookingTime: timeSlot, price, shoeNotes,
      });

      toast("Booking confirmed ✅");
      setMsg(`Order ID: ${orderRef.id}`);
      setTimeout(() => { location.href = "track.html"; }, 700);

    } catch (err) {
      console.error(err);
      setMsg("Booking failed");
      toast("Booking failed");
    } finally {
      btnBook.disabled = false;
      btnBook.textContent = "Confirm booking";
    }
  });
}

// Tracking page
function initTracking() {
  const ordersEl = $("#orders");
  if (!ordersEl) return;

  wireOverlay();

  ordersEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !auth.currentUser) return;
    const action = btn.getAttribute("data-action");
    const orderId = btn.getAttribute("data-id");
    try {
      if (action === "cancel") await cancelOrder(orderId);
      if (action === "reschedule") await rescheduleOrder(orderId);
    } catch (err) {
      console.error(err);
      toast("Action failed");
    }
  });

  ordersEl.innerHTML = `<div class="order-card"><div class="order-title">Loading…</div></div>`;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const overlay = $("#signupOverlay");
      if (overlay) overlay.hidden = false;
      ordersEl.innerHTML = `<div class="order-card">
        <div class="order-title">Please log in</div>
        <a class="btn primary" href="login.html?next=track.html">Go to Login</a>
      </div>`;
      return;
    }
    if ($("#signupOverlay")) $("#signupOverlay").hidden = true;

    onSnapshot(query(collection(db, "orders"), where("uid", "==", user.uid)), (snap) => {
      const orders = [];
      snap.forEach((d) => orders.push({ id: d.id, ...d.data() }));
      orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      const active = orders.filter((o) => !["Completed", "Cancelled", "Delivered", "Collected"].includes(o.status));
      ordersEl.innerHTML = active.length ? active.map(renderOrderCard).join("") : `
        <div class="order-card">
          <div class="order-title">No current orders</div>
          <p class="sub">Book a service to get started.</p>
          <a class="btn primary" href="booking.html">Go to Booking</a>
        </div>`;
    });
  });

  $("#btnRefresh")?.addEventListener("click", () => toast("Tracking is live ✅"));
}

async function cancelOrder(orderId) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { toast("Order not found"); return; }
  const data = snap.data();
  if (!["Booked", "Received"].includes(data.status)) {
    toast("This order can no longer be cancelled");
    return;
  }
  if (!confirm("Cancel this booking?")) return;
  await updateDoc(ref, { status: "Cancelled", updatedAt: serverTimestamp() });
  toast("Booking cancelled");
}

async function rescheduleOrder(orderId) {
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { toast("Order not found"); return; }
  const data = snap.data();
  if (!["Booked", "Received"].includes(data.status)) {
    toast("This order can no longer be rescheduled");
    return;
  }

  const newDate = prompt("New date (YYYY-MM-DD)", data.date || "");
  if (!newDate) return;
  const newTime = prompt("New time (HH:MM)", data.timeSlot || "");
  if (!newTime) return;

  if (!isValidDate(newDate.trim()) || !isValidTime(newTime.trim())) {
    toast("Use YYYY-MM-DD and HH:MM");
    return;
  }
  if (!(await slotAvailable(newDate.trim(), data.location, newTime.trim()))) {
    toast("That slot is taken");
    return;
  }

  await updateDoc(ref, { date: newDate.trim(), timeSlot: newTime.trim(), updatedAt: serverTimestamp() });
  toast("Booking rescheduled ✅");
}

// Customer account page
function initCustomer() {
  if (!$("#custOrders") && !$("#btnChangePass") && !$("#custName")) return;

  if ($("#custOrders")) {
    $("#custOrders").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn || !auth.currentUser) return;
      const action = btn.getAttribute("data-action");
      const orderId = btn.getAttribute("data-id");
      try {
        if (action === "cancel") await cancelOrder(orderId);
        if (action === "reschedule") await rescheduleOrder(orderId);
      } catch (err) {
        console.error(err);
      }
    });
  }

  $("#btnCustRefresh")?.addEventListener("click", () => toast("Account is live ✅"));

  onAuthStateChanged(auth, async (user) => {
    if (!user) { goLogin("customer.html"); return; }

    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    if ($("#custName")) $("#custName").textContent = userData.name || user.displayName || "-";
    if ($("#custEmail")) $("#custEmail").textContent = userData.email || user.email || "-";
    if ($("#custPoints")) $("#custPoints").textContent = String(userData.points || 0);

    const orderList = $("#custOrders");
    if (orderList) {
      onSnapshot(query(collection(db, "orders"), where("uid", "==", user.uid)), (snap2) => {
        const orders = [];
        snap2.forEach((d) => orders.push({ id: d.id, ...d.data() }));
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        orderList.innerHTML = orders.slice(0, 4).map(renderOrderCard).join("") ||
          `<div class="order-card"><div class="order-title">No orders yet</div></div>`;
      });
    }

    const changePassBtn = $("#btnChangePass");
    if (changePassBtn) {
      changePassBtn.addEventListener("click", async () => {
        const currentPass = $("#curPass")?.value;
        const newPass = $("#newPass")?.value;
        if (!currentPass || !newPass) {
          setMsg("Enter current and new password", "passMsg");
          return;
        }
        try {
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPass));
          await updatePassword(user, newPass);
          setMsg("Password updated ✅", "passMsg");
          toast("Password updated ✅");
          if ($("#curPass")) $("#curPass").value = "";
          if ($("#newPass")) $("#newPass").value = "";
        } catch (err) {
          setMsg(err.message || "Failed", "passMsg");
        }
      });
    }
  });
}

// Admin helpers
function getImageUrls(order) {
  const urls = [];
  ["imageUrl", "photoUrl", "uploadUrl", "beforeImage", "beforeImageUrl"].forEach((field) => {
    const val = order?.[field];
    if (typeof val === "string" && val.trim()) urls.push(val.trim());
  });
  ["imageUrls", "photos", "uploads", "images"].forEach((field) => {
    const val = order?.[field];
    if (Array.isArray(val)) val.forEach((u) => { if (typeof u === "string" && u.trim()) urls.push(u.trim()); });
  });
  return [...new Set(urls)];
}

function findConflicts(orders) {
  const active = orders.filter((o) => o.status !== "Cancelled");
  const groups = {};
  active.forEach((o) => {
    const key = `${o.date}__${o.timeSlot}__${o.location}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });
  return Object.values(groups).filter((g) => g.length > 1);
}

function renderAdminCard(order, currentUser, conflict = false) {
  const status = order.status || "Booked";
  const canEdit = isAdmin(currentUser?.email);
  const imageUrls = getImageUrls(order);

  const imageBlock = imageUrls.length ? `
    <div class="admin-images" style="margin-top:12px;">
      <div class="sub" style="margin-bottom:8px;">Customer Uploads</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${imageUrls.map((url, i) => `
          <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            <img src="${esc(url)}" alt="Upload ${i + 1}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);" loading="lazy"/>
          </a>`).join("")}
      </div>
    </div>` : "";

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">
            ${esc(order.customerName || "Customer")} &bull; ${esc(serviceLabel(order.service))}
            ${conflict ? `<span class="conflict-badge">Conflict</span>` : ""}
          </div>
          <div class="sub">${esc(order.customerEmail || "")}${order.customerPhone ? ` &bull; ${esc(order.customerPhone)}` : ""}</div>
          <div class="sub">${esc(order.location || "")}</div>
          <div class="sub">${esc(order.date || "")} &bull; ${esc(order.timeSlot || "")} &bull; ${esc(order.price || "")}</div>
          <div class="sub">Order ID: ${esc(order.id)}</div>
          <div class="sub">Picked up: ${order.pickedUp ? "✅ Yes" : "No"}</div>
        </div>
        <span class="${badgeClass(status)}">${esc(status)}</span>
      </div>
      ${renderProgress(status)}
      ${imageBlock}
      ${canEdit ? `
        <div class="admin-row" style="margin-top:14px;">
          <div class="admin-field">
            <label class="sub">Status</label>
            <select class="admin-status" data-id="${esc(order.id)}">
              ${STATUS.map((s) => `<option value="${esc(s)}" ${status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
            </select>
          </div>
          <div class="admin-field">
            <label class="sub">Points to award</label>
            <input class="admin-points" data-id="${esc(order.id)}" type="number" min="0" value="${esc(order.pointsAwarded ?? 10)}" />
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

async function saveOrder(orderId) {
  const statusEl = document.querySelector(`.admin-status[data-id="${orderId}"]`);
  const pointsEl = document.querySelector(`.admin-points[data-id="${orderId}"]`);
  if (!statusEl || !pointsEl) { toast("Fields missing"); return; }

  const status = statusEl.value;
  const points = Math.max(0, Number(pointsEl.value || 0));
  const ref = doc(db, "orders", orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { toast("Order not found"); return; }

  const prev = snap.data();
  const prevGranted = Number(prev.grantedPointsAmount || 0);
  const newGranted = status === "Completed" ? points : 0;
  const delta = newGranted - prevGranted;

  if (prev.uid && delta !== 0) {
    await setDoc(doc(db, "users", prev.uid), { points: increment(delta) }, { merge: true });
  }

  await updateDoc(ref, {
    status,
    pickedUp: status === "Completed",
    pointsAwarded: points,
    pointsGranted: newGranted > 0,
    grantedPointsAmount: newGranted,
    updatedAt: serverTimestamp(),
  });
  toast("Order updated ✅");
}

// Admin sidebar — lets admin open/close time slots per day
function initAvailabilityCalendar() {
  const calBody = document.getElementById("availCalBody");
  if (!calBody) return;

  const calLabel = document.getElementById("availMonthLabel");
  const prevBtn = document.getElementById("availPrev");
  const nextBtn = document.getElementById("availNext");
  const editor = document.getElementById("availSlotEditor");
  const selLabel = document.getElementById("availSelectedLabel");
  const slotGrid = document.getElementById("availSlotGrid");
  const btnOpen = document.getElementById("btnAvailOpenAll");
  const btnClose = document.getElementById("btnAvailCloseAll");
  const btnSave = document.getElementById("btnAvailSave");

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = null;
  let cache = {};

  function getSlots(iso) {
    return cache[iso] ? { ...cache[iso] } : Object.fromEntries(TIME_SLOTS.map((s) => [s, true]));
  }

  async function loadMonth() {
    const m = pad(viewMonth + 1);
    try {
      const q = query(collection(db, "availability"), where("__name__", ">=", `${viewYear}-${m}-01`), where("__name__", "<=", `${viewYear}-${m}-31`));
      const snap = await getDocs(q);
      snap.forEach((d) => { cache[d.id] = d.data().slots || {}; });
    } catch (err) {
      console.error(err);
    }
  }

  async function buildCal() {
    if (calLabel) calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonth();
    calBody.innerHTML = "";

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className = "avail-cell avail-cell--other";
      cell.textContent = daysInPrev - firstDay + 1 + i;
      calBody.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      date.setHours(0, 0, 0, 0);
      const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const cell = document.createElement("div");
      cell.className = "avail-cell";
      cell.textContent = d;

      if (date < today) {
        cell.classList.add("avail-cell--past");
      } else {
        const openCount = TIME_SLOTS.filter((s) => getSlots(iso)[s] !== false).length;
        cell.classList.add(openCount === 0 ? "avail-cell--closed" : "avail-cell--open");
        cell.addEventListener("click", () => pickDate(iso, date));
      }

      if (date.toDateString() === today.toDateString()) cell.classList.add("avail-cell--today");
      if (selectedDate === iso) cell.classList.add("avail-cell--selected");
      calBody.appendChild(cell);
    }

    const remaining = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement("div");
      cell.className = "avail-cell avail-cell--other";
      cell.textContent = i;
      calBody.appendChild(cell);
    }
  }

  function pickDate(iso, dateObj) {
    selectedDate = iso;
    buildCal();
    renderSlotEditor(iso, dateObj);
  }

  function renderSlotEditor(iso, dateObj) {
    if (!editor || !slotGrid || !selLabel) return;
    editor.style.display = "block";
    selLabel.textContent = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    slotGrid.innerHTML = "";

    const slots = getSlots(iso);
    TIME_SLOTS.forEach((slot) => {
      const isOpen = slots[slot] !== false;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `avail-slot-btn ${isOpen ? "slot-open" : "slot-closed"}`;
      btn.innerHTML = `<span class="avail-slot-dot"></span>${slot}`;
      btn.addEventListener("click", () => {
        if (!cache[iso]) cache[iso] = getSlots(iso);
        cache[iso][slot] = !isOpen;
        renderSlotEditor(iso, dateObj);
        buildCal();
      });
      slotGrid.appendChild(btn);
    });
  }

  btnOpen?.addEventListener("click", () => {
    if (!selectedDate) return;
    if (!cache[selectedDate]) cache[selectedDate] = getSlots(selectedDate);
    TIME_SLOTS.forEach((s) => { cache[selectedDate][s] = true; });
    renderSlotEditor(selectedDate, new Date(selectedDate + "T00:00:00"));
    buildCal();
  });

  btnClose?.addEventListener("click", () => {
    if (!selectedDate) return;
    if (!cache[selectedDate]) cache[selectedDate] = getSlots(selectedDate);
    TIME_SLOTS.forEach((s) => { cache[selectedDate][s] = false; });
    renderSlotEditor(selectedDate, new Date(selectedDate + "T00:00:00"));
    buildCal();
  });

  btnSave?.addEventListener("click", async () => {
    if (!selectedDate) { toast("Select a date first"); return; }
    btnSave.disabled = true;
    btnSave.textContent = "Saving…";
    try {
      await setDoc(doc(db, "availability", selectedDate), {
        slots: cache[selectedDate] || getSlots(selectedDate),
        updatedAt: serverTimestamp(),
      });
      toast(`Saved for ${selectedDate} ✅`);
      buildCal();
    } catch (err) {
      console.error(err);
      toast("Save failed");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Save";
    }
  });

  prevBtn?.addEventListener("click", async () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDate = null;
    if (editor) editor.style.display = "none";
    await buildCal();
  });

  nextBtn?.addEventListener("click", async () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDate = null;
    if (editor) editor.style.display = "none";
    await buildCal();
  });

  buildCal();
}

// Admin page
function initAdmin() {
  const adminOrders = $("#adminOrders");
  if (!adminOrders) return;

  initAvailabilityCalendar();

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById(`tab${target.charAt(0).toUpperCase() + target.slice(1)}`);
      if (panel) panel.classList.add("active");
    });
  });

  const adminSearch = $("#adminSearch");
  const adminFilter = $("#adminFilter");
  const conflictsList = $("#conflictsList");
  const conflictCount = $("#conflictCount");
  const scheduleList = $("#scheduleList");
  const missedPanel = $("#tabAppointment");
  const todayLabel = $("#todayLabel");
  const debugUid = $("#debugUid");
  const debugRole = $("#debugRole");

  let allOrders = [];
  let currentUser = null;

  const isoToday = todayISO();
  if (todayLabel) todayLabel.textContent = `Today's bookings — ${isoToday}`;

  function renderMissedTab() {
    if (!missedPanel) return;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);

    // A missed appointment is one still sitting at "Booked" after the date has passed
    // meaning the customer booked but never showed up to drop off their shoes
    const missed = allOrders.filter((o) =>
      o.status === "Booked" && o.date && new Date(o.date + "T00:00:00") < cutoff
    );

    const header = `
      <div class="card soft" style="margin-bottom:16px;padding:14px 18px;">
        <div class="card-title" style="font-size:0.95rem;">
          Missed Drop-off Appointments
          ${missed.length ? `<span class="badge danger" style="margin-left:8px;font-size:0.75rem;">${missed.length}</span>` : ""}
        </div>
        <p class="sub" style="margin-top:4px;font-size:0.88rem;">
          These customers booked a drop-off slot but never arrived.
          Notify them to rebook, or cancel the order.
        </p>
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
            <div class="sub">${esc(o.location || "")}</div>
            <div class="sub">${esc(o.date || "")} at ${esc(o.timeSlot || "")} &bull; ${esc(o.price || "")}</div>
            <div class="sub">Order ID: ${esc(o.id)}</div>
            <div class="sub" style="color:#ef4444;font-weight:600;margin-top:4px;">
              Customer did not drop off shoes — appointment date has passed
            </div>
          </div>
          <span class="badge danger">No-show</span>
        </div>
        ${renderProgress(o.status)}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn primary" type="button"
            data-notify-missed="${esc(o.id)}"
            data-name="${esc(o.customerName || "Customer")}"
            data-email="${esc(o.customerEmail || "")}"
            data-date="${esc(o.date || "")}"
            data-time="${esc(o.timeSlot || "")}"
            data-loc="${esc(o.location || "")}">
            Notify customer
          </button>
          <button class="btn secondary" type="button" data-cancel-missed="${esc(o.id)}">
            Cancel order
          </button>
        </div>
      </div>`).join("");
  }

  function renderAll() {
    const search = (adminSearch?.value || "").trim().toLowerCase();
    const filter = (adminFilter?.value || "") === "All" ? "" : (adminFilter?.value || "").trim();
    const conflicts = findConflicts(allOrders);
    const conflictIds = new Set(conflicts.flat().map((o) => o.id));

    if (conflictCount) conflictCount.textContent = String(conflicts.length);

    if (conflictsList) {
      conflictsList.innerHTML = conflicts.length === 0
        ? `<div class="order-card"><div class="order-title">No conflicts ✅</div></div>`
        : conflicts.map((g) => `
            <div style="margin-bottom:18px;">
              <div class="sub" style="font-weight:700;color:var(--warning);margin-bottom:8px;">
                ${g.length} orders — ${esc(g[0].date)} &bull; ${esc(g[0].timeSlot)} &bull; ${esc(g[0].location)}
              </div>
              ${g.map((o) => renderAdminCard(o, currentUser, true)).join("")}
            </div>`).join("");
    }

    if (scheduleList) {
      const todayOrders = allOrders
        .filter((o) => o.date === isoToday && o.status !== "Cancelled")
        .sort((a, b) => (a.timeSlot || "").localeCompare(b.timeSlot || ""));
      scheduleList.innerHTML = todayOrders.length
        ? todayOrders.map((o) => renderAdminCard(o, currentUser, conflictIds.has(o.id))).join("")
        : `<div class="order-card"><div class="order-title">No bookings today</div></div>`;
    }

    renderMissedTab();

    if ($("#adminTotalOrders")) $("#adminTotalOrders").textContent = String(allOrders.length);
    if ($("#adminOpenOrders")) $("#adminOpenOrders").textContent = String(allOrders.filter((o) => !["Completed", "Cancelled"].includes(o.status)).length);
    if ($("#adminCompletedOrders")) $("#adminCompletedOrders").textContent = String(allOrders.filter((o) => o.status === "Completed").length);
    if ($("#adminWithImages")) $("#adminWithImages").textContent = String(allOrders.filter((o) => getImageUrls(o).length > 0).length);

    const filtered = allOrders.filter((o) => {
      const matchesFilter = !filter || o.status === filter;
      const haystack = [o.customerName, o.customerEmail, o.location, o.service, o.date, o.timeSlot, o.price, o.status, o.id].join(" ").toLowerCase();
      return matchesFilter && (!search || haystack.includes(search));
    });

    adminOrders.innerHTML = filtered.length
      ? filtered.map((o) => renderAdminCard(o, currentUser, conflictIds.has(o.id))).join("")
      : `<div class="order-card"><div class="order-title">No matching orders</div></div>`;
  }

  adminSearch?.addEventListener("input", renderAll);
  adminFilter?.addEventListener("change", renderAll);
  $("#btnAdminRefresh")?.addEventListener("click", () => { renderAll(); toast("Refreshed ✅"); });

  adminOrders.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-admin-save]");
    if (!btn || !isAdmin(currentUser?.email)) return;
    try {
      await saveOrder(btn.getAttribute("data-admin-save"));
    } catch (err) {
      console.error(err);
      toast("Update failed");
    }
  });

  document.addEventListener("click", async (e) => {
    if (!isAdmin(currentUser?.email)) return;

    const notifyBtn = e.target.closest("[data-notify-missed]");
    if (notifyBtn) {
      const email = notifyBtn.getAttribute("data-email");
      if (!email) { toast("No email for this customer"); return; }
      notifyBtn.disabled = true;
      notifyBtn.textContent = "Sending…";
      try {
        await sendMissedEmail({
          customerName: notifyBtn.getAttribute("data-name"),
          customerEmail: email,
          orderId: notifyBtn.getAttribute("data-notify-missed"),
          bookingDate: notifyBtn.getAttribute("data-date"),
          bookingTime: notifyBtn.getAttribute("data-time"),
          location: notifyBtn.getAttribute("data-loc"),
        });
        toast(`Reminder sent to ${email} ✅`);
        notifyBtn.textContent = "✅ Sent";
      } catch (err) {
        console.error(err);
        toast("Email failed — check template ID is template_missed_appt");
        notifyBtn.disabled = false;
        notifyBtn.textContent = "Notify customer";
      }
      return;
    }

    const cancelBtn = e.target.closest("[data-cancel-missed]");
    if (cancelBtn) {
      if (!confirm("Cancel this no-show order?")) return;
      try {
        await updateDoc(doc(db, "orders", cancelBtn.getAttribute("data-cancel-missed")), {
          status: "Cancelled",
          updatedAt: serverTimestamp(),
        });
        toast("Order cancelled ✅");
      } catch (err) {
        console.error(err);
        toast("Cancel failed");
      }
      return;
    }

    const saveBtn = e.target.closest("[data-admin-save]");
    if (saveBtn && !saveBtn.closest("#adminOrders")) {
      try {
        await saveOrder(saveBtn.getAttribute("data-admin-save"));
      } catch (err) {
        console.error(err);
        toast("Update failed");
      }
    }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (debugUid) debugUid.textContent = user?.uid || "-";
    if (debugRole) debugRole.textContent = user ? (isAdmin(user.email) ? "Admin" : "User") : "-";

    if (!user) { goLogin("admin.html"); return; }
    if (!isAdmin(user.email)) {
      adminOrders.innerHTML = `<div class="order-card"><div class="order-title">Access denied</div></div>`;
      return;
    }

    onSnapshot(query(collection(db, "orders")), (snap) => {
      allOrders = [];
      snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
      allOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderAll();
    }, (err) => {
      console.error(err);
      toast("Admin load failed");
    });
  });
}

// Schedule page
function initSchedule() {
  const calGrid = document.getElementById("schedCalGrid");
  if (!calGrid) return;

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  let allOrders = [];
  let availCache = {};

  function isoFrom(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function bookingsFor(iso) {
    return allOrders.filter((o) => o.date === iso && o.status !== "Cancelled");
  }

  function slotsFor(iso) {
    return availCache[iso] ? { ...availCache[iso] } : Object.fromEntries(TIME_SLOTS.map((s) => [s, true]));
  }

  async function loadMonthAvail() {
    const m = pad(viewMonth + 1);
    try {
      const q = query(collection(db, "availability"), where("__name__", ">=", `${viewYear}-${m}-01`), where("__name__", "<=", `${viewYear}-${m}-31`));
      const snap = await getDocs(q);
      snap.forEach((d) => { availCache[d.id] = d.data().slots || {}; });
    } catch (err) {
      console.error(err);
    }
  }

  async function buildCal() {
    const monthLabel = document.getElementById("schedMonthLabel");
    if (monthLabel) monthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    await loadMonthAvail();
    calGrid.innerHTML = "";

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className = "sched-cell sched-cell--other";
      cell.innerHTML = `<span class="sched-cell-num">${daysInPrev - firstDay + 1 + i}</span>`;
      calGrid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      date.setHours(0, 0, 0, 0);
      const iso = isoFrom(date);
      const cell = document.createElement("div");
      cell.className = "sched-cell";

      const slots = slotsFor(iso);
      const bks = bookingsFor(iso);
      const bookedSet = new Set(bks.map((o) => o.timeSlot));
      const openCount = TIME_SLOTS.filter((s) => slots[s] !== false).length;
      const freeCount = TIME_SLOTS.filter((s) => slots[s] !== false && !bookedSet.has(s)).length;

      if (date < today) cell.classList.add("sched-cell--past");
      if (iso === isoFrom(today)) cell.classList.add("sched-cell--today");
      if (iso === selectedISO) cell.classList.add("sched-cell--selected");

      if (date >= today) {
        if (openCount === 0) cell.classList.add("sched-cell--all-closed");
        else if (freeCount === 0 || bks.length > 0) cell.classList.add("sched-cell--partial");
        else cell.classList.add("sched-cell--all-open");
      }

      const dots = TIME_SLOTS.map((s) => {
        const cls = slots[s] === false ? "sched-slot-dot--closed" : bookedSet.has(s) ? "sched-slot-dot--booked" : "";
        return `<span class="sched-slot-dot ${cls}"></span>`;
      }).join("");

      cell.innerHTML = `
        <span class="sched-cell-num">${d}</span>
        ${bks.length ? `<span class="sched-cell-count">${bks.length}</span>` : ""}
        <div class="sched-cell-dots">${dots}</div>`;

      if (date >= today) cell.addEventListener("click", () => selectDate(iso, date));
      calGrid.appendChild(cell);
    }

    const remaining = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement("div");
      cell.className = "sched-cell sched-cell--other";
      cell.innerHTML = `<span class="sched-cell-num">${i}</span>`;
      calGrid.appendChild(cell);
    }

    updateStats();
    buildWeek();
  }

  function selectDate(iso, dateObj) {
    selectedISO = iso;
    buildCal();
    renderSlotEditor(iso);
    renderTimeline(iso);
  }

  function renderSlotEditor(iso) {
    const grid = document.getElementById("schedSlotGrid");
    const title = document.getElementById("schedEditorTitle");
    if (!grid || !title) return;

    title.textContent = new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    grid.innerHTML = "";

    const slots = slotsFor(iso);
    const bks = bookingsFor(iso);
    const booked = new Set(bks.map((o) => o.timeSlot));

    TIME_SLOTS.forEach((slot) => {
      const isBooked = booked.has(slot);
      const isOpen = slots[slot] !== false;
      const count = bks.filter((o) => o.timeSlot === slot).length;

      const item = document.createElement("div");
      item.className = `sched-slot-item ${isBooked ? "slot-booked" : isOpen ? "slot-open" : "slot-closed"}`;
      item.innerHTML = `
        <div class="sched-slot-left">
          <div class="sched-slot-icon">${isBooked ? "Booked" : isOpen ? "Open" : "Closed"}</div>
          <span class="sched-slot-time">${slot}</span>
          ${isBooked ? `<span style="font-size:0.7rem;color:var(--text-3);margin-left:4px;">(${count})</span>` : ""}
        </div>
        <span class="sched-slot-status">${isBooked ? "Booked" : isOpen ? "Open" : "Closed"}</span>`;

      if (!isBooked) {
        item.style.cursor = "pointer";
        item.addEventListener("click", () => {
          if (!availCache[iso]) availCache[iso] = slotsFor(iso);
          availCache[iso][slot] = !isOpen;
          renderSlotEditor(iso);
          buildCal();
        });
      }
      grid.appendChild(item);
    });
  }

  function renderTimeline(iso) {
    const timeline = document.getElementById("schedTimeline");
    if (!timeline) return;

    const titleEl = document.getElementById("schedDayTitle");
    const isoEl = document.getElementById("schedDayISO");
    const countEl = document.getElementById("schedDayCount");

    if (titleEl) titleEl.textContent = iso === isoFrom(today) ? "Today's Orders" : `Orders — ${iso}`;
    if (isoEl) isoEl.textContent = new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    const bks = bookingsFor(iso);
    if (countEl) countEl.textContent = `${bks.length} order${bks.length !== 1 ? "s" : ""}`;

    if (!bks.length) {
      timeline.innerHTML = `<div class="sched-empty-day"><p>No orders for this date.</p></div>`;
      return;
    }

    const conflictIds = new Set(findConflicts(allOrders.filter((o) => o.date === iso)).flat().map((o) => o.id));
    const grouped = Object.fromEntries(TIME_SLOTS.map((s) => [s, []]));
    bks.forEach((o) => {
      const slot = o.timeSlot || "Unknown";
      if (!grouped[slot]) grouped[slot] = [];
      grouped[slot].push(o);
    });

    timeline.innerHTML = "";
    Object.entries(grouped).forEach(([slot, orders]) => {
      if (!orders.length) return;
      const group = document.createElement("div");
      group.className = "sched-time-slot-group";
      const heading = document.createElement("div");
      heading.className = "sched-time-heading";
      heading.textContent = slot;
      group.appendChild(heading);

      orders.forEach((o) => {
        const row = document.createElement("div");
        row.className = `sched-order-row${conflictIds.has(o.id) ? " conflict-row" : ""}`;

        const pickupTag = o.pickedUp
          ? `<span class="pickup-tag pickup-tag--done">Picked up</span>`
          : o.status === "Awaiting Pickup"
            ? `<span class="pickup-tag pickup-tag--waiting">Awaiting pickup</span>`
            : "";

        row.innerHTML = `
          <div class="sched-order-avatar">${esc((o.customerName || "?").charAt(0).toUpperCase())}</div>
          <div class="sched-order-info">
            <div class="sched-order-name">${esc(o.customerName || "Customer")} ${pickupTag}</div>
            <div class="sched-order-meta">${esc(serviceLabel(o.service))} &bull; ${esc(o.location || "")}${conflictIds.has(o.id) ? " — Conflict" : ""}</div>
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
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return bookingsFor(isoFrom(d)).length;
    });
    const max = Math.max(...counts, 1);

    counts.forEach((count, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = isoFrom(d);
      const cell = document.createElement("div");
      cell.className = "sched-week-day";
      if (i === 0) cell.classList.add("is-today");
      if (iso === selectedISO) cell.classList.add("is-selected");

      cell.innerHTML = `
        <div class="sched-week-name">${DAYS_SHORT[d.getDay()]}</div>
        <div class="sched-week-num">${d.getDate()}</div>
        <div class="sched-week-bar-wrap">
          <div class="sched-week-bar" style="height:${Math.max(Math.round((count / max) * 100), 8)}%"></div>
        </div>
        <div class="sched-week-orders">${count} order${count !== 1 ? "s" : ""}</div>`;

      cell.addEventListener("click", () => selectDate(iso, new Date(d)));
      weekGrid.appendChild(cell);
    });
  }

  function updateStats() {
    const isoTod = isoFrom(today);
    const todayBks = bookingsFor(isoTod);
    const slots = slotsFor(isoTod);
    const bookedNow = new Set(todayBks.map((o) => o.timeSlot));
    const openNow = TIME_SLOTS.filter((s) => slots[s] !== false && !bookedNow.has(s)).length;

    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      weekTotal += bookingsFor(isoFrom(d)).length;
    }

    if (document.getElementById("schedTodayCount")) document.getElementById("schedTodayCount").textContent = String(todayBks.length);
    if (document.getElementById("schedWeekCount")) document.getElementById("schedWeekCount").textContent = String(weekTotal);
    if (document.getElementById("schedOpenSlots")) document.getElementById("schedOpenSlots").textContent = String(openNow);
    if (document.getElementById("schedConflicts")) document.getElementById("schedConflicts").textContent = String(findConflicts(allOrders).length);
  }

  document.getElementById("btnSchedOpenAll")?.addEventListener("click", () => {
    if (!selectedISO) return;
    if (!availCache[selectedISO]) availCache[selectedISO] = slotsFor(selectedISO);
    TIME_SLOTS.forEach((s) => { availCache[selectedISO][s] = true; });
    renderSlotEditor(selectedISO);
    buildCal();
  });

  document.getElementById("btnSchedCloseAll")?.addEventListener("click", () => {
    if (!selectedISO) return;
    if (!availCache[selectedISO]) availCache[selectedISO] = slotsFor(selectedISO);
    TIME_SLOTS.forEach((s) => { availCache[selectedISO][s] = false; });
    renderSlotEditor(selectedISO);
    buildCal();
  });

  document.getElementById("btnSchedSave")?.addEventListener("click", async () => {
    if (!selectedISO) { toast("Select a date first"); return; }
    const saveBtn = document.getElementById("btnSchedSave");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await setDoc(doc(db, "availability", selectedISO), {
        slots: availCache[selectedISO] || slotsFor(selectedISO),
        updatedAt: serverTimestamp(),
      });
      toast(`Saved for ${selectedISO} ✅`);
      buildCal();
    } catch (err) {
      console.error(err);
      toast("Save failed");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });

  // Reschedule modal
  document.getElementById("btnSchedReschedule")?.addEventListener("click", () => {
    const bks = bookingsFor(selectedISO);
    if (!bks.length) { toast("No bookings on this date"); return; }

    let modal = document.getElementById("reschedModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "reschedModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;";

    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:18px;padding:28px 26px;width:min(480px,100%);box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:inherit;";
    box.innerHTML = `
      <h2 style="margin:0 0 6px;font-size:1.25rem;color:#111f3d;">Reschedule booking</h2>
      <p style="margin:0 0 20px;font-size:0.88rem;color:#69758b;">Choose an order, then pick a new date and time.</p>
      <label style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em;">Order</label>
      <select id="rModalOrder" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:16px;font:inherit;">
        ${bks.map((o) => `<option value="${esc(o.id)}">${esc(o.customerName || "Customer")} — ${esc(o.timeSlot)} — ${esc(serviceLabel(o.service))}</option>`).join("")}
      </select>
      <label style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em;">New date</label>
      <input id="rModalDate" type="date" value="${selectedISO}" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:16px;font:inherit;"/>
      <label style="display:block;font-size:0.8rem;font-weight:700;color:#44506a;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em;">New time slot</label>
      <select id="rModalTime" style="width:100%;min-height:44px;padding:9px 12px;border:1px solid #c7d3e3;border-radius:10px;margin-bottom:22px;font:inherit;">
        ${TIME_SLOTS.map((s) => `<option value="${s}">${s}</option>`).join("")}
      </select>
      <div style="display:flex;gap:10px;">
        <button id="rModalCancel" type="button" style="flex:1;min-height:44px;border-radius:10px;border:1px solid #c7d3e3;background:#f5f9ff;color:#44506a;font:inherit;font-weight:700;cursor:pointer;">Cancel</button>
        <button id="rModalConfirm" type="button" style="flex:1;min-height:44px;border-radius:10px;border:1px solid #0057b8;background:linear-gradient(180deg,#1f74ea,#006ce4);color:#fff;font:inherit;font-weight:700;cursor:pointer;">Confirm reschedule</button>
      </div>
      <p id="rModalMsg" style="margin:10px 0 0;font-size:0.82rem;color:#c93c3c;min-height:18px;"></p>`;

    modal.appendChild(box);
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    document.getElementById("rModalCancel").addEventListener("click", () => modal.remove());

    document.getElementById("rModalConfirm").addEventListener("click", async () => {
      const orderId = document.getElementById("rModalOrder").value;
      const newDate = document.getElementById("rModalDate").value.trim();
      const newTime = document.getElementById("rModalTime").value;
      const msgEl = document.getElementById("rModalMsg");
      const confirmBtn = document.getElementById("rModalConfirm");

      if (!isValidDate(newDate)) { msgEl.textContent = "Invalid date."; return; }
      const order = bks.find((o) => o.id === orderId);
      if (!order) { msgEl.textContent = "Order not found."; return; }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Checking…";
      try {
        if (!(await slotAvailable(newDate, order.location, newTime))) {
          msgEl.textContent = "That slot is already taken.";
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Confirm reschedule";
          return;
        }
        await updateDoc(doc(db, "orders", orderId), { date: newDate, timeSlot: newTime, updatedAt: serverTimestamp() });
        toast(`Rescheduled to ${newDate} at ${newTime} ✅`);
        modal.remove();
        renderTimeline(selectedISO);
        buildCal();
      } catch (err) {
        console.error(err);
        msgEl.textContent = "Reschedule failed.";
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm reschedule";
      }
    });
  });

  document.getElementById("schedPrev")?.addEventListener("click", async () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    await buildCal();
  });

  document.getElementById("schedNext")?.addEventListener("click", async () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    await buildCal();
  });

  document.getElementById("btnWeekRefresh")?.addEventListener("click", () => { buildCal(); toast("Refreshed ✅"); });

  onAuthStateChanged(auth, (user) => {
    if (!user || !isAdmin(user.email)) {
      calGrid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-3);">Admin access required.</div>`;
      return;
    }
    onSnapshot(query(collection(db, "orders")), (snap) => {
      allOrders = [];
      snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
      buildCal();
      renderSlotEditor(selectedISO);
      renderTimeline(selectedISO);
    });
  });

  buildCal();
  renderTimeline(selectedISO);
}

// Carousel on the home page
function initCarousel() {
  const track = document.querySelector(".carousel-track");
  const dotsWrap = document.querySelector(".carousel-dots");
  if (!track || !dotsWrap) return;

  const slides = [...track.children];
  let index = 0;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsWrap.children].forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-pressed", String(i === index));
    });
  }

  dotsWrap.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Go to slide ${i + 1}"${i === 0 ? ' class="active"' : ""}></button>`).join("");
  [...dotsWrap.children].forEach((dot, i) => dot.addEventListener("click", () => { index = i; render(); }));
  document.querySelector(".carousel-btn.prev")?.addEventListener("click", () => { index = (index - 1 + slides.length) % slides.length; render(); });
  document.querySelector(".carousel-btn.next")?.addEventListener("click", () => { index = (index + 1) % slides.length; render(); });

  render();
}

// Kick everything off — each init() returns early if its page elements don't exist,
// so it's safe to run all of them on every page load
onAuthStateChanged(auth, async (user) => {
  await setupNav(user);
});

initLogin();
initRegister();
initBooking();
initTracking();
initCustomer();
initAdmin();
initSchedule();
initCarousel();
wireOverlay();