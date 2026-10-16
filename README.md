# Bulk Email Studio — Modern Mass Email Dispatcher

A high-performance bulk email delivery studio built with React, Node.js, Express, Nodemailer, and MongoDB. Supports personalized mass emailing, audience segmentation, CSV/Excel ingestion, dynamic live preview, anti-spam throttling, and real-time delivery reporting.

---

## ✨ Features

- **Multi-Source Recipient Ingestion:**
  - 📁 **Spreadsheet Import:** Direct `.xlsx`, `.xls`, and `.csv` parsing with automatic column mapping.
  - 📋 **Saved Audience Lists:** Segment and manage contacts in reusable lists.
  - ✍️ **Manual / Bulk Paste:** Paste emails in standard or `Name <email@domain.com>` formats.
- **Recipient Deduplication & Cleaner:**
  - 1-click duplicate removal.
  - 1-click invalid email address pruning.
- **Rich Email Composer & Templates:**
  - 5 pre-built professional email templates (Product Announcement, Newsletter, Welcome Onboarding, Outreach, Custom).
  - Quick dynamic tags (`{name}`, `{email}`).
  - **Live Preview Mode** with real-time variable replacement.
- **Anti-Spam & Delivery Protection:**
  - Adjustable throttling delay slider (50ms – 1.5s per message) to prevent Gmail rate limits and spam flagging.
  - Single-recipient test button ("Send Test to Self") to check rendering before full launch.
- **Real-Time Progress & Reporting:**
  - Server-Sent Events (SSE) live progress bar and recipient ticker.
  - Detailed sent vs. failed delivery breakdown.
  - 1-click **Excel / CSV Report Export**.
- **Settings & SMTP Connection Hub:**
  - Interactive Gmail SMTP verification tester.
  - Step-by-step Google App Password guide.
- **Zero-Config Resilience:**
  - Automatically runs with in-memory storage fallback if MongoDB Atlas is not yet configured.
  - Development / Demo Mode enables testing all features without Google OAuth setup.
  - Automatic port resolution (Backend: 5001, avoiding macOS AirPlay port 5000 collisions; Frontend: 3001).

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Verify Setup

Run the diagnostic assistant to inspect your environment:

```bash
npm run check-setup
```

### 3. Run Locally

Start both backend and frontend concurrently:

```bash
npm run dev
```

- **Frontend:** http://localhost:3001
- **Backend:** http://localhost:5001 (Health check: http://localhost:5001/api/status)

Or run individually:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## ⚙️ Configuration (Optional)

The application functions immediately in local/in-memory mode. To connect live production services:

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `5001`) |
| `MONGO_URI` | MongoDB Atlas connection string (e.g. `mongodb+srv://...`) |
| `EMAIL_USER` | Default sender Gmail address |
| `EMAIL_PASS` | 16-character Google [App Password](https://myaccount.google.com/apppasswords) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase Admin service account JSON |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend URL (default: `http://localhost:5001`) |
| `REACT_APP_FIREBASE_*` | Optional Firebase Web client credentials |

---

## 🛡️ Admin & Permissions

- The default superadmin email is configurable in `backend/server.js` or via `ADMIN_EMAIL` in `backend/.env`.
- Superadmins can grant access, assign roles, and revoke permissions through the **Admin Panel** (`/admin`).
