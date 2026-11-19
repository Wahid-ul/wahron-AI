from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    workspace_name: Optional[str] = Field(default=None, min_length=2, max_length=150)

    @field_validator("name", "workspace_name")
    @classmethod
    def trim_names(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 non-whitespace characters.")
        return value


class OrganizationSummary(BaseModel):
    id: str
    name: str


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    role: Literal["owner", "admin", "member"]
    organization: OrganizationSummary


class OrganizationWorkspaceResponse(BaseModel):
    organization: OrganizationSummary
    workspace: WorkspaceSummary


class WorkspaceListResponse(BaseModel):
    workspaces: List[WorkspaceSummary]
