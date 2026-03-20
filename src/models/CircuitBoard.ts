import { Component, Point, Port, GRID_SIZE } from "./Component";
import { Wire } from "./Wire";
import { AndGate } from "./gates/AndGate";
import { OrGate } from "./gates/OrGate";
import { NotGate } from "./gates/NotGate";
import { ToggleSwitch } from "./components/ToggleSwitch";
import { LightBulb } from "./components/LightBulb";
import { XorGate } from "./gates/XorGate";
import { NorGate } from "./gates/NorGate";
import { XnorGate } from "./gates/XnorGate";
import { NandGate } from "./gates/NandGate";
import { Mux2 } from "./gates/Mux2";
import { Mux4 } from "./gates/Mux4";
import { Button } from "./components/Button";
import { Constant1 } from "./components/Constant1";
import { Constant0 } from "./components/Constant0";
import { Clock } from "./components/Clock";
import { DLatch } from "./Sequential/DLatch";
import { DFlipFlop } from "./Sequential/DFlipFlop";
import { Decoder } from "./gates/Decoder";
import { BufferGate } from "./gates/BufferGate";
import { HexDigit } from "./components/HexDigit";
import { Text } from "./other/Text";
import { LogicGate } from "./LogicGate";
import { State } from "./other/State";
import { HalfAdder } from "./gates/HalfAdder";
import { FullAdder } from "./gates/FullAdder";
import { HalfSubtractor } from "./gates/HalfSubtractor";
import { FullSubtractor } from "./gates/FullSubtractor";
import { Led } from "./components/Led";
import { MultiBit } from "./components/MultiBit";
import { GatePanel } from "./utils/GatePanel";
import { TruthTableManager } from "./utils/TruthTableManager";
import { KarnaughMap } from "./utils/KarnaughMap";
import { ActionHistory } from "./utils/ActionHistory";
import { SmartDisplay } from "./components/SmartDisplay";
import { Logger } from "../utils/logger";

export class CircuitBoard {
  components: Component[];
  wires: Wire[];
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  minimapCtx: CanvasRenderingContext2D;
  selectedComponent: Component | null;
  draggedComponent: Component | null;
  selectedWire: Wire | null;
  dragOffset: Point;
  currentWire: Wire | null;
  grid: boolean;
  public scale = 1;
  public offsetX = 0;
  public offsetY = 0;
  isDraggingCanvas = false;
  lastMouseX = 0;
  lastMouseY = 0;
  public minimapWidth = 200;
  public minimapHeight = 200;
  private truthTableManager: TruthTableManager;

  private selectionRect: { start: Point; end: Point } | null = null;
  private isSelecting = false;
  public selectedComponents: Component[] = [];
  private gatePropertiesPanel: GatePanel;
  private dragStartPositions = new Map<string, Point>();

  // Wire control point drag state
  private draggingWire: Wire | null = null;
  private draggingCPIndex: number | null = null;

  public clipboard: string | null = null;

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
    this.components = [];
    this.wires = [];
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.selectedComponent = null;
    this.draggedComponent = null;
    this.selectedWire = null;
    this.dragOffset = { x: 0, y: 0 };
    this.currentWire = null;
    this.grid = true;
    this.minimap = minimap || null;

    this.selectedComponents = [];
    this.truthTableManager = new TruthTableManager(this);

    this.gatePropertiesPanel = new GatePanel(this, "properties-panel-container", () => {
      this.simulate();
      this.draw();
    });

    if (this.minimap) {
      this.minimapCtx = this.minimap.getContext("2d") as CanvasRenderingContext2D;
      this.setupMinimap();
    } else this.minimapCtx = null as any;

