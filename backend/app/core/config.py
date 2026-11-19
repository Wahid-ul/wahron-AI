from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Wahron AI API"
    environment: str = "development"

    database_url: str

    secret_key: str
    access_token_expire_minutes: int = 10080

    cookie_name: str = "wahron_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    cors_origins: str = "http://localhost:5173"
    media_storage_dir: str = "media"
    gemini_api_key: str = ""
    gemini_storyboard_model: str = "gemini-4-hydrogen"
    gemini_video_model: str = "gemini-omni-1.2-flash"
    ffmpeg_binary: str = "ffmpeg"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()