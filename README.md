# Figma AI Chat 助手

一个 Figma/FigJam 插件，提供嵌入式聊天界面，让用户可以在设计环境内直接与 AI (通过 OpenAI API) 进行多轮对话。

## 项目结构

本项目采用 Monorepo 结构：

```
figma-agent/
├── packages/
│   ├── plugin/       # Figma 插件代码
│   │   ├── src/      # 源代码
│   │   └── ...
│   │
│   ├── backend/      # 外部后端服务
│   │   ├── src/      # 源代码
│   │   └── ...
│   │
│   └── common/       # 共享代码和类型定义
│       ├── types.ts  # 共享类型
│       └── ...
│
└── ...
```

## 核心特性

- **多轮对话**: 支持完整的上下文记忆
- **现代 UI**: 干净简洁的用户界面，与 Figma 风格一致
- **安全**: API 密钥存储在后端服务，不会暴露给用户
- **响应式**: 实时显示加载状态和回复
- **错误处理**: 提供友好的错误信息和重试机制

## 快速开始

1. 克隆项目

```bash
git clone <repository-url>
cd figma-agent
```

2. 安装依赖

```bash
npm install  # 安装根项目依赖
```

3. 设置和运行后端服务

```bash
cd packages/backend
npm install
cp .env.example .env  # 然后编辑 .env 填入你的 OpenAI API 密钥
npm run dev
```

4. 设置和构建 Figma 插件

```bash
cd packages/plugin
npm install
npm run build  # 或使用 npm run watch 进行开发
```

5. 将插件加载到 Figma

- 打开 Figma 桌面应用
- 选择菜单 → 插件 → 开发 → 导入插件
- 选择项目目录下的 `manifest.json` 文件

## 快速开发环境

我们提供了一个简化的开发环境设置脚本：

```bash
# 在项目根目录执行
npm run dev
```

这将:

- 启动 ngrok 创建 HTTPS 隧道
- 将 ngrok URL 自动注入到插件配置
- 启动后端服务
- 启动 Figma 插件构建监听

然后按照终端中的说明在 Figma 中加载插件。

## 技术实现

### 插件部分 (packages/plugin)

- **UI 框架**: Preact + TypeScript
- **UI 组件**: `@create-figma-plugin/ui`
- **通信**: 通过 `fetch` API 与后端服务通信
- **状态管理**: React Hooks (useState, useEffect, useCallback)
- **错误处理**: 自动重试逻辑和用户友好错误提示

### 后端部分 (packages/backend)

- **服务框架**: Node.js + Express
- **AI 集成**: OpenAI API (`gpt-4o` 模型)
- **安全**: CORS 配置，仅允许来自 Figma 域的请求
- **环境配置**: 通过 dotenv 加载环境变量
- **错误处理**: 友好的错误响应和日志记录

### 共享部分 (packages/common)

- **类型定义**: 在前后端之间共享的 TypeScript 类型
- **接口约定**: 定义了 API 请求和响应的格式

## 环境变量配置

### 后端环境变量 (.env)

```
# OpenAI API密钥（必需）
OPENAI_API_KEY=sk-your-api-key-here

# 端口设置（可选，默认为3000）
PORT=3000

# 环境设置（可选，默认为development）
NODE_ENV=development
```

## 常见问题解决

### 插件无法连接到后端

- 确保后端服务正在运行
- 检查 ngrok 隧道是否正常工作
- 在插件的 `config.ts` 中验证 API 基础 URL 是否正确

### OpenAI API 错误

- 检查 API 密钥是否正确
- 确认 API 密钥额度是否充足
- 查看后端服务的控制台日志以获取详细错误信息

## 贡献指南

欢迎提交 Pull Requests 和 Issues! 请确保您的代码符合项目的代码风格并通过所有测试。

### 代码风格

- 使用 TypeScript 的严格模式
- 遵循函数式编程原则
- 使用有意义的变量名和函数名
- 添加适当的注释说明复杂逻辑

## 许可

MIT

---

## 参考资源

- [Figma 插件 API 文档](https://www.figma.com/plugin-docs/)
- [OpenAI API 文档](https://platform.openai.com/docs/)
- [Create Figma Plugin 框架](https://yuanqing.github.io/create-figma-plugin/)