    this.setupCanvas();
    this.setupEvents();
  }

  private setupCanvas(): void {
    this.resizeCanvas();
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }
  private applyTransform() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }

  private handleDoubleClick(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);
    this.selectedComponent = null;

    // ── Wire control point removal on double-click ──
    for (const wire of this.wires) {
      if (wire.controlPoints.length > 0) {
        const cpIdx = wire.getControlPointAt(mousePos);
        if (cpIdx !== null) {
          wire.removeControlPoint(cpIdx);
          ActionHistory.saveState(this.exportCircuit());
          this.draw();
          return;
        }
      }
    }

    for (const component of this.components) {
      if (component.type === "text" && component.containsPoint(mousePos)) {
        const textComponent = component as Text;
        if (typeof textComponent.onDoubleClick === "function") {
          textComponent.onDoubleClick(mousePos, this.canvas);
          this.draw();
        }
        return;
      }
      if (component.type === "clock" && component.containsPoint(mousePos)) {
        const textComponent = component as Clock;
        if (typeof textComponent.onDoubleClick === "function") {
          textComponent.onDoubleClick(mousePos, this.canvas);
          this.draw();
        }
        return;
      }
      if (component.containsPoint(mousePos)) {
        const logic = component as LogicGate;
        if (
          logic.type !== "mux2" &&
          logic.type !== "mux4" &&
          logic.type !== "state" &&
          typeof logic.rotate === "function"
        ) {
          logic.rotate(1);
          this.draw();
        }
        return;
      }
    }
  }
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      return;
    }

    const keyboardEventTarget = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;
    const isInAIChat =
      keyboardEventTarget?.closest("#ai-chat-container") ||
      activeElement?.closest("#ai-chat-container");
    if (isInAIChat) {
      return;
    }

    const modifierPressed = event.ctrlKey || event.metaKey;

    if (modifierPressed && event.key === "d") {
      event.preventDefault();
      this.saveToFile();
    } else if (modifierPressed && event.key === "o") {
      event.preventDefault();

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.loadFromFile(file);
      };
      input.click();
    } else if (modifierPressed && event.key === "e") {
      event.preventDefault();
      const verilogCode = this.extractVerilog();
      this.saveVerilogToFile(verilogCode);
    } else if (event.altKey && event.key === "s") {
      event.preventDefault();
      this.takeScreenshot();
    }

    // Editing operations
    else if (event.key === "Delete" || event.key === "Backspace") {
      // If a wire is selected and has a selected control point, delete the CP only
      if (this.selectedWire && this.selectedWire.selectedPointIndex !== null) {
        this.selectedWire.removeControlPoint(this.selectedWire.selectedPointIndex);
        this.selectedWire.selectedPointIndex = null;
        ActionHistory.saveState(this.exportCircuit());
        this.draw();
      } else {
        this.deleteSelected();
      }
    } else if (event.key === "Escape") {
      // Clear all selections
      if (this.selectedWire) {
        this.selectedWire.selected = false;
        this.selectedWire = null;
        this.draw();
      }
    } else if (modifierPressed && event.key === "a") {
      event.preventDefault();
      this.selectAllComponents();
    } else if (modifierPressed && event.key === "g") {
      event.preventDefault();
      this.toggleGrid();
    } else if (modifierPressed && event.key === "c") {
      event.preventDefault();
      this.copySelected();
    } else if (modifierPressed && event.key === "v") {
      event.preventDefault();
      this.paste();
    } else if (modifierPressed && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      const json = ActionHistory.undo();
      if (json != null) this.importCircuit(json);
    } else if (
      (modifierPressed && event.key === "y") ||
      (modifierPressed && event.shiftKey && event.key === "Z")
    ) {
      event.preventDefault();
      const json = ActionHistory.redo();
      if (json != null) this.importCircuit(json);
    }

    // View controls
    else if (event.key === "+" || event.key === "=") {
      this.zoomIn();
    } else if (event.key === "-") {
      this.zoomOut();
    } else if (event.key === "0") {
      this.resetZoom();
    }

    // Simulation controls
    else if (event.key === "F5") {
      event.preventDefault();
      this.simulate();
    } else if (event.key === "t") {
      this.generateTruthTable();
    } else if (event.key === "k") {
      this.showKarnaughMap();
    } else if (event.key === "a") {
      this.autoArrangeCircuit();
    }

    // Component manipulation
    else if (event.key === "r" && this.selectedComponent) {
      const logic = this.selectedComponent as LogicGate;
      if (typeof logic.rotate === "function") {
        logic.rotate(1);
        this.draw();
      }
    }
    // Wire routing reset
    else if (event.key === "r" && this.selectedWire) {
      if (this.selectedComponents.length > 0) {
        this.selectedWire.forceAutoRoute(this.components);
      }
      this.draw();
    }
  }

  private handleKeyUp(_event: KeyboardEvent): void {
    // Currently no key up handling needed
  }

  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();

    const mousePos = this.getMousePosition(event);

    for (let i = this.wires.length - 1; i >= 0; i--) {
      const wire = this.wires[i];
      if (wire.isNearPoint(mousePos)) {
        return;
      }
    }

    // Handle other context menu items if needed
  }

  // Add this method to select all components
  private selectAllComponents(): void {
    this.selectedComponents = [...this.components];
    this.components.forEach(component => {
      component.selected = true;
    });
    this.draw();
  }

  private setupEvents(): void {
    // Existing mouse event handlers
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
    this.canvas.addEventListener("click", this.handleClick.bind(this));
    this.canvas.addEventListener("contextmenu", this.handleContextMenu.bind(this));

    // Add touch event handlers
    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this));
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));

    // Add keyboard event listeners
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  // Touch gesture state tracking
  private touchState = {
    touchCount: 0,
    initialDistance: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    isPinching: false,
    isPanning: false,
    touchStartTime: 0,
    initialTouches: [] as Touch[],
  };

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault(); // Prevent scrolling/zooming the page

    const touches = event.touches;
    this.touchState.touchCount = touches.length;
    this.touchState.touchStartTime = Date.now();
    this.touchState.initialTouches = Array.from(touches);
    this.isSelecting = false;

    if (touches.length === 1) {
      // Single touch - convert to mouse event for component interaction
      const touch = touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      this.touchState.lastTouchX = touchX;
      this.touchState.lastTouchY = touchY;

      // Convert touch to mouse position and call existing handler
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      this.handleMouseDown(mouseEvent);
    } else if (touches.length === 2) {
      // Two-finger gesture - setup for pinch/zoom or pan
      this.touchState.isPinching = true;
      this.touchState.isPanning = true;

      // Calculate initial distance for pinch/zoom
      const touch1 = touches[0];
      const touch2 = touches[1];
      this.touchState.initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      // Calculate midpoint for panning
      this.touchState.lastTouchX = (touch1.clientX + touch2.clientX) / 2;
      this.touchState.lastTouchY = (touch1.clientY + touch2.clientY) / 2;
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    this.isSelecting = false; // Disable selection during touch move
    const touches = event.touches;

    if (touches.length === 1 && !this.touchState.isPinching) {
      // Single touch - handle as mouse move
      const touch = touches[0];

      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      this.handleMouseMove(mouseEvent);
    } else if (touches.length === 2) {
      // Handle two-finger gestures
      const touch1 = touches[0];
      const touch2 = touches[1];

      // Calculate current distance between touch points
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      // Calculate midpoint of touches
      const midpointX = (touch1.clientX + touch2.clientX) / 2;
      const midpointY = (touch1.clientY + touch2.clientY) / 2;

      // Handle pinch/zoom
      if (this.touchState.isPinching) {
        const distanceChange = currentDistance / this.touchState.initialDistance;

        if (distanceChange > 1.05) {
          // Zooming in
          this.zoomIn(midpointX, midpointY);
          this.touchState.initialDistance = currentDistance;
        } else if (distanceChange < 0.95) {
          // Zooming out
          this.zoomOut(midpointX, midpointY);
          this.touchState.initialDistance = currentDistance;
        }
      }

      // Handle panning with two fingers
      if (this.touchState.isPanning) {
        const deltaX = midpointX - this.touchState.lastTouchX;
        const deltaY = midpointY - this.touchState.lastTouchY;

        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          this.panCanvas(deltaX, deltaY);
          this.touchState.lastTouchX = midpointX;
          this.touchState.lastTouchY = midpointY;
        }
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();

    this.draggedComponent = null; // Clear dragged component on touch end
    this.isSelecting = false;
    const touch = event.changedTouches[0];

    if (this.currentWire && event.changedTouches.length > 0) {
      // Convert to world coordinates
      const worldPos = this.getTransformedMousePosition(touch.clientX, touch.clientY);

      Logger.log("Touch end at world position:", worldPos);

      const TOUCH_RADIUS = 30;

      let foundPort = null;
      for (const component of this.components) {
        const port = component.getPortAtPositionRadius(worldPos, TOUCH_RADIUS);
        if (port) {
          Logger.log("Found port for connection:", port);
          foundPort = port;
          break;
        }
      }

      if (foundPort) {
        // Prevent connecting to the same component
        if (this.currentWire.from?.component === foundPort.component) {
          this.currentWire = null;
          this.draw();
          return;
        }

        // Prevent connecting to an already connected input port
        if (foundPort.type === "input" && foundPort.isConnected) {
          this.currentWire = null;
          this.draw();
          return;
        }

        // Prevent connecting input-to-input
        if (
          foundPort.type === "input" &&
          this.currentWire.from &&
          this.currentWire.from.type === "input"
        ) {
          this.currentWire = null;
          this.draw();
          return;
        }

        const success = this.currentWire.connect(foundPort);
        if (success) {
          Logger.log("Connection successful! Adding wire to list.");
          foundPort.isConnected = true;
          this.wires.push(this.currentWire);
          this.currentWire.autoRoute(this.components);
          this.currentWire = null;
          this.simulate();
        } else {
          Logger.log("Connection failed!");
          this.currentWire = null;
        }
      } else {
        Logger.log("No port found at touch end, clearing wire");
        this.currentWire = null;
      }
      this.draw();
    }

    for (const component of this.components) {
      if (component.type === "button") {
        if (
          component.containsPoint(this.getTransformedMousePosition(touch.clientX, touch.clientY))
        ) {
          (component as any).onMouseUp();
          this.simulate();
          this.draw();
          return;
        }
      }
    }
    // Reset touch state
    this.touchState.touchCount = 0;
    this.touchState.isPinching = false;
    this.touchState.isPanning = false;

    // If this was a quick tap, handle as click
    const touchDuration = Date.now() - this.touchState.touchStartTime;
    if (
      touchDuration < 200 &&
      event.touches.length === 0 &&
      this.touchState.initialTouches.length === 1
    ) {
      const initialTouch = this.touchState.initialTouches[0];
      const mouseEvent = new MouseEvent("click", {
        clientX: initialTouch.clientX,
        clientY: initialTouch.clientY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      this.handleClick(mouseEvent);
    }
  }

  addComponent(component: Component): void {
    this.components.push(component);
    ActionHistory.saveState(this.exportCircuit());
    this.draw();
  }

  public autoArrangeCircuit(): void {
    if (this.components.length === 0) {
      Logger.log("There are no components to arrange.");
      return;
    }

    this.snapAllComponentsToGrid();

    this.organizeCircuitLayout();

    this.rerouteAllWires();

    this.simulate();
    this.draw();

    Logger.log("Circuit arrangement completed.");
  }

  private snapAllComponentsToGrid(): void {
    const gridSize = 16;

    this.components.forEach(component => {
      const currentPos = component.position;

      const newX = Math.round(currentPos.x / gridSize) * gridSize;
      const newY = Math.round(currentPos.y / gridSize) * gridSize;

      component.move({ x: newX, y: newY });
    });
  }

  private organizeCircuitLayout(): void {
    const inputComponents: Component[] = [];
    const logicGateComponents: Component[] = [];
    const outputComponents: Component[] = [];
    const otherComponents: Component[] = [];

    this.components.forEach(component => {
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "constant0" ||
        component.type === "constant1" ||
        component.type === "clock"
      ) {
        inputComponents.push(component);
      } else if (
        component.type === "light-bulb" ||
        component.type === "hex" ||
        component.type === "led"
      ) {
        outputComponents.push(component);
      } else if (component.type !== "text" && component.type !== "state") {
        logicGateComponents.push(component);
      } else {
        otherComponents.push(component);
      }
    });

    this.organizeComponentsInColumn(inputComponents, 100, 100, 80);

    this.organizeLogicGatesByLayers(logicGateComponents, 300);

    this.organizeComponentsInColumn(outputComponents, 800, 100, 80);

    this.organizeComponentsInColumn(otherComponents, 50, 500, 100);

    Logger.log("Circuit layout optimized.");
  }

  private organizeComponentsInColumn(
    components: Component[],
    startX: number,
    startY: number,
    spacing: number
  ): void {
    components.forEach((component, index) => {
      component.move({ x: startX, y: startY + index * spacing });
    });
  }

  private organizeLogicGatesByLayers(components: Component[], startX: number): void {
    const gateLayers = this.analyzeGateLayers(components);

    Object.keys(gateLayers).forEach(layerIndex => {
      const layerComponents = gateLayers[parseInt(layerIndex)];
      const layerX = startX + parseInt(layerIndex) * 150;

      layerComponents.forEach((component, index) => {
        component.move({ x: layerX, y: 150 + index * 100 });
      });
    });
  }

  private analyzeGateLayers(gates: Component[]): Record<number, Component[]> {
    const layeredGates: Record<number, Component[]> = { 0: [] };
    const assignedGates = new Set<string>();

    gates.forEach(gate => {
      const hasInputOnly = this.hasInputsOnlyFromInputComponents(gate);
      if (hasInputOnly) {
        layeredGates[0].push(gate);
        assignedGates.add(gate.id);
      }
    });

    let currentLayer = 0;
    let allAssigned = false;

    while (!allAssigned) {
      let somethingChanged = false;
      const nextLayer = currentLayer + 1;

      if (!layeredGates[nextLayer]) {
        layeredGates[nextLayer] = [];
      }

      gates.forEach(gate => {
        if (assignedGates.has(gate.id)) return;

        const allInputsAssigned = this.areAllInputsAssigned(
          gate,
          assignedGates,
          currentLayer,
          layeredGates
        );

        if (allInputsAssigned) {
          layeredGates[nextLayer].push(gate);
          assignedGates.add(gate.id);
          somethingChanged = true;
        }
      });

      if (!somethingChanged) {
        gates.forEach(gate => {
          if (!assignedGates.has(gate.id)) {
            layeredGates[nextLayer].push(gate);
            assignedGates.add(gate.id);
          }
        });
        allAssigned = true;
      }

      currentLayer = nextLayer;
    }

    return layeredGates;
  }

  private areAllInputsAssigned(
    gate: Component,
    assignedGates: Set<string>,
    currentLayer: number,
    layeredGates: Record<number, Component[]>
  ): boolean {
    const inputConnections = this.getInputConnections(gate);

    if (inputConnections.length === 0) return true;

    for (const sourceGate of inputConnections) {
      if (!assignedGates.has(sourceGate.id)) {
        return false;
      }

      let foundInPreviousLayers = false;
      for (let layer = 0; layer <= currentLayer; layer++) {
        if (layeredGates[layer] && layeredGates[layer].some(g => g.id === sourceGate.id)) {
          foundInPreviousLayers = true;
          break;
        }
      }

      if (!foundInPreviousLayers) {
        return false;
      }
    }

    return true;
  }
  public generateTruthTable(): void {
    try {
      const ioCount = this.truthTableManager.identifyIOComponents();

      if (ioCount.inputs === 0) {
        alert(
          "There needs to be at least one input component (toggle, button, constant) in the circuit to generate a truth table."
        );
        return;
      }

      if (ioCount.outputs === 0) {
        alert(
          "There needs to be at least one output component (light-bulb, led, hex) in the circuit to generate a truth table."
        );
        return;
      }

      if (ioCount.inputs > 10) {
        const confirmed = confirm(
          `${ioCount.inputs} inputs will be calculated for ${Math.pow(2, ioCount.inputs)} combinations. This process may take a long time. Do you want to continue?`
        );
        if (!confirmed) return;
      }

      // Add labels to components
      this.addLabelsToComponents();

      // Generate truth table
      this.truthTableManager.generateTruthTable();

      // Show table
      this.showTruthTableModal();
    } catch (error) {
      alert(`Error generating truth table: ${error}`);
    }
  }

  private renderTableToCanvas(
    ctx: CanvasRenderingContext2D,
    table: HTMLTableElement,
    padding: number
  ): void {
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const rows = table.rows;
    const headerHeight = 40;
    const rowHeight = 30;

    const columnCount = rows[0]?.cells.length || 0;
    const columnWidth = (table.offsetWidth - padding * 2) / columnCount;

    if (rows.length > 0) {
      ctx.fillStyle = "#222";
      ctx.fillRect(padding, padding, table.offsetWidth - padding * 2, headerHeight);

      ctx.fillStyle = "#fff";
      const headerRow = rows[0];

      for (let j = 0; j < headerRow.cells.length; j++) {
        const cellText = headerRow.cells[j].textContent || "";
        const cellX = padding + j * columnWidth + columnWidth / 2;
        const cellY = padding + headerHeight / 2;
        ctx.fillText(cellText, cellX, cellY);
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const isOdd = i % 2 === 1;
      ctx.fillStyle = isOdd ? "#333" : "#282828";

      const rowY = padding + headerHeight + (i - 1) * rowHeight;
      ctx.fillRect(padding, rowY, table.offsetWidth - padding * 2, rowHeight);

      ctx.fillStyle = "#fff";
      const row = rows[i];

      for (let j = 0; j < row.cells.length; j++) {
        const cellText = row.cells[j].textContent || "";
        const cellX = padding + j * columnWidth + columnWidth / 2;
        const cellY = rowY + rowHeight / 2;
        ctx.fillText(cellText, cellX, cellY);
      }
    }

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;

    for (let j = 0; j <= columnCount; j++) {
      const lineX = padding + j * columnWidth;
      ctx.beginPath();
      ctx.moveTo(lineX, padding);
      ctx.lineTo(lineX, padding + headerHeight + (rows.length - 1) * rowHeight);
      ctx.stroke();
    }

    for (let i = 0; i <= rows.length; i++) {
      const lineY =
        i === 0
          ? padding
          : i === 1
            ? padding + headerHeight
            : padding + headerHeight + (i - 1) * rowHeight;

      ctx.beginPath();
      ctx.moveTo(padding, lineY);
      ctx.lineTo(padding + columnCount * columnWidth, lineY);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeRect(
      padding,
      padding,
      table.offsetWidth - padding * 2,
      headerHeight + (rows.length - 1) * rowHeight
    );
  }

  private showTruthTableModal(): void {
    if (document.querySelector(".truth-table-modal")) {
      document.body.removeChild(document.querySelector(".truth-table-modal")!);
    }
    const modal = document.createElement("div");
    modal.className = "truth-table-modal";

    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    const content = document.createElement("div");
    content.className = "modal-content";
    content.style.backgroundColor = "#151515";
    content.style.border = "1px solid #444";
    content.style.borderRadius = "5px";
    content.style.padding = "20px";
    content.style.maxWidth = "30%";
    content.style.maxHeight = "90%";
    content.style.overflow = "auto";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";

    const title = document.createElement("h2");
    title.innerText = "Truth Table";
    title.style.color = "#fff";
    title.style.margin = "0";

    const closeButton = document.createElement("button");
    closeButton.innerText = "×";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "24px";
    closeButton.style.color = "#fff";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeButton);

    const tableContainer = document.createElement("div");
    tableContainer.style.marginBottom = "20px";
    tableContainer.style.overflow = "auto";

    const table = this.truthTableManager.createTruthTableElement();
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    const style = document.createElement("style");
    style.textContent = `
      .truth-table th, .truth-table td {
        padding: 8px 12px;
        border: 1px solid #444;
        text-align: center;
        color: #fff;
      }
      .truth-table th {
        background-color: #222;
      }
      .truth-table tr:nth-child(odd) {
        background-color: #333;
      }
      .truth-table tr:nth-child(even) {
        background-color: #282828;
      }
    `;
    document.head.appendChild(style);

    tableContainer.appendChild(table);

    const exportContainer = document.createElement("div");
    exportContainer.style.display = "flex";
    exportContainer.style.gap = "10px";

    const exportCSV = document.createElement("button");
    exportCSV.innerText = "Export CSV";
    exportCSV.style.padding = "8px 16px";
    exportCSV.style.backgroundColor = "#4CAF50";
    exportCSV.style.color = "white";
    exportCSV.style.border = "none";
    exportCSV.style.borderRadius = "4px";
    exportCSV.style.cursor = "pointer";
    exportCSV.onclick = () => {
      const csv = this.truthTableManager.exportToCSV();
      this.downloadFile(csv, "truth-table.csv", "text/csv");
    };

    const exportPNG = document.createElement("button");
    exportPNG.innerText = "Export Image";
    exportPNG.style.padding = "8px 16px";
    exportPNG.style.backgroundColor = "#2196F3";
    exportPNG.style.color = "white";
    exportPNG.style.border = "none";
    exportPNG.style.borderRadius = "4px";
    exportPNG.style.cursor = "pointer";
    exportPNG.onclick = () => {
      const tempCanvas = document.createElement("canvas");
      const padding = 20;
      tempCanvas.width = table.offsetWidth + padding * 2;
      tempCanvas.height = table.offsetHeight + padding * 2;

      const tempCtx = tempCanvas.getContext("2d")!;

      tempCtx.fillStyle = "#151515";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      this.renderTableToCanvas(tempCtx, table as HTMLTableElement, padding);

      const dataUrl = tempCanvas.toDataURL("image/png");
      this.downloadFile(dataUrl, "truth-table.png", "image/png", true);
    };

    exportContainer.appendChild(exportCSV);
    exportContainer.appendChild(exportPNG);

    content.appendChild(header);
    content.appendChild(tableContainer);
    content.appendChild(exportContainer);
    modal.appendChild(content);

    document.body.appendChild(modal);
  }
  public showKarnaughMap(): void {
    try {
      const ioCount = this.truthTableManager.identifyIOComponents();

      if (ioCount.inputs === 0) {
        alert(
          "There needs to be at least one input component (toggle, button, constant) in the circuit."
        );
        return;
      }

      if (ioCount.outputs === 0) {
        alert(
          "There needs to be at least one output component (light-bulb, led, hex) in the circuit to create a K-Map."
        );
        return;
      }

      this.truthTableManager.generateTruthTable();

      const kmap = this.truthTableManager.createKarnaughMap();

      kmap.findMinimalGroups();

      this.showKarnaughMapModal(kmap);
    } catch (error) {
      alert(`K-Map oluşturulurken hata: ${error}`);
    }
  }

  private showKarnaughMapModal(kmap: KarnaughMap): void {
    if (document.querySelector(".kmap-modal")) {
      document.body.removeChild(document.querySelector(".kmap-modal")!);
    }

    const modal = document.createElement("div");
    modal.className = "kmap-modal";

    // Modal styles
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    const content = document.createElement("div");
    content.className = "modal-content";
    content.style.backgroundColor = "#1e1e1e";
    content.style.border = "1px solid #555";
    content.style.borderRadius = "8px";
    content.style.padding = "25px";
    content.style.maxWidth = "800px";
    content.style.width = "90%";
    content.style.maxHeight = "90%";
    content.style.overflow = "auto";
    content.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";
    header.style.borderBottom = "1px solid #444";
    header.style.paddingBottom = "15px";

    const title = document.createElement("h2");
    title.innerText = "Karnaugh Map";
    title.style.color = "#fff";
    title.style.margin = "0";
    title.style.fontSize = "24px";
    title.style.fontWeight = "600";

    const closeButton = document.createElement("button");
    closeButton.innerText = "×";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "28px";
    closeButton.style.color = "#fff";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "5px 12px";
    closeButton.style.borderRadius = "4px";
    closeButton.style.transition = "background-color 0.2s";
    closeButton.onmouseover = () => {
      closeButton.style.backgroundColor = "rgba(255,255,255,0.1)";
    };
    closeButton.onmouseout = () => {
      closeButton.style.backgroundColor = "transparent";
    };
    closeButton.onclick = () => document.body.removeChild(modal);

    header.appendChild(title);
    header.appendChild(closeButton);

    const kmapContainer = document.createElement("div");
    kmapContainer.style.marginBottom = "25px";
    kmapContainer.style.backgroundColor = "#222";
    kmapContainer.style.borderRadius = "8px";
    kmapContainer.style.padding = "20px";
    kmapContainer.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";

    const kmapElement = kmap.renderKMap();
    kmapContainer.appendChild(kmapElement);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "15px";
    buttonContainer.style.marginTop = "25px";
    buttonContainer.style.justifyContent = "center";

    const createCircuitButton = document.createElement("button");
    createCircuitButton.innerText = "Create Circuit From K-Map";
    createCircuitButton.style.padding = "12px 20px";
    createCircuitButton.style.backgroundColor = "#4CAF50";
    createCircuitButton.style.color = "white";
    createCircuitButton.style.border = "none";
    createCircuitButton.style.borderRadius = "6px";
    createCircuitButton.style.cursor = "pointer";
    createCircuitButton.style.fontSize = "16px";
    createCircuitButton.style.fontWeight = "bold";
    createCircuitButton.style.transition = "background-color 0.2s, transform 0.1s";
    createCircuitButton.onmouseover = () => {
      createCircuitButton.style.backgroundColor = "#66bb6a";
    };
    createCircuitButton.onmouseout = () => {
      createCircuitButton.style.backgroundColor = "#4CAF50";
    };
    createCircuitButton.onmousedown = () => {
      createCircuitButton.style.transform = "scale(0.98)";
    };
    createCircuitButton.onmouseup = () => {
      createCircuitButton.style.transform = "scale(1)";
    };
    createCircuitButton.onclick = () => {
      const confirmCreate = confirm(
        "This will clear your current circuit and create a new one based on this K-Map. Continue?"
      );
      if (confirmCreate) {
        this.clearCircuit();
        kmap.createCircuitFromExpression(this);
        document.body.removeChild(modal);
      }
    };

    const exportImageButton = document.createElement("button");
    exportImageButton.innerText = "Export as Image";
    exportImageButton.style.padding = "12px 20px";
    exportImageButton.style.backgroundColor = "#2196F3";
    exportImageButton.style.color = "white";
    exportImageButton.style.border = "none";
    exportImageButton.style.borderRadius = "6px";
    exportImageButton.style.cursor = "pointer";
    exportImageButton.style.fontSize = "16px";
    exportImageButton.style.fontWeight = "bold";
    exportImageButton.style.transition = "background-color 0.2s, transform 0.1s";
    exportImageButton.onmouseover = () => {
      exportImageButton.style.backgroundColor = "#42a5f5";
    };
    exportImageButton.onmouseout = () => {
      exportImageButton.style.backgroundColor = "#2196F3";
    };
    exportImageButton.onmousedown = () => {
      exportImageButton.style.transform = "scale(0.98)";
    };
    exportImageButton.onmouseup = () => {
      exportImageButton.style.transform = "scale(1)";
    };
    exportImageButton.onclick = () => {
      this.exportKMapAsImage(kmapContainer);
    };

    buttonContainer.appendChild(createCircuitButton);
    buttonContainer.appendChild(exportImageButton);

    content.appendChild(header);
    content.appendChild(kmapContainer);
    content.appendChild(buttonContainer);
    modal.appendChild(content);

    document.body.appendChild(modal);
  }

  private exportKMapAsImage(kmapContainer: HTMLElement): void {
    const tempCanvas = document.createElement("canvas");
    const padding = 30;

    const kmapTable = kmapContainer.querySelector(".kmap-table") as HTMLTableElement;
    const kmapTitle = kmapContainer.querySelector("h3") as HTMLElement;
    const kmapExpr = kmapContainer.querySelector(".kmap-boolean-expression") as HTMLElement;

    if (!kmapTable) {
      Logger.error("K-Map table not found in container");
      return;
    }

    const width = kmapTable.offsetWidth + padding * 2;
    const height = kmapTable.offsetHeight + padding * 2;

    const titleHeight = kmapTitle ? 50 : 0;
    const exprHeight = kmapExpr ? 60 : 0;

    tempCanvas.width = Math.max(width, 400);
    tempCanvas.height = height + titleHeight + exprHeight;

    const tempCtx = tempCanvas.getContext("2d")!;

    tempCtx.fillStyle = "#1e1e1e";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    let yOffset = padding;
    if (kmapTitle) {
      tempCtx.font = "bold 18px Arial";
      tempCtx.fillStyle = "#ffffff";
      tempCtx.textAlign = "center";
      tempCtx.fillText(kmapTitle.textContent || "K-Map", tempCanvas.width / 2, yOffset + 20);
      yOffset += titleHeight;
    }

    const rows = kmapTable.rows;
    const rowCount = rows.length;
    const colCount = rows[0]?.cells.length || 0;

    if (rowCount < 2 || colCount < 2) {
      Logger.error("Invalid K-Map structure");
      return;
    }

    const cellSize = Math.min((width - padding * 2) / colCount, (height - padding * 2) / rowCount);

    this.renderKMapToCanvas(tempCtx, kmapTable, yOffset, cellSize);

    if (kmapExpr && kmapExpr.textContent) {
      yOffset += height - padding;
      tempCtx.font = "16px monospace";
      tempCtx.fillStyle = "#4caf50";
      tempCtx.textAlign = "center";
      tempCtx.fillText(
        kmapExpr.textContent.replace("Minimized Boolean Expression:", "").trim(),
        tempCanvas.width / 2,
        yOffset + 30
      );
    }

    const dataUrl = tempCanvas.toDataURL("image/png");
    this.downloadFile(dataUrl, "karnaugh-map.png", "image/png", true);
  }

  private renderKMapToCanvas(
    ctx: CanvasRenderingContext2D,
    table: HTMLTableElement,

    yPadding: number,
    cellSize: number
  ): void {
    const rows = table.rows;
    const rowCount = rows.length;
    const colCount = rows[0]?.cells.length || 0;

    const tableWidth = cellSize * colCount;
    const tableHeight = cellSize * rowCount;

    const startX = (ctx.canvas.width - tableWidth) / 2;

    if (rows.length > 0) {
      const headerRow = rows[0];

      ctx.fillStyle = "#333";
      ctx.fillRect(startX, yPadding, tableWidth, cellSize);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let j = 0; j < headerRow.cells.length; j++) {
        const cellText = headerRow.cells[j].textContent || "";
        const cellX = startX + j * cellSize + cellSize / 2;
        const cellY = yPadding + cellSize / 2;
        ctx.fillText(cellText, cellX, cellY);
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowY = yPadding + i * cellSize;

      ctx.fillStyle = "#333";
      ctx.fillRect(startX, rowY, cellSize, cellSize);

      ctx.fillStyle = "#fff";
      const rowHeaderText = row.cells[0].textContent || "";
      ctx.fillText(rowHeaderText, startX + cellSize / 2, rowY + cellSize / 2);

      for (let j = 1; j < row.cells.length; j++) {
        const cell = row.cells[j];
        const cellText = cell.textContent || "";
        const cellX = startX + j * cellSize;
        const cellY = rowY;

        if (cellText === "1") {
          ctx.fillStyle = "#2a7340";
        } else {
          ctx.fillStyle = "#333";
        }

        ctx.fillRect(cellX, cellY, cellSize, cellSize);

        ctx.fillStyle = cellText === "1" ? "#fff" : "#aaa";
        ctx.fillText(cellText, cellX + cellSize / 2, cellY + cellSize / 2);
      }
    }

    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;

    for (let j = 0; j <= colCount; j++) {
      const lineX = startX + j * cellSize;
      ctx.beginPath();
      ctx.moveTo(lineX, yPadding);
      ctx.lineTo(lineX, yPadding + tableHeight);
      ctx.stroke();
    }

    for (let i = 0; i <= rowCount; i++) {
      const lineY = yPadding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(startX, lineY);
      ctx.lineTo(startX + tableWidth, lineY);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeRect(startX, yPadding, tableWidth, tableHeight);
  }

  private downloadFile(
    content: string,
    fileName: string,
    contentType: string,
    isDataURL = false
  ): void {
    const a = document.createElement("a");

    if (isDataURL) {
      a.href = content;
    } else {
      const file = new Blob([content], { type: contentType });
      a.href = URL.createObjectURL(file);
    }

    a.download = fileName;
    a.click();

    if (!isDataURL) {
      URL.revokeObjectURL(a.href);
    }
  }

  private hasInputsOnlyFromInputComponents(gate: Component): boolean {
    const inputConnections = this.getInputConnections(gate);

    if (inputConnections.length === 0) return true;

    for (const sourceGate of inputConnections) {
      const isInputComponent =
        sourceGate.type === "toggle" ||
        sourceGate.type === "button" ||
        sourceGate.type === "constant0" ||
        sourceGate.type === "constant1" ||
        sourceGate.type === "clock";

      if (!isInputComponent) {
        return false;
      }
    }

    return true;
  }

  private getInputConnections(gate: Component): Component[] {
    const connectedComponents: Component[] = [];

    gate.inputs.forEach(input => {
      this.wires.forEach(wire => {
        if (wire.to === input && wire.from) {
          connectedComponents.push(wire.from.component);
        }
      });
    });

    return connectedComponents;
  }

  private rerouteAllWires(): void {
    this.wires.forEach(wire => {
      wire.autoRoute(this.components);
    });

    Logger.log("Redirection completed.");
  }

  public extractVerilog(): string {
    if (this.components.length === 0) {
      return "// Empty circuit";
    }

    const inputs: Component[] = [];
    const outputs: Component[] = [];
    const gates: Component[] = [];
    const wires = new Map<string, string>();
    const wireConnections = new Map<string, string[]>();
    let internalWireCount = 0;

    const directOutputConnections = new Map<string, string>();

    for (const comp of this.components) {
      if (
        comp.type === "toggle" ||
        comp.type === "button" ||
        comp.type === "constant0" ||
        comp.type === "constant1" ||
        comp.type === "clock"
      ) {
        inputs.push(comp);

        if (comp.outputs.length > 0) {
          const wireName = this.getWireNameForComponent(comp);
          wires.set(comp.outputs[0].id, wireName);
        }
      } else if (comp.type === "light-bulb" || comp.type === "hex") {
        outputs.push(comp);
      } else if (comp.type !== "text" && comp.type !== "state") {
        gates.push(comp);
      }
    }

    for (const wire of this.wires) {
      if (!wire.from || !wire.to) continue;

      if (
        (wire.to.component.type === "light-bulb" || wire.to.component.type === "hex") &&
        wire.from.component.type !== "toggle" &&
        wire.from.component.type !== "button" &&
        wire.from.component.type !== "constant0" &&
        wire.from.component.type !== "constant1" &&
        wire.from.component.type !== "clock"
      ) {
        directOutputConnections.set(wire.from.id, this.getWireNameForComponent(wire.to.component));
      }
    }

    for (const wire of this.wires) {
      if (!wire.from || !wire.to) continue;

      let sourceWireName = wires.get(wire.from.id);

      if (!sourceWireName) {
        if (directOutputConnections.has(wire.from.id)) {
          sourceWireName = directOutputConnections.get(wire.from.id)!;
        } else if (
          wire.from.component.type === "toggle" ||
          wire.from.component.type === "button" ||
          wire.from.component.type === "clock"
        ) {
          sourceWireName = this.getWireNameForComponent(wire.from.component);
        } else {
          sourceWireName = `w${internalWireCount++}`;
        }

        wires.set(wire.from.id, sourceWireName);
      }

      if (wire.to.component.type === "light-bulb" || wire.to.component.type === "hex") {
        const outputName = this.getWireNameForComponent(wire.to.component);
        wires.set(wire.to.id, outputName);

        if (!wireConnections.has(outputName)) {
          wireConnections.set(outputName, [sourceWireName]);
        } else {
          wireConnections.get(outputName)!.push(sourceWireName);
        }
      } else {
        if (!wireConnections.has(wire.to.id)) {
          wireConnections.set(wire.to.id, [sourceWireName]);
        } else {
          wireConnections.get(wire.to.id)!.push(sourceWireName);
        }
      }
    }

    let moduleCode = "";

    const moduleName = `circuit_${new Date().getTime().toString(36)}`;

    const portNames: string[] = [];

    for (const input of inputs) {
      const portName = this.getWireNameForComponent(input);

      if (portName !== "1'b0" && portName !== "1'b1") {
        portNames.push(portName);
      }
    }

    for (const output of outputs) {
      const portName = this.getWireNameForComponent(output);
      portNames.push(portName);
    }

    moduleCode += `module ${moduleName}(\n  ${portNames.join(", ")}\n);\n\n`;

    if (inputs.length > 0) {
      moduleCode += "// Input ports\n";
      for (const input of inputs) {
        const portName = this.getWireNameForComponent(input);

        if (portName !== "1'b0" && portName !== "1'b1") {
          moduleCode += `input ${portName};\n`;
        }
      }
      moduleCode += "\n";
    }

    if (outputs.length > 0) {
      moduleCode += "// Output ports\n";
      for (const output of outputs) {
        moduleCode += `output ${this.getWireNameForComponent(output)};\n`;
      }
      moduleCode += "\n";
    }

    if (internalWireCount > 0) {
      moduleCode += "// Internal wires\n";
      for (let i = 0; i < internalWireCount; i++) {
        moduleCode += `wire w${i};\n`;
      }
      moduleCode += "\n";
    }

    if (gates.length > 0) {
      moduleCode += "// Gate instantiations\n";
      const instanceCount = new Map<string, number>();

      for (const gate of gates) {
        const gateType = this.mapGateTypeToVerilog(gate.type);

        const instanceNum = instanceCount.get(gateType) || 0;
        instanceCount.set(gateType, instanceNum + 1);
        const instanceName = `${gateType}${instanceNum}`;

        let outputSignal = "";

        if (gate.outputs.length > 0) {
          const outputPortId = gate.outputs[0].id;

          if (directOutputConnections.has(outputPortId)) {
            outputSignal = directOutputConnections.get(outputPortId)!;
          } else {
            outputSignal = wires.get(outputPortId) || `w${internalWireCount++}`;
            if (!wires.has(outputPortId)) {
              wires.set(outputPortId, outputSignal);
            }
          }
        }

        const inputs: string[] = [];
        for (const input of gate.inputs) {
          const connections = wireConnections.get(input.id);
          if (connections && connections.length > 0) {
            inputs.push(connections[0]);
          } else {
            inputs.push("1'b0");
          }
        }

        moduleCode += this.generateGateInstance(gateType, instanceName, outputSignal, inputs);
      }
    }

    moduleCode += "\nendmodule\n";

    return moduleCode;
  }
  private generateGateInstance(
    gateType: string,
    instanceName: string,
    output: string,
    inputs: string[]
  ): string {
    if (gateType === "mux") {
      const dataInputs = inputs.slice(0, inputs.length - 1);
      const select = inputs[inputs.length - 1];
      return `${gateType} ${instanceName}(${output}, ${dataInputs.join(", ")}, ${select});\n`;
    } else if (gateType === "dff") {
      const d = inputs[0] || "1'b0";
      const clk = inputs[1] || "1'b0";
      return `${gateType} ${instanceName}(${output}, ${d}, ${clk});\n`;
    } else {
      return `${gateType} ${instanceName}(${output}, ${inputs.join(", ")});\n`;
    }
  }

  private mapGateTypeToVerilog(componentType: string): string {
    switch (componentType) {
      case "and":
        return "and";
      case "or":
        return "or";
      case "not":
        return "not";
      case "nand":
        return "nand";
      case "nor":
        return "nor";
      case "xor":
        return "xor";
      case "xnor":
        return "xnor";
      case "buffer":
        return "buf";
      case "mux2":
        return "mux";
      case "mux4":
        return "mux4";
      case "decoder":
        return "decoder";
      case "dflipflop":
        return "dff";
      case "dlatch":
        return "latch";
      default:
        return "unknown";
    }
  }

  private getWireNameForComponent(component: Component): string {
    switch (component.type) {
      case "toggle":
        return `i_sw_${component.id.slice(-2)}`;
      case "button":
        return `i_btn_${component.id.slice(-2)}`;
      case "constant0":
        return "1'b0";
      case "constant1":
        return "1'b1";
      case "clock":
        return `i_clk_${component.id.slice(-2)}`;
      case "light-bulb":
        return `o_led_${component.id.slice(-2)}`;
      case "hex":
        return `o_hex_${component.id.slice(-2)}`;
      default:
        return `sig_${component.id.slice(-4)}`;
    }
  }

  simulate(): void {
    this.components.forEach(component => {
      if (typeof component.resetInputs === "function") {
        component.resetInputs();
      }
    });

    this.wires.forEach(wire => {
      if (wire.to && wire.from) {
        // Transfer value considering bit width
        wire.transferValue();
      }
    });

    this.components.forEach(component => {
      if (component instanceof Text) {
        component.update();
      } else component.evaluate();
    });

    for (let i = 0; i < 10; i++) {
      this.wires.forEach(wire => {
        if (wire.to && wire.from) {
          wire.transferValue();
        }
      });

      this.components.forEach(component => {
        component.evaluate();
      });
    }

    this.draw();
  }

  public zoomIn(clientX?: number, clientY?: number): void {
    const oldScale = this.scale;
    this.scale *= 1.1;
    this.scale = Math.min(this.scale, 5);

    this.adjustZoomOffset(clientX, clientY, oldScale);
  }

  public zoomOut(clientX?: number, clientY?: number): void {
    const oldScale = this.scale;
    this.scale /= 1.1;
    this.scale = Math.max(this.scale, 0.1);

    this.adjustZoomOffset(clientX, clientY, oldScale);
  }

  private adjustZoomOffset(clientX?: number, clientY?: number, oldScale?: number): void {
    if (clientX === undefined || clientY === undefined || oldScale === undefined) {
      this.draw();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const worldX = (canvasX - this.offsetX) / oldScale;
    const worldY = (canvasY - this.offsetY) / oldScale;

    this.offsetX = canvasX - worldX * this.scale;
    this.offsetY = canvasY - worldY * this.scale;

    this.draw();
  }
  public removeWire(wire: Wire): void {
    const index = this.wires.indexOf(wire);
    if (index !== -1) {
      this.wires.splice(index, 1);
    }
  }
  public removeComponent(component: Component): void {
    const index = this.components.indexOf(component);
    if (index !== -1) {
      this.components.splice(index, 1);
    }
  }
  public resetZoom() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.draw();
  }

  public panCanvas(deltaX: number, deltaY: number) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.draw();
  }

  public getTransformedMousePosition(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }

  private setupMinimap(): void {
    this.minimap.width = this.minimapWidth;
    this.minimap.height = this.minimapHeight;

    this.minimap.addEventListener("mousedown", this.handleMinimapClick.bind(this));
    this.minimap.addEventListener("mousemove", this.handleMinimapMove.bind(this));
    this.minimap.addEventListener("mouseup", this.handleMinimapUp.bind(this));
    this.minimap.addEventListener("mouseleave", this.handleMinimapLeave.bind(this));
  }

  private isDraggingMinimap = false;

  private handleMinimapClick(event: MouseEvent): void {
    this.isDraggingMinimap = true;
    this.handleMinimapMove(event);
  }
  public resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    }

    this.draw();
  }

  private handleMinimapMove(event: MouseEvent): void {
    if (!this.isDraggingMinimap) return;

    const rect = this.minimap.getBoundingClientRect();
    const minimapX = event.clientX - rect.left;
    const minimapY = event.clientY - rect.top;

    const { bounds } = this.calculateCircuitBounds();
    const minimapScale = this.getMinimapScale();

    const translateX =
      (this.minimap.width - (bounds.right - bounds.left) * minimapScale) / 2 -
      bounds.left * minimapScale;
    const translateY =
      (this.minimap.height - (bounds.bottom - bounds.top) * minimapScale) / 2 -
      bounds.top * minimapScale;

    const adjustedX = (minimapX - translateX) / minimapScale;
    const adjustedY = (minimapY - translateY) / minimapScale;

    this.centerViewOn(adjustedX, adjustedY);
  }

  private handleMinimapUp(): void {
    this.isDraggingMinimap = false;
  }

  private handleMinimapLeave(): void {
    this.isDraggingMinimap = false;
  }

  private centerViewOn(worldX: number, worldY: number): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.offsetX = centerX - worldX * this.scale;
    this.offsetY = centerY - worldY * this.scale;

    this.draw();
  }

  private getMinimapScale(): number {
    const { width, height } = this.calculateCircuitBounds();

    if (width === 0 || height === 0) {
      return 1;
    }

    const scaleX = this.minimap.width / width;
    const scaleY = this.minimap.height / height;

    return Math.min(scaleX, scaleY) * 0.9;
  }

  private calculateCircuitBounds(): {
    bounds: { left: number; top: number; right: number; bottom: number };
    width: number;
    height: number;
  } {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    this.components.forEach(component => {
      const box = component.getBoundingBox();
      left = Math.min(left, box.x);
      top = Math.min(top, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    });

    this.wires.forEach(wire => {
      const points = wire.getAllPoints();
      points.forEach(point => {
        left = Math.min(left, point.x);
        top = Math.min(top, point.y);
        right = Math.max(right, point.x);
        bottom = Math.max(bottom, point.y);
      });
    });

    if (left === Infinity) {
      left = 0;
      top = 0;
      right = this.canvas.width;
      bottom = this.canvas.height;
    }

    const width = right - left;
    const height = bottom - top;

    return {
      bounds: { left, top, right, bottom },
      width,
      height,
    };
  }

  private drawMinimap(): void {
    if (!this.minimap || !this.minimapCtx) return;

    this.minimapCtx.fillStyle = this.minimap.style.backgroundColor || "#151515";
    this.minimapCtx.fillRect(0, 0, this.minimap.width, this.minimap.height);

    const { bounds } = this.calculateCircuitBounds();
    const minimapScale = this.getMinimapScale();

    this.minimapCtx.strokeStyle = "#3a3a3a";
    this.minimapCtx.lineWidth = 2;
    this.minimapCtx.strokeRect(0, 0, this.minimap.width, this.minimap.height);

    this.minimapCtx.save();
    this.minimapCtx.translate(
      (this.minimap.width - (bounds.right - bounds.left) * minimapScale) / 2 -
        bounds.left * minimapScale,
      (this.minimap.height - (bounds.bottom - bounds.top) * minimapScale) / 2 -
        bounds.top * minimapScale
    );
    this.minimapCtx.scale(minimapScale, minimapScale);

    this.wires.forEach(wire => {
      this.minimapCtx.strokeStyle = wire.selected ? "#0B6E4F" : "#cdcfd0";
      this.minimapCtx.lineWidth = 1 / minimapScale;

      const points = wire.getAllPoints();
      if (points.length > 1) {
        this.minimapCtx.beginPath();
        this.minimapCtx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
          this.minimapCtx.lineTo(points[i].x, points[i].y);
        }

        this.minimapCtx.stroke();
      }
    });

    this.components.forEach(component => {
      component.draw(this.minimapCtx);
    });

    this.drawViewport();

    this.minimapCtx.restore();
  }

  private drawViewport(): void {
    const viewLeft = -this.offsetX / this.scale;
    const viewTop = -this.offsetY / this.scale;
    const viewWidth = this.canvas.width / this.scale;
    const viewHeight = this.canvas.height / this.scale;

    this.minimapCtx.strokeStyle = "#ff5533";
    this.minimapCtx.lineWidth = 2 / this.getMinimapScale();
    this.minimapCtx.strokeRect(viewLeft, viewTop, viewWidth, viewHeight);

    this.minimapCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
    this.minimapCtx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);
  }
  public removeWiresByPort(port: Port): void {
    const wiresToRemove: Wire[] = [];

    this.wires.forEach(wire => {
      if ((wire.from && wire.from.id === port.id) || (wire.to && wire.to.id === port.id)) {
        wiresToRemove.push(wire);
      }
    });

    wiresToRemove.forEach(wire => {
      wire.disconnect();

      const index = this.wires.indexOf(wire);
      if (index !== -1) {
        this.wires.splice(index, 1);
      }
    });
  }
  draw(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyTransform();

    if (this.grid) {
      this.drawGrid();
    }

    this.wires.forEach(wire => {
      wire.draw(this.ctx);
    });

    this.components.forEach(component => {
      component.draw(this.ctx);
    });

    if (this.isSelecting && this.selectionRect) {
      const rect = {
        x: Math.min(this.selectionRect.start.x, this.selectionRect.end.x),
        y: Math.min(this.selectionRect.start.y, this.selectionRect.end.y),
        width: Math.abs(this.selectionRect.end.x - this.selectionRect.start.x),
        height: Math.abs(this.selectionRect.end.y - this.selectionRect.start.y),
      };

      this.ctx.strokeStyle = "rgba(0, 150, 255, 0.8)";
      this.ctx.lineWidth = 2 / this.scale;
      this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    if (this.currentWire) {
      this.currentWire.draw(this.ctx);
    }

    this.drawMinimap();
  }

  private drawGrid(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    const visibleLeft = -this.offsetX / this.scale;
    const visibleTop = -this.offsetY / this.scale;
    const visibleRight = (width - this.offsetX) / this.scale;
    const visibleBottom = (height - this.offsetY) / this.scale;

    let step = GRID_SIZE;
    if (this.scale < 0.5) step *= 2;
    if (this.scale < 0.25) step *= 4;
    if (this.scale < 0.1) step *= 10;

    const startX = Math.floor(visibleLeft / step) * step;
    const startY = Math.floor(visibleTop / step) * step;
    const endX = Math.ceil(visibleRight / step) * step;
    const endY = Math.ceil(visibleBottom / step) * step;

    this.ctx.fillStyle = "rgba(100, 100, 100, 0.4)";

    const dotSize = Math.max(1 / this.scale, 1.5);
    const offset = dotSize / 2;

    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        this.ctx.fillRect(x - offset, y - offset, dotSize, dotSize);
      }
    }
  }

  private handleClick(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    for (const component of this.components) {
      if (component.containsPoint(mousePos)) {
        if (component.type === "toggle") {
          (component as any).toggle();
          this.simulate();
          break;
        } else if (component.onClick) {
          component.onClick(mousePos);
          this.simulate();
          break;
        }
      }
    }
  }
  public takeScreenshot(): void {
    if (this.components.length === 0) {
      alert("No components to screenshot");
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.components.forEach(component => {
      const box = component.getBoundingBox();
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    this.wires.forEach(wire => {
      const points = wire.getAllPoints();
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    const screenshotCanvas = document.createElement("canvas");
    screenshotCanvas.width = width;
    screenshotCanvas.height = height;
    const screenshotCtx = screenshotCanvas.getContext("2d") as CanvasRenderingContext2D;

    screenshotCtx.fillStyle = "#151515";
    screenshotCtx.fillRect(0, 0, width, height);

    if (this.grid) {
      this.drawGridForScreenshot(screenshotCtx, minX, minY, width, height);
    }

    this.wires.forEach(wire => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      wire.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    this.components.forEach(component => {
      screenshotCtx.save();
      screenshotCtx.translate(-minX, -minY);
      component.draw(screenshotCtx);
      screenshotCtx.restore();
    });

    const dataUrl = screenshotCanvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.download = "circuit-screenshot.png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public generatePreviewDataUrl(): string {
    if (this.components.length === 0 && this.wires.length === 0) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#151515";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Empty Circuit", canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL("image/png");
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.components.forEach(component => {
      const box = component.getBoundingBox();
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    this.wires.forEach(wire => {
      const points = wire.getAllPoints();
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Use a fixed aspect ratio common for thumbnails (16:9)
    // Scale down the circuit so it fits into max 640x360 depending on Aspect Ratio.
    const targetWidth = 640;
    const targetHeight = 360;

    const scale = Math.min(targetWidth / contentWidth, targetHeight / contentHeight);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    // Center the circuit within the thumbnail
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(minX + contentWidth / 2), -(minY + contentHeight / 2));

    this.wires.forEach(wire => {
      wire.draw(ctx);
    });

    this.components.forEach(component => {
      component.draw(ctx);
    });

    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.7); // 70% quality JPEG saves memory
  }

  private drawGridForScreenshot(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ): void {
    const gridSize = 16;

    const startX = Math.floor(offsetX / gridSize) * gridSize - offsetX;
    const startY = Math.floor(offsetY / gridSize) * gridSize - offsetY;

    ctx.strokeStyle = "rgba(80, 80, 80, 0.2)";
    ctx.lineWidth = 1;

    for (let x = startX; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = startY; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  private handleBitWidthNegotiation(wire: Wire): void {
    if (!wire.from || !wire.to) return;

    const fromBitWidth = wire.from.bitWidth || 1;

    wire.bitWidth = fromBitWidth;
  }

  private handleMouseDown(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    this.components.forEach(component => {
      component.selected = false;
    });
    this.wires.forEach(wire => {
      wire.selected = false;
    });
    this.selectedComponent = null;
    this.selectedWire = null;

    // ── Wire control point interaction (before component checks) ──
    // 1. Check if clicking on an existing control point → start dragging it
    for (const wire of this.wires) {
      if (wire.controlPoints.length > 0) {
        const cpIdx = wire.getControlPointAt(mousePos);
        if (cpIdx !== null) {
          wire.selected = true;
          this.selectedWire = wire;
          this.draggingWire = wire;
          this.draggingCPIndex = cpIdx;
          wire.selectedPointIndex = cpIdx;
          wire.isDraggingControlPoint = true;
          this.draw();
          return;
        }
      }
    }

    // 2. Check if clicking on a wire segment → insert a new CP and start dragging it
    for (const wire of this.wires) {
      if (wire.isNearPoint(mousePos) && wire.from && wire.to) {
        const cpIdx = wire.insertControlPoint(mousePos);
        wire.selected = true;
        this.selectedWire = wire;
        this.draggingWire = wire;
        this.draggingCPIndex = cpIdx;
        wire.selectedPointIndex = cpIdx;
        wire.isDraggingControlPoint = true;
        this.draw();
        return;
      }
    }

    for (const component of this.components) {
      if (component.type === "button") {
        if (component.containsPoint(mousePos)) {
          (component as any).onMouseDown();
          this.simulate();
          this.draw();
          return;
        }
      }
    }

    for (const component of this.components) {
      const port = component.getPortAtPosition(mousePos);
      if (port) {
        if (this.currentWire) {
          this.currentWire = null;
        }

        this.currentWire = new Wire(port, true);
        port.isConnected = true;
        this.currentWire.updateTempEndPoint(mousePos);

        this.draw();
        return;
      }
      if (component.containsPoint(mousePos)) {
        const isPartOfSelection = this.selectedComponents.includes(component);

        if (!isPartOfSelection) {
          this.selectedComponents.forEach(c => (c.selected = false));
          this.selectedComponents = [];

          this.selectedComponent = component;
          component.selected = true;
          this.selectedComponents = [component];

          if (this.selectedComponent) {
            this.updatePropertiesPanel();
          }
        }

        this.draggedComponent = component;

        this.dragOffset = { ...mousePos };
        this.dragStartPositions.clear();
        if (this.selectedComponents.length > 0) {
          this.selectedComponents.forEach(c => {
            this.dragStartPositions.set(c.id, { ...c.position });
          });
        } else {
          this.dragStartPositions.set(component.id, { ...component.position });
        }

        this.draw();
        return;
      }
    }
    for (const wire of this.wires) {
      if (wire.isNearPoint(mousePos)) {
        wire.selected = true;
        this.selectedWire = wire;

        this.gatePropertiesPanel.show(wire);
        this.draw();
        return;
      }
    }

    if (!this.isSelecting) {
      this.isSelecting = true;
      this.selectionRect = { start: mousePos, end: mousePos };
    }

    this.updatePropertiesPanel();

    this.selectedComponent = null;
    this.selectedWire = null;
    this.draw();
  }
  private updatePropertiesPanel(): void {
    if (this.selectedWire) {
      this.gatePropertiesPanel.show(this.selectedWire);
      return;
    }

    if (this.selectedComponents.length !== 1 || !this.selectedComponent) {
      this.gatePropertiesPanel.hide();
      return;
    }
    const selectedComponent = this.selectedComponents[0];
    this.gatePropertiesPanel.show(selectedComponent);
  }
  public clearSelection(): void {
    this.selectedComponents.forEach(component => (component.selected = false));
    this.selectedComponents = [];

    if (this.selectedWire) {
      this.selectedWire.selected = false;
      this.selectedWire = null;
    }
    this.gatePropertiesPanel.hide();
    this.draw();
  }
  public getCanvasWidth(): number {
    return this.canvas.width;
  }

  public getCanvasHeight(): number {
    return this.canvas.height;
  }
  public getComponentById(id: string): any {
    return this.components.find(component => component.id === id) || null;
  }

  public createWire(fromPort: any, toPort: any): void {
    if (!fromPort || !toPort) {
      return;
    }

    const inputPort = fromPort.type === "input" ? fromPort : toPort;
    if (inputPort.type === "input" && inputPort.isConnected) {
      return;
    }

    const wire = new Wire(fromPort, true);
    wire.connect(toPort);

    fromPort.isConnected = true;
    toPort.isConnected = true;

    this.wires.push(wire);
  }

  public addComponentByType(type: string, position: Point): string {
    const component = this.createComponentByType(type, position);
    if (component) {
      this.components.push(component);
      this.draw();
      return component.id;
    }
    return "";
  }

  private handleMouseMove(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    // ── Wire control point dragging ──
    if (this.draggingWire && this.draggingCPIndex !== null) {
      this.draggingWire.moveControlPoint(this.draggingCPIndex, mousePos);
      this.draw();
      return;
    }

    if (this.isSelecting && this.selectionRect) {
      this.selectionRect.end = mousePos;
      this.draw();
      return;
    }

    if (this.draggedComponent && this.selectedComponents.length > 0) {
      const deltaX = mousePos.x - this.dragOffset.x;
      const deltaY = mousePos.y - this.dragOffset.y;
      let didMove = false;

      this.selectedComponents.forEach(component => {
        const startPos = this.dragStartPositions.get(component.id);
        if (startPos) {
          const newPos = {
            x: startPos.x + deltaX,
            y: startPos.y + deltaY,
          };
          if (component.position.x !== newPos.x || component.position.y !== newPos.y)
            didMove = true;
          component.move(newPos);
        }
      });

      if (didMove && event.type === "mouseup") {
        ActionHistory.saveState(this.exportCircuit());
      }

      this.draw();
      return;
    }

    if (this.draggedComponent) {
      const deltaX = mousePos.x - this.dragOffset.x;
      const deltaY = mousePos.y - this.dragOffset.y;
      const startPos = this.dragStartPositions.get(this.draggedComponent.id);

      if (startPos) {
        const newPos = {
          x: startPos.x + deltaX,
          y: startPos.y + deltaY,
        };
        if (
          this.draggedComponent.position.x !== newPos.x ||
          this.draggedComponent.position.y !== newPos.y
        ) {
          if (event.type === "mouseup") ActionHistory.saveState(this.exportCircuit());
        }
        this.draggedComponent.move(newPos);
      }
      this.draw();
    }
    if (this.currentWire) {
      this.currentWire.updateTempEndPoint(mousePos);
      this.draw();
    }
  }
  private selectComponentsInRect(): void {
    if (!this.selectionRect) return;

    const rect = {
      left: Math.min(this.selectionRect.start.x, this.selectionRect.end.x),
      right: Math.max(this.selectionRect.start.x, this.selectionRect.end.x),
      top: Math.min(this.selectionRect.start.y, this.selectionRect.end.y),
      bottom: Math.max(this.selectionRect.start.y, this.selectionRect.end.y),
    };

    this.selectedComponents = this.components.filter(component => {
      const componentRect = component.getBoundingBox();
      return (
        componentRect.x < rect.right &&
        componentRect.x + componentRect.width > rect.left &&
        componentRect.y < rect.bottom &&
        componentRect.y + componentRect.height > rect.top
      );
    });

    this.selectedComponents.forEach(component => (component.selected = true));
  }

  private handleMouseUp(event: MouseEvent): void {
    const mousePos = this.getMousePosition(event);

    // ── End wire control point drag ──
    if (this.draggingWire && this.draggingCPIndex !== null) {
      this.draggingWire.isDraggingControlPoint = false;
      this.draggingWire.selectedPointIndex = null;
      ActionHistory.saveState(this.exportCircuit());
      this.draggingWire = null;
      this.draggingCPIndex = null;
      this.draw();
      return;
    }

    if (this.isSelecting && this.selectionRect) {
      this.selectionRect.end = mousePos;
      this.selectComponentsInRect();
      this.isSelecting = false;
      this.selectionRect = null;
      this.draw();
      return;
    }

    if (this.draggedComponent) {
      if (this.wires.length < 20) {
        this.updateConnectedWires(
          this.selectedComponents.length > 0 ? this.selectedComponents : [this.draggedComponent]
        );
      }
    }

    if (!this.draggedComponent && !this.currentWire && !this.selectedWire) {
      this.clearSelection();
    }

    this.draggedComponent = null;

    if (this.currentWire) {
      Logger.log("Has active wire, checking for port connection");

      for (const component of this.components) {
        const port = component.getPortAtPosition(mousePos);

        if (port) {
          if (this.currentWire.from?.component === port.component) {
            this.currentWire = null;
            this.draw();
            return;
          }

          // Prevent connecting to an already connected input port
          if (port.type === "input" && port.isConnected) {
            this.currentWire = null;
            this.draw();
            return;
          }

          // Prevent connecting input-to-input
          if (
            port.type === "input" &&
            this.currentWire.from &&
            this.currentWire.from.type === "input"
          ) {
            this.currentWire = null;
            this.draw();
            return;
          }

          const success = this.currentWire.connect(port);
          if (success) {
            Logger.log("Connection successful! Adding wire to list.");
            port.isConnected = true;
            this.wires.push(this.currentWire);
            this.currentWire.autoRoute(this.components);
            this.currentWire = null;
            ActionHistory.saveState(this.exportCircuit());
            this.simulate();
          } else {
            Logger.log("Connection failed!");
            this.currentWire = null;
          }
          this.draw();
          return;
        }
      }

      this.currentWire = null;
      this.draw();
    }

    for (const component of this.components) {
      if (component.type === "button") {
        if (component.containsPoint(mousePos)) {
          (component as any).onMouseUp();
          ActionHistory.saveState(this.exportCircuit());
          this.simulate();
          this.draw();
          return;
        }
      }
    }

    // Only save positional movements on mouseup if they actually changed position
    if (this.draggedComponent && Object.keys(this.dragStartPositions).length > 0) {
      const comp = this.draggedComponent as Component;
      const startPos = this.dragStartPositions.get(comp.id);
      if (startPos && (startPos.x !== comp.position.x || startPos.y !== comp.position.y)) {
        ActionHistory.saveState(this.exportCircuit());
      }
    }
  }

  public createComponentByType(type: string, position: Point): Component | null {
    switch (type) {
      case "and":
        return new AndGate(position);
      case "or":
        return new OrGate(position);
      case "not":
        return new NotGate(position);
      case "toggle":
        return new ToggleSwitch(position);
      case "light-bulb":
        return new LightBulb(position);
      case "xor":
        return new XorGate(position);
      case "nor":
        return new NorGate(position);
      case "xnor":
        return new XnorGate(position);
      case "nand":
        return new NandGate(position);
      case "mux2":
        return new Mux2(position);
      case "mux4":
        return new Mux4(position);
      case "button":
        return new Button(position);
      case "constant1":
        return new Constant1(position);
      case "constant0":
        return new Constant0(position);
      case "clock":
        return new Clock(position, this);
      case "dlatch":
        return new DLatch(position);
      case "dflipflop":
        return new DFlipFlop(position);
      case "decoder":
        return new Decoder(position);
      case "buffer":
        return new BufferGate(position);
      case "hex":
        return new HexDigit(position);
      case "text":
        return new Text(position);
      case "state":
        return new State(position);
      case "halfadder":
        return new HalfAdder(position);
      case "fulladder":
        return new FullAdder(position);
      case "halfsubtractor":
        return new HalfSubtractor(position);
      case "fullsubtractor":
        return new FullSubtractor(position);
      case "led":
        return new Led(position);
      case "multibit":
        return new MultiBit(position);
      case "smartdisplay":
        return new SmartDisplay(position);
      default:
        Logger.error(`Unknown component type: ${type}`);
        return null;
    }
  }
  public addWire(wire: Wire): void {
    this.wires.push(wire);
    this.handleBitWidthNegotiation(wire);
    this.draw();
  }

  public getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();

    const x = (event.clientX - rect.left - this.offsetX) / this.scale;
    const y = (event.clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }
  private updateConnectedWires(components: Component[]): void {
    const updatedWires: Wire[] = [];

    for (const component of components) {
      for (const wire of this.wires) {
        if (
          ((wire.from && wire.from.component === component) ||
            (wire.to && wire.to.component === component)) &&
          !updatedWires.includes(wire)
        ) {
          // Don't reset manual control points, just invalidate the path cache
          if (!wire.hasManualControlPoints) {
            wire.autoRoute(this.components);
          }
          updatedWires.push(wire);
        }
      }
    }
  }

  toggleGrid(): void {
    this.grid = !this.grid;
    this.draw();
  }

  deleteSelected(): void {
    if (this.selectedComponent) {
      if (this.selectedComponent.type === "state") {
        State.idCounter--;
      }

      let wiresDeleted = false;
      this.wires = this.wires.filter(wire => {
        const isConnectedToSelected =
          wire.from?.component === this.selectedComponent ||
          (wire.to && wire.to.component === this.selectedComponent);

        if (isConnectedToSelected) {
          wire.disconnect();
          wiresDeleted = true;
        }

        return !isConnectedToSelected;
      });

      if (wiresDeleted) {
        ActionHistory.saveState(this.exportCircuit());
      }

      this.components = this.components.filter(component => component !== this.selectedComponent);

      this.selectedComponent = null;
      this.draw();
      ActionHistory.saveState(this.exportCircuit());
    }
    if (this.selectedWire) {
      const index = this.wires.indexOf(this.selectedWire);
      if (index !== -1) {
        if (this.selectedWire.to) {
          this.selectedWire.to.isConnected = false;
        }
        if (this.selectedWire.from) {
          this.selectedWire.from.isConnected = false;
        }

        this.selectedWire.disconnect();
        this.wires.splice(index, 1);

        this.selectedWire = null;
        this.draw();
        ActionHistory.saveState(this.exportCircuit());
      }
    }
    if (this.selectedComponents.length > 0) {
      let wiresDeleted = false;
      for (const component of this.selectedComponents) {
        this.wires = this.wires.filter(wire => {
          const isConnectedToSelected =
            wire.from?.component === component || (wire.to && wire.to.component === component);

          if (isConnectedToSelected) {
            wire.disconnect();
            wiresDeleted = true;
          }

          return !isConnectedToSelected;
        });

        if (wiresDeleted) {
          // Save state immediately after cutting all connections for the current component
          ActionHistory.saveState(this.exportCircuit());
          wiresDeleted = false; // Reset for next iteration (though we usually batch select)
        }

        this.components = this.components.filter(c => c !== component);

        this.selectedComponent = null;
        this.draw();
      }
      this.selectedComponents = [];
      ActionHistory.saveState(this.exportCircuit());
    }
    this.simulate();
  }

  public copySelected(): void {
    const componentsToCopy =
      this.selectedComponents.length > 0
        ? this.selectedComponents
        : this.selectedComponent
          ? [this.selectedComponent]
          : [];

    if (componentsToCopy.length === 0) return;

    const componentSet = new Set(componentsToCopy);

    const clipboardData = {
      components: componentsToCopy.map(component => ({
        id: component.id,
        type: component.type,
        state: component.getState(),
      })),
      wires: this.wires
        .filter(wire => {
          const fromComponent = wire.from?.component;
          const toComponent = wire.to?.component;
          return (
            fromComponent &&
            toComponent &&
            componentSet.has(fromComponent) &&
            componentSet.has(toComponent)
          );
        })
        .map(wire => ({
          id: Math.random().toString(36).substring(2, 15),
          fromComponentId: wire.from?.component.id,
          fromPortId: wire.from?.id,
          toComponentId: wire.to ? wire.to.component.id : null,
          toPortId: wire.to ? wire.to.id : null,
          wireState: wire.getWireState(),
        })),
    };

    this.clipboard = JSON.stringify(clipboardData);
  }

  public paste(): void {
    if (!this.clipboard) return;

    try {
      const clipboardData = JSON.parse(this.clipboard);
      if (!clipboardData.components || clipboardData.components.length === 0) return;

      this.selectedComponents.forEach(c => (c.selected = false));
      if (this.selectedComponent) this.selectedComponent.selected = false;
      this.selectedComponents = [];
      this.selectedComponent = null;

      const componentMap = new Map<string, Component>();
      const portMap = new Map<string, Port>();

      const PASTING_OFFSET = GRID_SIZE * 2;

      for (const compData of clipboardData.components) {
        const originalPos = compData.state.position;
        const newPos = { x: originalPos.x + PASTING_OFFSET, y: originalPos.y + PASTING_OFFSET };

        const component = this.createComponentByType(compData.type, newPos);

        if (component instanceof Text) {
          component.setText(compData.state.text || "");
          component.setRelativeOffset(compData.state.relativeOffset || { x: 0, y: 0 });
        }

        if (component) {
          if (
            compData.state.defaultBitWidth !== undefined &&
            compData.state.defaultBitWidth !== 1
          ) {
            component.setBitWidth(compData.state.defaultBitWidth);
          }
          const { inputs, outputs, ...strippedState } = compData.state;
          const newState = { ...strippedState, position: newPos, id: component.id };
          component.setState(newState);
          component.move(newPos);

          if (compData.state.inputs && Array.isArray(compData.state.inputs)) {
            compData.state.inputs.forEach((portState: any, index: number) => {
              if (component.inputs[index] && portState.bitWidth !== undefined) {
                component.inputs[index].bitWidth = portState.bitWidth;
              }
            });
          }

          if (compData.state.outputs && Array.isArray(compData.state.outputs)) {
            compData.state.outputs.forEach((portState: any, index: number) => {
              if (component.outputs[index] && portState.bitWidth !== undefined) {
                component.outputs[index].bitWidth = portState.bitWidth;
              }
            });
          }

          componentMap.set(compData.id, component);
          component.inputs.forEach(port =>
            portMap.set(compData.state.inputs[component.inputs.indexOf(port)].id, port)
          );
          component.outputs.forEach(port =>
            portMap.set(compData.state.outputs[component.outputs.indexOf(port)].id, port)
          );

          this.components.push(component);
          component.selected = true;
          this.selectedComponents.push(component);
        }
      }

      if (clipboardData.wires) {
        for (const wireData of clipboardData.wires) {
          const fromPort = portMap.get(wireData.fromPortId);
          const toPort = portMap.get(wireData.toPortId);

          if (fromPort && toPort) {
            const wire = new Wire(fromPort, true);
            wire.connect(toPort);
            fromPort.isConnected = true;
            toPort.isConnected = true;

            if (wireData.wireState) {
              if (wireData.wireState.controlPoints) {
                wireData.wireState.controlPoints = wireData.wireState.controlPoints.map(
                  (cp: Point) => ({
                    x: cp.x + PASTING_OFFSET,
                    y: cp.y + PASTING_OFFSET,
                  })
                );
              }
              wire.setWireState(wireData.wireState);
            }
            this.wires.push(wire);
          }
        }
      }

      ActionHistory.saveState(this.exportCircuit());
      this.simulate();
      this.draw();
    } catch (error) {
      console.error("Failed to paste circuit elements from clipboard", error);
    }
  }
  public clearCircuit(): void {
    this.components = [];
    this.wires = [];
    this.selectedComponent = null;
    this.draggedComponent = null;
    this.currentWire = null;
    this.draw();
  }

  clearCurrentWire(): void {
    this.currentWire = null;
    this.draw();
  }
  exportCircuit(): string {
    const circuitData = {
      components: this.components.map(component => {
        return {
          id: component.id,
          type: component.type,
          state: component.getState(),
        };
      }),
      wires: this.wires.map(wire => {
        return {
          id: Math.random().toString(36).substring(2, 15),
          fromComponentId: wire.from?.component.id,
          fromPortId: wire.from?.id,
          toComponentId: wire.to ? wire.to.component.id : null,
          toPortId: wire.to ? wire.to.id : null,
          wireState: wire.getWireState(),
        };
      }),
    };

    return JSON.stringify(circuitData, null, 2);
  }

  importCircuit(jsonData: string): boolean {
    try {
      this.clearCircuit();

      const circuitData = JSON.parse(jsonData);

      const componentMap = new Map<string, Component>();
      const portMap = new Map<string, Port>();

      for (const compData of circuitData.components) {
        const component = this.createComponentByType(compData.type, compData.state.position);

        if (component instanceof Text) {
          component.setText(compData.state.text || "");
          const comp = this.getComponentById(compData.state.attachedToId);

          if (comp) component.attachToComponent(comp);

          component.setRelativeOffset(compData.state.relativeOffset || { x: 0, y: 0 });
        }

        if (component) {
          if (
            compData.state.defaultBitWidth !== undefined &&
            compData.state.defaultBitWidth !== 1
          ) {
            component.setBitWidth(compData.state.defaultBitWidth);
          }

          component.setState(compData.state);

          // Snap position to grid and recalculate port positions.
          // Old saved circuits may have non-grid-aligned positions.
          component.move(component.position);

          if (compData.state.inputs && Array.isArray(compData.state.inputs)) {
            compData.state.inputs.forEach((portState: any, index: number) => {
              if (component.inputs[index] && portState.bitWidth !== undefined) {
                component.inputs[index].bitWidth = portState.bitWidth;
              }
            });
          }

          if (compData.state.outputs && Array.isArray(compData.state.outputs)) {
            compData.state.outputs.forEach((portState: any, index: number) => {
              if (component.outputs[index] && portState.bitWidth !== undefined) {
                component.outputs[index].bitWidth = portState.bitWidth;
              }
            });
          }

          componentMap.set(component.id, component);
          component.inputs.forEach(port => portMap.set(port.id, port));
          component.outputs.forEach(port => portMap.set(port.id, port));

          this.components.push(component);
        }
      }

      for (const wireData of circuitData.wires) {
        const fromPort = portMap.get(wireData.fromPortId);
        const toPort = portMap.get(wireData.toPortId);

        if (fromPort && toPort) {
          const wire = new Wire(fromPort, true);
          wire.connect(toPort);

          fromPort.isConnected = true;
          toPort.isConnected = true;

          // Restore control point state if saved
          if (wireData.wireState) {
            wire.setWireState(wireData.wireState);
          }

          this.wires.push(wire);
        }
      }

      this.simulate();
      this.draw();

      return true;
    } catch (error) {
      Logger.error("Error loading circuit:", error);
      return false;
    }
  }

  public saveToFile(filename = "circuit.json"): void {
    const jsonData = this.exportCircuit();
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
  public saveVerilogToFile(verilogCode: string, filename = "circuit.v"): void {
    const blob = new Blob([verilogCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  public loadFromFile(file: File): Promise<boolean> {
    return new Promise(resolve => {
      if (!file.name.endsWith(".json")) {
        alert("Geçersiz dosya uzantısı. Lütfen .json uzantılı bir dosya seçin.");
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        if (e.target && e.target.result) {
          const result = this.importCircuit(e.target.result as string);
          resolve(result);
        } else {
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }

  saveToLocalStorage(key = "savedCircuit"): void {
    try {
      const jsonData = this.exportCircuit();
      localStorage.setItem(key, jsonData);
      Logger.log("Devre local storage'a kaydedildi");
    } catch (error) {
      Logger.error("Local storage'a kaydetme hatası:", error);
    }
  }

  loadFromLocalStorage(key = "savedCircuit"): boolean {
    try {
      const jsonData = localStorage.getItem(key);
      if (jsonData) {
        const result = this.importCircuit(jsonData);
        Logger.log("Devre local storage'dan yüklendi");
        return result;
      }
      return false;
    } catch (error) {
      Logger.error("Local storage'dan yükleme hatası:", error);
      return false;
    }
  }

  private addLabelsToComponents(): void {
    this.removeComponentLabels();

    this.truthTableManager.identifyIOComponents();

    const inputComponents = this.truthTableManager.getInputComponents();

    inputComponents.forEach(component => {
      if (
        component.type === "toggle" ||
        component.type === "button" ||
        component.type === "clock"
      ) {
        const label = this.truthTableManager.getAlphabeticLabel(component);
        this.addLabelToComponent(component, label);
      }
    });

    const outputComponents = this.truthTableManager.getOutputComponents();
    outputComponents.forEach(component => {
      const label = this.truthTableManager.getAlphabeticLabel(component);
      this.addLabelToComponent(component, label);
    });

    this.draw();
  }

  private addLabelToComponent(component: Component, label: string): void {
    const textPosition = {
      x: component.position.x - 25,
      y: component.position.y - 20,
    };

    const textComponent = new Text(textPosition);
    textComponent.setText(label);
    this.addComponent(textComponent);
  }

  private removeComponentLabels(): void {
    const labels = this.components.filter(
      comp => comp.type === "text" && (comp as any).customData && (comp as any).customData.isLabel
    );

    labels.forEach(label => {
      const index = this.components.indexOf(label);
      if (index !== -1) {
        this.components.splice(index, 1);
      }
    });
  }
}
