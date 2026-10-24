// Netlify serverless function — replaces the old Firebase Cloud Function
// of the same purpose (functions/index.js exports.stripeWebhook).
//
// This is the source of truth for "did this order actually get paid" --
// we don't trust the browser to tell us payment succeeded; Stripe tells
// us directly, signed, server to server.
//
// After this is deployed, add its URL as a webhook endpoint in the
// Stripe Dashboard (Developers -> Webhooks -> Add endpoint):
//   https://dkcleanedit.com/.netlify/functions/stripe-webhook
// listening for "payment_intent.succeeded", then copy the signing
// secret it gives you into Netlify's STRIPE_WEBHOOK_SECRET environment
// variable (Site settings -> Environment variables -- no CLI needed).
//
// Required Netlify environment variables:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   FIREBASE_SERVICE_ACCOUNT_B64   (same one create-payment-intent.js uses)

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed." };
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: "Stripe isn't configured yet." };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

  // Stripe's signature check needs the exact raw body bytes it sent --
  // Netlify may deliver that base64-encoded depending on content type.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "payment_intent.succeeded") {
    const intent = stripeEvent.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) {
      try {
        const fbAdmin = getAdmin();
        await fbAdmin.firestore().collection("orders").doc(orderId).update({
          paid: true,
          paidAt: fbAdmin.firestore.FieldValue.serverTimestamp(),
          stripePaymentIntentId: intent.id,
        });
        console.log("Order marked paid via Stripe webhook", orderId, intent.id);
      } catch (err) {
        console.error("Failed to mark order paid:", err);
        // Still 200 the webhook -- Stripe only retries on non-2xx, and
        // retrying won't fix a Firestore write failure here. Worth
        // checking Netlify function logs if this ever happens.
      }
    } else {
      console.warn("payment_intent.succeeded with no orderId in metadata", intent.id);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ received: true }),
  };
};
