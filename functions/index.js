const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

// Stripe keys live in Secret Manager, never in code. Set them once with:
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
const stripeSecretKey     = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Basic HTML-escaping for customer-supplied text before it goes into an
// email's HTML body (customer name, phone, notes, address are all
// free-text the customer typed on the booking form).
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

exports.sendBookingConfirmationEmail = onDocumentCreated("orders/{orderId}", async (event) => {
  const data = event.data?.data();
  if (!data) {
    logger.error("No order data found");
    return;
  }

  const orderId = event.params.orderId;
  const customerName = data.customerName || "Customer";
  const customerEmail = data.customerEmail;

  if (customerEmail) {
    await admin.firestore().collection("mail").add({
      to: customerEmail,
      message: {
        subject: "Booking confirmation",
        html: `
          <h2>Booking confirmed</h2>
          <p>Hi ${esc(customerName)},</p>
          <p>Your booking has been received.</p>
          <p><strong>Order ID:</strong> ${esc(orderId)}</p>
        `,
      },
    });
    logger.info("Confirmation email queued", { orderId, customerEmail });
  } else {
    logger.info("No customerEmail found. Customer email skipped.");
  }

  // Let the admin (Daniel) know a booking just came in, without having
  // to keep checking the dashboard.
  const serviceText = data.serviceLabel || data.service || "Service";
  const dueText = data.quoteRequired
    ? "Quote required"
    : (data.amountDueNow != null ? `£${data.amountDueNow}` : "—");
  const locationText = data.collectionOption === "homepickup"
    ? `Home pickup — ${esc(data.pickupAddress || "address on order")}`
    : esc(data.location || "—");

  await admin.firestore().collection("mail").add({
    to: ADMIN_EMAIL,
    message: {
      subject: `New booking — ${customerName} (${data.date || "date tbc"})`,
      html: `
        <h2>New booking received</h2>
        <p><strong>Order ID:</strong> ${esc(orderId)}</p>
        <p><strong>Customer:</strong> ${esc(customerName)}
          ${customerEmail ? ` — ${esc(customerEmail)}` : ""}
          ${data.customerPhone ? ` — ${esc(data.customerPhone)}` : ""}</p>
        <p><strong>Service:</strong> ${esc(serviceText)} &times; ${esc(data.pairCount || 1)}</p>
        <p><strong>Date/time:</strong> ${esc(data.date || "—")} at ${esc(data.timeSlot || "—")}</p>
        <p><strong>Location:</strong> ${locationText}</p>
        <p><strong>Amount due:</strong> ${dueText}${data.paymentOption === "deposit" ? " (deposit — balance on collection)" : ""}</p>
        ${data.shoeNotes ? `<p><strong>Notes:</strong> ${esc(data.shoeNotes)}</p>` : ""}
      `,
    },
  });

  logger.info("Admin notification email queued", { orderId, adminEmail: ADMIN_EMAIL });
});


// ─────────────────────────────────────────────────────────────
//  PAYMENTS — Stripe (card + Apple Pay + Google Pay)
// ─────────────────────────────────────────────────────────────

/**
 * Creates a Stripe PaymentIntent for an existing order and returns its
 * client secret so the browser can confirm payment with Stripe's
 * Payment Element (card, Apple Pay, Google Pay all handled by Stripe).
 *
 * The amount is never trusted from the client — it's read straight off
 * the order document in Firestore, and the caller must be signed in as
 * the customer who owns that order.
 */
exports.createPaymentIntent = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to pay.");
    }

    const orderId = String(request.data?.orderId || "").trim();
    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

    const orderRef  = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }

    const order = orderSnap.data();
    if (order.uid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "This isn't your order.");
    }
    if (order.status === "Cancelled") {
      throw new HttpsError("failed-precondition", "This order was cancelled.");
    }
    if (order.paid === true) {
      throw new HttpsError("failed-precondition", "This order is already paid.");
    }
    if (order.quoteRequired || order.amountDueNow == null) {
      throw new HttpsError("failed-precondition", "This order needs a quote before it can be paid.");
    }

    const amountPence = Math.round(Number(order.amountDueNow) * 100);
    if (!Number.isFinite(amountPence) || amountPence < 30) {
      throw new HttpsError("failed-precondition", "Invalid amount for this order.");
    }

    const stripe = require("stripe")(stripeSecretKey.value());

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
        automatic_payment_methods: { enabled: true },
        metadata: { orderId, uid: request.auth.uid },
        receipt_email: order.customerEmail || undefined,
      });
      await orderRef.update({ stripePaymentIntentId: paymentIntent.id });
    }

    return { clientSecret: paymentIntent.client_secret };
  }
);

/**
 * Stripe webhook — the source of truth for "did this order actually get
 * paid". We don't trust the browser to tell us payment succeeded; Stripe
 * tells us directly, signed, server to server.
 *
 * After deploying, add this function's URL as a webhook endpoint in the
 * Stripe dashboard (Developers → Webhooks) listening for
 * "payment_intent.succeeded", then run:
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 * with the signing secret Stripe gives you for that endpoint.
 */
exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const intent  = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await admin.firestore().collection("orders").doc(orderId).update({
          paid: true,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          stripePaymentIntentId: intent.id,
        });
        logger.info("Order marked paid via Stripe webhook", { orderId, paymentIntentId: intent.id });
      } else {
        logger.warn("payment_intent.succeeded with no orderId in metadata", { id: intent.id });
      }
    }

    res.json({ received: true });
  }
);
