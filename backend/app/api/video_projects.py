import shutil
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.models.business import Business
from app.models.content_media import ContentMedia
from app.models.video_generation_job import VideoGenerationJob
from app.models.user import User
from app.models.video_project import VideoProject
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.video_projects import (
    VideoGenerationJobListResponse,
    VideoGenerationJobResponse,
    VideoGenerationStartRequest,
    VideoProjectCreateRequest,
    VideoProjectListResponse,
    VideoProjectResponse,
)
from app.services.media_storage import get_media_path
from app.services.video_generation import process_video_generation


router = APIRouter(tags=["Video Projects"])


def get_member_role(
    db: Session,
    workspace_id: str,
    user_id: str,
) -> Optional[str]:
    return db.scalar(
        select(WorkspaceMembership.role).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
    )


def video_job_response(
    job: VideoGenerationJob,
) -> VideoGenerationJobResponse:
    return VideoGenerationJobResponse(
        id=job.id,
        project_id=job.project_id,
        workspace_id=job.workspace_id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        storyboard=job.storyboard,
        output_url=(
            "/workspaces/{}/video-jobs/{}/file".format(
                job.workspace_id,
                job.id,
            )
            if job.output_storage_key
            else None
        ),
        error_message=job.error_message,
    )


@router.post(
    "/workspaces/{workspace_id}/video-projects",
    response_model=VideoProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_video_project(
    workspace_id: str,
    data: VideoProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    business = db.scalar(
        select(Business).where(
            Business.id == data.business_id,
            Business.workspace_id == workspace_id,
        )
    )
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found in this workspace.",
        )

    media = db.scalars(
        select(ContentMedia).where(
            ContentMedia.workspace_id == workspace_id,
            ContentMedia.business_id == data.business_id,
            ContentMedia.id.in_(data.media_ids),
        )
    ).all()
    if len(media) != len(data.media_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Every selected photo or video must belong to this business.",
        )

    project = VideoProject(
        workspace_id=workspace_id,
        business_id=data.business_id,
        created_by_user_id=current_user.id,
        title=data.title,
        prompt=data.prompt,
        aspect_ratio=data.aspect_ratio,
        duration_seconds=data.duration_seconds,
        media_ids=data.media_ids,
        status="draft",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get(
    "/workspaces/{workspace_id}/video-projects",
    response_model=VideoProjectListResponse,
)
def list_video_projects(
    workspace_id: str,
    business_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    business_exists = db.scalar(
        select(Business.id).where(
            Business.id == business_id,
            Business.workspace_id == workspace_id,
        )
    )
    if business_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found in this workspace.",
        )

    projects = db.scalars(
        select(VideoProject)
        .where(
            VideoProject.workspace_id == workspace_id,
            VideoProject.business_id == business_id,
        )
        .order_by(VideoProject.updated_at.desc(), VideoProject.id)
    ).all()
    return VideoProjectListResponse(projects=projects)


@router.post(
    "/workspaces/{workspace_id}/video-projects/{project_id}/generate",
    response_model=VideoGenerationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_video_generation(
    workspace_id: str,
    project_id: str,
    background_tasks: BackgroundTasks,
    data: VideoGenerationStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Video generation is not configured. Set GEMINI_API_KEY on the backend.",
        )
    if shutil.which(settings.ffmpeg_binary) is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Video rendering is not configured. Install FFmpeg and add it to PATH.",
        )

    project = db.scalar(
        select(VideoProject).where(
            VideoProject.id == project_id,
            VideoProject.workspace_id == workspace_id,
        )
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video project not found.",
        )

    media_rows = db.scalars(
        select(ContentMedia).where(
            ContentMedia.workspace_id == workspace_id,
            ContentMedia.business_id == project.business_id,
            ContentMedia.id.in_(project.media_ids),
        )
    ).all()
    media_by_id = {asset.id: asset for asset in media_rows}
    if len(media_by_id) != len(project.media_ids) or not media_by_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The project must contain media that is still available.",
        )
    media = [media_by_id[media_id] for media_id in project.media_ids]
    if (
        any(asset.media_role == "face_reference" for asset in media)
        and not data.face_reference_consent
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confirm you have permission to use every person shown in the face/reference photos.",
        )

    reference_images = [
        asset for asset in media[:6] if asset.media_type == "photo"
    ]
    if sum(asset.size_bytes for asset in reference_images) > 20 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The first six reference photos must total no more than 20 MB.",
        )

    active_job = db.scalar(
        select(VideoGenerationJob).where(
            VideoGenerationJob.project_id == project_id,
            VideoGenerationJob.status.in_(("queued", "processing")),
        )
    )
    if active_job is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This project already has a video generation job in progress.",
        )

    job = VideoGenerationJob(
        project_id=project_id,
        workspace_id=workspace_id,
        requested_by_user_id=current_user.id,
        face_reference_consent=data.face_reference_consent,
        status="queued",
        stage="queued",
        progress=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_video_generation, job.id)
    return video_job_response(job)


@router.get(
    "/workspaces/{workspace_id}/video-jobs",
    response_model=VideoGenerationJobListResponse,
)
def list_video_generation_jobs(
    workspace_id: str,
    business_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    business_exists = db.scalar(
        select(Business.id).where(
            Business.id == business_id,
            Business.workspace_id == workspace_id,
        )
    )
    if business_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found in this workspace.",
        )

    jobs = db.scalars(
        select(VideoGenerationJob)
        .join(VideoProject, VideoProject.id == VideoGenerationJob.project_id)
        .where(
            VideoGenerationJob.workspace_id == workspace_id,
            VideoProject.business_id == business_id,
        )
        .order_by(VideoGenerationJob.created_at.desc())
        .limit(25)
    ).all()
    return VideoGenerationJobListResponse(
        jobs=[video_job_response(job) for job in jobs]
    )


@router.get("/workspaces/{workspace_id}/video-jobs/{job_id}/file")
def get_generated_video(
    workspace_id: str,
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated video not found.",
        )
    job = db.scalar(
        select(VideoGenerationJob).where(
            VideoGenerationJob.id == job_id,
            VideoGenerationJob.workspace_id == workspace_id,
            VideoGenerationJob.status == "completed",
        )
    )
    if job is None or not job.output_storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated video not found.",
        )

    path: Path = get_media_path(job.output_storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated video file is unavailable.",
        )
    return FileResponse(
        path,
        media_type="video/mp4",
        filename="wahron-video-{}.mp4".format(job.project_id),
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "private, no-store",
        },
    )
