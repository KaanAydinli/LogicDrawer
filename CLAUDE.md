# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogicDrawer is a web-based interactive digital logic circuit designer and simulator with advanced AI-powered features. **Version 1.1.0** (actively developed).

**Core Components**:

- **Frontend**: TypeScript/Vite-based canvas application for visual circuit design and simulation
- **Backend**: Node.js/Express server with MongoDB for user management, circuit storage, and API services
- **AI/ML Stack**:
  - Circuit detection via Python/YOLO v8 model with PyTorch
  - AI assistant powered by Google Gemini 2.5 Flash (with Mistral API as alternative)
  - Tool-based agent system for circuit manipulation and analysis
  - Detection statistics tracking for usage analytics

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
npm run test:detection          # Run YOLO circuit detection tests (requires Python venv)
                                # Uses: ./server/venv/bin/python
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

- `MONGODB_URI`: MongoDB connection string (local or cloud)
- `GOOGLE_API_KEY`: For Gemini 2.5 Flash AI features
- `JWT_SECRET`: Authentication secret (use strong random string)
- `PORT`: Server port (default: 3000)
- `LOGICDRAWER_DEV`: Set to `"true"` to enable console logging (dev mode)

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
   - **Tool-based architecture** with specialized tools located in `src/ai/tools/`:
     - `VerilogImportTool`: Parse and import Verilog HDL code
     - `CircuitDetectionTool`: Detect circuits from hand-drawn images using YOLO
     - `ImageAnalysisTool`: Analyze circuit images using vision models
     - `TruthTableImageTool`: Extract truth tables from images via OCR
     - `KMapImageTool`: Extract and analyze Karnaugh maps from images
     - `AddComponentsTool`: Programmatically add components to circuit board
     - `ConnectComponentsTool`: Auto-connect components with intelligent port selection
     - `GetCircuitSummaryTool`: Get JSON summary of current circuit state
     - `FinalAnswerTool`: Format final responses to users
   - Uses **Google Gemini 2.5 Flash** model with streaming responses
   - Message queue system for conversation history management
   - Rate limit checking for authenticated vs unauthenticated users
   - Image upload and management via `ImageUploader` class

2. **Circuit Suggester** (`src/ai/CircuitSuggester.ts`)
   - **Pattern-based circuit suggestions** (under development)
   - Analyzes current circuit and suggests completions
   - Ghost circuit preview with keyboard shortcuts
   - Pattern library for common circuit structures

3. **Circuit Recognition** (`src/ai/CircuitRecognizer.ts`)
   - Circuit pattern recognition and analysis
   - Component grouping and relationship detection
   - Integration with AI agent for intelligent circuit understanding

4. **Circuit Detection** (`server/detectCircuit.py`)
   - **YOLO-based object detection** model (`best.pt` - 22MB PyTorch model)
   - Detects logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) from images
   - Wire routing using skeletonization and path tracing algorithms
   - Returns JSON with gates and wire connections
   - Python dependencies: `ultralytics`, `opencv-python`, `scikit-image`, `numpy`
   - Runs as a subprocess spawned on-demand from Node.js server

5. **Backend AI Routes** (`server/routes/aiRoutes.ts`)
   - `/api/agent/chat`: Streaming chat endpoint with Gemini 2.5 Flash, supports tool calling
   - `/api/analyze/yolo`: YOLO-based circuit detection from base64 images
   - `/api/generate/gemini-text`: Text generation endpoint with optional streaming
   - `/api/rate-limit-status`: Check AI usage limits
   - **Rate limiting**: Configured via `aiRateLimit` middleware
     - Unauthenticated users: Limited requests per IP
     - Authenticated users: Unlimited access
   - **Detection statistics tracking**: Updates global stats in MongoDB (DetectionStats model)
   - Large payload support (25MB limit for image uploads)
   - Client abort handling for long-running requests

### Server Architecture

1. **Express Server** (`server/index.ts`)
   - **Four main route groups**:
     - `/api/auth`: Authentication (login, signup, JWT-based with cookie storage)
     - `/api/circuits`: Circuit CRUD operations (save, load, delete, list)
     - `/api/stats`: Public statistics endpoint for detection analytics
     - `/api/`: AI features (chat, detection, analysis, generation)
   - **Security**: Helmet, CORS, rate limiting, input sanitization, XSS protection, HPP
   - **MongoDB**: Connection pooling optimized for Railway deployment (5 max, 1 min)
   - **Error handling**: Graceful handling of aborted client requests
   - **Payload limits**:
     - Standard routes: 1MB
     - AI routes (`/api/analyze`, `/api/generate`, `/api/agent`): 25MB for images
   - Serves frontend static files from `dist/`
   - Custom robots.txt and sitemap.xml routes

2. **Data Models** (`server/models/`)
   - **User** (`User.ts`): Authentication, circuit ownership, bcrypt password hashing
   - **Circuit** (`Circuit.ts`): Stored circuit data with metadata, user association
   - **DetectionStats** (`DetectionStats.ts`): Global statistics tracking
     - Tracks total circuits detected and components detected
     - Atomic updates using MongoDB `$inc` operations
     - Singleton document pattern with `_id: "global"`
     - Public endpoint: `/api/stats/detection`

