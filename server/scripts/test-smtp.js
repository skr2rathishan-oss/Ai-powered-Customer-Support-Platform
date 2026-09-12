require("dotenv").config({ quiet: true });
const nodemailer = require("nodemailer");
const os = require("os");

function getBestLocalAddress() {
  if (process.env.SMTP_LOCAL_ADDRESS || process.env.MAIL_LOCAL_ADDRESS) {
    return process.env.SMTP_LOCAL_ADDRESS || process.env.MAIL_LOCAL_ADDRESS;
  }
  const ifaces = os.networkInterfaces();
  const preferredNames = ["wi-fi", "wifi", "ethernet", "wlan", "eth"];
  for (const pref of preferredNames) {
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes(pref)) {
        for (const a of addrs) {
          if (a.family === "IPv4" && !a.internal) {
            return a.address;
          }
        }
      }
    }
  }
  return undefined;
}

async function testSMTP() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.SMTP_PASS;
  const localAddress = getBestLocalAddress();

  console.log("----------------------------------------");
  console.log("Diagnosing SMTP Configuration & Connectivity");
  console.log("----------------------------------------");
  console.log(`Host:         ${host}`);
  console.log(`Port:         ${port}`);
  console.log(`LocalAddress: ${localAddress || "(default)"}`);
  console.log(`User:         ${user ? user.substring(0, 3) + "***@" + user.split("@")[1] : "NOT SET"}`);
  console.log(`Pass length:  ${pass ? pass.replace(/\s+/g, "").length + " chars" : "NOT SET"}`);
  console.log("----------------------------------------");

  if (!user || !pass) {
    console.error("ERROR: MAIL_USER / SMTP_USER or MAIL_PASSWORD / SMTP_PASS is missing in environment.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // Port 587 uses STARTTLS
    requireTLS: true,
    auth: {
      user,
      pass,
    },
    ...(localAddress ? { localAddress } : {}),
  });

  try {
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SUCCESS: SMTP connection and credentials verified successfully!");
    process.exit(0);
  } catch (err) {
    console.error("FAILURE: SMTP verification failed.");
    console.error(`Error Code:    ${err.code || "N/A"}`);
    console.error(`Command:       ${err.command || "N/A"}`);
    console.error(`Response:      ${err.response || "N/A"}`);
    console.error(`Error Message: ${err.message}`);
    process.exit(1);
  }
}

testSMTP();
