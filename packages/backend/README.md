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

后端负责管理完整的对话历史记录，自动为每个会话分配唯一ID，并提供会话过期清理机制。

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

```
