// auth-guard.js — DKcleanedit
// Shared authentication guard and navigation helper.
// Import this on every protected page BEFORE any page-specific logic.
//
// [1] Firebase Auth onAuthStateChanged:
//     https://firebase.google.com/docs/auth/web/manage-users
// [2] MDN — Location.replace:
//     https://developer.mozilla.org/en-US/docs/Web/API/Location/replace

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const ADMIN_EMAIL = "dkcleaneditnotts@gmail.com";

// Page roles: which roles may access each page.
// "admin" | "staff" | "customer" | "any"
const PAGE_ROLES = {
  "admin.html":        ["admin"],
  "schedule.html":     ["admin"],
  "analytics.html":    ["admin"],
  "admin_account.html":["admin"],
  "customer.html":     ["customer", "admin"],
  "booking.html":      ["customer", "admin"],
  "track.html":        ["customer", "admin"],
  "settings.html":     ["customer", "admin"],
};

export function isAdmin(email) {
  return String(email ?? "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function getStaffList() {
  try {
    const snap = await getDocs(collection(db, "staff"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export function isStaff(email, staffList) {
  if (!email || !staffList?.length) return false;
  return staffList.some(
    (s) => String(s.email ?? "").trim().toLowerCase() === email.trim().toLowerCase()
  );
}

// Check that the user completed 2FA in this session.
// We store a flag in sessionStorage after the 2FA step passes.
export function has2FA() {
  return sessionStorage.getItem("dk_2fa") === "1";
}

export function mark2FAPassed() {
  sessionStorage.setItem("dk_2fa", "1");
}

export function clear2FA() {
  sessionStorage.removeItem("dk_2fa");
}

// Derive role string from the signed-in user.
function roleFor(user, staffList) {
  if (!user) return null;
  if (isAdmin(user.email)) return "admin";
  if (isStaff(user.email, staffList)) return "staff";
  return "customer";
}

// Redirect to login, preserving intended destination.
function redirectLogin(next) {
  window.location.replace(`login.html?next=${encodeURIComponent(next || location.pathname)}`);
}

// Main guard — call once per protected page.
// Returns a promise that resolves with { user, role, userData } when access
// is allowed, or never resolves (page redirects away) if access is denied.
export function requireAuth(options = {}) {
  const {
    page = location.pathname.split("/").pop() || "index.html",
    on2FARequired = () => window.location.replace("login.html"),
  } = options;

  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        redirectLogin(page);
        return;
      }

      // check the user has finished 2fa
      if (!has2FA()) {
        clear2FA();
        on2FARequired();
        return;
      }

      const staffList = await getStaffList();
      const role = roleFor(user, staffList);
      const allowed = PAGE_ROLES[page];

      if (allowed && !allowed.includes(role)) {
        // Wrong role — send them somewhere sensible
        if (role === "admin") {
          window.location.replace("admin.html");
        } else {
          window.location.replace("customer.html");
        }
        return;
      }

      // Load Firestore user doc
      let userData = {};
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) userData = snap.data();
      } catch { /* non-critical */ }

      resolve({ user, role, userData, staffList });
    });
  });
}

// Set up the nav bar based on role.
// Call after requireAuth resolves.
export function setupNav(user, role, points = 0) {
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !visible;
  };

  const isLoggedIn = !!user;
  const adminRole  = role === "admin";
  const custRole   = role === "customer";

  // Common
  show("navLogin",    !isLoggedIn);
  show("navRegister", !isLoggedIn);
  show("navLogout",    isLoggedIn);

  // Customer-only nav items
  show("navHome",     custRole || !isLoggedIn);
  show("navBooking",  custRole);
  show("navTracking", custRole);
  show("navAccount",  custRole);

  // Admin-only nav items
  show("navAdmin",    adminRole);
  show("navSchedule", adminRole);
  show("navStaff",    adminRole);
  show("navAnalytics",adminRole);

  // Points badge (customers only)
  const badge = document.getElementById("navPointsBadge");
  if (badge) {
    badge.hidden = !custRole;
    if (custRole) badge.textContent = `${points} pts`;
  }

  // Logout handler
  const logoutBtn = document.getElementById("navLogout");
  if (logoutBtn && !logoutBtn._wired) {
    logoutBtn._wired = true;
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      clear2FA();
      await signOut(auth);
      window.location.replace("login.html");
    });
  }
}

// Guard links that require auth — redirect to login if not signed in.
// Attach to the document once on any page that has such links.
export function guardAuthLinks() {
  document.addEventListener("click", (e) => {
    const link = e.target?.closest("[data-requires-auth='true']");
    if (!link || (auth.currentUser && has2FA())) return;
    e.preventDefault();
    redirectLogin(link.getAttribute("href") || "");
  }, true);
}