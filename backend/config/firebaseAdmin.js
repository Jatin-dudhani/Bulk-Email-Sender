const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return;
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (jsonPath) {
    const resolved = path.isAbsolute(jsonPath)
      ? jsonPath
      : path.resolve(__dirname, "..", jsonPath);

    if (fs.existsSync(resolved)) {
      const serviceAccount = require(resolved);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin initialized from service account file");
      return;
    }

    console.warn(`Firebase service account file not found: ${resolved}`);
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (process.env.FIREBASE_PROJECT_ID && privateKey && clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert({
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
    console.log("Firebase Admin initialized from environment variables");
    return;
  }

  throw new Error(
    "Firebase Admin SDK not configured. Download a service account JSON from Firebase Console and save it to backend/config/, or set FIREBASE_* variables in backend/.env. See README.md."
  );
}

module.exports = { initFirebaseAdmin };
