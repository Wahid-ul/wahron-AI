from typing import Optional

import jwt

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)

from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])

session_cookie = APIKeyCookie(
    name=settings.cookie_name,
    auto_error=False,
)


def set_session_cookie(response: Response, user_id: str):
    token = create_access_token(user_id)

    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def get_current_user(
    token: Optional[str] = Depends(session_cookie),
    db: Session = Depends(get_db),
) -> User:

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )

    if not token:
        raise credentials_error

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")

        if not user_id:
            raise credentials_error

    except jwt.InvalidTokenError:
        raise credentials_error

    user = db.get(User, user_id)

    if not user or not user.is_active:
        raise credentials_error

    return user


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    normalized_email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(User.email == normalized_email)
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=data.full_name.strip(),
        email=normalized_email,
        hashed_password=hash_password(data.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    set_session_cookie(response, user.id)

    return {"user": user}


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    normalized_email = str(data.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == normalized_email)
    )

    if (
        not user
        or not verify_password(data.password, user.hashed_password)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    set_session_cookie(response, user.id)

    return {"user": user}


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):

    return current_user


@router.post("/logout")
def logout(response: Response):

    response.delete_cookie(
        key=settings.cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )

    return {"message": "Successfully logged out"}