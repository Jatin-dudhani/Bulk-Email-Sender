# Firebase service account (local backend)

1. Open [Firebase Console](https://console.firebase.google.com/) → project **bulk-email-5c174**
2. **Project settings** → **Service accounts** → **Generate new private key**
3. Save the downloaded JSON here as:

   `bulk-email-5c174-firebase-adminsdk-l7wjc-2abd0cd92d.json`

   (The filename can differ; if it does, update `FIREBASE_SERVICE_ACCOUNT_PATH` in `backend/.env`.)

This file is gitignored. Never commit it.
