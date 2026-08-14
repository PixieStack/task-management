from datetime import datetime
from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import bcrypt_fix
from .config import CORS_ORIGINS
from .routers import admin, ai_assistant, analytics, auth, challenges, contact, habits, productivity, projects, tasks

app = FastAPI(title="Task Manager API", version="2.2.0")
app.state.started_at = datetime.utcnow()
app.state.api_metrics = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def collect_api_metrics(request, call_next):
    started = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        elapsed_ms = (perf_counter() - started) * 1000
        route = request.scope.get("route")
        route_path = getattr(route, "path", request.url.path)
        key = f"{request.method} {route_path}"
        metrics = app.state.api_metrics.setdefault(
            key,
            {"count": 0, "errors": 0, "total_ms": 0.0, "last_status": None, "last_seen": None},
        )
        metrics["count"] += 1
        metrics["total_ms"] += elapsed_ms
        metrics["last_status"] = status_code
        metrics["last_seen"] = datetime.utcnow().isoformat() + "Z"
        if status_code >= 400:
            metrics["errors"] += 1


app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(analytics.router)
app.include_router(contact.router)
app.include_router(challenges.router)
app.include_router(projects.router)
app.include_router(habits.router)
app.include_router(productivity.router)
app.include_router(ai_assistant.router)
app.include_router(admin.router)


@app.get("/", tags=["root"])
def root():
    return {"message": "Task Manager API running"}


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "healthy"}
