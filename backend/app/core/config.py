"""
Application configuration management.
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    log_level: str = "INFO"
    environment: str = "development"
    
    # Security
    secret_key: Optional[str] = None  # Must be set via environment variable - no default for security
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # LLM Configuration
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    dashscope_api_key: Optional[str] = None
    llm_provider: str = "dashscope"  # openai, anthropic, or dashscope
    llm_model: str = "qwen3.6-plus"
    llm_temperature: float = 0.7
    dashscope_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    
    # Database
    database_url: str = "postgresql://devops_user:devops_pass@localhost:5432/devops_autopilot"
    database_pool_size: int = 20
    database_max_overflow: int = 10
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 50
    
    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_persist_directory: str = "/data/chromadb"
    
    # Agent Configuration
    max_agent_retries: int = 3
    agent_timeout_seconds: int = 300
    human_approval_required: bool = True
    
    # GitHub Integration
    github_token: Optional[str] = None
    github_org: Optional[str] = None
    
    # Jira Integration
    jira_url: Optional[str] = None
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    
    # Slack Integration
    slack_bot_token: Optional[str] = None
    slack_signing_secret: Optional[str] = None
    
    # PagerDuty Integration
    pagerduty_api_key: Optional[str] = None
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 9090
    
    def __init__(self, **kwargs):
        """Initialize settings and validate security configuration."""
        super().__init__(**kwargs)
        if not self.secret_key:
            raise ValueError(
                "SECRET_KEY must be set via environment variable. "
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        if self.secret_key == "change-this-in-production":
            raise ValueError("SECRET_KEY cannot use the default value. Please set a secure random key.")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment.lower() == "development"


# Global settings instance
settings = Settings()

# Made with Bob
