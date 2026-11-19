from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


MediaType = Literal["photo", "video"]
MediaRole = Literal["content_photo", "face_reference", "video_clip"]
AspectRatio = Literal["9:16", "1:1", "16:9"]


class ContentMediaResponse(BaseModel):
    id: str
    workspace_id: str
    business_id: str
    original_filename: str
    media_type: MediaType
    media_role: MediaRole
    content_type: str
    size_bytes: int
    file_url: str

    model_config = ConfigDict(from_attributes=True)


class ContentMediaListResponse(BaseModel):
    media: List[ContentMediaResponse]


class VideoProjectCreateRequest(BaseModel):
    business_id: str
    title: str = Field(min_length=2, max_length=150)
    prompt: str = Field(min_length=5, max_length=2000)
    aspect_ratio: AspectRatio = "9:16"
    duration_seconds: Literal[15, 30] = 15
    media_ids: List[str] = Field(min_length=1, max_length=12)

    @field_validator("title", "prompt")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Text must contain at least 2 characters.")
        return value

    @field_validator("media_ids")
    @classmethod
    def validate_media_ids(cls, values: List[str]) -> List[str]:
        if len(set(values)) != len(values):
            raise ValueError("The same media file cannot be selected twice.")
        return values


class VideoProjectResponse(BaseModel):
    id: str
    workspace_id: str
    business_id: str
    title: str
    prompt: str
    aspect_ratio: AspectRatio
    duration_seconds: Literal[15, 30]
    media_ids: List[str]
    status: Literal["draft"]

    model_config = ConfigDict(from_attributes=True)


class VideoProjectListResponse(BaseModel):
    projects: List[VideoProjectResponse]


class VideoGenerationStartRequest(BaseModel):
    face_reference_consent: bool = False


class VideoGenerationJobResponse(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    stage: str
    progress: int
    storyboard: Optional[dict] = None
    output_url: Optional[str] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VideoGenerationJobListResponse(BaseModel):
    jobs: List[VideoGenerationJobResponse]
