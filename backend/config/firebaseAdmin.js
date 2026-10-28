const { cert, getApps, initializeApp } = require("firebase-admin/app");
const fs = require("fs");
const path = require("path");

let isConfigured = false;

function initFirebaseAdmin() {
  if (getApps().length) {
    isConfigured = true;
    return true;
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (jsonPath) {
    const resolved = path.isAbsolute(jsonPath)
      ? jsonPath
      : path.resolve(__dirname, "..", jsonPath);

    if (fs.existsSync(resolved)) {
      try {
        const serviceAccount = require(resolved);
        initializeApp({
          credential: cert(serviceAccount),
        });
        console.log("✅ [Firebase] Firebase Admin initialized from service account file");
        isConfigured = true;
        return true;
      } catch (err) {
        console.warn(`⚠️  [Firebase] Error reading service account file (${resolved}): ${err.message}`);
      }
    } else {
      console.warn(`⚠️  [Firebase] Service account file not found: ${resolved}`);
    }
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (process.env.FIREBASE_PROJECT_ID && privateKey && clientEmail) {
    try {
      initializeApp({
        credential: cert({
          type: process.env.FIREBASE_TYPE || "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: clientEmail,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri:
            process.env.FIREBASE_AUTH_URI ||
            "https://accounts.google.com/o/oauth2/auth",
          token_uri:
            process.env.FIREBASE_TOKEN_URI ||
            "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url:
            process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL ||
            "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
          universe_domain:
            process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com",
        }),
      });
      console.log("✅ [Firebase] Firebase Admin initialized from environment variables");
      isConfigured = true;
      return true;
    } catch (err) {
      console.warn(`⚠️  [Firebase] Error initializing Firebase Admin from env: ${err.message}`);
    }
  }

  console.warn(
    "⚠️  [Firebase] Firebase Admin SDK not configured. User authentication & admin claims endpoints will run in development mode. To enable full Firebase Auth, provide credentials in backend/.env."
  );
  isConfigured = false;
  return false;
}

const isFirebaseConfigured = () => isConfigured && getApps().length > 0;

module.exports = { initFirebaseAdmin, isFirebaseConfigured };
