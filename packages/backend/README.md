# Figma AI Chat 后端服务

这是 Figma AI Chat 项目的后端服务部分。完整文档请参阅[主 README](../../README.md)。

## 后端特定说明

### 环境变量配置

在`.env`文件中配置以下变量:

```
# OpenAI API密钥（必需）
OPENAI_API_KEY=sk-your-api-key-here

# 端口设置（可选，默认为3000）
PORT=3000

# 环境设置（可选，默认为development）
NODE_ENV=development

# 调试请求头（可选，默认为false）
DEBUG_HEADERS=false

# 日志级别（可选，默认为info）
LOG_LEVEL=info
```

### 代码结构

- `src/index.ts` - 服务入口点，Express 应用配置和 API 路由
- `src/routes/` - API 路由处理
- `src/services/` - 业务逻辑服务层
- `src/types.ts` - 后端特定类型定义
- `src/config/` - 配置文件

### AI 模型设置

默认使用的 OpenAI 模型是 `gpt-4.1-2025-04-14`。

### 会话管理

后端负责管理完整的对话历史记录，自动为每个会话分配唯一 ID，并提供会话过期清理机制。

### API 端点

#### POST /api/chat

接收聊天消息并返回 AI 回复。

请求体格式:

```json
{
  "message": "用户消息内容",
  "sessionId": "可选的会话ID"
}
```

响应格式:

```json
{
  "message": "AI助手的回复内容",
  "responseId": "OpenAI响应ID",
  "sessionId": "会话ID"
}
```

#### GET /health

健康检查端点，返回服务状态与诊断信息。

### 日志级别

日志系统支持以下级别（从最低到最高优先级）：

- `trace` - 非常详细的调试信息（例如 WebSocket 消息分片）
- `debug` - 调试信息（详细流程）
- `info` - 关键操作和状态变化（生产环境默认级别）
- `warn` - 潜在问题或异常情况
- `error` - 影响功能的错误
- `fatal` - 需要立即关注的严重错误

设置一个日志级别将输出该级别及更高级别的所有日志。例如，设置 `LOG_LEVEL=info` 将输出 info、warn、error 和 fatal 日志，但不输出 debug 和 trace 日志。

```

```
