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

/* =========================
   BASIC HELPERS
========================= */
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

/* =========================
   PROGRESS / TRACKER HELPERS
========================= */
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

/* =========================
   URL / LOGIN HELPERS
========================= */
function getNextFromUrl() {
  const url = new URL(location.href);
  const next = url.searchParams.get("next");
  return next ? decodeURIComponent(next) : null;
}

function goLogin(nextFile = "home.html") {
  location.href = `login.html?next=${encodeURIComponent(nextFile)}`;
}

/* =========================
   USER / POINTS HELPERS
========================= */
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

/* =========================
   STATUS / BADGE HELPERS
========================= */
function badgeClass(status) {
  if (status === "Completed") return "badge success";
  if (status === "Cancelled") return "badge danger";
  if (status === "Ready") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

/* =========================
   OVERLAY HELPERS
========================= */
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

/* =========================
   AUTH REQUIRED LINKS
========================= */
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

/* =========================
   NAVBAR SETUP
========================= */
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

/* =========================
   LOGIN PAGE
========================= */
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

/* =========================
   REGISTER PAGE
========================= */
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

/* =========================
   BOOKING PAGE
========================= */
function initBooking() {
  const btnBook = $("#btnBook");
  if (!btnBook || btnBook.dataset.bound === "1") return;
  btnBook.dataset.bound = "1";

  wireOverlayExitButtonsSafe();

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

    if (!service || !locationVal || !date || !timeSlot) {
      setMsg("Select service, location, date and time");
      toast("Select service, location, date and time");
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
        location: locationVal,
        date,
        timeSlot,
        status: "Booked",
        pointsAwarded: 10,
        pointsGranted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, "orders"), order);

      toast("Booking confirmed ✅");
      setMsg(`Order ID: ${ref.id}`);

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

/* =========================
   CUSTOMER ORDER CARD
========================= */
function renderOrderCard(order) {
  const pct = progressPercent(order.status || "Booked");

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(order.service)} • ${esc(order.location)}</div>
          <div class="sub">${esc(order.date)} • ${esc(order.timeSlot)}</div>
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

/* =========================
   CANCEL ORDER
========================= */
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

/* =========================
   RESCHEDULE ORDER
========================= */
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

/* =========================
   CUSTOMER ORDER ACTION EVENTS
========================= */
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

/* =========================
   TRACKING PAGE
========================= */
function initTracking() {
  const ordersEl = $("#orders");
  if (!ordersEl || ordersEl.dataset.bound === "1") return;
  ordersEl.dataset.bound = "1";

  wireOverlayExitButtonsSafe();
  wireCustomerOrderActions(ordersEl);

  ordersEl.innerHTML = `
    <div class="order-card">
      <div class="order-title">Loading…</div>
      <p class="sub">Checking your account.</p>
    </div>
  `;

  let unsubOrders = null;

  onAuthStateChanged(auth, (user) => {
    if (typeof unsubOrders === "function") {
      unsubOrders();
      unsubOrders = null;
    }

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

        ordersEl.innerHTML = items.length
          ? items.map(renderOrderCard).join("")
          : `
            <div class="order-card">
              <div class="order-title">No orders yet</div>
              <p class="sub">Book a service to start tracking.</p>
              <a class="btn primary" href="booking.html">Go to Booking</a>
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

/* =========================
   CUSTOMER PAGE
========================= */
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

/* =========================
   ADMIN HELPERS
========================= */
function statusOptions(current) {
  return STATUS.map(
    (status) => `<option value="${esc(status)}" ${status === current ? "selected" : ""}>${esc(status)}</option>`
  ).join("");
}

function renderAdminCard(order) {
  const pct = progressPercent(order.status || "Booked");

  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(order.customerEmail || order.customerName || "Customer")}</div>
          <div class="sub">${esc(order.service)} • ${esc(order.location)} • ${esc(order.date)} ${esc(order.timeSlot)}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(order.status || "Booked")}</span>
      </div>

      ${renderStepProgress(order.status || "Booked")}

      <div class="order-meta">
        <span class="sub">Order ID: ${esc(order.id)}</span>
        <span class="sub">${pct}%</span>
      </div>

      <div class="admin-row">
        <div class="admin-field">
          <label class="sub">Stage</label>
          <select class="admin-status">${statusOptions(order.status || "Booked")}</select>
        </div>

        <div class="admin-field">
          <label class="sub">Points (award on completion)</label>
          <input class="admin-points" type="number" min="0" value="${esc(order.pointsAwarded ?? 10)}" />
        </div>

        <div class="admin-field admin-field-btn">
          <label class="sub">&nbsp;</label>
          <button class="btn primary full admin-save" type="button">Save</button>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   ADMIN PAGE
========================= */
function initAdmin() {
  const listEl = $("#adminOrders");
  if (!listEl || listEl.dataset.bound === "1") return;
  listEl.dataset.bound = "1";

  const searchEl = $("#adminSearch");
  const filterEl = $("#adminFilter");
  const btnAdminRefresh = $("#btnAdminRefresh");

  let all = [];
  let unsub = null;

  function render() {
    const term = (searchEl?.value || "").toLowerCase().trim();
    const stage = filterEl?.value || "All";

    let items = [...all];

    if (stage !== "All") {
      items = items.filter((order) => (order.status || "Booked") === stage);
    }

    if (term) {
      items = items.filter((order) =>
        String(order.customerEmail || "").toLowerCase().includes(term) ||
        String(order.customerName || "").toLowerCase().includes(term) ||
        String(order.id || "").toLowerCase().includes(term)
      );
    }

    listEl.innerHTML = items.length
      ? items.map(renderAdminCard).join("")
      : `<div class="order-card"><div class="order-title">No matching orders</div><p class="sub">Change search or filter.</p></div>`;
  }

  if (searchEl && searchEl.dataset.bound !== "1") {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", render);
  }

  if (filterEl && filterEl.dataset.bound !== "1") {
    filterEl.dataset.bound = "1";
    filterEl.addEventListener("change", render);
  }

  if (btnAdminRefresh && btnAdminRefresh.dataset.bound !== "1") {
    btnAdminRefresh.dataset.bound = "1";
    btnAdminRefresh.addEventListener("click", () => toast("Admin is live ✅"));
  }

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".admin-save");
    if (!btn) return;

    const card = e.target.closest("[data-id]");
    const id = card?.getAttribute("data-id");
    if (!id) return;

    const newStatus = card.querySelector(".admin-status")?.value || "Booked";
    const pts = Number(card.querySelector(".admin-points")?.value || 0);

    try {
      const ref = doc(db, "orders", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const prev = snap.data();
      const alreadyGranted = !!prev.pointsGranted;
      const becomingCompleted = newStatus === "Completed";

      const updatePayload = {
        status: newStatus,
        pointsAwarded: pts,
        updatedAt: serverTimestamp()
      };

      if (!alreadyGranted && becomingCompleted) {
        updatePayload.pointsGranted = true;
      }

      await updateDoc(ref, updatePayload);

      if (!alreadyGranted && becomingCompleted) {
        await updateDoc(doc(db, "users", prev.uid), {
          points: increment(pts)
        });
      }

      toast("Saved ✅");
    } catch (err) {
      console.error(err);
      toast("Save failed");
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (typeof unsub === "function") {
      unsub();
      unsub = null;
    }

    if (!user) {
      goLogin("admin.html");
      return;
    }

    if (!isAdminEmail(user.email)) {
      toast("Admins only");
      location.replace("home.html");
      return;
    }

    unsub = onSnapshot(query(collection(db, "orders")), (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      all = items;
      render();
    });
  });
}

/* =========================
   the boot of the page
========================= */
function bootByElements() {
  wireAuthRequiredLinks();
  wireOverlayExitButtonsSafe();

  initLoginPage();
  initRegisterPage();

  if ($("#btnBook")) initBooking();
  if ($("#orders")) initTracking();
  if ($("#custOrders") || $("#btnChangePass") || $("#custName")) initCustomer();
  if ($("#adminOrders")) initAdmin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootByElements);
} else {
  bootByElements();
}

/* =========================
   GLOBAL AUTH WATCHER
========================= */
onAuthStateChanged(auth, async (user) => {
  await setupNav(user);
  await updatePointsBadge(user);
  if (user) hideSignupOverlay();
});