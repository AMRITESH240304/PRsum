from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str
    OXLOAPI_KEY: str
    OXLO_BASE_URL: str = "https://api.oxlo.ai/v1"
    GITHUB_TOKEN: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://localhost:8080"

    @property
    def frontend_origins(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    
    class Config:
        env_file = ".env"
        
settings = Settings()