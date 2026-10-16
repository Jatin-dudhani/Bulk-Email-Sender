// Node 26+ compatibility shim for buffer-equal-constant-time / jwa
const buffer = require("buffer");
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = buffer.Buffer;
}

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const EmailList = require("./models/EmailList");
const connectDB = require("./config/db");
const { isDbConnected } = require("./config/db");
const { initFirebaseAdmin, isFirebaseConfigured } = require("./config/firebaseAdmin");

// Initialize connections
connectDB();
initFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 5000;
const MAIN_ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.MAIN_ADMIN_EMAIL || "jatindudhani07@gmail.com";

// Security HTTP Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "*"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// In-memory fallback storage when MongoDB is not connected
const inMemoryLists = new Map();

// Configure multer (in-memory file upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB attachment limit (Gmail limit)
});

// Configure CORS
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://bulk-email-frontend.onrender.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname;
        if (
          host === "localhost" ||
          host === "127.0.0.1" ||
          host === "bulk-email-6498b.web.app" ||
          host === "bulk-email-6498b.firebaseapp.com" ||
          host.endsWith(".web.app") ||
          host.endsWith(".firebaseapp.com")
        ) {
          return callback(null, true);
        }
      } catch (err) {
        // Invalid origin format
      }
      return callback(new Error("Blocked by CORS policy"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Session-ID",
      "X-Admin-Key",
      "X-Admin-Email",
      "X-User-ID",
    ],
    credentials: true,
  })
);

