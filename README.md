# Task Manager

A focused full-stack productivity app built with Angular and FastAPI.

## What is in the app

- JWT registration and login
- User profiles and account security
- Task CRUD with priorities, status, due dates, tags, estimates, and time spent
- Habit tracking with daily check-ins
- Meditation challenges
- Reading challenges
- Real task analytics
- AI assistant for tasks, habits, reading, and meditation
- Brevo transactional email for registration, account-security notifications, and contact messages

## Stack

- Angular 22
- Node.js 22.22.3
- TypeScript 6
- Python 3.14.7
- FastAPI
- SQLAlchemy
- SQLite by default
- Groq for the AI assistant
- Brevo SMTP for transactional email

## Local setup

### Backend

Python 3.14.7 is the validated backend runtime and is pinned in `backend/.python-version`.

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
# Copy backend/.env.example to backend/.env if you have not already created it.
python -m uvicorn app.main:app --reload --port 8000
```

Verify the active runtime with:

```bash
python --version
```

Expected: `Python 3.14.7`.

Set the real credentials only in `backend/.env` (or your deployment provider's secret/environment settings). Never commit API keys or SMTP keys.

Required production values:

- `SECRET_KEY`
- `GROQ_API_KEY`
- `BREVO_SMTP_LOGIN`
- `BREVO_SMTP_KEY`
- `SENDER_EMAIL`

The sender email must be verified in Brevo.

### Frontend

```bash
cd frontend
npm install
npm start
```

The Angular development proxy forwards API calls to the FastAPI backend.

## Email

All transactional email goes through Brevo SMTP (`smtp-relay.brevo.com`, port `587`). The app uses the SMTP key for relay authentication; the Brevo API key is not required for this integration.

## Security

Secrets are backend-only. The frontend never receives the Groq key, Brevo SMTP key, or JWT signing secret.
