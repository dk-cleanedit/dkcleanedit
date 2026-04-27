// login.js — DKcleanedit
// Handles credential login + email-based 2FA.
// SMS / Twilio references removed — email only.
//
// References:
// [1] Firebase Auth — https://firebase.google.com/docs/auth
// [2] EmailJS — https://www.emailjs.com
// [3] Bootdey 2FA card — https://www.bootdey.com/snippets/view/2-step-verification-form-inside-a-card#css

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { mark2FAPassed, has2FA } from "./auth-guard.js";

const EMAILJS_SERVICE  = "service_6ep5ahh";
const EMAILJS_TEMPLATE = "template_2fa_code";

const loginStep   = document.getElementById("loginStep");
const twoFAStep   = document.getElementById("twoFactorStep");
const emailHint   = document.getElementById("twoFAEmailHint");
const loginMsg    = document.getElementById("loginMsg");
const twofaMsg    = document.getElementById("twofaMsg");
const loginForm   = document.getElementById("loginForm");
const btnLogin    = document.getElementById("btnLogin");
const btnVerify   = document.getElementById("btnVerify2FA");
const resendBtn   = document.getElementById("resendCode");
const otpInputs   = [...document.querySelectorAll(".twofa-input")];

let pendingUser   = null;
let expectedCode  = "";

// If the user is already signed in and passed 2FA, skip straight to their dashboard
onAuthStateChanged(auth, (user) => {
  if (user && has2FA()) {
    const params = new URLSearchParams(location.search);
    const next   = params.get("next");
    window.location.replace(next || "customer.html");
  }
});

function setMsg(el, text, isErr = true) {
  if (!el) return;
  el.textContent  = text;
  el.style.color  = isErr ? "var(--danger, #f08888)" : "var(--success, #3dc98a)";
}

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOTPEmail(email, code) {
  // email-only 2FA — no SMS — Ref [2] (EmailJS)
  if (!window.emailjs) throw new Error("EmailJS not loaded");
  return window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
    to_email: email,
    code,
  });
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("logEmail")?.value.trim();
  const pass  = document.getElementById("logPass")?.value;

  if (!email) { setMsg(loginMsg, "Please enter your email address."); return; }
  if (!pass)  { setMsg(loginMsg, "Please enter your password."); return; }

  btnLogin.disabled   = true;
  btnLogin.textContent = "Signing in…";
  setMsg(loginMsg, "");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    pendingUser  = cred.user;
    expectedCode = generateCode();

    await sendOTPEmail(email, expectedCode);

    // show 2FA step
    loginStep.hidden  = false;
    twoFAStep.hidden  = false;
    loginStep.style.display  = "none";
    if (emailHint) emailHint.textContent = email;
    otpInputs[0]?.focus();

  } catch (err) {
    const msgs = {
      "auth/invalid-credential":    "Incorrect email or password.",
      "auth/too-many-requests":     "Too many attempts — try again later.",
      "auth/user-disabled":         "This account has been disabled.",
      "auth/network-request-failed":"Network error — check your connection.",
    };
    setMsg(loginMsg, msgs[err?.code] ?? "Sign-in failed. Please try again.");
  } finally {
    btnLogin.disabled    = false;
    btnLogin.textContent = "Sign in";
  }
});

// OTP digit auto-advance — Ref [3] (Bootdey 2FA card)
otpInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    // only keep the last character typed
    input.value = input.value.slice(-1).replace(/\D/, "");
    if (input.value && i < otpInputs.length - 1) {
      otpInputs[i + 1].focus();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && i > 0) {
      otpInputs[i - 1].focus();
    }
  });
});

btnVerify?.addEventListener("click", () => {
  const code = otpInputs.map((i) => i.value).join("");
  if (code.length !== 4) {
    setMsg(twofaMsg, "Enter the 4-digit code.");
    return;
  }
  if (code !== expectedCode) {
    setMsg(twofaMsg, "Incorrect code — please try again.");
    otpInputs.forEach((i) => (i.value = ""));
    otpInputs[0]?.focus();
    return;
  }

  // 2FA passed — mark session and redirect
  mark2FAPassed();
  const params = new URLSearchParams(location.search);
  const next   = params.get("next");
  window.location.replace(next || "customer.html");
});

resendBtn?.addEventListener("click", async () => {
  if (!pendingUser) return;
  setMsg(twofaMsg, "Sending…", false);
  try {
    expectedCode = generateCode();
    await sendOTPEmail(pendingUser.email, expectedCode);
    setMsg(twofaMsg, "New code sent.", false);
  } catch {
    setMsg(twofaMsg, "Could not resend — please try again.");
  }
});