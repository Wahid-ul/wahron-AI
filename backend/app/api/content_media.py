import os
import uuid
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.business import Business
from app.models.content_media import ContentMedia
from app.models.user import User
from app.models.video_project import VideoProject
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.video_projects import (
    ContentMediaListResponse,
    ContentMediaResponse,
)
from app.services.media_storage import get_media_path, get_media_storage_root


router = APIRouter(tags=["Video Media"])

ALLOWED_MEDIA_TYPES = {
    "image/jpeg": ("photo", ".jpg", 15 * 1024 * 1024),
    "image/png": ("photo", ".png", 15 * 1024 * 1024),
    "image/webp": ("photo", ".webp", 15 * 1024 * 1024),
    "video/mp4": ("video", ".mp4", 100 * 1024 * 1024),
    "video/webm": ("video", ".webm", 100 * 1024 * 1024),
    "video/quicktime": ("video", ".mov", 100 * 1024 * 1024),
}


def has_valid_signature(content_type: str, header: bytes) -> bool:
    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    if content_type in {"video/mp4", "video/quicktime"}:
        return header[4:8] == b"ftyp"
    if content_type == "video/webm":
        return header.startswith(b"\x1a\x45\xdf\xa3")
    return False


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


def get_upload_filename(filename: Optional[str]) -> str:
    normalized = (filename or "upload").replace("\\", "/")
    basename = normalized.rsplit("/", 1)[-1]
    safe_name = "".join(
        character for character in basename
        if character.isprintable() and character not in {'"', "'"}
    ).strip()
    return (safe_name or "upload")[:255]


def media_response(media: ContentMedia) -> ContentMediaResponse:
    return ContentMediaResponse(
        id=media.id,
        workspace_id=media.workspace_id,
        business_id=media.business_id,
        original_filename=media.original_filename,
        media_type=media.media_type,
        media_role=media.media_role,
        content_type=media.content_type,
        size_bytes=media.size_bytes,
        file_url=(
            "/workspaces/{}/media/{}/file".format(
                media.workspace_id,
                media.id,
            )
        ),
    )


@router.post(
    "/workspaces/{workspace_id}/media",
    response_model=ContentMediaResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_content_media(
    workspace_id: str,
    business_id: str = Form(...),
    media_role: str = Form(...),
    file: UploadFile = File(...),
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
            Business.id == business_id,
            Business.workspace_id == workspace_id,
        )
    )
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found in this workspace.",
        )

    content_type = (file.content_type or "").lower()
    media_config = ALLOWED_MEDIA_TYPES.get(content_type)
    if media_config is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video.",
        )

    media_type, extension, max_bytes = media_config
    if media_role not in {"content_photo", "face_reference", "video_clip"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose a valid media role.",
        )
    if (media_type == "video") != (media_role == "video_clip"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Photos must be content or face-reference photos; videos must be clips.",
        )

    header = file.file.read(16)
    file.file.seek(0)
    if not has_valid_signature(content_type, header):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The file content does not match its declared media type.",
        )

    media_id = str(uuid.uuid4())
    storage_key = "{}{}".format(uuid.uuid4().hex, extension)
    storage_root = get_media_storage_root()
    storage_root.mkdir(parents=True, exist_ok=True)
    destination = get_media_path(storage_key)
    size_bytes = 0

    try:
        with destination.open("wb") as target:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break

                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="This file exceeds the upload limit.",
                    )
                target.write(chunk)

        if size_bytes == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty.",
            )

        media = ContentMedia(
            id=media_id,
            workspace_id=workspace_id,
            business_id=business_id,
            uploaded_by_user_id=current_user.id,
            original_filename=get_upload_filename(file.filename),
            storage_key=storage_key,
            media_type=media_type,
            media_role=media_role,
            content_type=content_type,
            size_bytes=size_bytes,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return media_response(media)
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()


@router.get(
    "/workspaces/{workspace_id}/media",
    response_model=ContentMediaListResponse,
)
def list_content_media(
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

    media = db.scalars(
        select(ContentMedia)
        .where(
            ContentMedia.workspace_id == workspace_id,
            ContentMedia.business_id == business_id,
        )
        .order_by(ContentMedia.created_at.desc(), ContentMedia.id)
    ).all()
    return ContentMediaListResponse(
        media=[media_response(item) for item in media]
    )


@router.get("/workspaces/{workspace_id}/media/{media_id}/file")
def get_content_media_file(
    workspace_id: str,
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found.",
        )

    media = db.scalar(
        select(ContentMedia).where(
            ContentMedia.id == media_id,
            ContentMedia.workspace_id == workspace_id,
        )
    )
    if media is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found.",
        )

    path = get_media_path(media.storage_key)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media file is unavailable.",
        )

    return FileResponse(
        path,
        media_type=media.content_type,
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete(
    "/workspaces/{workspace_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_content_media(
    workspace_id: str,
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = get_member_role(db, workspace_id, current_user.id)
    media = db.scalar(
        select(ContentMedia).where(
            ContentMedia.id == media_id,
            ContentMedia.workspace_id == workspace_id,
        )
    )
    if role is None or media is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found.",
        )
    if media.uploaded_by_user_id != current_user.id and role not in {
        "owner",
        "admin",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove media you uploaded.",
        )

    projects = db.scalars(
        select(VideoProject).where(
            VideoProject.workspace_id == workspace_id,
        )
    ).all()
    if any(media.id in project.media_ids for project in projects):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Media used by a saved video brief cannot be deleted.",
        )

    storage_path = get_media_path(media.storage_key)
    db.delete(media)
    db.commit()
    if storage_path.is_file():
        os.remove(storage_path)
