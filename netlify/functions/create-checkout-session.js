// Netlify serverless function — creates a Stripe-hosted Checkout Session
// for an order, for ANY total (service + add-ons + pickup fee, minus any
// loyalty discount, or just the fixed deposit). This is the general-purpose
// payment path: unlike the fixed-price Payment Links in app.js (which only
// cover a plain full-price tier booking or the flat £10 deposit), this
// works for every order shape, because the price is read straight off the
// order in Firestore and built into the session at creation time.
//
// The customer is redirected to Stripe's own hosted checkout page
// (session.url) — Stripe shows whichever payment methods are enabled on
// the account (card, Apple Pay, Google Pay, etc.) automatically, same as
// it does for Payment Links, with no domain verification needed.
//
// Required Netlify environment variables (Site settings → Environment
// variables — no CLI needed):
//   STRIPE_SECRET_KEY            — live secret key (starts sk_live_)
//   FIREBASE_SERVICE_ACCOUNT_B64 — base64-encoded Firebase service account
//                                  JSON (same one the other functions use)
//
// If STRIPE_SECRET_KEY isn't set yet, this returns a clear 500 and the
// frontend falls back to the fixed-price Payment Links, then to bank
// transfer — nothing breaks while this is still being configured.

const admin = require("firebase-admin");
const Stripe = require("stripe");

function getAdmin() {
  if (!admin.apps.length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set in Netlify environment variables.");
    }
    const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

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

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!idToken) {
    return json(401, { error: "You must be signed in to pay." });
  }

  let fbAdmin;
  let uid;
  try {
    fbAdmin = getAdmin();
    const decoded = await fbAdmin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    console.error("verifyIdToken failed:", err);
    return json(401, { error: "Your session has expired. Please sign in again." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request." });
  }

  const orderId = String(body.orderId || "").trim();
  if (!orderId) {
    return json(400, { error: "orderId is required." });
  }

  const db = fbAdmin.firestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return json(404, { error: "Order not found." });
  }

  const order = orderSnap.data();
  if (order.uid !== uid) {
    return json(403, { error: "This isn't your order." });
  }
  if (order.status === "Cancelled") {
    return json(400, { error: "This order was cancelled." });
  }
  if (order.paid === true) {
    return json(400, { error: "This order is already paid." });
  }
  if (order.quoteRequired || order.amountDueNow == null) {
    return json(400, { error: "This order needs a quote before it can be paid." });
  }

  const amountPence = Math.round(Number(order.amountDueNow) * 100);
  if (!Number.isFinite(amountPence) || amountPence < 30) {
    return json(400, { error: "Invalid amount for this order." });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = event.headers.origin || "https://dkcleanedit.com";

  const isDeposit = order.paymentOption === "deposit";
  const productName = isDeposit
    ? `DKcleanedit — deposit for order ${orderId}`
    : `DKcleanedit — order ${orderId}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: productName },
          unit_amount: amountPence,
        },
        quantity: 1,
      },
    ],
    customer_email: order.customerEmail || undefined,
    client_reference_id: orderId,
    // payment_intent_data.metadata carries orderId onto the underlying
    // PaymentIntent, so the existing webhook (which reads
    // intent.metadata.orderId off payment_intent.succeeded) keeps working
    // unchanged for Checkout Sessions too.
    payment_intent_data: { metadata: { orderId, uid } },
    metadata: { orderId, uid },
    success_url: `${origin}/track.html?orderId=${encodeURIComponent(orderId)}&paid=1`,
    cancel_url: `${origin}/track.html?orderId=${encodeURIComponent(orderId)}`,
  });

  return json(200, { url: session.url });
};
