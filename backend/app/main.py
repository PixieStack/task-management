from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import bcrypt_fix
from .config import CORS_ORIGINS
from .routers import ai_assistant, analytics, auth, challenges, contact, habits, productivity, projects, tasks

app = FastAPI(title="Task Manager API", version="2.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(analytics.router)
app.include_router(contact.router)
app.include_router(challenges.router)
app.include_router(projects.router)
app.include_router(habits.router)
app.include_router(productivity.router)
app.include_router(ai_assistant.router)


@app.get("/", tags=["root"])
def root():
    return {"message": "Task Manager API running"}


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "healthy"}
