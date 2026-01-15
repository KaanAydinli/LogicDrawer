# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogicDrawer is a web-based interactive digital logic circuit designer and simulator with AI-powered features. The application consists of:
- **Frontend**: TypeScript/Vite-based canvas application for circuit design
- **Backend**: Node.js/Express server with MongoDB for user management and circuit storage
- **AI Features**: Circuit detection via Python/YOLO model, AI assistant via Google Gemini/Mistral APIs

## Development Commands

### Frontend Development
```bash
npm run dev              # Start frontend dev server on port 4000
npm run build            # Build frontend (TypeScript + Vite)
npm run preview          # Preview production build
npm run lint             # Run ESLint with auto-fix + type checking
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes
```

### Backend Development
```bash
npm run dev:server       # Start backend dev server (ts-node-dev)
cd server && npm run dev # Alternative: run from server directory
cd server && npm run build # Build backend TypeScript
```

### Combined Development
```bash
npm run dev:all          # Run frontend + backend concurrently
npm run dev:network      # Same but expose frontend to network
npm run build:all        # Build both frontend and backend
```

### Testing
```bash
npm test                        # Run all tests with Vitest
npm run test:detection          # Run circuit detection tests
npm run test:detection-runner   # Run detection test runner
```

### Python Environment (AI Features)
```bash
cd server
python3 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Environment Setup
Copy `server/.env.example` to `server/.env` and configure:
- `MONGODB_URI`: MongoDB connection string
- `GOOGLE_API_KEY`: For Gemini AI features
- `MISTRAL_API_KEY`: Alternative AI provider
- `JWT_SECRET`: Authentication secret
- `PORT`: Server port (default: 3000)

## Architecture

### Core Design Pattern

LogicDrawer uses an **object-oriented component-based architecture** where all circuit elements inherit from a base `Component` class:

1. **Component Hierarchy**
   - `Component` (abstract base class): Defines position, size, ports (inputs/outputs), rotation
   - `LogicGate`: Base class for all logic gates (AND, OR, NOT, XOR, etc.)
   - Specialized gates in `src/models/gates/`: Basic gates, multiplexers, adders, subtractors, decoders
   - Sequential elements in `src/models/Sequential/`: D-latches, D flip-flops
   - I/O components in `src/models/components/`: Switches, buttons, LEDs, displays, clock generators

2. **Wire and Port System**
   - `Wire` class connects `Port` objects between components
   - Ports have `type` (input/output), `bitWidth`, `value` (boolean or BitArray)
   - Wires support control points for routing, multi-bit values
   - Bit width validation ensures compatible connections

3. **CircuitBoard (Main Controller)**
   - Located at `src/models/CircuitBoard.ts` (~2700 lines)
   - Manages all components and wires in the circuit
   - Handles canvas rendering, zoom/pan, minimap
   - Implements simulation engine (signal propagation)
   - Manages user interactions: drag-drop, selection, wire routing
   - Coordinates with utility classes:
     - `ActionHistory`: Undo/redo functionality
     - `TruthTableManager`: Generate truth tables from circuits
     - `KarnaughMap`: K-map generation and analysis
     - `GatePanel`: Properties panel for gate configuration

4. **Main Application Entry**
   - `src/main.ts` (~2335 lines): Application initialization, event handlers, UI controllers
   - Sets up CircuitBoard, AIAgent, authentication, repository
   - Manages toolbar, gate panel, AI chat interface
   - Handles file import/export (JSON, Verilog, PNG)

### AI Integration

1. **AIAgent System** (`src/ai/AIAgent.ts`)
   - Tool-based architecture with specialized tools:
     - `VerilogImportTool`: Parse and import Verilog HDL
     - `CircuitDetectionTool`: Detect circuits from hand-drawn images
     - `ImageAnalysisTool`: Analyze circuit images
     - `TruthTableImageTool`: Extract truth tables from images
     - `KMapImageTool`: Extract K-maps from images
     - `CircuitFixTool`: Auto-fix circuit issues
   - Uses streaming responses from Google Gemini API
   - Message queue system for conversation history

2. **Circuit Detection** (`server/detectCircuit.py`)
   - YOLO-based object detection model (`best.pt`)
   - Detects logic gates, wires, and connections from images
   - Wire routing using skeletonization and path tracing
   - Returns JSON representation of detected circuits

3. **Backend AI Routes** (`server/routes/aiRoutes.ts`)
   - `/api/chat`: Streaming chat endpoint with tool calling
   - `/api/detect-circuit`: Upload image for circuit detection
   - `/api/rate-limit-status`: Check AI usage limits
   - Rate limiting for unauthenticated users, unlimited for authenticated

### Server Architecture

1. **Express Server** (`server/index.ts`)
   - Three main route groups:
     - `/api/auth`: Authentication (login, signup, JWT-based)
     - `/api/circuits`: Circuit CRUD operations (save, load, delete)
     - `/api/`: AI features (chat, detection, analysis)
   - Security: Helmet, CORS, rate limiting, input sanitization, XSS protection
   - Serves frontend static files from `dist/`

2. **Data Models** (`server/models/`)
   - User model: Authentication, circuit ownership
   - Circuit model: Stored circuit data with metadata

3. **Middleware** (`server/middlewares/`)
   - `security.ts`: Helmet, HPP, XSS filters, sanitization
   - `validation.ts`: Input validation
   - `auth.ts`: JWT authentication
   - `aiRateLimit.ts`: Rate limiting for AI features

### Frontend Services

Located in `src/services/`:
- `CircuitService.ts`: API calls for circuit CRUD operations
- `AuthService.ts`: Singleton service for authentication state
- `apiConfig.ts`: Base URL configuration

### Repository Pattern

`src/Repository/CircuitRepositoryController.ts`: Manages circuit storage, both local (browser storage) and remote (server API). Handles circuit versioning and synchronization.

## Key Development Notes

### Working with Components

When adding new circuit components:
1. Extend `Component` or `LogicGate` class
2. Implement `evaluate()` method for logic simulation
3. Define input/output ports with correct bit widths
4. Implement `draw()` method for canvas rendering
5. Add to component factory in `CircuitBoard.ts`
6. Update gate panel registration in `main.ts`

### Circuit Simulation

Simulation happens in `CircuitBoard.simulate()`:
- Topological sort to determine evaluation order
- Components evaluate inputs and update outputs
- Signal propagation through wires
- Multi-bit values supported via `BitArray` type

### Verilog Support

`src/models/utils/VerilogParser.ts` and `VerilogCircuitConverter.ts`:
- Parse Verilog HDL module definitions
- Convert to LogicDrawer component graph
- Export circuits to Verilog format

### Testing Strategy

- Unit tests in `tests/` directory
- Vitest configuration in `vite.config.ts` and `vitest.config.ts`
- `Detection.test.ts`: Tests for circuit detection accuracy
- `VerilogParser.test.ts`: Verilog parsing validation

### Multi-page Application

Vite builds two HTML entry points:
- `index.html`: Landing page
- `logic.html`: Main circuit editor application

Both defined in `vite.config.ts` rollup options.

## Common Patterns

### Adding a New Logic Gate

1. Create file in `src/models/gates/YourGate.ts`
2. Extend `LogicGate` class
3. Implement constructor, `evaluate()`, and optionally custom `draw()`
4. Import and register in `CircuitBoard.ts` component factory
5. Add to gate panel in `main.ts`

### Modifying Simulation Logic

Main simulation loop is in `CircuitBoard.simulate()`. Key methods:
- `evaluateDependencies()`: Build dependency graph
- Component's `evaluate()`: Process inputs → outputs
- Wire value propagation happens automatically after evaluation

### Extending AI Tools

1. Create new tool class in `src/ai/Tools.ts` implementing `Tool` interface
2. Add tool registration in `AIAgent.registerTools()`
3. Backend may need corresponding endpoint in `server/routes/aiRoutes.ts`

### Authentication Flow

1. User logs in via `AuthService.login()` → calls `/api/auth/login`
2. Server returns JWT token
3. Token stored in AuthService and sent with subsequent API requests
4. Protected routes use `auth` or `optionalAuth` middleware

## Technology Stack

- **Frontend**: TypeScript, Vite, HTML Canvas API
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB with Mongoose ODM
- **AI/ML**: Google Gemini API, Mistral API, YOLO (Ultralytics), PyTorch
- **Testing**: Vitest
- **Code Quality**: ESLint, Prettier
- **Image Processing**: Python (OpenCV, scikit-image)
