# Figma AI Chat Plugin

This is the plugin part of the Figma AI Chat project.  
For the full documentation, please refer to the [Main README](../../README.md).

## Plugin-Specific Notes

### Code Structure

- `src/main.ts` – Plugin logic, runs inside the Figma sandbox environment
- `src/ui.tsx` – Plugin UI, built with Preact
- `src/services/api.ts` – Service layer responsible for backend API communication
- `src/hooks/useChatConnection.ts` – Hook for managing chat connection states
- `src/types.ts` – Plugin-specific type definitions
- `src/config.ts` – Configuration file, including API endpoints and settings

### Architecture Highlights

- **Stateless Frontend**: The plugin only handles UI display and user interactions; it does not store full chat history.
- **Session Management**: Maintains conversation continuity using a session ID assigned by the backend.
- **Error Handling**: Automatic connection retries and user-friendly error messages.
- **Responsive UI**: Real-time display of connection and message loading statuses.

### Development Tips

- To modify the UI, mainly edit `ui.tsx`.
- To modify plugin logic, edit `main.ts`.
- For style adjustments, modify `ChatStyles.module.css`.
- API communication logic is centralized in `services/api.ts`.

### Common Issues

- If you encounter connection problems, ensure that the backend service is running properly.
- Figma plugins must connect to the backend via HTTPS; make sure to expose the backend using tools like ngrok.
- Session IDs are stored in plugin memory and will be lost after closing the plugin (consider using local storage if needed).

## Features

- Provides an embedded chat interface within Figma/FigJam
- Supports multi-turn conversations (managed via backend sessions)
- Clean and minimalistic user interface
- Real-time loading status display
- Connection status indicator

## Development

### Prerequisites

- Node.js (v18+)
- Figma Desktop App (for testing)

### Install Dependencies

```bash
cd packages/plugin
npm install
```

### Start Development Mode

```bash
npm run watch
```

### Load the Plugin in Figma

1. Open the Figma Desktop App
2. Navigate to Menu → Plugins → Development → Import Plugin
3. Select the `manifest.json` file located in the project root directory

The plugin will then appear in your Figma development plugin list.

## Build

Build the production version:

```bash
npm run build
```

The built files will be output to the `build` directory.

## Deployment
<!-- TODO: We may not need this part -->

要发布到 Figma 社区，请按照 [官方文档](https://help.figma.com/hc/en-us/articles/360042293394-Publish-plugins-and-widgets-to-the-Community) 进行操作。

## Notes

This plugin relies on a separately running backend service to handle communication with the OpenAI API.
Please ensure you have set up and are running the backend according to the instructions in the `packages/backend` directory.