// Support Chrome Private Network Access (PNA) so deployed https sites can talk to local backend if desired
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate Limiters for Security & DDoS / Abuse Mitigation
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: "Too many requests from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendMailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Max 50 dispatches/checks per 15 minutes per IP
  message: { error: "Email rate limit exceeded. Please wait a few minutes before sending more campaigns." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: "Too many registration attempts from this IP. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general API rate limiter across all routes
app.use(apiLimiter);

// Active SSE client connections map: sessionId -> Set of res objects
const sseClients = new Map();

function extractNameFromEmail(email) {
  if (!email || !email.includes("@")) return "Friend";
  const localPart = email.split("@")[0];
  const nameParts = localPart
    .split(/[._+-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  return nameParts.join(" ") || "Friend";
}

// Convert plain text with line breaks to clean HTML
function textToHtml(text) {
  if (!text) return "";
  // Check if text already has html tags
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return text
    .split(/\n\n+/)
    .map((p) => `<p style="margin-bottom: 1em; line-height: 1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// Helper: build nodemailer transporter
function createTransporter(userEmail, userPass) {
  const user = userEmail || process.env.EMAIL_USER;
  const pass = userPass || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      "Sender email or App Password not provided. Configure EMAIL_USER and EMAIL_PASS or provide them in request."
    );
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""), // App passwords often copied with spaces
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

// -------------------------------------------------------------
// Health & System Status Endpoints
// -------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/status", (req, res) => {
  const mongoConnected = isDbConnected();
  const firebaseReady = isFirebaseConfigured();
  const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

  const maskedAdmin = MAIN_ADMIN_EMAIL
    ? `${MAIN_ADMIN_EMAIL.slice(0, 2)}***@${MAIN_ADMIN_EMAIL.split("@")[1] || "gmail.com"}`
    : null;

  const maskedSmtp = process.env.EMAIL_USER
    ? `${process.env.EMAIL_USER.slice(0, 2)}***@${process.env.EMAIL_USER.split("@")[1] || "gmail.com"}`
    : null;

  res.json({
    status: "online",
    nodeVersion: process.version,
    mongodb: {
      connected: mongoConnected,
      mode: mongoConnected ? "mongodb" : "in-memory fallback",
    },
    firebase: {
      configured: firebaseReady,
      projectId: process.env.FIREBASE_PROJECT_ID || "bulk-email-6498b",
    },
    smtp: {
      configured: emailConfigured,
      defaultUser: maskedSmtp,
    },
    adminConfigured: !!MAIN_ADMIN_EMAIL,
    adminEmailMasked: maskedAdmin,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Strict ReDoS-safe email validation without exponential backtracking
function isValidEmail(email) {
  if (typeof email !== "string" || email.length > 254) return false;
  if (/[\r\n]/.test(email)) return false;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) return false;
  if (email.indexOf("@", atIndex + 1) !== -1) return false;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (local.length > 64 || domain.length > 255) return false;
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) && /^[a-zA-Z0-9.-]+$/.test(domain);
}

// -------------------------------------------------------------
// Verify Sender / SMTP Connection
// -------------------------------------------------------------
app.post("/verify-sender", sendMailLimiter, async (req, res) => {
  const { senderEmail, appPassword } = req.body;
  const isRequesterAdmin =
    (senderEmail && senderEmail.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase()) ||
    (req.headers["x-admin-key"] && req.headers["x-admin-key"] === process.env.ADMIN_SECRET);

  const emailToTest = senderEmail || (isRequesterAdmin ? process.env.EMAIL_USER : null);
  const passToTest = appPassword || (isRequesterAdmin ? process.env.EMAIL_PASS : null);

  if (!emailToTest || !passToTest) {
    return res.status(400).json({
      success: false,
      error: "Please provide both sender email and Google App Password.",
    });
  }

  if (!isValidEmail(emailToTest)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email format. Please provide a valid email address.",
    });
  }

  try {
    const transporter = createTransporter(emailToTest, passToTest);
    await transporter.verify();
    return res.json({
      success: true,
      message: `Successfully connected to Gmail SMTP as ${emailToTest}!`,
    });
  } catch (error) {
    console.error("SMTP verification error:", error.message);
    let friendlyMessage = error.message;
    if (error.code === "EAUTH" || error.responseCode === 535) {
      friendlyMessage =
        "Authentication failed. Please verify your Gmail address and 16-character App Password (not standard account password). Make sure 2-Step Verification is enabled on your Google Account.";
    } else if (error.code === "ESOCKET" || error.code === "ETIMEDOUT") {
      friendlyMessage = "Connection to smtp.gmail.com timed out. Check your internet connection or firewall.";
    }
    return res.status(400).json({
      success: false,
      error: friendlyMessage,
      code: error.code,
    });
  }
});

async function verifyAdminCaller(req) {
  if (req.headers["x-admin-key"] && req.headers["x-admin-key"] === process.env.ADMIN_SECRET) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && firebaseAdmin) {
    try {
      const idToken = authHeader.split("Bearer ")[1];
      const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
      if (
        (decoded.email && decoded.email.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase()) ||
        decoded.admin === true
      ) {
        return true;
      }
    } catch (e) {
      return false;
    }
  }
  return false;
}

// -------------------------------------------------------------
// Send Single Test Email
// -------------------------------------------------------------
app.post("/api/test-email", sendMailLimiter, async (req, res) => {
  const { senderEmail, appPassword, testRecipient } = req.body;
  const isRequesterAdmin = await verifyAdminCaller(req);

  const fromEmail = senderEmail || (isRequesterAdmin ? process.env.EMAIL_USER : null);
  const toEmail = testRecipient || fromEmail;

  if (!fromEmail) {
    return res.status(400).json({ success: false, error: "Sender email is required." });
  }

  if (!isValidEmail(fromEmail) || !isValidEmail(toEmail)) {
    return res.status(400).json({ success: false, error: "Invalid email address format." });
  }

  try {
    const transporter = createTransporter(fromEmail, appPassword || (isRequesterAdmin ? process.env.EMAIL_PASS : null));
    const info = await transporter.sendMail({
      from: `"Bulk Email Sender" <${fromEmail}>`,
      to: toEmail,
      subject: "Test Email from Bulk Email Sender",
      text: "Congratulations! Your email settings are working perfectly. You are ready to send campaigns.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Bulk Email Sender - Connection Test</h2>
          <p>Hello,</p>
          <p>Congratulations! Your Gmail SMTP credentials are confirmed and ready for bulk sending.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; color: #166534; font-size: 14px; margin: 16px 0;">
            ✓ SMTP Auth: Successful<br/>
            ✓ Sender: ${fromEmail}<br/>
            ✓ Sent At: ${new Date().toLocaleString()}
          </div>
          <p style="color: #64748b; font-size: 12px;">This is an automated test message sent from Bulk Email Sender.</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: `Test email successfully delivered to ${toEmail}!`,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Test email error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// Real-time Progress (SSE)
// -------------------------------------------------------------
app.get("/send-emails/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (res.flushHeaders) res.flushHeaders();

  const sessionId = req.query.sessionId || "default";

  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`);

  req.on("close", () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

function broadcastProgress(sessionId, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;

  // Send to specific session clients
  if (sessionId && sseClients.has(sessionId)) {
    sseClients.get(sessionId).forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {
        // Ignored
      }
    });
  }

  // Also broadcast to "default" session listeners
  if (sessionId !== "default" && sseClients.has("default")) {
    sseClients.get("default").forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {
        // Ignored
      }
    });
  }
}

// -------------------------------------------------------------
// Send Bulk Emails
// -------------------------------------------------------------
app.post("/send-emails", sendMailLimiter, upload.array("attachments"), async (req, res) => {
  const { valid, subject, body, senderEmail, appPassword, sessionId, delayMs } = req.body;
  const files = req.files || [];

  if (!valid) {
    return res.status(400).json({ error: "No recipients provided" });
  }

  let recipients = [];
  try {
    recipients = typeof valid === "string" ? JSON.parse(valid) : valid;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Recipients array is empty" });
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid recipients JSON payload" });
  }

  // Maximum recipient limit per batch to prevent server memory exhaustion
  const MAX_RECIPIENTS_LIMIT = 1000;
  if (recipients.length > MAX_RECIPIENTS_LIMIT) {
    return res.status(400).json({
      error: `Batch size (${recipients.length}) exceeds the maximum limit of ${MAX_RECIPIENTS_LIMIT} recipients per campaign. Please split into smaller campaigns.`,
    });
  }

  // Multi-tenant credential protection:
  // Public users MUST provide their own credentials.
  const isRequesterAdmin = await verifyAdminCaller(req);

  const fromEmail = senderEmail ? senderEmail.trim() : (isRequesterAdmin ? process.env.EMAIL_USER : null);
  const pass = appPassword ? appPassword.trim() : (isRequesterAdmin ? process.env.EMAIL_PASS : null);

  if (!fromEmail || !pass) {
    return res.status(400).json({
      error: "Sender email and Gmail App Password are required. Please configure your sender credentials in Email Settings.",
    });
  }

  // Prevent CRLF SMTP Header Injection
  if (/[\r\n]/.test(fromEmail) || /[\r\n]/.test(subject || "")) {
    return res.status(400).json({
      error: "Security error: Header injection detected. Newline characters are not allowed in sender email or subject.",
    });
  }

  if (!isValidEmail(fromEmail)) {
    return res.status(400).json({
      error: "Invalid sender email address format.",
    });
  }

  let transporter;
  try {
    transporter = createTransporter(fromEmail, pass);
    await transporter.verify();
  } catch (error) {
    return res.status(400).json({
      error: `Failed to authenticate with Gmail SMTP: ${error.message}`,
    });
  }

  const emailAttachments = files.map((file) => ({
    filename: file.originalname,
    content: file.buffer,
    contentType: file.mimetype,
  }));

  const results = {
    total: recipients.length,
    sent: 0,
    failed: 0,
    details: [],
  };

  const parsedDelay = Number(delayMs);
  if (!Number.isInteger(parsedDelay) || parsedDelay < 0 || parsedDelay > 1000) {
    return res.status(400).json({ error: "Invalid delayMs. Must be an integer between 0 and 1000." });
  }
  const throttleDelay = parsedDelay;

  // Send emails sequentially to avoid rate limits and permit progress streaming
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const email = (recipient.email || "").trim();
    const name = (recipient.name || "").trim() || extractNameFromEmail(email);

    // Validate recipient format
    if (!isValidEmail(email)) {
      results.failed++;
      results.details.push({ email, name, status: "failed", error: "Invalid email address format" });
      broadcastProgress(sessionId, {
        index: i + 1,
        total: recipients.length,
        email,
        name,
        status: "failed",
        percent: Math.round(((i + 1) / recipients.length) * 100),
      });
      continue;
    }

    // Personalization replacement
    const personalizedSubject = (subject || "").replace(/{name}/gi, name).replace(/{email}/gi, email);
    const rawMessage = (body || "").replace(/{name}/gi, name).replace(/{email}/gi, email);
    const htmlMessage = textToHtml(rawMessage);

    try {
      await transporter.sendMail({
        from: `"${name ? name + ' via Bulk Sender' : 'Bulk Email'}" <${fromEmail}>`,
        to: email,
        subject: personalizedSubject,
        text: rawMessage,
        html: htmlMessage,
        attachments: emailAttachments,
      });

      results.sent++;
      results.details.push({ email, name, status: "sent" });

      broadcastProgress(sessionId, {
        index: i + 1,
        total: recipients.length,
        email,
        name,
        status: "sent",
        percent: Math.round(((i + 1) / recipients.length) * 100),
      });
    } catch (err) {
      console.error("Failed to send to recipient %s: %s", email, err.message);
      results.failed++;
      results.details.push({ email, name, status: "failed", error: err.message });

      broadcastProgress(sessionId, {
        index: i + 1,
        total: recipients.length,
        email,
        name,
        status: "failed",
        error: err.message,
        percent: Math.round(((i + 1) / recipients.length) * 100),
      });
    }

    if (throttleDelay > 0 && i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, throttleDelay));
    }
  }

  broadcastProgress(sessionId, {
    type: "complete",
    total: recipients.length,
    sent: results.sent,
    failed: results.failed,
  });

  return res.json({
    success: true,
    total: results.total,
    sent: results.sent,
    failed: results.failed,
    details: results.details,
  });
});

