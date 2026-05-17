"""
PR Review Agent - Reviews pull requests for policy compliance.
"""
from typing import Any, Dict
import json
from app.agents.base_agent import BaseAgent


class PRReviewAgent(BaseAgent):
    """Agent responsible for reviewing pull requests against policy rules."""
    
    def __init__(self):
        super().__init__(
            name="PRReviewAgent",
            description="Reviews PRs for security, style, and best practice compliance"
        )
        
        self.system_prompt = """You are an expert code reviewer with deep knowledge of:
- Security best practices and common vulnerabilities
- Code quality and maintainability
- Performance optimization
- Testing requirements
- Documentation standards
- Language-specific best practices

Your role is to review pull requests and check for:

1. Security Issues:
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Hardcoded secrets or credentials
   - Insecure dependencies
   - Authentication/authorization issues
   - Data exposure risks

2. Code Quality:
   - Code complexity and readability
   - Proper error handling
   - Code duplication
   - Naming conventions
   - Code organization

3. Best Practices:
   - Proper logging
   - Resource cleanup
   - Null/undefined checks
   - Input validation
   - API design patterns

4. Testing:
   - Test coverage for new code
   - Edge cases handled
   - Integration tests where needed

5. Documentation:
   - Code comments for complex logic
   - API documentation
   - README updates if needed

Provide your review in JSON format:
{
    "approved": true/false,
    "violations": [
        {
            "severity": "critical|high|medium|low",
            "category": "security|quality|testing|documentation",
            "file": "path/to/file",
            "line": 123,
            "issue": "Description of the issue",
            "suggestion": "How to fix it"
        }
    ],
    "suggestions": ["general improvement suggestions"],
    "security_issues": [
        {
            "severity": "critical|high|medium|low",
            "type": "Type of security issue",
            "description": "Detailed description",
            "remediation": "How to fix"
        }
    ],
    "complexity_score": 0.0-10.0,
    "recommendation": "approve|request_changes|needs_discussion",
    "dependency_analysis": {
        "changed_files": ["list of files modified in PR"],
        "dependencies": [
            {
                "file": "path/to/file",
                "depends_on": ["list of files this file imports/requires"],
                "depended_by": ["list of files that import this file"],
                "risk_level": "high|medium|low"
            }
        ],
        "impact_summary": "Brief summary of change impact"
    }
}"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process PR review request.
        
        Args:
            input_data: Dictionary containing:
                - pr_url: URL of the pull request
                - repository: Repository name
                - pr_number: PR number
                - title: PR title
                - description: PR description
                - files_changed: List of changed files
                - diff: Optional diff content
        
        Returns:
            Review results with violations and recommendations
        """
        self.validate_input(
            input_data,
            ["pr_url", "repository", "pr_number", "title", "files_changed"]
        )
        
        pr_url = input_data["pr_url"]
        repository = input_data["repository"]
        pr_number = input_data["pr_number"]
        title = input_data["title"]
        description = input_data.get("description", "")
        files_changed = input_data["files_changed"]
        diff = input_data.get("diff", "")
        
        # Build user prompt
        user_prompt = f"""Review this pull request and analyze file dependencies:

Repository: {repository}
PR #{pr_number}: {title}
URL: {pr_url}

Description:
{description}

Files Changed ({len(files_changed)}):
{chr(10).join(f"- {file}" for file in files_changed)}

Diff:
{diff if diff else "Diff not provided - review based on file list and description"}

IMPORTANT: Analyze the dependencies between files:
1. For each changed file, identify which files it imports/requires
2. Identify which files might be affected by these changes
3. Assess the risk level based on:
   - Number of dependencies
   - Criticality of dependent files
   - Test coverage
4. Provide a dependency graph structure for visualization

Provide a comprehensive review in the specified JSON format including dependency_analysis."""
        
        try:
            # Invoke LLM for PR review
            response = await self.invoke_llm(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt
            )
            
            # Parse JSON response
            review_result = self._parse_response(response)
            
            # Determine if auto-approval is possible
            review_result["can_auto_approve"] = self._can_auto_approve(review_result)
            
            self.logger.info(
                "pr_review_completed",
                pr_number=pr_number,
                approved=review_result["approved"],
                violations_count=len(review_result["violations"]),
                security_issues_count=len(review_result["security_issues"])
            )
            
            return self.format_output(review_result)
            
        except Exception as e:
            self.logger.error("pr_review_failed", error=str(e))
            raise
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response and extract review information."""
        try:
            # Try to extract JSON from response
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[start_idx:end_idx]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["approved", "recommendation"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            # Set defaults for optional fields
            if "violations" not in result:
                result["violations"] = []
            if "suggestions" not in result:
                result["suggestions"] = []
            if "security_issues" not in result:
                result["security_issues"] = []
            if "complexity_score" not in result:
                result["complexity_score"] = 5.0
            if "dependency_analysis" not in result:
                result["dependency_analysis"] = {
                    "changed_files": [],
                    "dependencies": [],
                    "impact_summary": "Dependency analysis not available"
                }
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error("json_parse_error", error=str(e), response=response)
            # Return conservative review if parsing fails
            return {
                "approved": False,
                "violations": [],
                "suggestions": ["Manual review required - automated review failed"],
                "security_issues": [],
                "complexity_score": 5.0,
                "recommendation": "needs_discussion"
            }
    
    def _can_auto_approve(self, review_result: Dict[str, Any]) -> bool:
        """
        Determine if PR can be auto-approved based on review results.
        
        Auto-approval criteria:
        - No critical or high severity violations
        - No security issues
        - Complexity score below threshold
        - Recommendation is 'approve'
        """
        # Check for critical/high violations
        for violation in review_result.get("violations", []):
            if violation.get("severity") in ["critical", "high"]:
                return False
        
        # Check for any security issues
        if review_result.get("security_issues", []):
            return False
        
        # Check complexity score
        if review_result.get("complexity_score", 10) > 7.0:
            return False
        
        # Check recommendation
        if review_result.get("recommendation") != "approve":
            return False
        
        return review_result.get("approved", False)
    
    async def post_review_comment(
        self,
        pr_url: str,
        review_result: Dict[str, Any]
    ) -> None:
        """
        Post review comments to the PR.
        
        Args:
            pr_url: URL of the pull request
            review_result: Review results to post
        """
        # TODO: Implement GitHub API integration
        # This would:
        # 1. Format review comments
        # 2. Post inline comments for violations
        # 3. Post summary comment
        # 4. Request changes or approve based on results
        
        self.logger.info(
            "review_comment_posted",
            pr_url=pr_url,
            approved=review_result.get("approved")
        )
    
    async def check_policy_rules(
        self,
        files_changed: list[str],
        diff: str
    ) -> list[Dict[str, Any]]:
        """
        Check PR against predefined policy rules.
        
        Args:
            files_changed: List of changed files
            diff: Diff content
        
        Returns:
            List of policy violations
        """
        violations = []
        
        # Example policy rules
        # TODO: Load from configuration
        
        # Rule: No changes to production config without approval
        prod_config_files = [f for f in files_changed if "prod" in f.lower() and "config" in f.lower()]
        if prod_config_files:
            violations.append({
                "severity": "high",
                "category": "policy",
                "files": prod_config_files,
                "issue": "Production configuration changes require manual approval",
                "suggestion": "Request review from platform team"
            })
        
        # Rule: Database migrations require review
        migration_files = [f for f in files_changed if "migration" in f.lower()]
        if migration_files:
            violations.append({
                "severity": "high",
                "category": "policy",
                "files": migration_files,
                "issue": "Database migrations require DBA review",
                "suggestion": "Request review from database team"
            })
        
        return violations

# Made with Bob
