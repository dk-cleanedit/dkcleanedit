// register.js — DKcleanedit
// Handles new user registration.
// Password strictly blocked if under 8 characters — Ref [2] (100 JS Projects, validation).
//
// References:
// [1] Firebase Auth — https://firebase.google.com/docs/auth
// [2] 100 JS Projects — form validation pattern (https://www.100jsprojects.com)

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const form    = document.getElementById("registerForm");
const msgEl   = document.getElementById("registerMsg");
const btnReg  = document.getElementById("btnRegister");

function showErr(msg) {
  if (!msgEl) return;
  msgEl.textContent = msg;
  msgEl.style.color = "var(--danger, #f08888)";
}

function clearMsg() {
  if (msgEl) msgEl.textContent = "";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const name        = document.getElementById("regName")?.value.trim();
  const email       = document.getElementById("regEmail")?.value.trim();
  const phone       = document.getElementById("regPhone")?.value.trim() || "";
  const pass        = document.getElementById("regPass")?.value ?? "";
  const passConfirm = document.getElementById("regPassConfirm")?.value ?? "";

  // Validation — Ref [2]
  if (!name)           { showErr("Please enter your full name."); return; }
  if (!email)          { showErr("Please enter your email address."); return; }
  if (!pass)           { showErr("Please choose a password."); return; }

  // block weak passwords
  if (pass.length < 8) {
    showErr("Password must be at least 8 characters.");
    document.getElementById("regPass").focus();
    return;
  }

  if (pass !== passConfirm) {
    showErr("Passwords do not match.");
    document.getElementById("regPassConfirm").focus();
    return;
  }

  btnReg.disabled    = true;
  btnReg.textContent = "Creating account…";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    await Promise.all([
      updateProfile(cred.user, { displayName: name }),
      setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        phone,
        points:    0,
        tier:      "Carbon",
        createdAt: serverTimestamp(),
      }),
    ]);

    // Send to login — they still need to complete 2FA before accessing the app
    window.location.replace("login.html?registered=1");

  } catch (err) {
    const msgs = {
      "auth/email-already-in-use":  "An account with this email already exists.",
      "auth/invalid-email":         "That email address isn't valid.",
      "auth/weak-password":         "Password must be at least 8 characters.",
      "auth/network-request-failed":"Network error — check your connection.",
    };
    showErr(msgs[err?.code] ?? "Registration failed. Please try again.");
  } finally {
    btnReg.disabled    = false;
    btnReg.textContent = "Create account";
  }
});