from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from app.main import app


FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist" / "frontend" / "browser"
# The API exposes a diagnostic GET / route in backend-only environments. On
# Render, this entrypoint hosts Angular on the same origin, so the SPA owns /.
app.router.routes = [
    route
    for route in app.router.routes
    if not (getattr(route, "path", None) == "/" and getattr(route, "name", None) == "root")
]



@app.get("/{frontend_path:path}", include_in_schema=False)
def serve_frontend(frontend_path: str):
    """Serve Angular assets and fall back to index.html for client-side routes."""
    requested_file = (FRONTEND_DIST / frontend_path).resolve()
    if FRONTEND_DIST not in requested_file.parents and requested_file != FRONTEND_DIST:
        raise HTTPException(status_code=404)

    if requested_file.is_file():
        return FileResponse(requested_file)

    index_file = FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=503, detail="Frontend build is unavailable")
    return FileResponse(index_file)
