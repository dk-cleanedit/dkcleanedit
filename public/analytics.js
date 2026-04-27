import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const ADMIN_EMAIL = "dkcleaneditnotts@gmail.com";
let analyticsCharts = [];

function analyticsSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function analyticsIsAdmin(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function analyticsGetPrice(price) {
  if (!price) return 0;
  return Number(String(price).replace(/[^\d.]/g, "")) || 0;
}

function analyticsGetServiceName(service) {
  const names = {
    standard_clean: "Standard Cleaning",
    express: "Express Service",
    next_day: "Next Day",
  };
  return names[service] || service || "Unknown";
}

function analyticsSortEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function analyticsDestroyCharts() {
  analyticsCharts.forEach((chart) => chart.destroy());
  analyticsCharts = [];
}

function analyticsMakeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const chart = new Chart(canvas, config);
  analyticsCharts.push(chart);
  return chart;
}

function analyticsBuildData(allOrders) {
  const statusData = {};
  const serviceData = {};
  const locationData = {};
  const dayData = {};
  const timeSlotData = {};
  const revenueData = {};
  const customerData = {};

  let totalRevenue = 0;
  let completedRevenue = 0;
  let totalPoints = 0;

  allOrders.forEach((order) => {
    const orderStatus = order.status || "Unknown";
    const orderService = analyticsGetServiceName(order.service);
    const orderLocation = order.location || "Unknown";
    const orderDay = order.date || "Unknown";
    const orderTimeSlot = order.timeSlot || "Unknown";
    const orderPrice = analyticsGetPrice(order.price);

    const customerKey =
      order.uid ||
      order.customerEmail ||
      order.customerName ||
      "unknown";

    statusData[orderStatus] = (statusData[orderStatus] || 0) + 1;
    serviceData[orderService] = (serviceData[orderService] || 0) + 1;
    locationData[orderLocation] = (locationData[orderLocation] || 0) + 1;
    dayData[orderDay] = (dayData[orderDay] || 0) + 1;
    timeSlotData[orderTimeSlot] = (timeSlotData[orderTimeSlot] || 0) + 1;
    customerData[customerKey] = (customerData[customerKey] || 0) + 1;

    totalRevenue += orderPrice;
    totalPoints += Number(order.grantedPointsAmount || 0);

    if (orderStatus === "Completed") {
      completedRevenue += orderPrice;
      revenueData[orderService] = (revenueData[orderService] || 0) + orderPrice;
    }
  });

  const totalOrders = allOrders.length;
  const completedOrders = statusData["Completed"] || 0;
  const cancelledOrders = statusData["Cancelled"] || 0;
  const activeOrders = totalOrders - completedOrders - cancelledOrders;
  const repeatCustomers = Object.values(customerData).filter((count) => count > 1).length;
  const popularService = analyticsSortEntries(serviceData)[0]?.[0] || "-";
  const topLocation = analyticsSortEntries(locationData)[0]?.[0] || "-";

  return {
    summaryData: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      activeOrders,
      totalRevenue,
      completedRevenue,
      totalPoints,
      repeatCustomers,
      popularService,
      topLocation,
    },
    chartData: {
      statusData,
      serviceData,
      locationData,
      dayData,
      timeSlotData,
      revenueData,
    },
  };
}

function analyticsRenderSummary(summaryData) {
  analyticsSetText("kpiTotal", summaryData.totalOrders);
  analyticsSetText("kpiCompletedInline", summaryData.completedOrders);
  analyticsSetText("kpiRevenue", `£${summaryData.totalRevenue}`);
  analyticsSetText("kpiCompletedRevenue", `£${summaryData.completedRevenue}`);
  analyticsSetText("kpiActive", summaryData.activeOrders);
  analyticsSetText("kpiCancelled", summaryData.cancelledOrders);
  analyticsSetText("kpiPoints", summaryData.totalPoints);
  analyticsSetText("kpiRepeat", summaryData.repeatCustomers);

  analyticsSetText("kpiCompletedCard", summaryData.completedOrders);
  analyticsSetText("kpiRepeatCard", summaryData.repeatCustomers);
  analyticsSetText("kpiPopularService", summaryData.popularService);
  analyticsSetText("kpiTopLocation", summaryData.topLocation);
}

function analyticsRenderCharts(chartData, summaryData) {
  analyticsDestroyCharts();

  analyticsMakeChart("statusChart", {
    type: "doughnut",
    data: {
      labels: Object.keys(chartData.statusData),
      datasets: [{ data: Object.values(chartData.statusData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("serviceChart", {
    type: "bar",
    data: {
      labels: Object.keys(chartData.serviceData),
      datasets: [{ label: "Orders", data: Object.values(chartData.serviceData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("locationChart", {
    type: "pie",
    data: {
      labels: Object.keys(chartData.locationData),
      datasets: [{ data: Object.values(chartData.locationData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("dayChart", {
    type: "line",
    data: {
      labels: Object.keys(chartData.dayData),
      datasets: [{
        label: "Orders by day",
        data: Object.values(chartData.dayData),
        fill: false,
        tension: 0.25,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("timeSlotChart", {
    type: "bar",
    data: {
      labels: Object.keys(chartData.timeSlotData),
      datasets: [{ label: "Bookings", data: Object.values(chartData.timeSlotData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("pointsChart", {
    type: "bar",
    data: {
      labels: ["Points Awarded"],
      datasets: [{ label: "Points", data: [summaryData.totalPoints], borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("revenueChart", {
    type: "bar",
    data: {
      labels: Object.keys(chartData.revenueData),
      datasets: [{ label: "Revenue (£)", data: Object.values(chartData.revenueData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

async function analyticsLoadPage() {
  try {
    const snap = await getDocs(collection(db, "orders"));
    const allOrders = [];

    snap.forEach((doc) => {
      allOrders.push({ id: doc.id, ...doc.data() });
    });

    allOrders.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    const analyticsData = analyticsBuildData(allOrders);
    analyticsRenderSummary(analyticsData.summaryData);
    analyticsRenderCharts(analyticsData.chartData, analyticsData.summaryData);
  } catch (error) {
    console.error("Analytics load failed:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = "login.html?next=analytics.html";
    return;
  }

  if (!analyticsIsAdmin(user.email)) {
    location.href = "customer.html";
    return;
  }

  analyticsLoadPage();
});