"""
Orchestrator Agent - Coordinates all specialized agents using LangGraph.
"""
from typing import Any, Dict, TypedDict, Annotated
from langgraph.graph import StateGraph, END
import structlog

from app.agents.triage_agent import TriageAgent
from app.agents.runbook_agent import RunbookAgent
from app.agents.pr_review_agent import PRReviewAgent
from app.agents.doc_agent import DocAgent
from app.models.task import TaskType, TaskStatus
from app.core.config import settings

logger = structlog.get_logger()


class AgentState(TypedDict):
    """State shared across all agents in the workflow."""
    task_id: str
    task_type: TaskType
    input_data: Dict[str, Any]
    current_agent: str
    results: Dict[str, Any]
    requires_approval: bool
    approved: bool
    error: str | None
    status: TaskStatus


class OrchestratorAgent:
    """
    Orchestrator that coordinates multiple specialized agents.
    Uses LangGraph for state management and workflow orchestration.
    """
    
    def __init__(self):
        """Initialize the orchestrator with all specialized agents."""
        self.logger = logger.bind(agent="Orchestrator")
        
        # Initialize specialized agents
        self.triage_agent = TriageAgent()
        self.runbook_agent = RunbookAgent()
        self.pr_review_agent = PRReviewAgent()
        self.doc_agent = DocAgent()
        
        # Build the workflow graph
        self.workflow = self._build_workflow()
        
        self.logger.info("orchestrator_initialized")
    
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow for agent orchestration."""
        
        # Create the state graph
        workflow = StateGraph(AgentState)
        
        # Add nodes for each agent
        workflow.add_node("route", self._route_to_agent)
        workflow.add_node("triage", self._execute_triage)
        workflow.add_node("runbook", self._execute_runbook)
        workflow.add_node("pr_review", self._execute_pr_review)
        workflow.add_node("documentation", self._execute_documentation)
        workflow.add_node("approval_check", self._check_approval)
        workflow.add_node("finalize", self._finalize_task)
        
        # Set entry point
        workflow.set_entry_point("route")
        
        # Add conditional edges from router
        workflow.add_conditional_edges(
            "route",
            self._route_decision,
            {
                "triage": "triage",
                "runbook": "runbook",
                "pr_review": "pr_review",
                "documentation": "documentation",
            }
        )
        
        # All agents go to approval check
        workflow.add_edge("triage", "approval_check")
        workflow.add_edge("runbook", "approval_check")
        workflow.add_edge("pr_review", "approval_check")
        workflow.add_edge("documentation", "approval_check")
        
        # Approval check goes to finalize or waits
        workflow.add_conditional_edges(
            "approval_check",
            self._approval_decision,
            {
                "finalize": "finalize",
                "wait": END,
            }
        )
        
        # Finalize is the end
        workflow.add_edge("finalize", END)
        
        return workflow.compile()
    
    async def process_task(
        self,
        task_id: str,
        task_type: TaskType,
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a task through the agent workflow.
        
        Args:
            task_id: Unique task identifier
            task_type: Type of task to process
            input_data: Input data for the task
        
        Returns:
            Task results
        """
        self.logger.info(
            "processing_task",
            task_id=task_id,
            task_type=task_type
        )
        
        # Initialize state
        initial_state: AgentState = {
            "task_id": task_id,
            "task_type": task_type,
            "input_data": input_data,
            "current_agent": "orchestrator",
            "results": {},
            "requires_approval": settings.human_approval_required,
            "approved": False,
            "error": None,
            "status": TaskStatus.IN_PROGRESS
        }
        
        try:
            # Execute workflow
            final_state = await self.workflow.ainvoke(initial_state)
            
            self.logger.info(
                "task_completed",
                task_id=task_id,
                status=final_state["status"]
            )
            
            return final_state
            
        except Exception as e:
            self.logger.error(
                "task_failed",
                task_id=task_id,
                error=str(e)
            )
            raise
    
    async def _route_to_agent(self, state: AgentState) -> AgentState:
        """Route task to appropriate agent based on task type."""
        state["current_agent"] = state["task_type"].value
        self.logger.info(
            "routing_task",
            task_id=state["task_id"],
            agent=state["current_agent"]
        )
        return state
    
    def _route_decision(self, state: AgentState) -> str:
        """Decide which agent to route to."""
        return state["task_type"].value
    
    async def _execute_triage(self, state: AgentState) -> AgentState:
        """Execute triage agent."""
        try:
            result = await self.triage_agent.process(state["input_data"])
            state["results"] = result
            state["status"] = TaskStatus.AWAITING_APPROVAL if state["requires_approval"] else TaskStatus.COMPLETED
        except Exception as e:
            state["error"] = str(e)
            state["status"] = TaskStatus.FAILED
        return state
    
    async def _execute_runbook(self, state: AgentState) -> AgentState:
        """Execute runbook agent."""
        try:
            result = await self.runbook_agent.process(state["input_data"])
            state["results"] = result
            state["status"] = TaskStatus.AWAITING_APPROVAL if state["requires_approval"] else TaskStatus.COMPLETED
        except Exception as e:
            state["error"] = str(e)
            state["status"] = TaskStatus.FAILED
        return state
    
    async def _execute_pr_review(self, state: AgentState) -> AgentState:
        """Execute PR review agent."""
        try:
            result = await self.pr_review_agent.process(state["input_data"])
            state["results"] = result
            
            # Check if auto-approval is possible
            if result.get("data", {}).get("can_auto_approve", False):
                state["requires_approval"] = False
                state["approved"] = True
            
            state["status"] = TaskStatus.AWAITING_APPROVAL if state["requires_approval"] else TaskStatus.COMPLETED
        except Exception as e:
            state["error"] = str(e)
            state["status"] = TaskStatus.FAILED
        return state
    
    async def _execute_documentation(self, state: AgentState) -> AgentState:
        """Execute documentation agent."""
        try:
            result = await self.doc_agent.process(state["input_data"])
            state["results"] = result
            state["status"] = TaskStatus.AWAITING_APPROVAL if state["requires_approval"] else TaskStatus.COMPLETED
        except Exception as e:
            state["error"] = str(e)
            state["status"] = TaskStatus.FAILED
        return state
    
    async def _check_approval(self, state: AgentState) -> AgentState:
        """Check if task requires approval."""
        if state["status"] == TaskStatus.FAILED:
            return state
        
        if state["requires_approval"] and not state["approved"]:
            state["status"] = TaskStatus.AWAITING_APPROVAL
            self.logger.info(
                "awaiting_approval",
                task_id=state["task_id"]
            )
        else:
            state["status"] = TaskStatus.APPROVED
        
        return state
    
    def _approval_decision(self, state: AgentState) -> str:
        """Decide whether to finalize or wait for approval."""
        if state["status"] == TaskStatus.AWAITING_APPROVAL:
            return "wait"
        return "finalize"
    
    async def _finalize_task(self, state: AgentState) -> AgentState:
        """Finalize task processing."""
        if state["status"] != TaskStatus.FAILED:
            state["status"] = TaskStatus.COMPLETED
        
        self.logger.info(
            "task_finalized",
            task_id=state["task_id"],
            status=state["status"]
        )
        
        return state
    
    async def approve_task(
        self,
        task_id: str,
        approved: bool,
        comment: str | None = None
    ) -> Dict[str, Any]:
        """
        Approve or reject a task awaiting approval.
        
        Args:
            task_id: Task identifier
            approved: Whether the task is approved
            comment: Optional approval comment
        
        Returns:
            Updated task state
        """
        self.logger.info(
            "task_approval",
            task_id=task_id,
            approved=approved
        )
        
        # TODO: Implement state persistence and retrieval
        # This would:
        # 1. Retrieve task state from database
        # 2. Update approval status
        # 3. Continue workflow if approved
        # 4. Mark as rejected if not approved
        
        return {
            "task_id": task_id,
            "approved": approved,
            "comment": comment,
            "status": TaskStatus.APPROVED if approved else TaskStatus.REJECTED
        }


# Global orchestrator instance
orchestrator = OrchestratorAgent()

# Made with Bob
