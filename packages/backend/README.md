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
- `src/types.ts` - 后端特定类型定义

### API 端点

#### POST /api/chat

接收聊天消息并返回 AI 回复。

请求体格式:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是一个帮助设计师的AI助手"
    },
    {
      "role": "user",
      "content": "用户消息内容"
    }
  ]
}
```

响应格式:

```json
{
  "message": "AI助手的回复内容"
}
```

#### GET /health

健康检查端点，返回服务状态。

响应格式:

```json
{
  "status": "ok"
}
```
