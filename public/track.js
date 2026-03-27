import { auth, db } from "../firebase.js";
import { qs, setText } from "../ui/dom.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const STATUS_ORDER = [
  "Booked",
  "Received",
  "Cleaning",
  "Drying & Finish",
  "Ready",
  "Completed"
];

const STATUS_COPY = {
  Booked: "Booking confirmed",
  Received: "Shoes received",
  Cleaning: "Cleaning in progress",
  "Drying & Finish": "Finishing and drying",
  Ready: "Ready for collection",
  Completed: "Completed"
};

const DEFAULT_SUPPORT_EMAIL = "danielasouzu2@gmail.com";
const DEFAULT_SUPPORT_PHONE = "+447000000000";
const DEFAULT_CARRIER_URLS = {
  FedEx: "https://www.fedex.com/fedextrack/",
  UPS: "https://www.ups.com/track",
  DHL: "https://www.dhl.com/global-en/home/tracking.html",
  RoyalMail: "https://www.royalmail.com/track-your-item",
  Evri: "https://www.evri.com/track-a-parcel"
};

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
  return value || "Service";
}

function friendlyStatus(status) {
  return STATUS_COPY[status] || status || "Booking confirmed";
}

function progressPercent(status) {
  const i = Math.max(0, STATUS_ORDER.indexOf(status));
  return Math.round((i / (STATUS_ORDER.length - 1)) * 100);
}

