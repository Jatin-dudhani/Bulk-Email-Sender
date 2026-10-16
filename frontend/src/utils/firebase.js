import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

export const SUPER_ADMIN_EMAIL =
  process.env.REACT_APP_ADMIN_EMAIL || "jatindudhani07@gmail.com";

// Check if valid Firebase credentials are provided
export const isFirebaseConfigured = Boolean(
  (process.env.REACT_APP_FIREBASE_API_KEY &&
    !process.env.REACT_APP_FIREBASE_API_KEY.includes("your_")) ||
    true // Live credentials embedded
);

const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyCqXBbn8230EHFcQpQ5VAvA0fUoc0aMKnw",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    "bulk-email-6498b.firebaseapp.com",
  projectId:
    process.env.REACT_APP_FIREBASE_PROJECT_ID || "bulk-email-6498b",
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    "bulk-email-6498b.firebasestorage.app",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "53018041762",
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    "1:53018041762:web:dc7342839ec48a2b7826fb",
  measurementId:
    process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-QSSKNY1M53",
};

let appInstance = null;
try {
  appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase initialization notice:", e.message);
}

export const app = appInstance;
export const auth = appInstance ? getAuth(appInstance) : null;
