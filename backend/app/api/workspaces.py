from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.workspaces import (
    OrganizationCreateRequest,
    OrganizationSummary,
    OrganizationWorkspaceResponse,
    WorkspaceListResponse,
    WorkspaceSummary,
)


router = APIRouter(tags=["Workspaces"])


@router.post(
    "/organizations",
    response_model=OrganizationWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    data: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = Organization(
        name=data.name,
        created_by_user_id=current_user.id,
    )
    db.add(organization)
    db.flush()

    workspace = Workspace(
        organization_id=organization.id,
        name=data.workspace_name or data.name,
    )
    db.add(workspace)
    db.flush()

    membership = WorkspaceMembership(
        user_id=current_user.id,
        workspace_id=workspace.id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    return OrganizationWorkspaceResponse(
        organization=OrganizationSummary(
            id=organization.id,
            name=organization.name,
        ),
        workspace=WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            role=membership.role,
            organization=OrganizationSummary(
                id=organization.id,
                name=organization.name,
            ),
        ),
    )


@router.get(
    "/workspaces",
    response_model=WorkspaceListResponse,
)
def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Workspace, Organization, WorkspaceMembership.role)
        .join(
            WorkspaceMembership,
            WorkspaceMembership.workspace_id == Workspace.id,
        )
        .join(
            Organization,
            Organization.id == Workspace.organization_id,
        )
        .where(WorkspaceMembership.user_id == current_user.id)
        .order_by(Workspace.created_at, Workspace.id)
    ).all()

    return WorkspaceListResponse(
        workspaces=[
            WorkspaceSummary(
                id=workspace.id,
                name=workspace.name,
                role=role,
                organization=OrganizationSummary(
                    id=organization.id,
                    name=organization.name,
                ),
            )
            for workspace, organization, role in rows
        ]
    )
