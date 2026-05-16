"""
Triage Agent - Classifies and routes incidents.
"""
from typing import Any, Dict
import json
from app.agents.base_agent import BaseAgent
from app.models.task import Severity
from app.core.incident_store import incident_store


class TriageAgent(BaseAgent):
    """Agent responsible for triaging incidents and alerts."""
    
    def __init__(self):
        super().__init__(
            name="TriageAgent",
            description="Classifies incident severity and routes to appropriate teams"
        )
        
        self.system_prompt = """You are an expert DevOps incident triage specialist.
Your role is to analyze incoming incidents and alerts, classify their severity, 
and route them to the appropriate team.

Consider the following when triaging:
1. Impact on users and business operations
2. Affected systems and services
3. Historical patterns and similar incidents
4. Urgency and time sensitivity

Severity Levels:
- CRITICAL: System down, data loss, security breach, affecting all users
- HIGH: Major functionality broken, affecting many users
- MEDIUM: Partial functionality issues, affecting some users
- LOW: Minor issues, workarounds available
- INFO: Informational, no immediate action needed

Teams:
- Platform: Infrastructure, networking, cloud resources
- Database: Database performance, queries, data integrity
- Application: Application code, APIs, business logic
- Security: Security incidents, vulnerabilities, access issues
- Frontend: UI/UX issues, client-side problems

Provide your analysis in JSON format with the following structure:
{
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "category": "infrastructure|database|application|security|frontend|other",
    "assigned_team": "Platform|Database|Application|Security|Frontend",
    "initial_steps": ["step1", "step2", "step3"],
    "confidence": 0.0-1.0,
    "reasoning": "explanation of your decision"
}"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process incident triage request.
        
        Args:
            input_data: Dictionary containing:
                - title: Incident title
                - description: Incident description
                - source: Source of the incident (e.g., prometheus, manual)
                - metadata: Additional metadata
        
        Returns:
            Triage results including severity, team assignment, and initial steps
        """
        self.validate_input(input_data, ["title", "description"])
        
        title = input_data["title"]
        description = input_data["description"]
        source = input_data.get("source", "manual")
        metadata = input_data.get("metadata", {})
        
        # Build user prompt with all available information
        user_prompt = f"""Analyze this incident and provide triage recommendations:

Title: {title}

Description: {description}

Source: {source}

Additional Context:
{json.dumps(metadata, indent=2)}

Provide your triage analysis in the specified JSON format."""
        
        try:
            # Invoke LLM for triage analysis
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            # Parse JSON response
            triage_result = self._parse_response(response)
            
            # Enhance with similar incidents (would query vector DB in production)
            triage_result["similar_incidents"] = await self._find_similar_incidents(
                title, description
            )
            
            self.logger.info(
                "triage_completed",
                severity=triage_result["severity"],
                team=triage_result["assigned_team"],
                confidence=triage_result["confidence"]
            )
            
            return self.format_output(triage_result)
            
        except Exception as e:
            self.logger.error("triage_failed", error=str(e))
            raise
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response and extract triage information."""
        try:
            # Try to extract JSON from response
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[start_idx:end_idx]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["severity", "category", "assigned_team", "initial_steps"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            # Ensure confidence is present
            if "confidence" not in result:
                result["confidence"] = 0.8
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error("json_parse_error", error=str(e), response=response)
            # Return default triage if parsing fails
            return {
                "severity": "MEDIUM",
                "category": "other",
                "assigned_team": "Platform",
                "initial_steps": [
                    "Review incident details",
                    "Check system logs",
                    "Verify system status"
                ],
                "confidence": 0.5,
                "reasoning": "Failed to parse LLM response, using default triage"
            }
    
    async def _find_similar_incidents(
        self,
        title: str,
        description: str
    ) -> list[Dict[str, Any]]:
        """
        Find similar past incidents using vector similarity search.
        """
        query = f"{title}. {description}"
        results = incident_store.find_similar_incidents(query, n_results=3)
        self.logger.info("similar_incidents_found", count=len(results))
        return results
    
    async def update_incident_history(
        self,
        incident_data: Dict[str, Any],
        resolution: Dict[str, Any]
    ) -> None:
        """
        Update incident history in vector database for future reference.
        
        Args:
            incident_data: Original incident data
            resolution: How the incident was resolved
        """
        import uuid
        incident_store.store_incident(
            incident_id=str(uuid.uuid4()),
            title=incident_data.get("title", ""),
            description=incident_data.get("description", ""),
            metadata={
                "severity": resolution.get("severity", ""),
                "team": resolution.get("team", ""),
                "resolution": resolution.get("resolution", ""),
                "resolution_time": resolution.get("resolution_time", ""),
            }
        )
        self.logger.info("incident_history_updated", title=incident_data.get("title"))

# Made with Bob
