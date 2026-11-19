import uuid
from datetime import datetime
from typing import List

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class VideoProject(Base):
    __tablename__ = "video_projects"
    __table_args__ = (
        CheckConstraint(
            "aspect_ratio IN ('9:16', '1:1', '16:9')",
            name="ck_video_projects_aspect_ratio",
        ),
        CheckConstraint(
            "duration_seconds IN (15, 30)",
            name="ck_video_projects_duration",
        ),
        CheckConstraint(
            "status = 'draft'",
            name="ck_video_projects_status",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    business_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="9:16",
    )
    duration_seconds: Mapped[int] = mapped_column(
        nullable=False,
        default=15,
    )
    media_ids: Mapped[List[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
