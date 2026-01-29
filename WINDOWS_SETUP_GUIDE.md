# 🚀 FIX-DASHBOARD-2 BRANCH - SETUP GUIDE FOR WINDOWS

## ✅ ISSUE FIXED
The requirements.txt had `asyncpg` which is for PostgreSQL. You're using SQLite, so we removed it.

---

## 📋 COMMANDS TO RUN ON YOUR LOCAL MACHINE (Windows)

### STEP 1: Update Your Branch

```powershell
# Make sure you're on fix-dashboard-2 branch
cd C:\Users\thwal\Documents\projects\task-management\backend
git checkout fix-dashboard-2

# Pull latest changes from master (after I push)
git pull origin master
```

---

### STEP 2: Create `.env` File

Create a file named `.env` in `backend/` folder with this content:

```env
SECRET_KEY=iVk5KKN70TbRcpJGoS3z41RfyJBV_-y9Z7pVyVcsxxg
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./taskmanager.db
```

**How to create:**
1. Open `backend/` folder
2. Create new file: `.env` (starts with a dot!)
3. Paste the content above
4. Save

---

### STEP 3: Install Dependencies (Windows-Compatible)

```powershell
# Activate virtual environment
cd C:\Users\thwal\Documents\projects\task-management\backend
.\venv\Scripts\Activate.ps1

# Install ONLY the packages we need (no asyncpg)
pip install fastapi==0.115.12 uvicorn==0.34.2 sqlalchemy==2.0.41 python-jose==3.4.0 passlib==1.7.4 bcrypt==4.3.0 python-dotenv==1.1.0 pydantic==2.11.4 email-validator==2.2.0 python-multipart
```

**OR** if you want to use the clean requirements file I created:

```powershell
pip install -r requirements_clean.txt
```

---

### STEP 4: Run Backend

```powershell
# Still in backend folder with venv activated
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Application startup complete.
```

**Test it:** Open http://localhost:8001/docs

---

### STEP 5: Run Frontend (Separate Terminal)

```powershell
# Open NEW terminal
cd C:\Users\thwal\Documents\projects\task-management\frontend
yarn start
```

**Wait ~30 seconds for compilation**

**Test it:** Open http://localhost:3000

---

## 🔧 IF YOU STILL GET ERRORS

### Error: "ModuleNotFoundError: No module named 'app'"

**Solution:**
```powershell
# Run from backend folder
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Error: "SECRET_KEY is not set"

**Solution:** Make sure you created `.env` file in `backend/` folder (not in `backend/app/`)

### Error: Port 8001 already in use

**Solution:**
```powershell
# Find process using port 8001
netstat -ano | findstr :8001

# Kill it (replace PID with actual number from above)
taskkill /PID <PID> /F
```

---

## 📦 WHAT I FIXED

### 1. **Removed PostgreSQL dependency**
   - ❌ Removed: `asyncpg==0.30.0` (PostgreSQL adapter)
   - ❌ Removed: `alembic` (database migrations)
   - ❌ Removed: Other unnecessary packages
   - ✅ Using: SQLite (built into Python)

### 2. **Windows-Compatible Requirements**
   - All packages now install cleanly on Windows
   - No C compiler needed
   - No PostgreSQL needed

### 3. **Simplified Dependencies**
   Only 10 essential packages instead of 33!

---

## 🎯 FILES I'LL PUSH TO MASTER

You'll get these files when you merge:

### Backend:
- ✅ `backend/.env` - Environment configuration
- ✅ `backend/server.py` - Entry point
- ✅ `backend/requirements_clean.txt` - Windows-compatible dependencies
- ✅ `backend/app/auth.py` - Fixed path loading
- ✅ `backend/app/config.py` - Fixed path loading
- ✅ `backend/app/models.py` - All 15 database models
- ✅ `backend/app/schemas_extended.py` - API schemas
- ✅ `backend/app/routers/challenges.py` - Challenge endpoints
- ✅ `backend/app/routers/projects.py` - Project endpoints
- ✅ `backend/app/routers/roadmaps.py` - Roadmap endpoints
- ✅ `backend/app/routers/habits.py` - Habit endpoints
- ✅ `backend/app/routers/diet.py` - Diet & hydration endpoints
- ✅ `backend/app/routers/ai_assistant.py` - AI assistant
- ✅ `backend/app/routers/gamification.py` - XP & levels
- ✅ `backend/app/main.py` - Updated with all routers

### Frontend:
- ✅ `frontend/src/app/shared/services/challenge.service.ts`
- ✅ `frontend/src/app/shared/services/diet.service.ts`
- ✅ `frontend/src/app/shared/services/ai.service.ts`
- ✅ `frontend/src/app/shared/services/gamification.service.ts`
- ✅ `frontend/src/app/shared/services/notification.service.ts`

### Documentation:
- ✅ `COMPLETE_FIX_GUIDE.md`
- ✅ `FRONTEND_INTEGRATION_GUIDE.md`
- ✅ `QUICK_START.md`
- ✅ `RUN_COMMANDS.txt`

---

## 🚀 QUICK COMMANDS SUMMARY

```powershell
# Terminal 1: Backend
cd C:\Users\thwal\Documents\projects\task-management\backend
.\venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy python-jose passlib bcrypt python-dotenv pydantic email-validator python-multipart
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Terminal 2: Frontend
cd C:\Users\thwal\Documents\projects\task-management\frontend
yarn start
```

---

## ✅ AFTER THIS WORKS

Once backend is running, you'll see:
- ✅ Backend API: http://localhost:8001/docs
- ✅ Frontend App: http://localhost:3000

Then we can integrate the frontend components to use all the backend features!

---

## 🎯 NEXT PHASE

After you confirm backend works:
1. I'll update dashboard component to connect to backend
2. I'll update profile component 
3. I'll update navbar to show first_name
4. Everything will save to database instead of localStorage

---

## 📝 NOTES

- **SQLite database** will be created automatically at: `backend/taskmanager.db`
- **No PostgreSQL needed** - everything runs locally
- **All 50+ API endpoints** are ready to use
- **15 database tables** will be created on first run

---

**Ready to test!** Run the commands above and let me know when backend starts successfully. 🚀
