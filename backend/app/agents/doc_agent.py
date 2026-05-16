"""
Documentation Agent - Generates release notes, post-mortems, and changelogs.
"""
from typing import Any, Dict
import json
from datetime import datetime
from app.agents.base_agent import BaseAgent


class DocAgent(BaseAgent):
    """Agent responsible for generating documentation from various sources."""
    
    def __init__(self):
        super().__init__(
            name="DocAgent",
            description="Generates release notes, post-mortems, and changelogs automatically"
        )
        
        self.system_prompt = """You are an expert technical writer specializing in DevOps documentation.
Your role is to generate clear, comprehensive documentation including:
- Release notes
- Post-mortem reports
- Changelogs
- Architecture diagrams
- Incident summaries

Guidelines for each document type:

RELEASE NOTES:
- Highlight new features and improvements
- List bug fixes
- Note breaking changes
- Include upgrade instructions
- Acknowledge contributors

POST-MORTEM:
- Incident timeline
- Root cause analysis
- Impact assessment
- Resolution steps taken
- Lessons learned
- Action items to prevent recurrence

CHANGELOG:
- Organized by version
- Categorized changes (Added, Changed, Deprecated, Removed, Fixed, Security)
- Clear, concise descriptions
- Links to issues/PRs

ARCHITECTURE DIAGRAM:
- Analyze code repository structure
- Identify main components and their relationships
- Generate Mermaid diagram syntax
- Include data flow and dependencies
- Show API endpoints, services, databases, etc.

IMPORTANT MERMAID SYNTAX RULES:
- Use square brackets [] for node labels, NOT parentheses ()
- Avoid special characters in node labels (use quotes if needed)
- Use simple, clear node IDs (A, B, C or descriptive names)
- Valid shapes: [Rectangle], (Rounded), ([Stadium]), [[Subroutine]], [(Database)], {{Hexagon}}, [/Parallelogram/], [\Parallelogram\], [/Trapezoid\], [\Trapezoid/]
- For text with special chars, use quotes: A["Text with (parens)"]
- Example: Frontend[Frontend App] -->|API| Backend[Backend Service]

Format your output as JSON:
{
    "doc_type": "release_notes|postmortem|changelog|architecture_diagram",
    "title": "Document title",
    "content": "Full markdown content",
    "sections": {
        "section_name": "section_content"
    },
    "mermaid_diagram": "mermaid diagram code (only for architecture_diagram)",
    "metadata": {
        "version": "if applicable",
        "date": "ISO date",
        "author": "if applicable"
    }
}"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process documentation generation request.
        
        Args:
            input_data: Dictionary containing:
                - doc_type: Type of document (release_notes, postmortem, changelog)
                - repository: Optional repository name
                - from_commit: Optional starting commit
                - to_commit: Optional ending commit
                - incident_id: Optional incident ID for post-mortems
                - metadata: Additional metadata
        
        Returns:
            Generated documentation
        """
        self.validate_input(input_data, ["doc_type"])
        
        doc_type = input_data["doc_type"]
        
        if doc_type == "release_notes":
            return await self._generate_release_notes(input_data)
        elif doc_type == "postmortem":
            return await self._generate_postmortem(input_data)
        elif doc_type == "changelog":
            return await self._generate_changelog(input_data)
        elif doc_type == "architecture_diagram":
            return await self._generate_architecture_diagram(input_data)
        else:
            raise ValueError(f"Unsupported document type: {doc_type}")
    
    async def _generate_release_notes(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate release notes from Git history."""
        repository = input_data.get("repository", "Unknown")
        from_commit = input_data.get("from_commit", "")
        to_commit = input_data.get("to_commit", "HEAD")
        metadata = input_data.get("metadata", {})
        
        # In production, this would fetch actual Git commits
        commits = await self._fetch_commits(repository, from_commit, to_commit)
        
        user_prompt = f"""Generate release notes for the following changes:

Repository: {repository}
Version: {metadata.get('version', 'Next Release')}
Date: {datetime.now().isoformat()}

Commits:
{self._format_commits(commits)}

Additional Context:
{json.dumps(metadata, indent=2)}

Generate comprehensive release notes in the specified JSON format."""
        
        try:
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            result = self._parse_response(response)
            
            self.logger.info(
                "release_notes_generated",
                repository=repository,
                version=metadata.get('version')
            )
            
            return self.format_output(result)
            
        except Exception as e:
            self.logger.error("release_notes_generation_failed", error=str(e))
            raise
    
    async def _generate_postmortem(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate post-mortem report from incident data."""
        incident_id = input_data.get("incident_id")
        metadata = input_data.get("metadata", {})
        
        # In production, this would fetch incident details from database
        incident_data = await self._fetch_incident_data(incident_id)
        
        user_prompt = f"""Generate a post-mortem report for this incident:

Incident ID: {incident_id}
Title: {incident_data.get('title', 'Unknown')}
Severity: {incident_data.get('severity', 'Unknown')}
Duration: {incident_data.get('duration', 'Unknown')}

Timeline:
{self._format_timeline(incident_data.get('timeline', []))}

Impact:
{incident_data.get('impact', 'Not documented')}

Resolution:
{incident_data.get('resolution', 'Not documented')}

Additional Context:
{json.dumps(metadata, indent=2)}

Generate a comprehensive post-mortem in the specified JSON format."""
        
        try:
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            result = self._parse_response(response)
            
            self.logger.info(
                "postmortem_generated",
                incident_id=incident_id
            )
            
            return self.format_output(result)
            
        except Exception as e:
            self.logger.error("postmortem_generation_failed", error=str(e))
            raise
    
    async def _generate_changelog(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate changelog from Git history."""
        repository = input_data.get("repository", "Unknown")
        from_commit = input_data.get("from_commit", "")
        to_commit = input_data.get("to_commit", "HEAD")
        metadata = input_data.get("metadata", {})
        
        # In production, this would fetch actual Git commits
        commits = await self._fetch_commits(repository, from_commit, to_commit)
        
        user_prompt = f"""Generate a changelog for the following changes:

Repository: {repository}
Version: {metadata.get('version', 'Unreleased')}

Commits:
{self._format_commits(commits)}

Categorize changes into:
- Added: New features
- Changed: Changes in existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security fixes

Generate a well-organized changelog in the specified JSON format."""
        
        try:
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            result = self._parse_response(response)
            
            self.logger.info(
                "changelog_generated",
                repository=repository,
                version=metadata.get('version')
            )
            
            return self.format_output(result)
            
        except Exception as e:
            self.logger.error("changelog_generation_failed", error=str(e))
            raise
    
    async def _generate_architecture_diagram(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate architecture diagram from code repository analysis."""
        repository = input_data.get("repository", "Unknown")
        metadata = input_data.get("metadata", {})
        
        # In production, this would analyze actual repository structure
        repo_structure = await self._analyze_repository(repository)
        
        user_prompt = f"""Generate an architecture diagram for this repository:

Repository Name: {repository}

Based on the repository name and common software architecture patterns, infer and generate a comprehensive architecture diagram that shows:
1. Likely main components (frontend, backend, database, cache, message queues, etc.)
2. Data flow between components
3. Common external services and APIs for this type of application
4. Typical technologies used in such projects

IMPORTANT:
- Analyze the repository NAME to understand what type of application it is
- Generate a realistic, typical architecture for that type of application
- DO NOT use any hardcoded mock data
- Infer components based on the repository name and common patterns

CRITICAL Mermaid syntax rules:
- Use square brackets [] for node labels
- DO NOT use parentheses () in node text - use quotes if needed
- Use simple node IDs without special characters
- Valid example: Frontend[Frontend App] -->|API| Backend[Backend Service]
- For database: DB[(Database)]
- For text with special chars: Node["Text with special-chars"]

Return the result in JSON format with:
- doc_type: "architecture_diagram"
- title: A descriptive title based on the repository
- content: A brief description of the inferred architecture
- mermaid_diagram: The complete Mermaid diagram code (without ```mermaid wrapper)
- sections: Key architectural components and their descriptions
- metadata: Any relevant metadata

Example Mermaid diagram format (DO NOT copy this, generate based on repository):
graph TB
    Frontend[Web Frontend] -->|HTTPS| API[API Gateway]
    API -->|Query| DB[(Database)]
    API -->|Cache| Cache[(Redis)]
"""
        
        try:
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            result = self._parse_response(response)
            
            self.logger.info(
                "architecture_diagram_generated",
                repository=repository
            )
            
            return self.format_output(result)
            
        except Exception as e:
            self.logger.error("architecture_diagram_generation_failed", error=str(e))
            raise
    
    async def _analyze_repository(self, repository: str) -> Dict[str, Any]:
        """Analyze repository structure."""
        # TODO: Implement actual repository analysis by cloning/fetching the repo
        # For now, return minimal structure so AI generates based on repository name
        
        return {
            "repository_name": repository,
            "note": "AI will infer architecture from repository name and common patterns"
        }
    
    def _format_repo_structure(self, structure: Dict[str, Any]) -> str:
        """Format repository structure for prompt."""
        formatted = []
        
        formatted.append("Directories:")
        for dir in structure.get("directories", []):
            formatted.append(f"  - {dir}")
        
        formatted.append("\nKey Files:")
        for location, files in structure.get("files", {}).items():
            formatted.append(f"  {location}:")
            for file in files:
                formatted.append(f"    - {file}")
        
        formatted.append("\nTechnologies:")
        for component, tech in structure.get("technologies", {}).items():
            formatted.append(f"  {component}: {tech}")
        
        return "\n".join(formatted)
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response and extract documentation."""
        try:
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[start_idx:end_idx]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["doc_type", "title", "content"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            # Set defaults
            if "sections" not in result:
                result["sections"] = {}
            if "metadata" not in result:
                result["metadata"] = {}
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error("json_parse_error", error=str(e), response=response)
            return {
                "doc_type": "unknown",
                "title": "Documentation Generation Failed",
                "content": "Failed to generate documentation. Please try again.",
                "sections": {},
                "metadata": {}
            }
    
    async def _fetch_commits(
        self,
        repository: str,
        from_commit: str,
        to_commit: str
    ) -> list[Dict[str, Any]]:
        """Fetch commits from Git repository."""
        # TODO: Implement GitHub API integration
        # This would fetch actual commits using PyGithub
        
        # Mock data for now
        return [
            {
                "sha": "abc123",
                "message": "Add new feature X",
                "author": "developer1",
                "date": "2024-01-15"
            },
            {
                "sha": "def456",
                "message": "Fix bug in component Y",
                "author": "developer2",
                "date": "2024-01-14"
            }
        ]
    
    async def _fetch_incident_data(self, incident_id: str) -> Dict[str, Any]:
        """Fetch incident data from database."""
        # TODO: Implement database query
        # This would fetch incident details from PostgreSQL
        
        # Mock data for now
        return {
            "title": "High CPU usage on production servers",
            "severity": "high",
            "duration": "2 hours",
            "timeline": [
                {"time": "14:00", "event": "Alert triggered"},
                {"time": "14:15", "event": "Team notified"},
                {"time": "15:30", "event": "Root cause identified"},
                {"time": "16:00", "event": "Issue resolved"}
            ],
            "impact": "Degraded performance for 30% of users",
            "resolution": "Scaled up instances and optimized queries"
        }
    
    def _format_commits(self, commits: list[Dict[str, Any]]) -> str:
        """Format commits for prompt."""
        if not commits:
            return "No commits provided"
        
        formatted = []
        for commit in commits:
            formatted.append(
                f"- {commit.get('sha', 'unknown')[:7]}: {commit.get('message', 'No message')} "
                f"by {commit.get('author', 'unknown')} on {commit.get('date', 'unknown')}"
            )
        
        return "\n".join(formatted)
    
    def _format_timeline(self, timeline: list[Dict[str, Any]]) -> str:
        """Format incident timeline for prompt."""
        if not timeline:
            return "No timeline provided"
        
        formatted = []
        for event in timeline:
            formatted.append(f"{event.get('time', 'unknown')}: {event.get('event', 'No description')}")
        
        return "\n".join(formatted)

# Made with Bob
