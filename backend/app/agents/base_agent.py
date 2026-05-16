"""
Base agent class for all specialized agents.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from langchain.schema import HumanMessage, SystemMessage
from langchain.callbacks import get_openai_callback
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class BaseAgent(ABC):
    """Base class for all agents in the system."""
    
    def __init__(self, name: str, description: str):
        """
        Initialize the base agent.
        
        Args:
            name: Agent name
            description: Agent description
        """
        self.name = name
        self.description = description
        self.llm = self._initialize_llm()
        self.logger = logger.bind(agent=name)
    
    def _initialize_llm(self):
        """Initialize the LLM based on configuration."""
        if settings.llm_provider == "openai":
            return ChatOpenAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                openai_api_key=settings.openai_api_key,
                max_retries=settings.max_agent_retries,
            )
        elif settings.llm_provider == "anthropic":
            return ChatAnthropic(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                anthropic_api_key=settings.anthropic_api_key,
                max_retries=settings.max_agent_retries,
            )
        elif settings.llm_provider == "dashscope":
            # DashScope/Qwen uses OpenAI-compatible API
            return ChatOpenAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                openai_api_key=settings.dashscope_api_key,
                openai_api_base=settings.dashscope_base_url,
                max_retries=settings.max_agent_retries,
            )
        else:
            raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
    
    @abstractmethod
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process the input data and return results.
        
        Args:
            input_data: Input data for the agent
            
        Returns:
            Processing results
        """
        pass
    
    async def invoke_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs
    ) -> str:
        """
        Invoke the LLM with system and user prompts.
        
        Args:
            system_prompt: System prompt
            user_prompt: User prompt
            **kwargs: Additional arguments for the LLM
            
        Returns:
            LLM response
        """
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]
            
            self.logger.info(
                "invoking_llm",
                system_prompt_length=len(system_prompt),
                user_prompt_length=len(user_prompt)
            )
            
            with get_openai_callback() as cb:
                response = await self.llm.ainvoke(messages, **kwargs)
                
                self.logger.info(
                    "llm_invoked",
                    tokens_used=cb.total_tokens,
                    cost=cb.total_cost
                )
            
            return response.content
            
        except Exception as e:
            self.logger.error("llm_invocation_failed", error=str(e))
            raise
    
    def validate_input(self, input_data: Dict[str, Any], required_fields: list[str]) -> None:
        """
        Validate that required fields are present in input data.
        
        Args:
            input_data: Input data to validate
            required_fields: List of required field names
            
        Raises:
            ValueError: If required fields are missing
        """
        missing_fields = [field for field in required_fields if field not in input_data]
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
    
    async def execute_with_retry(
        self,
        func,
        *args,
        max_retries: Optional[int] = None,
        **kwargs
    ) -> Any:
        """
        Execute a function with retry logic.
        
        Args:
            func: Function to execute
            *args: Positional arguments
            max_retries: Maximum number of retries
            **kwargs: Keyword arguments
            
        Returns:
            Function result
        """
        max_retries = max_retries or settings.max_agent_retries
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_error = e
                self.logger.warning(
                    "retry_attempt",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    error=str(e)
                )
                
                if attempt == max_retries - 1:
                    break
        
        self.logger.error("max_retries_exceeded", error=str(last_error))
        raise last_error
    
    def format_output(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format the output data with agent metadata.
        
        Args:
            data: Output data
            
        Returns:
            Formatted output with metadata
        """
        return {
            "agent": self.name,
            "data": data,
            "metadata": {
                "agent_description": self.description,
                "llm_provider": settings.llm_provider,
                "llm_model": settings.llm_model,
            }
        }

# Made with Bob