function formatDate(value) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const alt = new Date(`${value}T00:00:00`);
    if (Number.isNaN(alt.getTime())) return String(value);
    return alt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTimeFromFirestore(ts) {
  if (!ts?.seconds) return "Not available";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function estimateDeliveryDate(order) {
  if (order.expectedDeliveryDate) return order.expectedDeliveryDate;
  if (!order.date) return "";

  const base = new Date(`${order.date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return order.date;

  let addDays = 4;
  if (order.service === "express") addDays = 2;
  if (order.service === "next_day") addDays = 1;

  base.setDate(base.getDate() + addDays);
  return base.toISOString().slice(0, 10);
}

function getCarrierName(order) {
  return order.carrier || "DKCleanEdit Delivery";
}

function getTrackingNumber(order) {
  return order.trackingNumber || order.trackingId || order.reference || "";
}

function getCarrierTrackingUrl(order) {
  if (order.carrierTrackingUrl) return order.carrierTrackingUrl;

  const carrier = String(getCarrierName(order)).replace(/\s+/g, "");
  const base = DEFAULT_CARRIER_URLS[carrier] || "";
  const trackingNumber = getTrackingNumber(order);

  if (!base) return "";
  if (!trackingNumber) return base;

  if (base.includes("?")) return `${base}&trackingnumber=${encodeURIComponent(trackingNumber)}`;
  return `${base}?trackingnumber=${encodeURIComponent(trackingNumber)}`;
}

function getShippingAddress(order) {
  if (order.shippingAddress) return order.shippingAddress;

  const parts = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.postcode
  ].filter(Boolean);

  if (parts.length) return parts.join(", ");
  return order.location || "Collection / location to be confirmed";
}

function getItems(order) {
  if (Array.isArray(order.items) && order.items.length) return order.items;

  return [{
    name: serviceLabel(order.service),
    description: order.notes || "Luxury shoe cleaning service",
    quantity: 1,
    image: order.itemImage || "",
    variant: order.location || ""
  }];
}

function getStatusIndex(status) {
  const idx = STATUS_ORDER.indexOf(status);
  return idx < 0 ? 0 : idx;
}

function buildStatusHistory(order) {
  if (Array.isArray(order.statusHistory) && order.statusHistory.length) {
    return order.statusHistory;
  }

  const currentIndex = getStatusIndex(order.status || "Booked");
  const createdAt = order.createdAt ? formatDateTimeFromFirestore(order.createdAt) : "Not available";
  const updatedAt = order.updatedAt ? formatDateTimeFromFirestore(order.updatedAt) : createdAt;

  return STATUS_ORDER.slice(0, currentIndex + 1).map((stage, index) => ({
    status: stage,
    label: friendlyStatus(stage),
    timestamp: index === 0 ? createdAt : updatedAt
  }));
}

function renderStepProgress(status) {
  const safeIndex = getStatusIndex(status || "Booked");

  return `
    <div class="order-tracker" role="list" aria-label="Order progress timeline">
      ${STATUS_ORDER.map((stage, i) => `
        <div
          class="step ${i <= safeIndex ? "active" : ""}"
          role="listitem"
          aria-current="${i === safeIndex ? "step" : "false"}"
        >
          <span class="circle" aria-hidden="true"></span>
          <span class="label">${esc(friendlyStatus(stage))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function badgeClass(status) {
  if (status === "Completed") return "badge success";
  if (status === "Ready") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function renderCompactOrderCard(order) {
  const pct = progressPercent(order.status || "Booked");
  const title = `${serviceLabel(order.service)} • ${order.location || "Location pending"}`;
  const dateLine = `${order.date || "-"} • ${order.timeSlot || "-"} • ${order.price || ""}`;

  return `
    <article class="order-card" data-order-card="${esc(order.id)}" tabindex="0" aria-label="Order ${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-title">${esc(title)}</div>
          <div class="sub">${esc(dateLine)}</div>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(friendlyStatus(order.status || "Booked"))}</span>
      </div>

      ${renderStepProgress(order.status || "Booked")}

      <div class="order-meta">
        <span class="sub">Order ID: ${esc(order.id)}</span>
        <span class="sub">Progress: ${pct}%</span>
      </div>
    </article>
  `;
}

function renderItemRows(order) {
  const items = getItems(order);

  return `
    <div class="tracking-items">
      ${items.map((item, index) => `
        <div class="tracking-item-row" role="listitem">
          <div class="tracking-item-media">
            ${
              item.image
                ? `<img src="${esc(item.image)}" alt="${esc(item.name || `Item ${index + 1}`)}" />`
                : `<div class="tracking-item-placeholder" aria-hidden="true">Image</div>`
            }
          </div>

          <div class="tracking-item-copy">
            <div class="tracking-item-title">${esc(item.name || `Item ${index + 1}`)}</div>
            <div class="sub">${esc(item.description || "")}</div>
            ${item.variant ? `<div class="sub">${esc(item.variant)}</div>` : ""}
          </div>

          <div class="tracking-item-qty">
            <span class="sub">Qty</span>
            <strong>${esc(item.quantity ?? 1)}</strong>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHistory(order) {
  const history = buildStatusHistory(order);

  return `
    <div class="tracking-history">
      <h3>Tracking history</h3>
      <ul class="timeline-list">
        ${history.map((entry) => `
          <li class="timeline-item">
            <div class="timeline-dot" aria-hidden="true"></div>
            <div class="timeline-copy">
              <strong>${esc(entry.label || friendlyStatus(entry.status))}</strong>
              <div class="sub">${esc(entry.timestamp || "Update recorded")}</div>
              ${entry.comment ? `<div class="sub">${esc(entry.comment)}</div>` : ""}
            </div>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function renderSelectedOrder(order, user) {
  const trackingNumber = getTrackingNumber(order);
  const carrier = getCarrierName(order);
  const carrierUrl = getCarrierTrackingUrl(order);
  const shippingDate = order.shippingDate || order.date || "";
  const expectedDeliveryDate = estimateDeliveryDate(order);
  const shippingAddress = getShippingAddress(order);
  const customerName = order.customerName || user?.displayName || "Customer";

  return `
    <section class="card tracking-detail-card" aria-label="Selected order details">
      <div class="card-header">
        <div>
          <span class="eyebrow">Hello ${esc(customerName)}</span>
          <h2>Order details</h2>
          <p class="sub">Track every stage of your restoration journey in one place.</p>
        </div>
        <span class="${badgeClass(order.status || "Booked")}">${esc(friendlyStatus(order.status || "Booked"))}</span>
      </div>

      <div class="tracking-summary-grid">
        <div class="card soft">
          <h3>Current status</h3>
          <p class="tracking-status-hero">${esc(friendlyStatus(order.status || "Booked"))}</p>
          <p class="sub">Order number: ${esc(order.id)}</p>
          <p class="sub">Last updated: ${esc(formatDateTimeFromFirestore(order.updatedAt || order.createdAt))}</p>
          ${renderStepProgress(order.status || "Booked")}
        </div>

        <div class="card soft">
          <h3>Shipping information</h3>
          <div class="detail-list">
            <div class="detail-row">
              <span>Shipping date</span>
              <strong>${esc(formatDate(shippingDate))}</strong>
            </div>
            <div class="detail-row">
              <span>Expected delivery / ready date</span>
              <strong>${esc(formatDate(expectedDeliveryDate))}</strong>
            </div>
            <div class="detail-row">
              <span>Carrier</span>
              <strong>${esc(carrier)}</strong>
            </div>
            <div class="detail-row">
              <span>Tracking number</span>
              <strong>${trackingNumber ? esc(trackingNumber) : "Pending"}</strong>
            </div>
            <div class="detail-row">
              <span>Carrier link</span>
              <strong>
                ${
                  carrierUrl
                    ? `<a href="${esc(carrierUrl)}" target="_blank" rel="noopener noreferrer">Open carrier tracking</a>`
                    : "Available when assigned"
                }
              </strong>
            </div>
            <div class="detail-row">
              <span>Shipping address</span>
              <strong>${esc(shippingAddress)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="tracking-summary-grid">
        <div class="card soft">
          <h3>Order information</h3>
          <div class="detail-list">
            <div class="detail-row">
              <span>Service</span>
              <strong>${esc(serviceLabel(order.service))}</strong>
            </div>
            <div class="detail-row">
              <span>Location</span>
              <strong>${esc(order.location || "Not provided")}</strong>
            </div>
            <div class="detail-row">
              <span>Booking date</span>
              <strong>${esc(formatDate(order.date))}</strong>
            </div>
            <div class="detail-row">
              <span>Time slot</span>
              <strong>${esc(order.timeSlot || "Not provided")}</strong>
            </div>
            <div class="detail-row">
              <span>Price</span>
              <strong>${esc(order.price || "To be confirmed")}</strong>
            </div>
          </div>
        </div>

        <div class="card soft">
          <h3>Support</h3>
          <p class="sub">
            If your order is delayed or you need to change collection details, contact support.
          </p>
          <div class="stack-sm">
            <a class="btn primary full" href="mailto:${esc(DEFAULT_SUPPORT_EMAIL)}">Email support</a>
            <a class="btn secondary full" href="tel:${esc(DEFAULT_SUPPORT_PHONE)}">Call support</a>
          </div>
        </div>
      </div>

      <div class="card soft">
        <h3>Items in this order</h3>
        ${renderItemRows(order)}
      </div>

      ${renderHistory(order)}
    </section>
  `;
}

function normaliseSearchTerm(value) {
  return String(value || "").trim().toLowerCase();
}

function findOrderBySearch(items, searchTerm, user) {
  const q = normaliseSearchTerm(searchTerm);
  if (!q) return null;

  return items.find((order) => {
    const fields = [
      order.id,
      order.reference,
      order.orderNumber,
      order.customerEmail,
      user?.email
    ]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());

    return fields.some((field) => field.includes(q));
  }) || null;
}

function selectLatestOrder(items) {
  if (!items.length) return null;
  return [...items].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
}

function bindLookupEvents({ ordersEl, selectedEl, msgEl, lookupMsgEl, searchEl, findBtn, latestBtn, refreshBtn, state }) {
  if (ordersEl.dataset.boundLookup === "1") return;
  ordersEl.dataset.boundLookup = "1";

  function renderList() {
    const items = state.items;

    if (!items.length) {
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">No orders yet</div>
          <p class="sub">Book a service to start tracking.</p>
          <a class="btn primary" href="booking.html" data-requires-auth="true">Go to Booking</a>
        </div>
      `;
      selectedEl.innerHTML = "";
      setText(msgEl, "");
      setText(lookupMsgEl, "");
      return;
    }

    ordersEl.innerHTML = items
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .map(renderCompactOrderCard)
      .join("");

    setText(msgEl, "");
  }

  function renderSelected(order) {
    if (!order) {
      selectedEl.innerHTML = "";
      return;
    }

    selectedEl.innerHTML = renderSelectedOrder(order, state.user);
  }

  function chooseOrder(order, message = "") {
    state.selectedOrder = order || null;
    renderSelected(state.selectedOrder);
    setText(lookupMsgEl, message);
  }

  findBtn?.addEventListener("click", () => {
    const result = findOrderBySearch(state.items, searchEl?.value, state.user);

    if (!result) {
      chooseOrder(null, "No matching order found. Check the order ID or use Latest order.");
      return;
    }

    chooseOrder(result, `Showing order ${result.id}`);
  });

  latestBtn?.addEventListener("click", () => {
    const latest = selectLatestOrder(state.items);

    if (!latest) {
      chooseOrder(null, "No orders available yet.");
      return;
    }

    if (searchEl) searchEl.value = latest.id;
    chooseOrder(latest, "Showing your latest order.");
  });

  refreshBtn?.addEventListener("click", () => {
    setText(msgEl, "Tracking is live — updates appear automatically.");
    setTimeout(() => setText(msgEl, ""), 1500);

    if (state.selectedOrder) {
      const fresh = state.items.find((o) => o.id === state.selectedOrder.id) || state.selectedOrder;
      chooseOrder(fresh, "Order view refreshed.");
    }
  });

  ordersEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-order-card]");
    if (!card) return;

    const orderId = card.getAttribute("data-order-card");
    const order = state.items.find((o) => o.id === orderId);
    if (!order) return;

    if (searchEl) searchEl.value = order.id;
    chooseOrder(order, `Showing order ${order.id}`);
    selectedEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  ordersEl.addEventListener("keydown", (e) => {
    const card = e.target.closest("[data-order-card]");
    if (!card) return;

    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();

    const orderId = card.getAttribute("data-order-card");
    const order = state.items.find((o) => o.id === orderId);
    if (!order) return;

    if (searchEl) searchEl.value = order.id;
    chooseOrder(order, `Showing order ${order.id}`);
    selectedEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  state.renderList = renderList;
  state.chooseOrder = chooseOrder;
}

export function initTrackingPage() {
  const ordersEl = qs("#orders");
  const msgEl = qs("#msg");
  const refreshBtn = qs("#btnRefresh");
  const selectedEl = qs("#trackingSelectedOrder");
  const lookupMsgEl = qs("#trackLookupMsg");
  const searchEl = qs("#trackOrderSearch");
  const findBtn = qs("#btnFindOrder");
  const latestBtn = qs("#btnShowLatest");

  if (!ordersEl || !selectedEl) return;

  const state = {
    items: [],
    selectedOrder: null,
    user: null,
    renderList: null,
    chooseOrder: null
  };

  bindLookupEvents({
    ordersEl,
    selectedEl,
    msgEl,
    lookupMsgEl,
    searchEl,
    findBtn,
    latestBtn,
    refreshBtn,
    state
  });

  const unsubscribeAuth = auth.onAuthStateChanged((user) => {
    state.user = user;

    if (!user) {
      ordersEl.innerHTML = `
        <div class="order-card">
          <div class="order-title">Please log in</div>
          <p class="sub">You must be signed in to view tracking.</p>
          <a class="btn primary" href="login.html?next=track.html">Go to Login</a>
        </div>
      `;
      selectedEl.innerHTML = "";
      setText(msgEl, "Please log in to view tracking.");
      setText(lookupMsgEl, "");
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("uid", "==", user.uid)
    );

    const unsubOrders = onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      state.items = items;
      state.renderList?.();

      if (!items.length) return;

      if (state.selectedOrder) {
        const refreshedSelected = items.find((o) => o.id === state.selectedOrder.id);
        if (refreshedSelected) {
          state.chooseOrder?.(refreshedSelected, "Order updated live.");
          return;
        }
      }

      const latest = selectLatestOrder(items);
      if (latest) {
        if (searchEl && !searchEl.value) searchEl.value = latest.id;
        state.chooseOrder?.(latest, "Showing your latest order.");
      }
    }, (err) => {
      console.error(err);
      setText(msgEl, "Failed to load orders. Please try again.");
      setText(lookupMsgEl, "We could not load your tracking data.");
    });

    window.addEventListener("beforeunload", () => unsubOrders(), { once: true });
  });

  window.addEventListener("beforeunload", () => unsubscribeAuth(), { once: true });
}