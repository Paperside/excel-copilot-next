"""
Code Executor - executes Python code in Jupyter kernels and collects results.
"""
import asyncio
import base64
from datetime import datetime
from typing import Dict, Any, List
import jupyter_client
import logging

logger = logging.getLogger(__name__)


class CodeExecutor:
    """Executes Python code and collects results."""

    @staticmethod
    async def execute_code(
        kernel_manager: jupyter_client.KernelManager,
        code: str,
        timeout: int = 60
    ) -> Dict[str, Any]:
        """
        Execute Python code in the kernel and collect results.

        Args:
            kernel_manager: Jupyter kernel manager
            code: Python code to execute
            timeout: Execution timeout in seconds

        Returns:
            Dictionary containing:
                - success: bool
                - output: str (stdout)
                - error: str (stderr/traceback)
                - result: str (last expression result)
                - plots: List[str] (base64 encoded images)
                - execution_time: float
        """
        start_time = datetime.now()
        kc = kernel_manager.client()

        # Execute code
        msg_id = kc.execute(code)

        output_parts = []
        error_parts = []
        result = None
        plots = []
        success = True

        # Collect outputs
        deadline = datetime.now().total_seconds() + timeout

        try:
            while True:
                # Check timeout
                if datetime.now().total_seconds() > deadline:
                    error_parts.append(f"Execution timeout ({timeout}s)")
                    success = False
                    break

                try:
                    msg = kc.get_iopub_msg(timeout=1)
                    msg_type = msg['header']['msg_type']
                    content = msg['content']

                    if msg_type == 'stream':
                        # Standard output
                        output_parts.append(content['text'])

                    elif msg_type == 'error':
                        # Error occurred
                        error_parts.append('\n'.join(content['traceback']))
                        success = False

                    elif msg_type == 'execute_result':
                        # Result of last expression
                        result = content['data'].get('text/plain', '')

                    elif msg_type == 'display_data':
                        # Handle plots and other display data
                        if 'image/png' in content['data']:
                            # Store base64 encoded plot
                            plots.append(content['data']['image/png'])
                        elif 'text/plain' in content['data']:
                            output_parts.append(content['data']['text/plain'])

                    elif msg_type == 'status' and content['execution_state'] == 'idle':
                        # Execution completed
                        break

                except Exception as e:
                    # Timeout on get_iopub_msg, continue waiting
                    if "Timeout" not in str(e):
                        logger.error(f"Error receiving message: {e}")

        except Exception as e:
            logger.error(f"Unexpected error during execution: {e}")
            error_parts.append(f"Unexpected error: {str(e)}")
            success = False

        execution_time = (datetime.now() - start_time).total_seconds()

        return {
            "success": success,
            "output": '\n'.join(output_parts).strip(),
            "error": '\n'.join(error_parts).strip(),
            "result": result,
            "plots": plots,
            "execution_time": execution_time
        }

    @staticmethod
    def validate_code(code: str) -> tuple[bool, str]:
        """
        Validate Python code before execution.

        Args:
            code: Python code to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Basic validation
        if not code or not code.strip():
            return False, "Code cannot be empty"

        # Check for obviously dangerous operations (basic check)
        dangerous_patterns = [
            'os.system',
            'subprocess.',
            '__import__',
            'eval(',
            'exec(',
        ]

        for pattern in dangerous_patterns:
            if pattern in code:
                return False, f"Potentially dangerous operation detected: {pattern}"

        # Try to compile the code
        try:
            compile(code, '<string>', 'exec')
            return True, ""
        except SyntaxError as e:
            return False, f"Syntax error: {str(e)}"
        except Exception as e:
            return False, f"Validation error: {str(e)}"
