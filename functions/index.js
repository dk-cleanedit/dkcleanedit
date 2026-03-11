const functions = require("firebase-functions");
const twilio = require("twilio");

exports.sendSms = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).send("Use POST");

  const { phone, name } = req.body || {};
  if (!phone) return res.status(400).send("Missing phone");

  const sid = functions.config().twilio.sid;
  const token = functions.config().twilio.token;
  const from = functions.config().twilio.from;

  if (!sid || !token || !from) return res.status(500).send("Twilio config missing");

  try {
    const client = twilio(sid, token);
    await client.messages.create({
      to: phone,
      from,
      body: `Welcome to DKcleanedit ${name || ""}! 👟 Your account is ready.`
    });
    return res.status(200).send("SMS sent");
  } catch (err) {
    console.error("Twilio error:", err);
    return res.status(500).send(err.message || "SMS failed");
  }
});

