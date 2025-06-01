from . import bcrypt_fix
from fastapi import FastAPI
from .routers import tasks, auth, analytics, contact
from . import models, database
from fastapi.middleware.cors import CORSMiddleware

# Create all tables on startup
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Task Management API")

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(analytics.router)
app.include_router(contact.router)

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
    return {"message": "Task management API running"}