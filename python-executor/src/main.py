"""
Main entry point for the Python executor service.
FastAPI server that provides code execution endpoints.
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import ExecuteRequest, ExecuteResponse, KernelInfo, HealthResponse
from kernel_manager import KernelManager
from code_executor import CodeExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
KERNEL_TIMEOUT = int(os.getenv('JUPYTER_KERNEL_TIMEOUT', '1800'))  # 30 minutes
MAX_KERNELS = int(os.getenv('MAX_KERNELS_PER_USER', '3'))

# Global kernel manager
kernel_manager = KernelManager(
    timeout_minutes=KERNEL_TIMEOUT // 60,
    max_kernels_per_user=MAX_KERNELS
)
code_executor = CodeExecutor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Python Executor service...")
    # Start cleanup task
    await kernel_manager.start_cleanup_task()
    logger.info(f"Kernel timeout: {KERNEL_TIMEOUT}s, Max kernels per user: {MAX_KERNELS}")

    yield

    # Shutdown
    logger.info("Shutting down Python Executor service...")
    await kernel_manager.shutdown_all()
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Excel Copilot Python Executor",
    description="Python code execution service for Excel Copilot",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/execute", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """
    Execute Python code in a user-specific Jupyter kernel.

    Args:
        request: ExecuteRequest containing user_id, code, and working_dir

    Returns:
        ExecuteResponse with execution results
    """
    logger.info(f"Execute request from user {request.user_id}")

    # Validate code
    is_valid, error_msg = code_executor.validate_code(request.code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Code validation failed: {error_msg}")

    try:
        # Get or create kernel
        km = await kernel_manager.get_or_create_kernel(
            request.user_id,
            request.working_dir
        )

        # Execute code
        result = await code_executor.execute_code(
            km,
            request.code,
            timeout=request.timeout
        )

        logger.info(
            f"Execution completed for user {request.user_id}: "
            f"success={result['success']}, time={result['execution_time']:.2f}s"
        )

        return ExecuteResponse(**result)

    except RuntimeError as e:
        logger.error(f"Runtime error for user {request.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error for user {request.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    active_kernels = len(kernel_manager.kernels)
    return HealthResponse(
        status="ok",
        active_kernels=active_kernels,
        version="0.1.0"
    )


@app.get("/kernels")
async def get_kernels():
    """Get information about active kernels (dev only)."""
    if os.getenv('NODE_ENV') == 'production':
        raise HTTPException(status_code=404, detail="Not found")

    kernel_info = kernel_manager.get_kernel_info()
    return {
        "count": len(kernel_info),
        "kernels": kernel_info
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv('PYTHON_EXECUTOR_PORT', '8000'))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
