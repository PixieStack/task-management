# 🚀 Life Management App - Quick Start Guide

## ✅ APPS ARE ALREADY RUNNING!

Your apps are managed by **Supervisor** and are already running:

### 📍 Access URLs:
- **Frontend (Angular):** http://localhost:3000
- **Backend (FastAPI):** http://localhost:8001
- **API Documentation:** http://localhost:8001/docs
- **API Health Check:** http://localhost:8001/api/health

---

## 🎮 Managing the Apps

### Option 1: Using Supervisor (Recommended - Always Running)

```bash
# Check status
sudo supervisorctl status

# Restart backend
sudo supervisorctl restart backend

# Restart frontend
sudo supervisorctl restart frontend

# Restart all services
sudo supervisorctl restart all

# Stop/Start
sudo supervisorctl stop backend
sudo supervisorctl start backend

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.out.log
```

### Option 2: Manual Run (For Development)

If you want to run manually in VS Code terminal:

#### Backend:
```bash
cd /app/backend
source /root/.venv/bin/activate
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

#### Frontend:
```bash
cd /app/frontend
yarn start
```

#### Or use the convenience scripts:
```bash
# Start both (if supervisor is stopped)
/app/start-apps.sh

# Stop both
/app/stop-apps.sh
```

---

## 🔍 Troubleshooting

### Backend won't start?
```bash
# Check logs
tail -50 /var/log/supervisor/backend.err.log

# Check if dependencies are installed
source /root/.venv/bin/activate
cd /app/backend
pip install -r requirements.txt

# Test manually
python -m uvicorn server:app --reload --port 8001
```

### Frontend won't start?
```bash
# Check logs
tail -50 /var/log/supervisor/frontend.out.log

# Check if dependencies are installed
cd /app/frontend
yarn install

# Test manually
yarn start
```

### Port already in use?
```bash
# Find what's using port 8001
lsof -i :8001

# Find what's using port 3000
lsof -i :3000

# Kill process on port
kill -9 $(lsof -ti:8001)
kill -9 $(lsof -ti:3000)
```

---

## 📊 Database

- **Type:** SQLite
- **Location:** `/app/backend/taskmanager.db`
- **Tables:** 15 tables (users, challenges, projects, diet, etc.)

### View database:
```bash
cd /app/backend
sqlite3 taskmanager.db "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 🛠️ Development Workflow

### Making Backend Changes:
1. Edit files in `/app/backend/app/`
2. Backend auto-reloads (if using --reload flag)
3. Or restart: `sudo supervisorctl restart backend`

### Making Frontend Changes:
1. Edit files in `/app/frontend/src/`
2. Angular auto-compiles changes
3. Refresh browser to see changes

---

## 📝 Important Files

### Backend:
- `/app/backend/server.py` - Entry point
- `/app/backend/app/main.py` - FastAPI app
- `/app/backend/app/models.py` - Database models
- `/app/backend/app/routers/` - API endpoints
- `/app/backend/.env` - Environment variables

### Frontend:
- `/app/frontend/src/app/app.component.ts` - Main app
- `/app/frontend/src/app/pages/dashboard/` - Dashboard
- `/app/frontend/src/app/shared/services/` - API services

---

## 🧪 Testing the APIs

### Using Swagger UI:
1. Open: http://localhost:8001/docs
2. Click "Authorize" button
3. Register/Login to get token
4. Try any endpoint

### Using curl:
```bash
# Register
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"test123"}'

# Login
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Get challenges (use token from login)
curl -X GET http://localhost:8001/api/challenges \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎯 What's Implemented

✅ Complete backend with 50+ API endpoints
✅ Database with 15 tables
✅ User authentication & profiles
✅ Challenges (with 24-hour check-in cooldown)
✅ Projects (3-6 months with milestones)
✅ Roadmaps (12 months with quarterly tracking)
✅ Diet & Hydration (AI meal planning)
✅ Habits tracking
✅ AI Assistant (learns from conversations)
✅ Gamification (2000 XP per level)

⏳ Frontend needs integration with backend APIs

---

## 🚨 Current Issue

The frontend is still using **localStorage** for most features. Backend is ready, but Angular components need to be updated to call the APIs instead of storing data locally.

**Next step:** Integrate frontend components with backend APIs (Phase 2)

---

## 💡 Quick Commands

```bash
# View all services
sudo supervisorctl status

# Restart everything
sudo supervisorctl restart all

# View backend logs (live)
tail -f /var/log/supervisor/backend.err.log

# View frontend logs (live)
tail -f /var/log/supervisor/frontend.out.log

# Test backend health
curl http://localhost:8001/api/health

# Access API docs
open http://localhost:8001/docs
```

---

**Your apps are ready to use! The backend is 100% functional.** 🎉
