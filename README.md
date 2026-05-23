# Bulk Email React — local development

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- MongoDB Atlas connection string
- Firebase project **bulk-email-5c174** (login + admin)
- Gmail address with an [App Password](https://myaccount.google.com/apppasswords) (for sending mail)

## One-time setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Backend secrets (`backend/.env`)

Edit `backend/.env` and set:

| Variable | Where to get it |
|----------|-----------------|
| `MONGO_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → Connect → connection string |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase Console → Service accounts → Generate new private key → save JSON under `backend/config/` (see `backend/config/README.md`) |
| `EMAIL_USER` / `EMAIL_PASS` | Your Gmail + App Password |

### 3. Frontend (optional)

`frontend/.env` is already configured for local API + Firebase web login. Copy from `frontend/.env.example` if you need to reset it.

## Run locally

From the project root:

```bash
npm run dev
```

- **Frontend:** http://localhost:3000 (or the next free port if 3000 is busy)
- **Backend:** http://localhost:5000

Run only one side:

```bash
npm run dev:backend
npm run dev:frontend
```

## Production API

To point the frontend at the hosted backend instead of localhost, set in `frontend/.env`:

```env
REACT_APP_API_URL=https://bulk-email-backend-dx5l.onrender.com
```

Restart the frontend after changing env files.
