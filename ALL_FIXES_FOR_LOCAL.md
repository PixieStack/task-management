# Complete Fixes for Your Local Windows Environment

## Issues Fixed

1. **Registration component had hardcoded URL** (`http://127.0.0.1:8000`) - Changed to use proxy (`/auth/register`)
2. **Contact component had hardcoded URL** (`http://localhost:8000`) - Changed to use proxy (`/api`)
3. **Backend routers inconsistent** - Fixed `/analytics` and `/contact` to use `/api` prefix

---

## Files to Update on Your Local Machine

### 1. `frontend/src/app/auth/register/register.component.ts`

**Find this line (around line 36):**
```typescript
private apiUrl = 'http://127.0.0.1:8000/auth/register';
```

**Replace with:**
```typescript
private apiUrl = '/auth/register';
```

---

### 2. `frontend/src/app/shared/contact-cta/contact-cta.component.ts`

**Find this line (around line 66):**
```typescript
// Direct API URL - change this to match your backend
private apiUrl = 'http://localhost:8000';
```

**Replace with:**
```typescript
// Use proxy for API calls
private apiUrl = '/api';
```

---

### 3. `backend/app/routers/analytics.py`

**Find this line (around line 6):**
```python
router = APIRouter(prefix="/analytics", tags=["analytics"])
```

**Replace with:**
```python
router = APIRouter(prefix="/api/analytics", tags=["analytics"])
```

---

### 4. `backend/app/routers/contact.py`

**Find this line (around line 12):**
```python
router = APIRouter(prefix="/contact", tags=["contact"])
```

**Replace with:**
```python
router = APIRouter(prefix="/api/contact", tags=["contact"])
```

---

## How to Run (On Your Windows Machine)

### Terminal 1 - Backend:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Terminal 2 - Frontend:
```powershell
cd frontend
yarn start
```

The frontend will automatically open at `http://localhost:4200`

---

## How the Proxy Works

The `frontend/proxy.conf.json` routes API calls:
- `/auth/*` → `http://localhost:8001/auth/*`
- `/api/*` → `http://localhost:8001/api/*`

This means:
- Login: `POST /auth/login` → proxied to backend port 8001
- Register: `POST /auth/register` → proxied to backend port 8001
- Contact: `POST /api/contact/` → proxied to backend port 8001

---

## Test Backend Independently

```powershell
# Test health
curl http://localhost:8001/api/health

# Test registration
curl -X POST http://localhost:8001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","email":"test@test.com","password":"Test@123456"}'

# Test login
curl -X POST http://localhost:8001/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"Test@123456"}'
```
