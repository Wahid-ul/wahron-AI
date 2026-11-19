import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.business import Business
from app.models.content_draft import ContentDraft
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.content import (
    CaptionGenerationRequest,
    CaptionGenerationResponse,
    CaptionVariant,
    ContentDraftCreateRequest,
    ContentDraftListResponse,
    ContentDraftResponse,
    ContentDraftUpdateRequest,
)


router = APIRouter(tags=["Content Studio"])

TONE_OPENERS = {
    "friendly": "A little inspiration for your day:",
    "playful": "Here's something to put a smile on your face:",
    "professional": "A thoughtful choice for your next step:",
    "inspiring": "Great things begin with a small, meaningful choice:",
}


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


def create_caption_variants(
    business: Business,
    data: CaptionGenerationRequest,
) -> CaptionGenerationResponse:
    opener = TONE_OPENERS[data.tone]
    topic = data.topic
    business_name = business.name
    audience_text = (
        "Made with {} in mind. ".format(data.audience)
        if data.audience
        else ""
    )
    action = data.call_to_action or "Tell us what you think in the comments."
    hashtags = []
    for value in (business.name, business.industry, topic):
        slug = re.sub(r"[^a-zA-Z0-9]", "", value.title())
        if slug and slug.lower() not in {tag.lower() for tag in hashtags}:
            hashtags.append(slug)
    hashtags.append("WahronAI")

    captions = [
        (
            "{} {} is in focus today. {}At {}, we love helping you "
            "explore what works for you. {}"
        ).format(opener, topic, audience_text, business_name, action),
        (
            "Looking for a fresh idea around {}? {}{} brings its "
            "{} experience to the conversation. {}"
        ).format(topic.lower(), audience_text, business_name, business.industry, action),
        (
            "{}\n\nDiscover a little more about {} with {}. "
            "Save this post for later, or share it with someone who'd love it. {}"
        ).format(opener, topic.lower(), business_name, action),
    ]

    return CaptionGenerationResponse(
        business_id=business.id,
        topic=topic,
        variants=[
            CaptionVariant(
                label=label,
                caption=caption,
                hashtags=hashtags,
            )
            for label, caption in zip(
                ("Warm introduction", "Quick hook", "Save-worthy"),
                captions,
            )
        ],
    )


@router.post(
    "/workspaces/{workspace_id}/content/generate",
    response_model=CaptionGenerationResponse,
)
def generate_captions(
    workspace_id: str,
    data: CaptionGenerationRequest,
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

    return create_caption_variants(business, data)


@router.get(
    "/workspaces/{workspace_id}/content/drafts",
    response_model=ContentDraftListResponse,
)
def list_content_drafts(
    workspace_id: str,
    business_id: Optional[str] = None,
    include_archived: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if get_member_role(db, workspace_id, current_user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    statement = select(ContentDraft).where(
        ContentDraft.workspace_id == workspace_id,
    )
    if business_id:
        statement = statement.where(ContentDraft.business_id == business_id)
    if not include_archived:
        statement = statement.where(ContentDraft.status == "draft")

    drafts = db.scalars(
        statement.order_by(ContentDraft.updated_at.desc(), ContentDraft.id)
    ).all()
    return ContentDraftListResponse(drafts=drafts)


@router.post(
    "/workspaces/{workspace_id}/content/drafts",
    response_model=ContentDraftResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_content_draft(
    workspace_id: str,
    data: ContentDraftCreateRequest,
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

    draft = ContentDraft(
        workspace_id=workspace_id,
        business_id=business.id,
        created_by_user_id=current_user.id,
        title=data.topic,
        topic=data.topic,
        audience=data.audience,
        tone=data.tone,
        call_to_action=data.call_to_action,
        caption=data.caption,
        hashtags=data.hashtags,
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.patch(
    "/content/drafts/{draft_id}",
    response_model=ContentDraftResponse,
)
def update_content_draft(
    draft_id: str,
    data: ContentDraftUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    draft = db.get(ContentDraft, draft_id)
    if draft is None or get_member_role(
        db,
        draft.workspace_id,
        current_user.id,
    ) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found.",
        )

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one draft field must be provided.",
        )

    for field, value in updates.items():
        setattr(draft, field, value)
    db.commit()
    db.refresh(draft)
    return draft
