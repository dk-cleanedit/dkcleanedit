// Netlify serverless function — creates a Stripe-hosted Checkout Session
// for an order, for ANY total (service + add-ons + pickup fee, minus any
// loyalty discount, or just the fixed deposit).
//
// No Firebase involved on purpose: the browser already computed and wrote
// this exact total to Firestore when the booking was confirmed (same as
// everything else in this app — orders are written directly by the
// signed-in customer's browser), so this function just takes that number
// and turns it into a Stripe Checkout Session. One secret, nothing else.
//
// The customer is redirected to Stripe's own hosted checkout page
// (session.url) — Stripe shows whichever payment methods are enabled on
// the account (card, Apple Pay, Google Pay, etc.) automatically, same as
// it does for Payment Links, with no domain verification needed.
//
// Required Netlify environment variable (Site settings → Environment
// variables — no CLI needed):
//   STRIPE_SECRET_KEY — your Stripe secret key, from
//                       Stripe Dashboard → Developers → API keys
//
// If STRIPE_SECRET_KEY isn't set yet, this returns a clear 500 and the
// frontend falls back to the fixed-price Payment Links, then to bank
// transfer — nothing breaks while this is still being configured.

const Stripe = require("stripe");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: "Card payment isn't set up yet — pay by bank transfer using the details on your order." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const orderId = String(body.orderId || "").trim();
  const amount = Number(body.amountDueNow);
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) : "";

  if (!orderId) {
    return json(400, { error: "orderId is required." });
  }
  // Sanity bounds on the amount — not a security boundary (the browser
  // already fully controls what it writes to this order in Firestore,
  // same as the rest of the booking flow), just a guard against a
  // malformed/garbage request.
  if (!Number.isFinite(amount) || amount < 1 || amount > 2000) {
    return json(400, { error: "Invalid amount for this order." });
  }

  const amountPence = Math.round(amount * 100);
  // Strip stray spaces/newlines/quotes picked up when pasting the key into
  // Netlify — any of those makes Stripe see a broken Authorization header.
  const stripe = Stripe(String(process.env.STRIPE_SECRET_KEY).replace(/[\s"']/g, ""));
  const origin = event.headers.origin || "https://dkcleanedit.com";

  let session;
  try {
  session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: description || `DKcleanedit — order ${orderId}` },
          unit_amount: amountPence,
        },
        quantity: 1,
      },
    ],
    customer_email: customerEmail || undefined,
    client_reference_id: orderId,
    metadata: { orderId },
    success_url: `${origin}/track.html?orderId=${encodeURIComponent(orderId)}&paid=1`,
    cancel_url: `${origin}/track.html?orderId=${encodeURIComponent(orderId)}`,
  });
  } catch (err) {
    console.error("Checkout session failed:", err && err.message);
    return json(502, { error: (err && err.message) || "Stripe error", amount });
  }

  return json(200, { url: session.url });
};
