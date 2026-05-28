from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    ENVIRONMENT: str = "development"
    # Allow admin match updates in production if explicitly enabled
    ALLOW_ADMIN_MATCH_UPDATES: bool = False
    # football-data.org API key for match/result sync
    FOOTBALL_API_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"
    # Leave empty to allow open registration (local dev). Set in Cloud Run to gate signups.
    INVITE_CODE: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