3. **Middleware** (`server/middlewares/`)
   - `security.ts`: Helmet configuration, HPP protection, XSS filters, mongo-sanitize
   - `validation.ts`: Input validation and sanitization
   - `auth.ts`: JWT authentication with **automatic token refresh**
     - `authMiddleware`: Requires valid JWT token
     - `optionalAuth`: Sets user if token present, continues without if absent
     - **Auto-refresh**: Tokens expiring in <30 min are automatically renewed
     - `adminRequired`: Admin role verification
     - `ownerRequired`: Resource ownership verification
   - `aiRateLimit.ts`: Rate limiting for AI features (IP-based for unauthenticated users)

4. **Utilities** (`server/utils/`)
   - `logger.ts`: Custom logger that only outputs in dev mode (`LOGICDRAWER_DEV=true`)
     - Methods: `log()`, `error()`, `warn()`, `info()`
     - Prevents console spam in production

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

- **Test framework**: Vitest with TypeScript support
- **Configuration**:
  - `vite.config.ts`: Main Vite build configuration
  - `vitest.config.ts`: Test-specific configuration
- **Test files** in `tests/` directory:
  - `Detection.test.ts`: **Comprehensive YOLO circuit detection tests**
    - Tests 8 different circuit images (`circuit1.jpg` through `circuit8.jpg`)
    - Validates gate detection accuracy (type, count, position)
    - Validates wire detection and connectivity
    - Expected ranges for gates and wires per circuit
    - 30-second timeout per test to accommodate YOLO processing
    - Base64 image encoding and Python subprocess communication
    - Structured test cases with min/max expectations
  - `VerilogParser.test.ts`: Verilog parsing validation (if exists)
- **Python environment**: Configurable via `PYTHON_EXECUTABLE` env var
- **Test images**: Located in `public/detection/` directory

### Multi-page Application

Vite builds two HTML entry points:

- `index.html`: Landing page
- `logic/index.html`: Main circuit editor application

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

1. Create new tool class in `src/ai/tools/YourTool.ts` implementing `Tool` interface:

   ```typescript
   import { Tool, ToolContext } from "./Tool";

   export class YourTool implements Tool {
     async execute(context: ToolContext): Promise<string> {
       // context.circuitBoard - access to circuit
       // context contains tool parameters passed by Gemini
       // Return JSON string or text response
     }
   }
   ```

2. Export tool from `src/ai/tools/index.ts`
3. Register in `AIAgent.registerTools()` method in `src/ai/AIAgent.ts`
4. Add Gemini function declaration in `AIAgent.getGeminiTools()`
5. Backend endpoint may be needed in `server/routes/aiRoutes.ts` for external operations

**Examples of tool patterns**:

- `AddComponentsTool`: Accepts component array with types and positions, adds to circuit
- `ConnectComponentsTool`: Auto-connects components with intelligent port selection (prefers unconnected inputs, allows fan-out)
- `GetCircuitSummaryTool`: Returns JSON summary of all components and their connection states

### Authentication Flow

1. User logs in via `AuthService.login()` → calls `/api/auth/login`
2. Server returns JWT token
3. Token stored in AuthService and sent with subsequent API requests
4. Protected routes use `auth` or `optionalAuth` middleware

## Technology Stack

- **Frontend**: TypeScript, Vite, HTML Canvas API
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB with Mongoose ODM
- **AI/ML**:
  - Google Gemini 2.5 Flash API (primary AI model)
  - Mistral API (alternative, optional)
  - YOLO v8 (Ultralytics) for circuit detection
  - PyTorch 2.4.1 (CPU-optimized for Railway deployment)
- **Testing**: Vitest
- **Code Quality**: ESLint, Prettier
- **Image Processing**: Python (OpenCV, scikit-image, NumPy)
- **Deployment**: Docker support with optimized Node.js heap (1GB) and connection pooling

## Deployment & Production

### Docker Deployment

The project includes a `Dockerfile` for containerized deployment:

**Key optimizations**:

- **Base Image**: `node:20-slim` for minimal footprint
- **Python ML Stack**: PyTorch CPU-only build (2.4.1) to reduce image size
  - Installed from PyTorch's CPU-specific wheel index
  - Includes Ultralytics, OpenCV (headless), scikit-image, NumPy
- **System dependencies**: `libgl1`, `libglib2.0-0` for OpenCV
- **Build process**:
  1. Install Python dependencies first (better caching)
  2. Build frontend with Vite
  3. Build backend TypeScript to `server/dist/`
  4. Copy Python detection script to dist

**Environment variables for production**:

```dockerfile
NODE_OPTIONS="--max_old_space_size=1024"  # Limit heap to 1GB (Railway optimization)
PYTHONPATH=/app:/app/server               # Python module paths
```

### Railway Deployment Optimizations

**Memory management**:

- Node.js heap limited to 1GB (`NODE_OPTIONS`)
- MongoDB connection pool: 5 max, 1 min (vs default 100 max)
- Request timeouts and abort handling for long-running YOLO processes

**Performance tuning**:

- Python subprocess spawned on-demand (not kept alive)
- Large payload support (25MB) only on AI routes
- Conditional console logging via `LOGICDRAWER_DEV` flag
- Atomic MongoDB operations for statistics (`$inc`)

**Production checklist**:

1. Set `LOGICDRAWER_DEV=false` to disable logging
2. Configure `MONGODB_URI` for production database
3. Add `GOOGLE_API_KEY` for Gemini AI
4. Generate secure `JWT_SECRET` (use `openssl rand -hex 32`)
5. Enable `robots.txt` and `sitemap.xml` routes (already configured)
6. Review security middleware settings in `server/middlewares/security.ts`
