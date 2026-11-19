from pathlib import Path

from app.core.config import settings


def get_media_storage_root() -> Path:
    configured_path = Path(settings.media_storage_dir)
    if configured_path.is_absolute():
        return configured_path
    return Path(__file__).resolve().parents[2] / configured_path


def get_media_path(storage_key: str) -> Path:
    return get_media_storage_root() / storage_key
