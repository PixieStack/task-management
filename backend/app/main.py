from . import bcrypt_fix
from fastapi import FastAPI
from .routers import tasks, auth, analytics, contact, challenges, projects, roadmaps, habits, diet, ai_assistant, gamification
from . import models, database
from fastapi.middleware.cors import CORSMiddleware

# Create all tables on startup
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Life Management & Task Tracking API")

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(analytics.router)
app.include_router(contact.router)
app.include_router(challenges.router)
app.include_router(projects.router)
app.include_router(roadmaps.router)
app.include_router(habits.router)
app.include_router(diet.router)
app.include_router(ai_assistant.router)
app.include_router(gamification.router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["root"])
def root():
    return {"message": "Life Management & Task Tracking API running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "message": "All systems operational"}