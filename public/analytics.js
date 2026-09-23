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
  const customerNames = {};

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
    if (!customerNames[customerKey]) {
      customerNames[customerKey] = order.customerName || order.customerEmail || "Customer";
    }

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
  const uniqueCustomers = Object.keys(customerData).length;
  const cancelRate = totalOrders ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
  const repeatCustomers = Object.values(customerData).filter((count) => count > 1).length;
  const popularService = analyticsSortEntries(serviceData)[0]?.[0] || "-";
  const topLocation = analyticsSortEntries(locationData)[0]?.[0] || "-";

  // Top 8 customers by order count, for the "Top customers" chart.
  const topCustomersData = {};
  analyticsSortEntries(customerData).slice(0, 8).forEach(([key, count]) => {
    topCustomersData[customerNames[key] || key] = count;
  });

  return {
    summaryData: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      activeOrders,
      uniqueCustomers,
      cancelRate,
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
      topCustomersData,
    },
  };
}

function analyticsRenderSummary(summaryData) {
  analyticsSetText("kpiTotal", summaryData.totalOrders);
  analyticsSetText("kpiCompletedInline", summaryData.completedOrders);
  analyticsSetText("kpiRevenue", `£${summaryData.totalRevenue}`);
  analyticsSetText("kpiCompletedRevenue", `£${summaryData.completedRevenue}`);
  analyticsSetText("kpiCustomers", summaryData.uniqueCustomers);
  analyticsSetText("kpiPoints", summaryData.totalPoints);
  analyticsSetText("kpiCancelled", summaryData.cancelledOrders);
  analyticsSetText("kpiCancelRate", `${summaryData.cancelRate}%`);

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

  analyticsMakeChart("revenueChart", {
    type: "bar",
    data: {
      labels: Object.keys(chartData.revenueData),
      datasets: [{ label: "Revenue (£)", data: Object.values(chartData.revenueData), borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  analyticsMakeChart("customersChart", {
    type: "bar",
    data: {
      labels: Object.keys(chartData.topCustomersData),
      datasets: [{ label: "Orders", data: Object.values(chartData.topCustomersData), borderWidth: 1 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
    },
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