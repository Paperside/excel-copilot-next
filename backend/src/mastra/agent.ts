/**
 * Mastra Agent: Excel Copilot
 */
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getPythonExecutor } from '../services/pythonExecutor';
import { getStorage } from '../services/fileStorage';
import { db } from '../db';
import { userFiles } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// Define run_python tool
export const runPythonTool = createTool({
  id: 'run_python',
  description: `Execute Python code in a Jupyter notebook environment for Excel file processing.

This tool has access to:
- polars (pl): For efficient data processing (recommended for large datasets)
- pandas (pd): For traditional data manipulation
- matplotlib.pyplot (plt): For visualization
- jieba: For Chinese text segmentation

The code executes in an isolated environment with:
- User-specific working directory
- Uploaded files accessible via relative paths in ./uploads/
- Outputs should be saved to ./outputs/
- Persistent session (30 min timeout)

Best practices:
- Use Polars for datasets > 100K rows
- Use relative paths for file access (e.g., './uploads/data.xlsx')
- Save outputs to './outputs/' directory
- Always show data preview before processing`,

  inputSchema: z.object({
    code: z.string().describe('Python code to execute'),
    fileIds: z.array(z.string()).optional().describe('File IDs needed for this execution'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
    plots: z.array(z.string()).optional(),
  }),

  execute: async ({ context, runtimeContext }) => {
    const { code, fileIds = [] } = context;
    const userId = runtimeContext?.get('userId') as string;

    if (!userId) {
      throw new Error('User ID not found in runtime context');
    }

    const executor = getPythonExecutor();
    const storage = getStorage();

    // Ensure user directory exists
    const userDir = await storage.ensureUserDirectory(userId);

    // Download requested files to user directory
    if (fileIds.length > 0) {
      const files = await db.select()
        .from(userFiles)
        .where(
          and(
            eq(userFiles.userId, userId),
            inArray(userFiles.id, fileIds)
          )
        );

      for (const file of files) {
        await storage.copyFileToUserDir(file.s3Key, userId, file.originalName);
      }

      console.log(`✓ Copied ${files.length} files to user ${userId}'s directory`);
    }

    // Execute Python code
    const result = await executor.executeCode({
      userId,
      code,
      workingDir: userDir,
      timeout: 60,
    });

    return {
      success: result.success,
      output: result.output,
      error: result.error || undefined,
      plots: result.plots.length > 0 ? result.plots : undefined,
    };
  },
});

// Create Excel Copilot Agent
export const excelCopilotAgent = new Agent({
  name: 'Excel Copilot',
  description: 'AI助手,帮助用户分析、处理和生成Excel文件',

  instructions: async ({ runtimeContext }) => {
    const userId = runtimeContext?.get('userId') as string;
    const fileContext = runtimeContext?.get('fileContext') as Array<{ id: string; name: string }> || [];

    const fileList = fileContext.length > 0
      ? `\n\n当前会话中的文件:\n${fileContext.map((f, i) => `${i + 1}. ${f.name} (ID: ${f.id})`).join('\n')}`
      : '';

    return `你是一个专业的Excel数据分析助手。你可以帮助用户:

1. **数据分析**: 使用Polars或Pandas读取和分析Excel文件
2. **数据处理**: 清洗、转换、合并数据
3. **数据可视化**: 使用Matplotlib创建图表
4. **文件生成**: 生成新的Excel文件或修改现有文件
5. **中文处理**: 使用jieba进行中文文本分析

## 工具使用指南

你有一个核心工具: **run_python**

这个工具让你在用户的Jupyter环境中执行Python代码。每个用户都有独立的环境,会话会保持30分钟。

### 可用的库:
- \`polars as pl\` - 推荐用于大数据处理(>100K行)
- \`pandas as pd\` - 传统数据处理
- \`matplotlib.pyplot as plt\` - 数据可视化
- \`jieba\` - 中文分词

### 文件路径规则:
- 用户上传的文件在: \`./uploads/\`
- 输出文件保存到: \`./outputs/\`
- 使用相对路径即可

### 最佳实践:
1. 优先使用Polars,它比Pandas快10-100倍
2. 分步骤执行复杂任务,每次返回中间结果
3. 创建可视化时,使用\`plt.savefig('./outputs/plot.png')\`保存图片
4. 处理Excel文件时,先显示前几行数据让用户确认
5. 生成文件后,告知用户文件名和位置
6. 调用run_python时,如果需要访问文件,必须在fileIds参数中指定文件ID${fileList}

## 示例代码:

### 读取Excel文件
\`\`\`python
import polars as pl
df = pl.read_excel('./uploads/data.xlsx')
print(f"数据形状: {df.shape}")
print(df.head())
\`\`\`

### 数据分析
\`\`\`python
# 统计分析
print(df.describe())

# 分组聚合
result = df.group_by('category').agg([
    pl.col('amount').sum().alias('total'),
    pl.col('amount').mean().alias('avg')
])
print(result)
\`\`\`

### 可视化
\`\`\`python
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 6))
df.plot.bar(x='category', y='amount')
plt.title('销售额分析')
plt.savefig('./outputs/analysis.png')
print("✓ 图表已保存到 outputs/analysis.png")
\`\`\`

## 注意事项:
- 用户ID: ${userId}
- 你的代码在沙箱环境中运行,非常安全
- 会话会在30分钟无活动后过期
- 如果出现错误,解释原因并提供解决方案
- 记得在fileIds中指定需要的文件!`;
  },

  model: openai(process.env.OPENAI_MODEL || 'gpt-4o'),

  tools: {
    runPython: runPythonTool,
  },
});
