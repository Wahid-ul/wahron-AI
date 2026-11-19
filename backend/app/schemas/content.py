from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


Tone = Literal["friendly", "playful", "professional", "inspiring"]
DraftStatus = Literal["draft", "archived"]


class CaptionGenerationRequest(BaseModel):
    business_id: str
    topic: str = Field(min_length=2, max_length=200)
    audience: Optional[str] = Field(default=None, max_length=200)
    tone: Tone = "friendly"
    call_to_action: Optional[str] = Field(default=None, max_length=200)

    @field_validator("topic")
    @classmethod
    def trim_topic(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Topic must contain at least 2 characters.")
        return value

    @field_validator("audience", "call_to_action")
    @classmethod
    def trim_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CaptionVariant(BaseModel):
    label: str
    caption: str
    hashtags: List[str]


class CaptionGenerationResponse(BaseModel):
    business_id: str
    topic: str
    variants: List[CaptionVariant]


class ContentDraftCreateRequest(CaptionGenerationRequest):
    caption: str = Field(min_length=1, max_length=2200)
    hashtags: List[str] = Field(default_factory=list, max_length=30)

    @field_validator("caption")
    @classmethod
    def trim_caption(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Caption cannot be empty.")
        return value

    @field_validator("hashtags")
    @classmethod
    def validate_hashtags(cls, values: List[str]) -> List[str]:
        tags = [value.strip().lstrip("#") for value in values]
        if any(not tag or len(tag) > 50 for tag in tags):
            raise ValueError("Hashtags must contain between 1 and 50 characters.")
        if len({tag.lower() for tag in tags}) != len(tags):
            raise ValueError("Hashtags must be unique.")
        return tags


class ContentDraftUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    caption: Optional[str] = Field(default=None, min_length=1, max_length=2200)
    status: Optional[DraftStatus] = None

    @field_validator("title", "caption")
    @classmethod
    def trim_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty.")
        return value


class ContentDraftResponse(BaseModel):
    id: str
    workspace_id: str
    business_id: str
    platform: Literal["instagram"]
    title: str
    topic: str
    audience: Optional[str]
    tone: Tone
    call_to_action: Optional[str]
    caption: str
    hashtags: List[str]
    status: DraftStatus

    model_config = ConfigDict(from_attributes=True)


class ContentDraftListResponse(BaseModel):
    drafts: List[ContentDraftResponse]
