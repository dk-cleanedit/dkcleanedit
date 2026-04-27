// app.logic.js — pure functions only, no Firebase, no DOM

export function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function has2FA(storage = sessionStorage) {
  return storage.getItem("dk_2fa") === "1";
}

export function mark2FAPassed(storage = sessionStorage) {
  storage.setItem("dk_2fa", "1");
}

export function clear2FA(storage = sessionStorage) {
  storage.removeItem("dk_2fa");
}

export function getTierDiscount(tier) {
  if (tier === "Pearl") return { pct: 100, label: "Pearl tier — free clean!" };
  if (tier === "Stone") return { pct: 10,  label: "Stone tier — 10% off" };
  return { pct: 0, label: "" };
}

export function getAddonsTotal(addons) {
  return addons.reduce((sum, a) => sum + a.price, 0);
}

export function getTotalPriceStr(basePrice, tierDiscountPct, addonsTotal) {
  const discount = Math.round(basePrice * (tierDiscountPct / 100));
  return "£" + Math.max(0, basePrice - discount + addonsTotal);
}