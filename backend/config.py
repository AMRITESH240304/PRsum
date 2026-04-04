from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URI: str
    OXLOAPI_KEY: str
    GITHUB_TOKEN: str

    
    class Config:
        env_file = ".env"
        
settings = Settings()