// -------------------------------------------------------------
// Middleware: Strict Super Admin Authorization
// -------------------------------------------------------------
async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminKey = req.headers["x-admin-key"];
  const adminSecret = process.env.ADMIN_SECRET;

  // 1. Verify custom secret header if configured in environment
  if (adminSecret && adminKey && adminKey === adminSecret) {
    return next();
  }

  // 2. Verify Firebase ID Token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      if (isFirebaseConfigured()) {
        const decoded = await admin.auth().verifyIdToken(token);
        if (
          decoded.email &&
          (decoded.email.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() || decoded.admin === true)
        ) {
          req.adminUser = decoded;
          return next();
        }
      } else {
        // Fallback: decode JWT payload in dev / serverless modes
        const payloadBase64 = token.split(".")[1];
        if (payloadBase64) {
          const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
          if (
            payload.email &&
            (payload.email.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase() || payload.admin === true)
          ) {
            req.adminUser = payload;
            return next();
          }
        }
      }
    } catch (tokenErr) {
      console.warn("Admin token verification warning:", tokenErr.message);
    }
  }

  // 3. Localhost development fallback
  const isLocalRequest =
    req.ip === "127.0.0.1" ||
    req.ip === "::1" ||
    req.ip === "::ffff:127.0.0.1" ||
    req.hostname === "localhost";

  const requestedAdminEmail = req.headers["x-admin-email"] || req.body.adminEmail || req.query.adminEmail;

  if (
    process.env.NODE_ENV !== "production" &&
    isLocalRequest &&
    requestedAdminEmail &&
    requestedAdminEmail.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase()
  ) {
    return next();
  }

  return res.status(403).json({
    error: "Access Denied: Super Admin privileges required. Only jatindudhani07@gmail.com is authorized.",
  });
}

