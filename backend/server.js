const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
require("dotenv").config();
const EmailList = require("./models/EmailList");
const connectDB = require("./config/db");
const { initFirebaseAdmin } = require("./config/firebaseAdmin");

// Connect to MongoDB
connectDB();

initFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 5000;
const upload = multer();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://bulk-email-frontend.onrender.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ];

app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
// console.log(process.env.EMAIL_USER);
let emailProgress = new Map();

function extractNameFromEmail(email) {
  const localPart = email.split("@")[0];
  const nameParts = localPart
    .split(/[._]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return nameParts.join(" ");
}

// Toggle admin status
app.post("/toggle-admin", async (req, res) => {
  const { currentAdminEmail, targetUserEmail } = req.body;
  const mainAdminEmail = "parthgarg351@gmail.com";

  try {
    // Verify current admin
    const adminUser = await admin.auth().getUserByEmail(currentAdminEmail);
    const adminClaims = (await admin.auth().getUser(adminUser.uid))
      .customClaims;

    if (!adminClaims?.admin) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify admin status" });
    }

    // Protect main admin
    if (targetUserEmail === mainAdminEmail) {
      return res.status(403).json({ error: "Cannot modify main admin status" });
    }

    // Toggle admin status
    const targetUser = await admin.auth().getUserByEmail(targetUserEmail);
    const currentClaims =
      (await admin.auth().getUser(targetUser.uid)).customClaims || {};

    await admin.auth().setCustomUserClaims(targetUser.uid, {
      ...currentClaims,
      admin: !currentClaims.admin,
    });

    res.json({ message: "Admin status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all authorized users
app.get("/authorized-users", async (req, res) => {
  try {
    console.log("Fetching authorized users...");
    const listUsers = await admin.auth().listUsers();
    const authorizedUsers = listUsers.users
      .filter((user) => user.customClaims?.authorized)
      .map((user) => ({
        email: user.email,
        isAdmin: user.customClaims?.admin || false,
      }));
    console.log("Found users:", authorizedUsers);
    res.json({ users: authorizedUsers });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to grant access
app.post("/grant-access", async (req, res) => {
  const adminEmail = req.body.adminEmail;
  const userEmailToGrant = req.body.userEmailToGrant;
  console.log("Attempting to grant access:", {
    adminEmail,
    userEmailToGrant,
  });

  try {
    const adminUser = await admin.auth().getUserByEmail(adminEmail);
    console.log("Admin user found:", adminUser.uid);
    const adminClaims = (await admin.auth().getUser(adminUser.uid))
      .customClaims;
    // console.log('Admin claims:', adminClaims);

    if (!adminClaims?.admin) {
      return res.status(403).json({ error: "Not authorized as admin" });
    }

    const userToGrant = await admin.auth().getUserByEmail(userEmailToGrant);
    await admin
      .auth()
      .setCustomUserClaims(userToGrant.uid, { authorized: true });

    console.log("Access granted successfully to:", userEmailToGrant);
    res.json({ message: "Access granted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/send-emails/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const clientId = Date.now();
  emailProgress.set(clientId, res);

  req.on("close", () => {
    emailProgress.delete(clientId);
  });
});

app.post("/send-emails", upload.array("attachments"), async (req, res) => {
  const { valid, subject, body, senderEmail, appPassword } = req.body;
  const files = req.files; 
  let hasResponded = false;
  console.log("Subject = ", subject);
  console.log("Body = ", body);
  console.log("Sender Email = ", senderEmail);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: senderEmail || process.env.EMAIL_USER,
      pass: appPassword || process.env.EMAIL_PASS,
    },
  });

  for (const recipient of JSON.parse(valid)) {
    const name = recipient.name || extractNameFromEmail(recipient.email);
    const personalizedSubject = subject.replace(/{name}/g, name);
    const personalizedMessage = body.replace(/{name}/g, name);

    try {
      await transporter.sendMail({
        from: senderEmail,
        to: recipient.email,
        subject: personalizedSubject,
        text: personalizedMessage,
        attachments: files
          ? files.map((file) => ({
              filename: file.originalname,
              content: file.buffer,
            }))
          : [],
      });
      console.log(`Email sent to: ${recipient.email}`);
      // Send progress to all connected clients
      emailProgress.forEach((client) => {
        client.write(`data: ${JSON.stringify({ email: recipient.email })}\n\n`);
      });
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);
      if (!hasResponded) {
        hasResponded = true;
        return res.status(500).json({ error: error.message });
      }
    }
  }
  
  if (!hasResponded) {
    res.json({ success: true });
  }
});

app.post("/revoke-access", async (req, res) => {
  const { adminEmail, userEmailToRevoke } = req.body;

  try {
    const adminUser = await admin.auth().getUserByEmail(adminEmail);
    const adminClaims = (await admin.auth().getUser(adminUser.uid))
      .customClaims;

    if (!adminClaims?.admin) {
      return res.status(403).json({ error: "Not authorized as admin" });
    }

    const userToRevoke = await admin.auth().getUserByEmail(userEmailToRevoke);
    await admin.auth().setCustomUserClaims(userToRevoke.uid, null);

    res.json({ message: "Access revoked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this endpoint after your existing routes
app.post("/setup-admin", async (req, res) => {
  const uid = "F95tLXwOIXVhLvpWrSRFTe4y3QX2"; // Replace with your Firebase user UID
  try {
    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
      authorized: true,
    });
    res.json({ message: "Admin setup successful" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Command to set up admin is ---  curl -X POST http://localhost:5000/setup-admin

app.get("/test-admin", async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers();
    res.json({
      message: "Firebase Admin SDK working",
      userCount: listUsers.users.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  console.log(
    "Firebase Admin initialized with project:",
    process.env.FIREBASE_PROJECT_ID
  );
});

//the command to check admin  ------ curl http://localhost:5000/test-admin

// Create new list
app.post("/api/lists", async (req, res) => {
  const { userId, listName } = req.body;
  const list = new EmailList({
    userId,
    listName,
    emails: [],
  });
  await list.save();
  res.json(list);
});

// Get all lists for user
app.get("/api/lists/:userId", async (req, res) => {
  const lists = await EmailList.find({ userId: req.params.userId });
  res.json(lists);
});

// Add email to list
app.post("/api/lists/:listId/emails", async (req, res) => {
  const { emails } = req.body;
  const list = await EmailList.findByIdAndUpdate(
    req.params.listId,
    { $push: { emails: { $each: emails } } },
    { new: true }
  );
  res.json(list);
});

// Remove email from list
app.delete("/api/lists/:listId/emails/:email", async (req, res) => {
  const list = await EmailList.findByIdAndUpdate(
    req.params.listId,
    { $pull: { emails: req.params.email } },
    { new: true }
  );
  res.json(list);
});

// Delete list
app.delete("/api/lists/:listId", async (req, res) => {
  await EmailList.findByIdAndDelete(req.params.listId);
  res.json({ message: "List deleted successfully" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
