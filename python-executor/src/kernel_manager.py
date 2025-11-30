"""
Jupyter Kernel Manager - manages user-specific Jupyter kernels.
"""
import os
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
from pathlib import Path
import jupyter_client
import logging

logger = logging.getLogger(__name__)


class KernelManager:
    """Manages Jupyter kernels for multiple users."""

    def __init__(self, timeout_minutes: int = 30, max_kernels_per_user: int = 3):
        """
        Initialize the kernel manager.

        Args:
            timeout_minutes: Kernel idle timeout in minutes
            max_kernels_per_user: Maximum concurrent kernels per user
        """
        self.kernels: Dict[str, jupyter_client.KernelManager] = {}
        self.last_activity: Dict[str, datetime] = {}
        self.working_dirs: Dict[str, str] = {}
        self.timeout = timedelta(minutes=timeout_minutes)
        self.max_kernels_per_user = max_kernels_per_user

        # Start cleanup task
        self._cleanup_task = None

    async def start_cleanup_task(self):
        """Start the periodic cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def _periodic_cleanup(self):
        """Periodically clean up expired kernels."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self.cleanup_expired_kernels()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def get_or_create_kernel(
        self,
        user_id: str,
        working_dir: str
    ) -> jupyter_client.KernelManager:
        """
        Get existing kernel for user or create a new one.

        Args:
            user_id: User identifier
            working_dir: Working directory for the kernel

        Returns:
            KernelManager instance

        Raises:
            RuntimeError: If user has too many kernels
        """
        # Check if kernel exists and is still valid
        if user_id in self.kernels:
            if datetime.now() - self.last_activity[user_id] < self.timeout:
                # Update activity and return existing kernel
                self.last_activity[user_id] = datetime.now()
                logger.info(f"Reusing kernel for user {user_id}")
                return self.kernels[user_id]
            else:
                # Expired, clean up
                logger.info(f"Kernel expired for user {user_id}, creating new one")
                await self.cleanup_kernel(user_id)

        # Count user's kernels
        user_kernel_count = sum(1 for uid in self.kernels.keys() if uid.startswith(user_id))
        if user_kernel_count >= self.max_kernels_per_user:
            raise RuntimeError(
                f"User {user_id} has reached maximum kernel limit ({self.max_kernels_per_user})"
            )

        # Create working directory if it doesn't exist
        Path(working_dir).mkdir(parents=True, exist_ok=True)

        # Create new kernel
        logger.info(f"Creating new kernel for user {user_id} in {working_dir}")
        km = jupyter_client.KernelManager(
            kernel_name='python3',
            cwd=working_dir
        )
        km.start_kernel()

        # Wait for kernel to be ready
        kc = km.client()
        kc.start_channels()

        try:
            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, kc.wait_for_ready),
                timeout=60
            )
        except asyncio.TimeoutError:
            km.shutdown_kernel()
            raise RuntimeError("Kernel failed to start within 60 seconds")

        # Initialize environment with common libraries
        init_code = """
import polars as pl
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import jieba
import os
import sys
from pathlib import Path

# Set Chinese font support
plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

print("✓ Environment initialized successfully")
"""

        # Execute initialization code
        msg_id = kc.execute(init_code)

        # Wait for execution to complete (with timeout)
        init_timeout = 30
        start_time = datetime.now()

        while (datetime.now() - start_time).total_seconds() < init_timeout:
            try:
                msg = kc.get_iopub_msg(timeout=1)
                if msg['header']['msg_type'] == 'status' and \
                   msg['content']['execution_state'] == 'idle':
                    break
            except Exception:
                pass

        # Store kernel info
        self.kernels[user_id] = km
        self.last_activity[user_id] = datetime.now()
        self.working_dirs[user_id] = working_dir

        logger.info(f"Kernel created successfully for user {user_id}")
        return km

    async def cleanup_kernel(self, user_id: str):
        """Clean up a specific kernel."""
        if user_id in self.kernels:
            km = self.kernels[user_id]
            try:
                km.shutdown_kernel(now=True)
                logger.info(f"Shut down kernel for user {user_id}")
            except Exception as e:
                logger.error(f"Error shutting down kernel for user {user_id}: {e}")
            finally:
                del self.kernels[user_id]
                del self.last_activity[user_id]
                if user_id in self.working_dirs:
                    del self.working_dirs[user_id]

    async def cleanup_expired_kernels(self):
        """Clean up all expired kernels."""
        now = datetime.now()
        expired_users = [
            user_id for user_id, last_time in self.last_activity.items()
            if now - last_time >= self.timeout
        ]

        for user_id in expired_users:
            logger.info(f"Cleaning up expired kernel for user {user_id}")
            await self.cleanup_kernel(user_id)

    async def shutdown_all(self):
        """Shutdown all kernels (for graceful shutdown)."""
        logger.info("Shutting down all kernels...")
        user_ids = list(self.kernels.keys())
        for user_id in user_ids:
            await self.cleanup_kernel(user_id)

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    def get_kernel_info(self) -> Dict[str, dict]:
        """Get information about all active kernels."""
        return {
            user_id: {
                "kernel_id": km.kernel_id,
                "created_at": self.last_activity[user_id].isoformat(),
                "working_dir": self.working_dirs.get(user_id, "unknown"),
                "status": "active" if km.is_alive() else "dead"
            }
            for user_id, km in self.kernels.items()
        }
