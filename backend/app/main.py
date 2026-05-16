"""
FastAPI application entry point.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import structlog
import uuid

from app.core.config import settings
from app.core.seed_demo_data import seed_demo_data
from app.models.task import (
    TaskType, TaskStatus, TaskResponse,
    IncidentTriageRequest, IncidentTriageResult,
    RunbookRequest, RunbookResult,
    PRReviewRequest, PRReviewResult,
    DocGenerationRequest, DocGenerationResult,
    ApprovalRequest, Task
)
from app.agents.orchestrator import orchestrator

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()

# In-memory task storage (replace with database in production)
tasks_db: dict[str, Task] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("application_starting", environment=settings.environment)
    seed_demo_data()
    yield
    logger.info("application_shutting_down")


# Create FastAPI application
app = FastAPI(
    title="DevOps Autopilot Multi-Agent System",
    description="Intelligent multi-agent system for automating DevOps toil",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "DevOps Autopilot Multi-Agent System",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "llm_provider": settings.llm_provider
    }


@app.post("/api/v1/incidents/triage", response_model=TaskResponse)
async def triage_incident(
    request: IncidentTriageRequest,
    background_tasks: BackgroundTasks
):
    """
    Triage an incident or alert.
    
    The triage agent will:
    - Classify severity
    - Route to appropriate team
    - Suggest initial troubleshooting steps
    """
    task_id = str(uuid.uuid4())
    
    # Create task
    task = Task(
        id=task_id,
        task_type=TaskType.TRIAGE,
        title=request.title,
        description=request.description,
        status=TaskStatus.PENDING,
        metadata=request.metadata,
        requires_approval=settings.human_approval_required,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    tasks_db[task_id] = task
    
    # Process in background
    background_tasks.add_task(
        process_task_async,
        task_id,
        TaskType.TRIAGE,
        request.dict()
    )
    
    logger.info("triage_task_created", task_id=task_id)
    
    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="Incident triage task created and processing"
    )


@app.post("/api/v1/runbooks/generate", response_model=TaskResponse)
async def generate_runbook(
    request: RunbookRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate a runbook for incident resolution.
    
    The runbook agent will:
    - Search for similar past incidents
    - Generate step-by-step resolution procedures
    - Provide prerequisites and estimated time
    """
    task_id = str(uuid.uuid4())
    
    task = Task(
        id=task_id,
        task_type=TaskType.RUNBOOK,
        title=f"Runbook: {request.incident_title}",
        description=request.incident_description,
        status=TaskStatus.PENDING,
        metadata=request.metadata,
        requires_approval=settings.human_approval_required,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    tasks_db[task_id] = task
    
    background_tasks.add_task(
        process_task_async,
        task_id,
        TaskType.RUNBOOK,
        request.dict()
    )
    
    logger.info("runbook_task_created", task_id=task_id)
    
    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="Runbook generation task created and processing"
    )


@app.post("/api/v1/prs/review", response_model=TaskResponse)
async def review_pr(
    request: PRReviewRequest,
    background_tasks: BackgroundTasks
):
    """
    Review a pull request for policy compliance.
    
    The PR review agent will:
    - Check for security vulnerabilities
    - Verify code quality standards
    - Validate against policy rules
    - Auto-approve if all checks pass
    """
    task_id = str(uuid.uuid4())
    
    task = Task(
        id=task_id,
        task_type=TaskType.PR_REVIEW,
        title=f"PR Review: {request.title}",
        description=request.description,
        status=TaskStatus.PENDING,
        metadata={"pr_url": request.pr_url, "repository": request.repository},
        requires_approval=settings.human_approval_required,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    tasks_db[task_id] = task
    
    background_tasks.add_task(
        process_task_async,
        task_id,
        TaskType.PR_REVIEW,
        request.dict()
    )
    
    logger.info("pr_review_task_created", task_id=task_id)
    
    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message="PR review task created and processing"
    )


@app.post("/api/v1/docs/generate", response_model=TaskResponse)
async def generate_documentation(
    request: DocGenerationRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate documentation (release notes, post-mortems, changelogs).
    
    The documentation agent will:
    - Parse Git history or incident data
    - Generate well-formatted documentation
    - Organize content into appropriate sections
    """
    task_id = str(uuid.uuid4())
    
    task = Task(
        id=task_id,
        task_type=TaskType.DOCUMENTATION,
        title=f"Generate {request.doc_type}",
        description=f"Generate {request.doc_type} documentation",
        status=TaskStatus.PENDING,
        metadata=request.metadata,
        requires_approval=settings.human_approval_required,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    tasks_db[task_id] = task
    
    background_tasks.add_task(
        process_task_async,
        task_id,
        TaskType.DOCUMENTATION,
        request.dict()
    )
    
    logger.info("documentation_task_created", task_id=task_id, doc_type=request.doc_type)
    
    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        message=f"{request.doc_type} generation task created and processing"
    )


@app.get("/api/v1/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get task status and results."""
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return tasks_db[task_id]


@app.get("/api/v1/tasks", response_model=list[Task])
async def list_tasks(
    status: TaskStatus | None = None,
    task_type: TaskType | None = None,
    limit: int = 50
):
    """List all tasks with optional filtering."""
    tasks = list(tasks_db.values())
    
    if status:
        tasks = [t for t in tasks if t.status == status]
    
    if task_type:
        tasks = [t for t in tasks if t.task_type == task_type]
    
    # Sort by created_at descending
    tasks.sort(key=lambda t: t.created_at, reverse=True)
    
    return tasks[:limit]


@app.post("/api/v1/tasks/{task_id}/approve", response_model=Task)
async def approve_task(
    task_id: str,
    request: ApprovalRequest,
    background_tasks: BackgroundTasks
):
    """
    Approve or reject a task awaiting approval.
    
    If approved, the task will be finalized and executed.
    If rejected, the task will be marked as rejected.
    """
    if task_id not in tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks_db[task_id]
    
    if task.status != TaskStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=400,
            detail=f"Task is not awaiting approval (current status: {task.status})"
        )
    
    # Update task
    task.approved_by = request.approved_by
    task.approved_at = datetime.now()
    
    if request.approved:
        task.status = TaskStatus.APPROVED
        # Continue processing in background
        background_tasks.add_task(finalize_task, task_id)
        logger.info("task_approved", task_id=task_id, approved_by=request.approved_by)
    else:
        task.status = TaskStatus.REJECTED
        logger.info("task_rejected", task_id=task_id, approved_by=request.approved_by)
    
    task.updated_at = datetime.now()
    
    return task


async def process_task_async(
    task_id: str,
    task_type: TaskType,
    input_data: dict
):
    """Process task asynchronously through orchestrator."""
    try:
        result = await orchestrator.process_task(task_id, task_type, input_data)
        
        # Update task in database
        if task_id in tasks_db:
            task = tasks_db[task_id]
            task.status = result["status"]
            task.result = result.get("results")
            task.error = result.get("error")
            task.assigned_agent = result.get("current_agent")
            task.updated_at = datetime.now()
        
    except Exception as e:
        logger.error("task_processing_failed", task_id=task_id, error=str(e))
        if task_id in tasks_db:
            task = tasks_db[task_id]
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.updated_at = datetime.now()


async def finalize_task(task_id: str):
    """Finalize an approved task."""
    if task_id in tasks_db:
        task = tasks_db[task_id]
        task.status = TaskStatus.COMPLETED
        task.updated_at = datetime.now()
        logger.info("task_finalized", task_id=task_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.is_development
    )

# Made with Bob
