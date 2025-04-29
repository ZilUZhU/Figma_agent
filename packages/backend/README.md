# Figma AI Chat Backend Service

This is the backend service part of the Figma AI Chat project.  
For the full documentation, please refer to the [Main README](../../README.md).

## Backend-Specific Notes

### Environment Variable Configuration

Configure the following variables in a `.env` file:

```
# OpenAI API Key (required)
OPENAI_API_KEY=sk-your-api-key-here

# Port setting (optional, defaults to 3000)
PORT=3000

# Environment setting (optional, defaults to development)
NODE_ENV=development

# Debug request headers (optional, defaults to false)
DEBUG_HEADERS=false

# Log level (optional, defaults to info)
LOG_LEVEL=info
```

### Code Structure

- `src/index.ts` - Service entry point; sets up the Express app and API routes
- `src/routes/` - API route handlers
- `src/services/` - Business logic service layer
- `src/types.ts` - Backend-specific type definitions
- `src/config/` - Configuration files

### AI Model Setting

The default OpenAI model used is `gpt-4.1-2025-04-14`。

### Session Management

The backend manages complete conversation histories, automatically assigns unique session IDs, and includes session expiration cleanup.

### API Endpoints

#### POST /api/chat

Receives chat messages and returns AI responses.

Request Body Format:

```json
{
  "message": "用户消息内容",
  "sessionId": "可选的会话ID"
}
```

Response Format:

```json
{
  "message": "AI助手的回复内容",
  "responseId": "OpenAI响应ID",
  "sessionId": "会话ID"
}
```

#### GET /health

Health check endpoint that returns service status and diagnostic information.

### Logging Levels

The logging system supports the following levels (in increasing order of severity):

- `trace` - Highly detailed debug information (e.g., WebSocket message fragments)
- `debug` - Debug information (detailed process tracing)
- `info` - Key operations and status changes (default for production)
- `warn` - Potential issues or abnormal situations
- `error` - Errors affecting functionality
- `fatal` - Critical errors requiring immediate attention

Setting a log level will output logs at that level and all higher-priority levels. For example, `LOG_LEVEL=info` will output info, warn, error, and fatal logs，but not debug or trace.
