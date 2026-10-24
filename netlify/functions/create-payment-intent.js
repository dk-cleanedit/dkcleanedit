// Netlify serverless function — replaces the old Firebase Cloud Function
// of the same purpose (functions/index.js exports.createPaymentIntent).
// Moved here so deploys happen automatically via Netlify's existing
// git-push pipeline instead of requiring a separate Firebase CLI deploy.
//
// Required Netlify environment variables (Site settings -> Environment
// variables -- no CLI needed):
//   STRIPE_SECRET_KEY            -- live secret key from Stripe Dashboard
//                                  -> Developers -> API keys (starts sk_live_)
//   FIREBASE_SERVICE_ACCOUNT_B64 -- base64-encoded JSON of a Firebase
//                                  service account key (Firebase Console ->
//                                  Project Settings -> Service Accounts ->
//                                  Generate new private key, then
//                                  `base64 -i that-file.json | pbcopy`)
//
// The amount charged is never trusted from the browser -- it's read
// straight off the order document in Firestore, same as before, and the
// caller must present a valid Firebase ID token for the user who owns
// that order.

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

  // Reuse an existing PaymentIntent for this order if one is already
  // pending, instead of creating a new one every time the payment
  // sheet is opened.
  let paymentIntent;
  if (order.stripePaymentIntentId) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      if (["succeeded", "canceled"].includes(paymentIntent.status)) paymentIntent = null;
    } catch {
      paymentIntent = null;
    }
  }

  if (!paymentIntent || paymentIntent.amount !== amountPence) {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      // automatic_payment_methods lets Stripe decide which methods to
      // offer (card, Apple Pay, Google Pay, ...) based on the Stripe
      // Dashboard config and the customer's browser/device -- this is
      // what makes Apple Pay show up in the Payment Element.
      automatic_payment_methods: { enabled: true },
      metadata: { orderId, uid },
      receipt_email: order.customerEmail || undefined,
    });
    await orderRef.update({ stripePaymentIntentId: paymentIntent.id });
  }

  return json(200, { clientSecret: paymentIntent.client_secret });
};
