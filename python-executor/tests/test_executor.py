"""
Unit tests for the code executor.
"""
import pytest
import asyncio
from src.code_executor import CodeExecutor


class TestCodeExecutor:
    """Test cases for CodeExecutor."""

    def test_validate_code_success(self):
        """Test code validation with valid code."""
        code = "print('Hello, world!')"
        is_valid, error = CodeExecutor.validate_code(code)
        assert is_valid is True
        assert error == ""

    def test_validate_code_empty(self):
        """Test code validation with empty code."""
        is_valid, error = CodeExecutor.validate_code("")
        assert is_valid is False
        assert "empty" in error.lower()

    def test_validate_code_syntax_error(self):
        """Test code validation with syntax error."""
        code = "print('unclosed string"
        is_valid, error = CodeExecutor.validate_code(code)
        assert is_valid is False
        assert "syntax" in error.lower()

    def test_validate_code_dangerous_operations(self):
        """Test code validation with dangerous operations."""
        dangerous_codes = [
            "os.system('rm -rf /')",
            "import subprocess; subprocess.call(['ls'])",
            "eval('malicious code')",
            "exec('dangerous')",
        ]

        for code in dangerous_codes:
            is_valid, error = CodeExecutor.validate_code(code)
            assert is_valid is False
            assert "dangerous" in error.lower()


@pytest.mark.asyncio
class TestCodeExecutorIntegration:
    """Integration tests for code execution."""

    @pytest.fixture
    async def kernel_manager(self):
        """Create a kernel manager for testing."""
        from src.kernel_manager import KernelManager
        import tempfile

        km = KernelManager(timeout_minutes=5)
        working_dir = tempfile.mkdtemp()

        # Create a kernel
        kernel = await km.get_or_create_kernel("test_user", working_dir)

        yield kernel

        # Cleanup
        await km.shutdown_all()

    async def test_execute_simple_print(self, kernel_manager):
        """Test executing simple print statement."""
        code = "print('Hello from test!')"
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is True
        assert 'Hello from test!' in result['output']
        assert result['error'] == ''

    async def test_execute_with_result(self, kernel_manager):
        """Test executing code that returns a result."""
        code = "2 + 2"
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is True
        assert result['result'] == '4'

    async def test_execute_with_error(self, kernel_manager):
        """Test executing code that raises an error."""
        code = "1 / 0"
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is False
        assert 'ZeroDivisionError' in result['error']

    async def test_execute_polars(self, kernel_manager):
        """Test executing Polars code."""
        code = """
import polars as pl
df = pl.DataFrame({
    'a': [1, 2, 3],
    'b': ['x', 'y', 'z']
})
print(df.shape)
"""
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is True
        assert '(3, 2)' in result['output']

    async def test_execute_matplotlib(self, kernel_manager):
        """Test executing matplotlib code (should produce a plot)."""
        code = """
import matplotlib.pyplot as plt
plt.figure(figsize=(6, 4))
plt.plot([1, 2, 3, 4], [1, 4, 2, 3])
plt.title('Test Plot')
plt.show()
"""
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is True
        # Should have at least one plot
        assert len(result['plots']) > 0
        # Plots should be base64 encoded strings
        assert isinstance(result['plots'][0], str)
        assert len(result['plots'][0]) > 0

    async def test_execute_timeout(self, kernel_manager):
        """Test execution timeout."""
        code = """
import time
time.sleep(100)  # Sleep longer than timeout
"""
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=2)

        assert result['success'] is False
        assert 'timeout' in result['error'].lower()

    async def test_execution_time_tracking(self, kernel_manager):
        """Test that execution time is tracked."""
        code = "import time; time.sleep(0.1)"
        result = await CodeExecutor.execute_code(kernel_manager, code, timeout=10)

        assert result['success'] is True
        assert result['execution_time'] > 0.1
        assert result['execution_time'] < 1.0  # Should not take too long
