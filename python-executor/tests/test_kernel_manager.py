"""
Unit tests for the kernel manager.
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from src.kernel_manager import KernelManager


@pytest.mark.asyncio
class TestKernelManager:
    """Test cases for KernelManager."""

    @pytest.fixture
    async def kernel_manager(self):
        """Create a kernel manager for testing."""
        km = KernelManager(timeout_minutes=1, max_kernels_per_user=2)
        await km.start_cleanup_task()

        yield km

        # Cleanup
        await km.shutdown_all()

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        temp_path = tempfile.mkdtemp()
        yield temp_path
        # Cleanup
        shutil.rmtree(temp_path, ignore_errors=True)

    async def test_create_kernel(self, kernel_manager, temp_dir):
        """Test creating a new kernel."""
        user_id = "test_user_1"

        kernel = await kernel_manager.get_or_create_kernel(user_id, temp_dir)

        assert kernel is not None
        assert kernel.is_alive()
        assert user_id in kernel_manager.kernels
        assert user_id in kernel_manager.last_activity

    async def test_reuse_existing_kernel(self, kernel_manager, temp_dir):
        """Test reusing an existing kernel."""
        user_id = "test_user_2"

        # Create first kernel
        kernel1 = await kernel_manager.get_or_create_kernel(user_id, temp_dir)
        kernel1_id = kernel1.kernel_id

        # Get kernel again (should reuse)
        kernel2 = await kernel_manager.get_or_create_kernel(user_id, temp_dir)
        kernel2_id = kernel2.kernel_id

        assert kernel1_id == kernel2_id
        assert len(kernel_manager.kernels) == 1

    async def test_max_kernels_per_user(self, kernel_manager, temp_dir):
        """Test maximum kernels per user limit."""
        user_id = "test_user_3"

        # Create max allowed kernels
        await kernel_manager.get_or_create_kernel(f"{user_id}_1", temp_dir)
        await kernel_manager.get_or_create_kernel(f"{user_id}_2", temp_dir)

        # Try to create one more (should fail)
        with pytest.raises(RuntimeError) as exc_info:
            await kernel_manager.get_or_create_kernel(f"{user_id}_3", temp_dir)

        assert "maximum kernel limit" in str(exc_info.value).lower()

    async def test_kernel_cleanup(self, kernel_manager, temp_dir):
        """Test manual kernel cleanup."""
        user_id = "test_user_4"

        # Create kernel
        kernel = await kernel_manager.get_or_create_kernel(user_id, temp_dir)
        assert user_id in kernel_manager.kernels

        # Cleanup
        await kernel_manager.cleanup_kernel(user_id)

        assert user_id not in kernel_manager.kernels
        assert user_id not in kernel_manager.last_activity

    async def test_expired_kernel_recreation(self, kernel_manager, temp_dir):
        """Test that expired kernels are recreated."""
        user_id = "test_user_5"

        # Create kernel
        kernel1 = await kernel_manager.get_or_create_kernel(user_id, temp_dir)
        kernel1_id = kernel1.kernel_id

        # Manually expire the kernel
        from datetime import datetime, timedelta
        kernel_manager.last_activity[user_id] = datetime.now() - timedelta(minutes=2)

        # Get kernel again (should create new one)
        kernel2 = await kernel_manager.get_or_create_kernel(user_id, temp_dir)
        kernel2_id = kernel2.kernel_id

        assert kernel1_id != kernel2_id

    async def test_working_directory_creation(self, kernel_manager):
        """Test that working directory is created if it doesn't exist."""
        user_id = "test_user_6"
        working_dir = Path(tempfile.gettempdir()) / f"test_kernel_{user_id}"

        # Ensure directory doesn't exist
        if working_dir.exists():
            shutil.rmtree(working_dir)

        # Create kernel
        await kernel_manager.get_or_create_kernel(user_id, str(working_dir))

        # Check directory was created
        assert working_dir.exists()

        # Cleanup
        shutil.rmtree(working_dir, ignore_errors=True)

    async def test_get_kernel_info(self, kernel_manager, temp_dir):
        """Test getting kernel information."""
        user_id = "test_user_7"

        # Create kernel
        await kernel_manager.get_or_create_kernel(user_id, temp_dir)

        # Get info
        info = kernel_manager.get_kernel_info()

        assert user_id in info
        assert 'kernel_id' in info[user_id]
        assert 'created_at' in info[user_id]
        assert 'working_dir' in info[user_id]
        assert info[user_id]['status'] == 'active'

    async def test_shutdown_all(self, kernel_manager, temp_dir):
        """Test shutting down all kernels."""
        # Create multiple kernels
        await kernel_manager.get_or_create_kernel("user1", temp_dir)
        await kernel_manager.get_or_create_kernel("user2", temp_dir)

        assert len(kernel_manager.kernels) == 2

        # Shutdown all
        await kernel_manager.shutdown_all()

        assert len(kernel_manager.kernels) == 0


@pytest.mark.asyncio
class TestKernelInitialization:
    """Test kernel initialization and environment setup."""

    async def test_kernel_has_libraries(self):
        """Test that kernel has required libraries loaded."""
        km = KernelManager(timeout_minutes=5)
        temp_dir = tempfile.mkdtemp()

        try:
            kernel = await km.get_or_create_kernel("test_init", temp_dir)
            kc = kernel.client()

            # Test if polars is available
            msg_id = kc.execute("import polars; print('polars ok')")

            output = ""
            while True:
                try:
                    msg = kc.get_iopub_msg(timeout=5)
                    if msg['header']['msg_type'] == 'stream':
                        output += msg['content']['text']
                    elif msg['header']['msg_type'] == 'status' and \
                         msg['content']['execution_state'] == 'idle':
                        break
                except Exception:
                    break

            assert 'polars ok' in output

        finally:
            await km.shutdown_all()
            shutil.rmtree(temp_dir, ignore_errors=True)
