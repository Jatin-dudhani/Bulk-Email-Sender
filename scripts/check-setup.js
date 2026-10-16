const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backendEnv = path.join(root, "backend", ".env");
const frontendEnv = path.join(root, "frontend", ".env");
const serviceAccount = path.join(
  root,
  "backend",
  "config",
  "bulk-email-5c174-firebase-adminsdk-l7wjc-2abd0cd92d.json"
);

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

console.log("\n==========================================");
console.log("  🔍 Bulk Email Sender - System Diagnostic");
console.log("==========================================\n");

// 1. Node Runtime Check
console.log(`Node Runtime: ${process.version}`);
const nodeMajor = parseInt(process.version.slice(1).split(".")[0], 10);
if (nodeMajor < 18) {
  console.log("⚠️  Warning: Node.js 18+ is recommended.");
} else {
  console.log("✅ Node version compatible (18+)");
}

// 2. Check Backend Environment
const bEnv = readEnv(backendEnv);
const notices = [];
const ready = [];

if (bEnv.MONGO_URI && !bEnv.MONGO_URI.includes("your_mongodb_connection_string")) {
  ready.push("MongoDB Atlas configured via MONGO_URI");
} else {
  notices.push("MongoDB Atlas: Not configured. (App will use in-memory store for lists)");
}

const hasServiceAccountJson = fs.existsSync(serviceAccount);
const hasFirebaseEnv =
  bEnv.FIREBASE_PRIVATE_KEY &&
  bEnv.FIREBASE_CLIENT_EMAIL &&
  !bEnv.FIREBASE_PRIVATE_KEY.includes("your_");

if (hasServiceAccountJson || hasFirebaseEnv) {
  ready.push("Firebase Admin: Configured");
} else {
  notices.push("Firebase Admin: In dev mode. (Local demo authentication enabled)");
}

if (
  bEnv.EMAIL_USER &&
  !bEnv.EMAIL_USER.includes("your_gmail") &&
  bEnv.EMAIL_PASS &&
  !bEnv.EMAIL_PASS.includes("your_gmail")
) {
  ready.push("Gmail SMTP: Default credentials set in backend/.env");
} else {
  notices.push("Gmail SMTP: Not in backend/.env (Can be entered directly in app settings)");
}

console.log("\nActive Features:");
ready.forEach((r) => console.log(`  ✓ ${r}`));

if (notices.length > 0) {
  console.log("\nOptional / Fallback Configurations:");
  notices.forEach((n) => console.log(`  ℹ ${n}`));
}

console.log("\n🚀 System Ready to Run:");
console.log("  Run `npm run dev` to start both backend and frontend concurrently.");
console.log("  • Frontend: http://localhost:3000");
console.log("  • Backend:  http://localhost:5001\n");
