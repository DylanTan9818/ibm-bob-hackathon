"""
Runbook Agent - Generates resolution procedures from past incidents.
"""
from typing import Any, Dict
import json
from app.agents.base_agent import BaseAgent


class RunbookAgent(BaseAgent):
    """Agent responsible for generating runbooks and resolution procedures."""
    
    def __init__(self):
        super().__init__(
            name="RunbookAgent",
            description="Generates step-by-step resolution procedures based on incident history"
        )
        
        self.system_prompt = """You are an expert DevOps engineer specializing in incident resolution and runbook creation.
Your role is to generate clear, actionable runbooks for resolving incidents based on:
1. Current incident details
2. Historical similar incidents and their resolutions
3. Best practices and standard operating procedures
4. System architecture and dependencies

A good runbook should:
- Have clear, numbered steps that anyone can follow
- Include verification steps after each action
- Specify prerequisites and required access/tools
- Provide rollback procedures if applicable
- Estimate time for completion
- Link to relevant documentation

Provide your runbook in JSON format with the following structure:
{
    "title": "Descriptive title for the runbook",
    "prerequisites": ["prerequisite1", "prerequisite2"],
    "estimated_time": "X minutes/hours",
    "steps": [
        {
            "step_number": 1,
            "action": "What to do",
            "command": "Optional command to run",
            "expected_result": "What should happen",
            "verification": "How to verify it worked",
            "rollback": "Optional rollback if it fails"
        }
    ],
    "related_docs": ["doc_url1", "doc_url2"],
    "notes": "Additional important information"
}"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process runbook generation request.
        
        Args:
            input_data: Dictionary containing:
                - incident_title: Title of the incident
                - incident_description: Description of the incident
                - error_logs: Optional error logs
                - metadata: Additional metadata
        
        Returns:
            Generated runbook with steps and procedures
        """
        self.validate_input(input_data, ["incident_title", "incident_description"])
        
        incident_title = input_data["incident_title"]
        incident_description = input_data["incident_description"]
        error_logs = input_data.get("error_logs", "")
        metadata = input_data.get("metadata", {})
        
        # Find similar incidents from history
        similar_incidents = await self._find_similar_incidents(
            incident_title, incident_description
        )
        
        # Build context from similar incidents
        similar_context = self._build_similar_incidents_context(similar_incidents)
        
        # Build user prompt
        user_prompt = f"""Generate a detailed runbook for resolving this incident:

Incident Title: {incident_title}

Incident Description: {incident_description}

Error Logs:
{error_logs if error_logs else "No error logs provided"}

Additional Context:
{json.dumps(metadata, indent=2)}

{similar_context}

Generate a comprehensive runbook in the specified JSON format."""
        
        try:
            # Invoke LLM for runbook generation
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            # Parse JSON response
            runbook = self._parse_response(response)
            
            # Add similar incidents reference
            runbook["similar_incidents"] = similar_incidents
            
            self.logger.info(
                "runbook_generated",
                title=runbook["title"],
                steps_count=len(runbook["steps"]),
                estimated_time=runbook["estimated_time"]
            )
            
            return self.format_output(runbook)
            
        except Exception as e:
            self.logger.error("runbook_generation_failed", error=str(e))
            raise
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response and extract runbook information."""
        try:
            # Try to extract JSON from response
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[start_idx:end_idx]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["title", "steps"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            # Set defaults for optional fields
            if "prerequisites" not in result:
                result["prerequisites"] = []
            if "estimated_time" not in result:
                result["estimated_time"] = "Unknown"
            if "related_docs" not in result:
                result["related_docs"] = []
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error("json_parse_error", error=str(e), response=response)
            # Return default runbook if parsing fails
            return {
                "title": "Generic Troubleshooting Runbook",
                "prerequisites": ["System access", "Monitoring tools"],
                "estimated_time": "30-60 minutes",
                "steps": [
                    {
                        "step_number": 1,
                        "action": "Review incident details and error logs",
                        "expected_result": "Understanding of the issue",
                        "verification": "Can describe the problem clearly"
                    },
                    {
                        "step_number": 2,
                        "action": "Check system health and metrics",
                        "expected_result": "Identify affected components",
                        "verification": "Know which services are impacted"
                    },
                    {
                        "step_number": 3,
                        "action": "Review recent changes and deployments",
                        "expected_result": "Identify potential root cause",
                        "verification": "Timeline of changes established"
                    },
                    {
                        "step_number": 4,
                        "action": "Apply appropriate fix or rollback",
                        "expected_result": "Issue resolved",
                        "verification": "System metrics return to normal"
                    }
                ],
                "related_docs": [],
                "notes": "This is a generic runbook. Customize based on specific incident details."
            }
    
    async def _find_similar_incidents(
        self,
        title: str,
        description: str
    ) -> list[Dict[str, Any]]:
        """
        Find similar past incidents using vector similarity search.
        
        In production, this would query ChromaDB with embeddings.
        """
        # TODO: Implement vector similarity search with ChromaDB
        # This would:
        # 1. Generate embeddings for title + description
        # 2. Query ChromaDB for similar incidents
        # 3. Return top N similar incidents with their resolutions
        
        return []
    
    def _build_similar_incidents_context(
        self,
        similar_incidents: list[Dict[str, Any]]
    ) -> str:
        """Build context string from similar incidents."""
        if not similar_incidents:
            return "No similar incidents found in history."
        
        context = "Similar Past Incidents:\n\n"
        for idx, incident in enumerate(similar_incidents[:3], 1):
            context += f"{idx}. {incident.get('title', 'Unknown')}\n"
            context += f"   Resolution: {incident.get('resolution', 'Not documented')}\n"
            context += f"   Time to resolve: {incident.get('resolution_time', 'Unknown')}\n\n"
        
        return context
    
    async def save_runbook(
        self,
        runbook: Dict[str, Any],
        incident_id: str
    ) -> None:
        """
        Save generated runbook for future reference.
        
        Args:
            runbook: Generated runbook data
            incident_id: Associated incident ID
        """
        # TODO: Implement storage in database and vector store
        # This would:
        # 1. Store runbook in PostgreSQL
        # 2. Create embeddings and store in ChromaDB
        # 3. Link to incident for future retrieval
        
        self.logger.info(
            "runbook_saved",
            incident_id=incident_id,
            runbook_title=runbook.get("title")
        )

# Made with Bob