// -------------------------------------------------------------
// Firebase User Authorization & Admin Management
// -------------------------------------------------------------
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, uid, displayName } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const isSuperAdmin = email.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase().trim();

  try {
    if (isFirebaseConfigured() && uid) {
      await admin.auth().setCustomUserClaims(uid, {
        authorized: true,
        admin: isSuperAdmin,
      });
      console.log(`✅ Granted initial claims to newly registered user ${email} (Admin: ${isSuperAdmin})`);
    }

    return res.json({
      success: true,
      message: `User ${email} registered successfully`,
      isSuperAdmin,
      authorized: true,
      user: {
        email,
        displayName: displayName || extractNameFromEmail(email),
        isAdmin: isSuperAdmin,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/authorized-users", authLimiter, requireAdminAuth, async (req, res) => {
  if (!isFirebaseConfigured()) {
    // In dev mode without Firebase credentials, return demo user list
    return res.json({
      users: [
        { email: MAIN_ADMIN_EMAIL, isAdmin: true, authorized: true },
        { email: "team@example.com", isAdmin: false, authorized: true },
      ],
      devMode: true,
    });
  }

  try {
    const listUsers = await admin.auth().listUsers();
    const authorizedUsers = listUsers.users
      .filter((user) => user.customClaims?.authorized || user.email === MAIN_ADMIN_EMAIL)
      .map((user) => ({
        email: user.email,
        isAdmin: user.email === MAIN_ADMIN_EMAIL || !!user.customClaims?.admin,
        uid: user.uid,
        displayName: user.displayName,
      }));
    return res.json({ users: authorizedUsers });
  } catch (error) {
    console.error("Error fetching authorized users:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/grant-access", authLimiter, requireAdminAuth, async (req, res) => {
  const { userEmailToGrant } = req.body;

  if (!userEmailToGrant) {
    return res.status(400).json({ error: "User email to grant is required" });
  }

  if (!isFirebaseConfigured()) {
    return res.json({ message: `Access granted successfully to ${userEmailToGrant} (Dev Mode)` });
  }

  try {
    const userToGrant = await admin.auth().getUserByEmail(userEmailToGrant);
    const existingClaims = userToGrant.customClaims || {};
    await admin.auth().setCustomUserClaims(userToGrant.uid, {
      ...existingClaims,
      authorized: true,
    });

    return res.json({ message: "Access granted successfully" });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({
        error: "User must sign in with Google at least once before access can be granted.",
      });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.post("/revoke-access", authLimiter, requireAdminAuth, async (req, res) => {
  const { userEmailToRevoke } = req.body;

  if (!userEmailToRevoke) {
    return res.status(400).json({ error: "User email to revoke is required" });
  }

  if (userEmailToRevoke.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase().trim()) {
    return res.status(403).json({ error: "Cannot revoke main admin privileges" });
  }

  if (!isFirebaseConfigured()) {
    return res.json({ message: `Access revoked successfully from ${userEmailToRevoke} (Dev Mode)` });
  }

  try {
    const userToRevoke = await admin.auth().getUserByEmail(userEmailToRevoke);
    await admin.auth().setCustomUserClaims(userToRevoke.uid, {
      authorized: false,
      admin: false,
    });
    return res.json({ message: "Access revoked successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/toggle-admin", authLimiter, requireAdminAuth, async (req, res) => {
  const { targetUserEmail } = req.body;

  if (!targetUserEmail) {
    return res.status(400).json({ error: "Target user email is required" });
  }

  if (targetUserEmail.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase().trim()) {
    return res.status(403).json({ error: "Cannot modify main admin status" });
  }

  if (!isFirebaseConfigured()) {
    return res.json({ message: `Admin status toggled for ${targetUserEmail} (Dev Mode)` });
  }

  try {
    const targetUser = await admin.auth().getUserByEmail(targetUserEmail);
    const currentClaims = targetUser.customClaims || {};
    const newAdminStatus = !currentClaims.admin;

    await admin.auth().setCustomUserClaims(targetUser.uid, {
      ...currentClaims,
      admin: newAdminStatus,
      authorized: true,
    });

    return res.json({
      message: `Admin status updated to ${newAdminStatus ? "Admin" : "Standard User"} successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/setup-admin", authLimiter, requireAdminAuth, async (req, res) => {
  const targetEmail = req.body.email || MAIN_ADMIN_EMAIL;
  const uid = req.body.uid;

  if (!isFirebaseConfigured()) {
    return res.json({
      message: `Admin setup simulated for ${targetEmail} (Firebase Admin not configured yet)`,
    });
  }

  try {
    let targetUid = uid;
    if (!targetUid && targetEmail) {
      const user = await admin.auth().getUserByEmail(targetEmail);
      targetUid = user.uid;
    }

    if (!targetUid) {
      return res.status(400).json({ error: "Provide either a valid email or uid" });
    }

    await admin.auth().setCustomUserClaims(targetUid, {
      admin: true,
      authorized: true,
    });

    return res.json({
      message: `Admin privileges granted to UID ${targetUid} (${targetEmail})`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Email Lists API (MongoDB + In-Memory Fallback)
// -------------------------------------------------------------
// Create new list
app.post("/api/lists", async (req, res) => {
  const { userId, listName, description } = req.body;

  if (!userId || !listName) {
    return res.status(400).json({ error: "userId and listName are required" });
  }

  try {
    if (isDbConnected()) {
      const list = new EmailList({
        userId,
        listName: listName.trim(),
        description: description || "",
        emails: [],
      });
      await list.save();
      return res.status(201).json(list);
    }

    // In-memory fallback
    const id = "list_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const memoryList = {
      _id: id,
      userId,
      listName: listName.trim(),
      description: description || "",
      emails: [],
      createdAt: new Date(),
    };
    inMemoryLists.set(id, memoryList);
    return res.status(201).json(memoryList);
  } catch (error) {
    console.error("Create list error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Get all lists for a user
app.get("/api/lists/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    if (isDbConnected()) {
      const lists = await EmailList.find({ userId }).sort({ createdAt: -1 });
      return res.json(lists);
    }

    // In-memory fallback
    const userLists = Array.from(inMemoryLists.values())
      .filter((l) => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(userLists);
  } catch (error) {
    console.error("Get lists error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Add emails to list
app.post("/api/lists/:listId/emails", async (req, res) => {
  const { emails, userId } = req.body;
  const { listId } = req.params;
  const requesterId = userId || req.headers["x-user-id"];

  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: "emails array is required" });
  }

  // Filter and deduplicate incoming emails
  const cleanEmails = emails
    .map((e) => (typeof e === "string" ? e.trim() : e.email ? e.email.trim() : ""))
    .filter(Boolean);

  try {
    if (isDbConnected()) {
      const list = await EmailList.findById(listId);
      if (!list) return res.status(404).json({ error: "List not found" });

      if (requesterId && list.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Unauthorized: You do not own this list" });
      }

      const emailSet = new Set(list.emails || []);
      cleanEmails.forEach((email) => emailSet.add(email));
      list.emails = Array.from(emailSet);
      await list.save();
      return res.json(list);
    }

    // In-memory fallback
    const list = inMemoryLists.get(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    if (requesterId && list.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Unauthorized: You do not own this list" });
    }

    const emailSet = new Set(list.emails || []);
    cleanEmails.forEach((email) => emailSet.add(email));
    list.emails = Array.from(emailSet);
    inMemoryLists.set(listId, list);
    return res.json(list);
  } catch (error) {
    console.error("Add emails error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Remove email from list
app.delete("/api/lists/:listId/emails/:email", async (req, res) => {
  const { listId, email } = req.params;
  const requesterId = req.query.userId || req.body?.userId || req.headers["x-user-id"];

  try {
    if (isDbConnected()) {
      const existingList = await EmailList.findById(listId);
      if (!existingList) return res.status(404).json({ error: "List not found" });

      if (requesterId && existingList.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Unauthorized: You do not own this list" });
      }

      const list = await EmailList.findByIdAndUpdate(
        listId,
        { $pull: { emails: email } },
        { new: true }
      );
      return res.json(list);
    }

    // In-memory fallback
    const list = inMemoryLists.get(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    if (requesterId && list.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Unauthorized: You do not own this list" });
    }

    list.emails = (list.emails || []).filter((e) => e !== email);
    inMemoryLists.set(listId, list);
    return res.json(list);
  } catch (error) {
    console.error("Remove email error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Delete list
app.delete("/api/lists/:listId", async (req, res) => {
  const { listId } = req.params;
  const requesterId = req.query.userId || req.body?.userId || req.headers["x-user-id"];

  try {
    if (isDbConnected()) {
      const existingList = await EmailList.findById(listId);
      if (!existingList) return res.status(404).json({ error: "List not found" });

      if (requesterId && existingList.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Unauthorized: You do not have permission to delete this list" });
      }

      await EmailList.findByIdAndDelete(listId);
      return res.json({ message: "List deleted successfully" });
    }

    // In-memory fallback
    const existingList = inMemoryLists.get(listId);
    if (!existingList) return res.status(404).json({ error: "List not found" });

    if (requesterId && existingList.userId !== requesterId && requesterId !== MAIN_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Unauthorized: You do not have permission to delete this list" });
    }

    inMemoryLists.delete(listId);
    return res.json({ message: "List deleted successfully" });
  } catch (error) {
    console.error("Delete list error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Serve static frontend build assets in production
// -------------------------------------------------------------
const frontendBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/send-emails") ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/verify-sender") ||
      req.path.startsWith("/grant-access") ||
      req.path.startsWith("/revoke-access") ||
      req.path.startsWith("/toggle-admin") ||
      req.path.startsWith("/authorized-users")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
}

// -------------------------------------------------------------
// Start the server with graceful port fallback
// -------------------------------------------------------------
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`🚀 Bulk Email Backend running on http://localhost:${portToTry}`);
    console.log(`📍 Status endpoint: http://localhost:${portToTry}/api/status`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      const nextPort = portToTry === 5000 ? 5001 : portToTry + 1;
      console.warn(
        `⚠️  Port ${portToTry} is currently in use (common with macOS ControlCenter/AirPlay on 5000). Falling back to port ${nextPort}...`
      );
      startServer(nextPort);
    } else {
      console.error("Server fatal error:", err);
    }
  });

  return server;
}

if (require.main === module) {
  const initialPort = parseInt(process.env.PORT, 10) || 5001;
  startServer(initialPort);
}

module.exports = app;

