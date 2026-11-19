from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BusinessCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    industry: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    website: Optional[str] = Field(default=None, max_length=255)

    @field_validator("name", "industry")
    @classmethod
    def trim_required_fields(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Value must contain at least 2 characters.")
        return value

    @field_validator("description", "website")
    @classmethod
    def trim_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class BusinessUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    industry: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    website: Optional[str] = Field(default=None, max_length=255)

    @field_validator("name", "industry")
    @classmethod
    def trim_required_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        value = value.strip()
        if len(value) < 2:
            raise ValueError("Value must contain at least 2 characters.")
        return value

    @field_validator("description", "website")
    @classmethod
    def trim_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class BusinessResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    industry: str
    description: Optional[str]
    website: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class BusinessListResponse(BaseModel):
    businesses: list[BusinessResponse]
