# Bulk Email Sender

A bulk email sender for sending personalized mass emails with contact import, template-based composition, deduplication, SMTP delivery, and progress tracking.

This repository is primarily JavaScript-based, with the majority of the code written in JavaScript (97.7%), followed by CSS (1.4%) and a small percentage of other files (0.9%).

## Overview

Bulk Email Sender is a full-stack web application that helps users:

- import contact lists from CSV or Excel files
- clean and deduplicate recipients
- compose emails with reusable templates and personalization tags
- send test emails before a campaign
- monitor delivery progress and export campaign reports
- connect to Gmail SMTP or production-ready email providers

## Tech Stack

- Frontend: React
- Backend: Node.js + Express
- Email delivery: Nodemailer
- Data storage: MongoDB (with in-memory fallback)
- Hosting: Firebase
- UI styling: CSS

## Features

- Spreadsheet and manual contact ingestion
- Duplicate and invalid email cleanup
- Email template library and live preview
- Dynamic tags such as `{name}` and `{email}`
- Send test email to self before mass campaigns
- configurable throttling to reduce spam or delivery issues
- real-time progress updates and delivery summary
- CSV/Excel report export
- admin controls and role-based access

## Quick Start

### Install dependencies

```bash
npm run install:all
```

### Verify environment

```bash
npm run check-setup
```

### Run locally

```bash
npm run dev
```

Then open:

- Frontend: http://localhost:3001
- Backend: http://localhost:5001

You can also run each service independently:

```bash
npm run dev:backend
npm run dev:frontend
```

## Configuration

The app can run in local/in-memory mode by default. For production email sending, configure your backend environment variables in `backend/.env`.

Typical settings include:

- `PORT`
- `MONGO_URI`
- `EMAIL_USER`
- `EMAIL_PASS`
- `FIREBASE_SERVICE_ACCOUNT_PATH`

## Project Status

This project is a JavaScript-heavy application focused on bulk email operations, audience management, and campaign delivery automation.

## License

This project does not currently declare a specific license in the repository metadata.
