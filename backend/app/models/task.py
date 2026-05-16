"""
Task data models for agent orchestration.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """Types of tasks that can be processed."""
    TRIAGE = "triage"
    RUNBOOK = "runbook"
    PR_REVIEW = "pr_review"
    DOCUMENTATION = "documentation"


class TaskStatus(str, Enum):
    """Task processing status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


class Severity(str, Enum):
    """Incident severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class TaskBase(BaseModel):
    """Base task model."""
    task_type: TaskType
    title: str
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskCreate(TaskBase):
    """Task creation model."""
    pass


class Task(TaskBase):
    """Complete task model."""
    id: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    assigned_agent: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    requires_approval: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class IncidentTriageRequest(BaseModel):
    """Request model for incident triage."""
    title: str
    description: str
    source: str = "manual"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentTriageResult(BaseModel):
    """Result of incident triage."""
    severity: Severity
    category: str
    assigned_team: str
    initial_steps: list[str]
    similar_incidents: list[Dict[str, Any]] = Field(default_factory=list)
    confidence: float


class RunbookRequest(BaseModel):
    """Request model for runbook generation."""
    incident_title: str
    incident_description: str
    error_logs: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RunbookResult(BaseModel):
    """Result of runbook generation."""
    title: str
    steps: list[Dict[str, str]]
    prerequisites: list[str]
    estimated_time: str
    related_docs: list[str] = Field(default_factory=list)
    similar_incidents: list[Dict[str, Any]] = Field(default_factory=list)


class PRReviewRequest(BaseModel):
    """Request model for PR review."""
    pr_url: str
    repository: str
    pr_number: int
    title: str
    description: str
    files_changed: list[str]
    diff: Optional[str] = None


class PRReviewResult(BaseModel):
    """Result of PR review."""
    approved: bool
    violations: list[Dict[str, str]] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    security_issues: list[Dict[str, str]] = Field(default_factory=list)
    complexity_score: float
    recommendation: str


class DocGenerationRequest(BaseModel):
    """Request model for documentation generation."""
    doc_type: str  # release_notes, postmortem, changelog
    repository: Optional[str] = None
    from_commit: Optional[str] = None
    to_commit: Optional[str] = None
    incident_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocGenerationResult(BaseModel):
    """Result of documentation generation."""
    doc_type: str
    content: str
    sections: Dict[str, str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ApprovalRequest(BaseModel):
    """Request model for task approval."""
    approved: bool
    comment: Optional[str] = None
    approved_by: str


class TaskResponse(BaseModel):
    """Response model for task operations."""
    task_id: str
    status: TaskStatus
    message: str

# Made with Bob
