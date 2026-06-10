from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    ENVIRONMENT: str = "development"
    # Allow admin match updates in production if explicitly enabled
    ALLOW_ADMIN_MATCH_UPDATES: bool = False
    # Run a fixtures sync immediately on scheduler startup. Off by default so a
    # routine cold start does not auto-mutate match data (and cannot silently
    # repopulate an emptied matches table, masking a wipe). Enable for a
    # controlled prompt sync (e.g. right after a post-deploy fixtures load).
    SYNC_FIXTURES_ON_BOOT: bool = False
    # football-data.org API key for match/result sync
    FOOTBALL_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOWED_HOSTS: str = ""  # leave empty to disable; set to comma-separated hostnames in prod
    # Leave empty to allow open registration (local dev). Set in Cloud Run to gate signups.
    INVITE_CODE: str = ""
    RESEND_API_KEY: str = ""
    APP_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
