const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backendEnv = path.join(root, "backend", ".env");
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

const env = readEnv(backendEnv);
const issues = [];

if (
  !env.MONGO_URI ||
  env.MONGO_URI.includes("your_mongodb_connection_string")
) {
  issues.push("MONGO_URI is not set in backend/.env");
}

if (!fs.existsSync(serviceAccount)) {
  const hasFirebaseEnv =
    env.FIREBASE_PRIVATE_KEY &&
    env.FIREBASE_CLIENT_EMAIL &&
    !env.FIREBASE_PRIVATE_KEY.includes("your_");
  if (!hasFirebaseEnv) {
    issues.push(
      "Firebase service account JSON missing (backend/config/) and FIREBASE_* env vars incomplete"
    );
  }
}

if (
  !env.EMAIL_USER ||
  env.EMAIL_USER.includes("your_gmail") ||
  !env.EMAIL_PASS ||
  env.EMAIL_PASS.includes("your_gmail")
) {
  issues.push("EMAIL_USER / EMAIL_PASS not set in backend/.env");
}

if (issues.length === 0) {
  console.log("Backend setup looks complete.");
  process.exit(0);
}

console.log("Backend setup incomplete:\n");
issues.forEach((msg) => console.log(`  - ${msg}`));
console.log("\nSee README.md for instructions.");
process.exit(1);
