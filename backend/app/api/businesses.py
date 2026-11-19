from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.business import Business
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.businesses import (
    BusinessCreateRequest,
    BusinessListResponse,
    BusinessResponse,
    BusinessUpdateRequest,
)


router = APIRouter(tags=["Businesses"])


def get_workspace_role(
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


@router.get(
    "/workspaces/{workspace_id}/businesses",
    response_model=BusinessListResponse,
)
def list_businesses(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_workspace_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    businesses = db.scalars(
        select(Business)
        .where(Business.workspace_id == workspace_id)
        .order_by(Business.created_at, Business.id)
    ).all()

    return BusinessListResponse(businesses=businesses)


@router.post(
    "/workspaces/{workspace_id}/businesses",
    response_model=BusinessResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_business(
    workspace_id: str,
    data: BusinessCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = get_workspace_role(db, workspace_id, current_user.id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    if role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace admin access is required to create a business.",
        )

    business = Business(
        workspace_id=workspace_id,
        name=data.name,
        industry=data.industry,
        description=data.description,
        website=data.website,
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    return business


@router.patch(
    "/businesses/{business_id}",
    response_model=BusinessResponse,
)
def update_business(
    business_id: str,
    data: BusinessUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    business = db.scalar(
        select(Business).where(Business.id == business_id)
    )
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )

    role = get_workspace_role(db, business.workspace_id, current_user.id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found.",
        )
    if role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace admin access is required to update a business.",
        )

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one business field must be provided.",
        )
    if any(
        updates[field] is None
        for field in ("name", "industry")
        if field in updates
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Business name and industry cannot be cleared.",
        )

    for field, value in updates.items():
        setattr(business, field, value)

    db.commit()
    db.refresh(business)
    return business
