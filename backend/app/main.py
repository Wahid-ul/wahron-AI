from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.base import Base
from app.database.session import engine

# Import models so SQLAlchemy registers their tables.
from app.models.organization import Organization
from app.models.business import Business
from app.models.content_media import ContentMedia
from app.models.content_draft import ContentDraft
from app.models.video_generation_job import VideoGenerationJob
from app.models.user import User
from app.models.video_project import VideoProject
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership

from app.api.auth import router as auth_router
from app.api.businesses import router as business_router
from app.api.content import router as content_router
from app.api.content_media import router as content_media_router
from app.api.video_projects import router as video_projects_router
from app.api.workspaces import router as workspace_router


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# Basic Origin validation for browser requests that can change state.
@app.middleware("http")
async def validate_request_origin(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")

        if origin and origin not in settings.allowed_origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Untrusted request origin"},
            )

    return await call_next(request)


app.include_router(
    auth_router,
    prefix="/api/v1",
)
app.include_router(
    workspace_router,
    prefix="/api/v1",
)
app.include_router(
    business_router,
    prefix="/api/v1",
)
app.include_router(
    content_router,
    prefix="/api/v1",
)
app.include_router(
    content_media_router,
    prefix="/api/v1",
)
app.include_router(
    video_projects_router,
    prefix="/api/v1",
)


@app.on_event("startup")
def startup():
    # Convenient for local development only.
    # Use Alembic migrations for production.
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "Welcome to Wahron AI API",
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}