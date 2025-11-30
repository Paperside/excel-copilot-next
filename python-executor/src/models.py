"""
Data models for the Python executor service.
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    """Request model for code execution."""

    user_id: str = Field(..., description="User ID for kernel isolation")
    code: str = Field(..., description="Python code to execute")
    working_dir: str = Field(..., description="Working directory for the kernel")
    timeout: int = Field(default=60, description="Execution timeout in seconds", ge=1, le=300)


class ExecuteResponse(BaseModel):
    """Response model for code execution."""

    success: bool = Field(..., description="Whether execution was successful")
    output: str = Field(default="", description="Standard output from execution")
    error: str = Field(default="", description="Error messages if any")
    result: Optional[str] = Field(default=None, description="Return value of last expression")
    plots: List[str] = Field(default_factory=list, description="Base64 encoded plots")
    execution_time: float = Field(..., description="Execution time in seconds")


class KernelInfo(BaseModel):
    """Information about a running kernel."""

    user_id: str
    kernel_id: str
    status: str
    created_at: str
    last_activity: str
    working_dir: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    active_kernels: int = 0
    version: str = "0.1.0"
