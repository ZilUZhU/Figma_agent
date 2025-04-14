# Figma AI Chat 插件

这是 Figma AI Chat 项目的插件部分。完整文档请参阅[主 README](../../README.md)。

## 插件特定说明

### 代码结构

- `src/main.ts` - 插件逻辑，运行在 Figma 沙箱环境中
- `src/ui.tsx` - 插件 UI 界面，使用 Preact 构建
- `src/services/api.ts` - 负责与后端 API 通信的服务层
- `src/types.ts` - 插件特定类型定义
- `src/config.ts` - 配置文件，包含 API 端点等

### 开发提示

- 修改 UI 时，主要编辑`ui.tsx`文件
- 处理插件逻辑时，编辑`main.ts`文件
- 调整样式可通过`ChatStyles.module.css`文件
- API 调用逻辑集中在`services/api.ts`文件

### 常见问题

- 如遇连接问题，请检查后端服务是否正常运行
- Figma 插件只能通过 HTTPS 连接后端，确保使用 ngrok 等工具暴露后端服务

## 功能

- 在 Figma/FigJam 中提供嵌入式聊天界面
- 支持多轮对话
- 干净简洁的用户界面
- 实时加载状态显示

## 开发

### 先决条件

- Node.js (v18+) 和 npm
- Figma 桌面应用（用于测试）

### 安装依赖

```bash
cd packages/plugin
npm install
```

### 启动开发模式

```bash
npm run watch
```

### 在 Figma 中加载插件

1. 打开 Figma 桌面应用
2. 选择菜单 → 插件 → 开发 → 导入插件
3. 选择项目根目录下的 `manifest.json` 文件

插件将出现在您的 Figma 插件开发列表中。

## 构建

构建生产版本：

```bash
npm run build
```

构建的文件将位于 `build` 目录中。

## 部署

要发布到 Figma 社区，请按照 [官方文档](https://help.figma.com/hc/en-us/articles/360042293394-Publish-plugins-and-widgets-to-the-Community) 进行操作。

## 注意

该插件依赖于单独运行的后端服务来处理与 OpenAI API 的通信。请确保按照 `packages/backend` 目录中的说明设置和运行后端服务。
