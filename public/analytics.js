import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (s) => document.querySelector(s);

let charts = {};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function groupCount(items, field) {
  const map = {};
  items.forEach(item => {
    const key = item[field] || "Unknown";
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function groupByDay(items) {
  const map = {};
  items.forEach(item => {
    const key = item.date || "Unknown";
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function groupPointsByDay(items) {
  const map = {};
  items.forEach(item => {
    if (item.status === "Completed") {
      const key = item.date || "Unknown";
      const pts = Number(item.pointsAwarded || 0);
      map[key] = (map[key] || 0) + pts;
    }
  });
  return map;
}

function countRepeatCustomers(items) {
  const customerCounts = {};
  items.forEach(item => {
    const key = item.uid || item.customerEmail || "unknown";
    customerCounts[key] = (customerCounts[key] || 0) + 1;
  });
  return Object.values(customerCounts).filter(n => n > 1).length;
}

function totalPointsAwarded(items) {
  return items
    .filter(item => item.status === "Completed")
    .reduce((sum, item) => sum + Number(item.pointsAwarded || 0), 0);
}

function renderChart(canvasId, type, dataMap, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(ctx, {
    type,
    data: {
      labels: Object.keys(dataMap),
      datasets: [{
        label,
        data: Object.values(dataMap)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderAnalytics(items) {
  const total = items.length;
  const completed = items.filter(o => o.status === "Completed").length;
  const cancelled = items.filter(o => o.status === "Cancelled").length;
  const active = total - completed - cancelled;
  const points = totalPointsAwarded(items);
  const repeat = countRepeatCustomers(items);

  setText("kpiTotal", total);
  setText("kpiCompleted", completed);
  setText("kpiCancelled", cancelled);
  setText("kpiActive", active);
  setText("kpiPoints", points);
  setText("kpiRepeat", repeat);

  renderChart("statusChart", "bar", groupCount(items, "status"), "Orders by Status");
  renderChart("serviceChart", "bar", groupCount(items, "service"), "Orders by Service");
  renderChart("locationChart", "pie", groupCount(items, "location"), "Orders by Location");
  renderChart("dayChart", "line", groupByDay(items), "Orders by Day");
  renderChart("timeSlotChart", "bar", groupCount(items, "timeSlot"), "Orders by Time Slot");
  renderChart("pointsChart", "line", groupPointsByDay(items), "Points Awarded by Day");
}
function averageTurnaroundHours(items) {
  const completed = items.filter(
    item => item.status === "Completed" && item.createdAt && item.updatedAt
  );

  if (!completed.length) return 0;

  const totalHours = completed.reduce((sum, item) => {
    const created = item.createdAt.seconds * 1000;
    const updated = item.updatedAt.seconds * 1000;
    return sum + ((updated - created) / (1000 * 60 * 60));
  }, 0);

  return (totalHours / completed.length).toFixed(1);
}
function initAnalytics() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("login.html?next=analytics.html");
      return;
    }

    const q = query(collection(db, "orders"));
    onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      renderAnalytics(items);
    }, (err) => {
      console.error(err);
    });
  });
}

initAnalytics();