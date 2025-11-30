/**
 * Python Executor Client
 * Communicates with the Python executor service
 */
import fetch from 'node-fetch';

export interface ExecuteCodeRequest {
  userId: string;
  code: string;
  workingDir: string;
  timeout?: number;
}

export interface ExecuteCodeResponse {
  success: boolean;
  output: string;
  error: string;
  result: string | null;
  plots: string[];
  executionTime: number;
}

export class PythonExecutorClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.PYTHON_EXECUTOR_URL || 'http://localhost:8000';
  }

  /**
   * Execute Python code
   */
  async executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    const response = await fetch(`${this.baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: request.userId,
        code: request.code,
        working_dir: request.workingDir,
        timeout: request.timeout || 60,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Python execution failed: ${error.detail || response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      output: data.output,
      error: data.error,
      result: data.result,
      plots: data.plots,
      executionTime: data.execution_time,
    };
  }

  /**
   * Check if Python executor is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let executorInstance: PythonExecutorClient | null = null;

export function getPythonExecutor(): PythonExecutorClient {
  if (!executorInstance) {
    executorInstance = new PythonExecutorClient();
  }
  return executorInstance;
}
