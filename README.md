# FigChat Assistant

An intelligent AI-powered assistant for FigJam that streamlines design ideation, layout planning, and component creation—all through natural language prompts. Powered by GPT-4.1 and seamlessly integrated with Figma’s API, FigChat enables designers to chat, search the web, validate ideas, and generate fully structured templates with a single click—eliminating repetitive tasks and accelerating the creative process.

---

## Problems to be solved

Despite rapid advances in AI—especially with search and web-search capabilities—most “info-rich” models still spit out long, text-heavy responses that aren’t easily visualized or digestible during a brainstorming session. Switching between multiple tools for idea generation and validation interrupts the creative flow and kills productivity. Built-in AI in FigJam often produces empty templates with no real content (and they’re not editable), while existing Figma plugins force you to click through every step and never take initiative.  

**FigChat** addresses these challenges by acting as a proactive AI agent that:
- Generates context-filled, editable FigJam templates in a single step  
- Integrates web research directly into your board, organized into clear sections  
- Takes initiative—automating repetitive setup work so you can focus on creativity

---
## Core Features

- **Multi-Turn Conversations**: Supports full context memory, with conversation history stored on the backend.
- **Session Management**: Automatically assigns a session ID for each conversation, with support for session persistence and expiration.
- **Modern UI**: Clean and minimalistic interface, consistent with Figma's style.
- **Security**: API keys are securely stored on the backend and never exposed to users.
- **Responsiveness**: Real-time display of loading status and responses.
- **Error Handling**: Provides user-friendly error messages and retry mechanisms.
- **Health Monitoring**: Real-time monitoring of service status and session statistics.

## Use Cases

- **Context-Rich Template Generation**  
  “Generate a FigJam workshop board for ‘What can I create for an AI agent,’ complete with well structured section titles, content-filled sticky notes”
- **Web-Powered Research & Ideation**  
  “Pull the latest market trends on ‘remote work tools’ and automatically organize findings into ‘Pros’, ‘Cons’, and ‘Opportunities’ sections.”
- **Interactive Template Customization**  
  “After generating a ‘Sprint Planning’ template, adjust section layouts and rewrite prompts directly in the board to fit your team’s process.”
- **Collaborative Brainstorming Sessions**  
  “During a live FigJam session, ask FigChat for ‘5 creative ice-breaker questions’ and have them appear instantly as sticky notes for the team to discuss.”

---
## Workflow diagram

<img width="1235" alt="Image" src="https://github.com/user-attachments/assets/03717ee4-50b5-498b-b83f-55bfe7cce3d3" />

## Project Structure

This project uses a Monorepo structure:

```
figma-agent/
├── packages/
│   ├── plugin/       # Figma plugin code
│   │   ├── src/      # source code
│   │   └── ...
│   │
│   ├── backend/      # backend service
│   │   ├── src/      # source code
│   │   └── ...
│   │
│   └── common/       # shared code and type
│       ├── types.ts  # shared type
│       └── ...
│
└── ...
```
---
## Architecture Design

### Key Design Decisions

- **Frontend-Backend Separation**: The frontend handles only UI rendering; the backend manages all conversation history and AI communication.
- **Session Management**: Sessions are identified with UUIDs, featuring automatic expiration and cleanup.
- **Stateless Frontend**: The plugin does not store full chat history, ensuring clear separation of concerns.
- **Type Safety**: Shared type definitions guarantee interface consistency between frontend and backend.

---
## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd figma-agent
```

2. Install dependencies

```bash
npm install  # Install root project dependencies
```

3. Set up and run the backend service

```bash
cd packages/backend
npm install
cp .env.example .env  # Then edit .env to fill in your OpenAI API key
npm run dev
```

4. Set up and build the Figma plugin

```bash
cd packages/plugin
npm install
npm run build  # Or use npm run watch for development
```

5. Load the plugin into Figma

- Open the Figma desktop app
- Navigate to Menu → Plugins → Development → Import Plugin
- Select the `manifest.json` file under the project directory


## Quick Development Environment

We provide a simplified development setup script:

```bash
# Run from the project root
npm run dev
```

This will:

- Launch ngrok to create an HTTPS tunnel
- Automatically inject the ngrok URL into the plugin configuration
- Start the backend service
- Start the Figma plugin build watcher

Follow the terminal instructions to load the plugin into Figma.

---
## Technical Implementation

### Plugin (packages/plugin)

- **UI Framework**: Preact + TypeScript
- **UI Components**: [`@create-figma-plugin/ui`](https://www.npmjs.com/package/@create-figma-plugin/ui)
- **Communication**: Communicates with the backend using the `fetch` API
- **State Management**: React Hooks (`useState`, `useEffect`, `useCallback`)
- **Error Handling**: Automatic retry logic and user-friendly error messages

### Backend (packages/backend)

- **Service Framework**: Node.js + Express
- **AI Integration**: OpenAI API (`gpt-4.1-2025-04-14` model)
- **Session Management**: In-memory session storage with automatic expiration cleanup
- **Security**: CORS configuration allowing requests only from Figma domains
- **Environment Configuration**: Environment variables loaded via dotenv
- **Error Handling**: Friendly error responses and logging
- **Monitoring**: Health check API providing memory usage and session statistics

### Shared Code (packages/common)

- **Type Definitions**: Shared TypeScript types between frontend and backend
- **API Contracts**: Defines API request and response formats

## Environment Variable Configuration

### Backend Environment Variables (`.env`)

```bash
# OpenAI API key (required)
OPENAI_API_KEY=sk-your-api-key-here

# Port setting (optional, defaults to 3000)
PORT=3000

# Environment setting (optional, defaults to development)
NODE_ENV=development
```
---
## Troubleshooting

### Plugin Cannot Connect to Backend

- Ensure that the backend service is running properly.
- Check whether the ngrok tunnel is active and functioning.
- Verify that the API base URL configured in `config.ts` matches the ngrok address.

### Session Management Issues

- Sessions are stored temporarily in the plugin’s memory; they will reset when the plugin is closed.
- Backend sessions are set to automatically expire after 24 hours.
- You can monitor active sessions using the health check API endpoint (`/health`).

### OpenAI API Errors

- Confirm that the OpenAI API key is correctly set in the backend environment configuration.
- Ensure that your OpenAI account has sufficient quota and no billing issues.
- Check the backend server logs for detailed error messages and diagnostics.

---

## Contribution Guidelines

We welcome contributions via Pull Requests and Issues!  
Please ensure that your code aligns with the project’s coding standards and passes all relevant tests.

### Coding Standards

- Enable and adhere to **TypeScript strict mode**.
- Follow **functional programming principles** where appropriate.
- Use **clear, meaningful variable and function names**.
- Add **comments** to explain any non-trivial or complex logic.

---
## License

This project is licensed under the [MIT License](LICENSE).

---

## Reference Resources

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Create Figma Plugin Framework Documentation](https://yuanqing.github.io/create-figma-plugin/)

---

## Members

- Yuxi Chen: Product Designer
- Dengyang Xu: Backend Developer, Agent Architect
- Zilu Zhu: Prompt Engineer, Frontend Developer
