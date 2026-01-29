# 🔧 QUICK FIX FOR CORS ERROR

## ✅ ISSUE FIXED

The frontend was trying to connect to **port 8000** but backend runs on **port 8001**.

I've updated:
- ✅ `auth.service.ts` - Changed to port 8001
- ✅ `task.service.ts` - Changed to port 8001
- ✅ `main.py` - Fixed CORS middleware order

---

## 🚀 WHAT TO DO NOW

### Step 1: Pull Latest Changes

```powershell
cd C:\Users\thwal\Documents\projects\task-management
git pull origin master
```

### Step 2: Restart Backend

```powershell
# Stop backend (Ctrl+C)
# Then restart:
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Step 3: Restart Frontend

```powershell
# Stop frontend (Ctrl+C)
# Then restart:
cd frontend
yarn start
```

### Step 4: Test Login

1. Open http://localhost:3000
2. Try to login
3. Should work now!

---

## 🔍 IF STILL GETTING ERRORS

### Check Backend is Running on 8001:
```powershell
# Should show: http://0.0.0.0:8001
# In backend terminal output
```

### Check CORS in Browser Console:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try login again
4. Look for the request to `/auth/login`
5. Should show status 200 (success)

### Manual Test Backend:
```powershell
curl -X POST http://localhost:8001/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"test123\"}"
```

---

## ✅ FILES UPDATED

1. `frontend/src/app/shared/services/auth.service.ts`
   - Changed: `http://127.0.0.1:8000/auth` → `http://127.0.0.1:8001/auth`

2. `frontend/src/app/shared/services/task.service.ts`
   - Changed: `http://localhost:8000/tasks` → `http://localhost:8001/api/tasks`

3. `backend/app/main.py`
   - Moved CORS middleware before routers

---

## 🎯 EXPECTED BEHAVIOR

After fix:
- ✅ Login should work
- ✅ No CORS errors in console
- ✅ Backend responds to frontend requests
- ✅ Token is saved in localStorage

---

**Try it now and let me know if login works!** 🚀
