const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

exports.sendBookingConfirmationEmail = onDocumentCreated("orders/{orderId}", async (event) => {
  const data = event.data?.data();
  if (!data) {
    logger.error("No order data found");
    return;
  }

  const orderId = event.params.orderId;
  const customerName = data.customerName || "Customer";
  const customerEmail = data.customerEmail;

  if (!customerEmail) {
    logger.info("No customerEmail found. Email skipped.");
    return;
  }

  await admin.firestore().collection("mail").add({
    to: customerEmail,
    message: {
      subject: "Booking confirmation",
      html: `
        <h2>Booking confirmed</h2>
        <p>Hi ${customerName},</p>
        <p>Your booking has been received.</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
      `,
    },
  });

  logger.info("Confirmation email queued", { orderId, customerEmail });
});