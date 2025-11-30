# Excel Copilot - 快速开始指南

## 📋 MVP状态总结

已完成的核心功能:
- ✅ Python执行环境 (Jupyter Kernel管理)
- ✅ 模拟S3文件存储系统
- ✅ Express后端API
- ✅ Mastra Agent集成
- ✅ 数据库Schema设计
- ✅ Next.js前端 (登录、聊天、文件管理)

## 🚀 快速启动

### 1. 安装依赖

```bash
# 安装uv (Python包管理器)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装Node依赖
pnpm install

# 安装Python依赖
cd python-executor
uv sync
cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑.env文件,填入必要的配置
```

需要配置的关键变量:
- `DATABASE_URL`: PostgreSQL连接字符串
- `OPENAI_API_KEY`: OpenAI API密钥
- `JWT_SECRET`: JWT签名密钥(随机字符串)

### 3. 数据库迁移

```bash
cd backend
pnpm db:generate
pnpm db:migrate
```

### 4. 启动服务

**方式一: 分别启动各服务(推荐开发时)**

```bash
# 终端1: Python执行器
cd python-executor
uv run python src/main.py

# 终端2: 后端
cd backend
pnpm dev

# 终端3: 前端
cd frontend
pnpm dev
```

**方式二: 使用根目录脚本(待实现)**

```bash
pnpm dev
```

## 🧪 测试

### Python执行器测试

```bash
cd python-executor
uv run pytest tests/ -v
```

应该看到所有测试通过的输出。

### 手动测试后端API

```bash
# 健康检查
curl http://localhost:4000/api/health

# 登录
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'

# 保存返回的token,用于后续请求
export TOKEN="your-jwt-token-here"

# 上传文件
curl -X POST http://localhost:4000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@path/to/your/file.xlsx"

# 列出文件
curl http://localhost:4000/api/files \
  -H "Authorization: Bearer $TOKEN"
```

## 📦 项目结构

```
excel-copilot-next/
├── backend/              ✅ 已完成
│   ├── src/
│   │   ├── db/          # 数据库配置和Schema
│   │   ├── services/     # 业务逻辑(存储、Python执行器)
│   │   ├── routes/      # API路由
│   │   ├── mastra/      # Mastra Agent配置
│   │   └── middleware/  # 中间件(认证等)
│   └── package.json
│
├── python-executor/      ✅ 已完成
│   ├── src/
│   │   ├── main.py      # FastAPI服务器
│   │   ├── kernel_manager.py
│   │   └── code_executor.py
│   ├── tests/           # 单元测试
│   └── pyproject.toml
│
├── frontend/             ✅ 已完成
│   ├── app/
│   │   ├── page.tsx      # 登录页面
│   │   └── chat/         # 聊天界面
│   ├── components/       # UI组件
│   └── lib/              # API客户端和工具
│
└── README.md
```

## 🔍 核心设计

### 1. Python执行流程

```
用户消息 → Agent → run_python工具 → Python Executor → Jupyter Kernel → 执行结果
```

### 2. 文件管理流程

```
上传文件 → 模拟S3存储 → 数据库记录元数据
Agent需要文件 → 从S3复制到用户目录 → Python代码访问
```

### 3. Agent工具调用

Agent通过`run_python`工具执行代码时,会:
1. 检查`fileIds`参数
2. 将指定文件从模拟S3复制到用户目录
3. 在用户的Jupyter Kernel中执行代码
4. 返回执行结果(输出、错误、图片等)

## ⚠️ 已知限制(MVP阶段)

1. **安全性**
   - 无密码登录(仅用户名)
   - Python代码执行有基本验证,但不完全沙箱化
   - 建议仅在可信环境使用

2. **性能**
   - 每用户独立Kernel,资源消耗较大
   - 没有实现缓存机制
   - 大文件上传可能较慢

3. **功能缺失**
   - 没有会话历史持久化
   - 没有代码执行可视化
   - 没有图表/图片展示
   - 错误处理需要优化

## 📝 开发笔记

### 核心决策

1. **为什么使用Express而不是纯Mastra?**
   - 更灵活的路由和中间件
   - 更好的文件上传支持(multer)
   - Mastra作为模块集成更清晰

2. **为什么使用FastAPI作为Python服务?**
   - 现代异步框架
   - 自动生成OpenAPI文档
   - 类型提示支持好

3. **为什么让Agent传递fileIds?**
   - Agent明确知道需要哪些文件
   - 避免不必要的文件复制
   - 更好的错误处理

### 下一步计划

1. 会话历史持久化和加载
2. 代码执行可视化
3. 图表/图片展示
4. 优化错误处理
5. 添加更多测试

## 🐛 故障排查

### Python Executor无法启动

```bash
# 检查Python版本
python --version  # 需要 >= 3.11

# 检查uv是否安装
uv --version

# 重新安装依赖
cd python-executor
rm -rf .venv
uv sync
```

### 数据库连接失败

```bash
# 检查PostgreSQL是否运行
pg_isready

# 检查DATABASE_URL是否正确
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL -c "SELECT 1"
```

### Agent无法执行代码

1. 检查Python Executor是否运行
2. 查看后端日志是否有错误
3. 确认文件ID是否正确
4. 检查用户目录权限

## 📄 许可证

MIT
