import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection, query, where, onSnapshot,
  doc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const TIERS = [
  { name: "Carbon", min: 0,   max: 99,  next: "Stone", nextMin: 100 },
  { name: "Stone",  min: 100, max: 499, next: "Pearl", nextMin: 500 },
  { name: "Pearl",  min: 500, max: Infinity, next: null, nextMin: null },
];

function getTier(pts) {
  return TIERS.find(t => pts >= t.min && pts <= t.max) || TIERS[0];
}

function fmtDate(val) {
  if (!val) return "—";
  try {
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return String(val); }
}

function badgeCls(status) {
  if (status === "Completed")                           return "badge success";
  if (status === "Cancelled")                           return "badge danger";
  if (status === "Ready" || status === "Awaiting Pickup") return "badge info";
  if (status === "Cleaning" || status === "Drying & Finish") return "badge warning";
  return "badge";
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "—";
}

function applyTierUI(pts) {
  const tier = getTier(pts);

  document.querySelectorAll(".tier-item").forEach(el => el.classList.remove("active-tier"));
  const active = document.getElementById("tier-" + tier.name.toLowerCase());
  if (active) active.classList.add("active-tier");

  const badge = document.getElementById("custTierBadge");
  const chip  = document.getElementById("loyaltyTierChip");
  if (badge) badge.textContent = tier.name;
  if (chip)  chip.textContent  = tier.name;

  const currLabel = document.getElementById("tierCurrentLabel");
  const nextLabel = document.getElementById("tierNextLabel");
  const hint      = document.getElementById("tierHint");
  const fill      = document.getElementById("tierBarFill");

  if (currLabel) currLabel.textContent = tier.name;

  if (tier.next) {
    const pct       = Math.min(100, Math.round(((pts - tier.min) / (tier.nextMin - tier.min)) * 100));
    const remaining = tier.nextMin - pts;
    if (fill)      fill.style.width  = pct + "%";
    if (nextLabel) nextLabel.textContent = remaining + " pts to " + tier.next;
    if (hint)      hint.textContent  = "Earn " + remaining + " more point" + (remaining !== 1 ? "s" : "") + " to unlock " + tier.next + ".";
  } else {
    if (fill)      fill.style.width  = "100%";
    if (nextLabel) nextLabel.textContent = "Max tier reached";
    if (hint)      hint.textContent  = "You are at Pearl tier. Enjoy your free monthly clean and maximum rewards.";
  }
}

function renderOrders(orders) {
  const el = document.getElementById("custOrders");
  if (!el) return;

  if (!orders.length) {
    el.innerHTML = `<p class="acct-empty">No orders yet — <a href="booking.html">book your first clean</a>.</p>`;
    return;
  }

  el.innerHTML = orders.map(o => {
    const service = o.service || "Cleaning service";
    const date    = fmtDate(o.createdAt || o.bookingDate || o.date);
    const loc     = o.location ? " · " + o.location : "";
    const time    = o.timeSlot ? " · " + o.timeSlot  : "";
    const pts     = o.pointsGranted ? `<span class="acct-order-pts">+${o.pointsAwarded || 0} pts</span>` : "";

    return `
      <div class="acct-order-row">
        <div>
          <div class="acct-order-service">${service}</div>
          <div class="acct-order-meta">
            <span>${date}${loc}${time}</span>
            ${pts}
          </div>
        </div>
        <span class="${badgeCls(o.status)}">${o.status || "Booked"}</span>
      </div>`;
  }).join("");
}

onAuthStateChanged(auth, async user => {
  if (!user) return;

  setEl("custName",  user.displayName || "Customer");
  setEl("custEmail", user.email);

  const avatar = document.getElementById("custAvatar");
  if (avatar && user.photoURL) avatar.src = user.photoURL;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      const pts  = Number(data.points || 0);

      setEl("custPoints",      pts);
      setEl("custPointsEarned", pts);

      if (data.createdAt) {
        const d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        setEl("custSince", d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }));
      }

      applyTierUI(pts);
    }
  } catch (e) {
    console.error("user doc:", e);
  }

  const ordersEl = document.getElementById("custOrders");
  if (ordersEl) {
    try {
      const q = query(collection(db, "orders"), where("uid", "==", user.uid));
      onSnapshot(q, snap => {
        const orders = [];
        snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setEl("custTotalOrders", orders.length);
        setEl("custCompleted", orders.filter(o => o.status === "Completed").length);

        renderOrders(orders);
      });
    } catch (e) {
      console.error("orders:", e);
      ordersEl.innerHTML = `<p class="acct-empty">Could not load orders.</p>`;
    }
  }
});