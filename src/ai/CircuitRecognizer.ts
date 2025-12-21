import { Point, Port } from "../models/Component";
import { CircuitBoard } from "../models/CircuitBoard";
import { Component } from "../models/Component";
import { Wire } from "../models/Wire";

export interface ImageDimensions {
  originalWidth: number;
  originalHeight: number;
}
interface PythonGate {
  id: string;
  type: string;
  position: [number, number];
}

interface PythonTerminal {
  id: string;
  terminal: "input" | "output" | "external";
}

interface PythonWire {
  from: PythonTerminal;
  to: PythonTerminal;
}

export interface PythonAnalysisResult {
  gates: PythonGate[];
  wires: PythonWire[];
}

export class CircuitRecognizer {
  private circuitBoard: CircuitBoard;
  private componentMap: Map<string, Component>;

  private componentTypeMap: Record<string, string> = {
    AND: "and",
    OR: "or",
    NOT: "not",
    NAND: "nand",
    NOR: "nor",
    XOR: "xor",
    XNOR: "xnor",
    and: "and",
    or: "or",
    not: "not",
    nand: "nand",
    nor: "nor",
    xor: "xor",
    xnor: "xnor",
  };

  private readonly DIRECT_CONNECTION_THRESHOLD = 150;
  private readonly TOGGLE_CONNECTION_THRESHOLD = 80;

  constructor(circuitBoard: CircuitBoard) {
    this.circuitBoard = circuitBoard;
    this.componentMap = new Map<string, Component>();
  }

  async processDetections(
    analysisResult: PythonAnalysisResult,
    dimensions: ImageDimensions
  ): Promise<void> {
    try {
      console.log("Processing analysis result:", analysisResult);
      this.circuitBoard.clearCircuit();
      this.componentMap.clear();

      if (!analysisResult || !analysisResult.gates || !analysisResult.wires) {
        console.error("Invalid analysis result structure received:", analysisResult);
        alert("Error: Invalid data received from analysis.");
        return;
      }

      const { gates, wires } = analysisResult;

      for (const gate of gates) {
        const componentType = this.mapComponentType(gate.type);
        if (!componentType) {
          console.warn(
            `Unknown component type from Python: ${gate.type} (ID: ${gate.id}). Skipping.`
          );
          continue;
        }
        const position = this.calculateScaledPosition(gate.position, dimensions);
        const component = this.circuitBoard.createComponentByType(componentType, position);

        if (component) {
          this.componentMap.set(gate.id, component);
        } else {
          console.error(
            `Failed to create component object for type ${componentType} (Python ID: ${gate.id})`
          );
        }
      }

      this.componentMap.forEach(component => {
        if (!component.type.startsWith("toggle") && !component.type.startsWith("light-bulb")) {
          this.circuitBoard.addComponent(component);
        }
      });

      const usedInputPorts = new Set<string>();
      const externalOffset = 120;

      const gateToggleOffsets: Map<string, number> = new Map();

      for (const wire of wires) {
        let fromComponent: Component | null = null;
        let toComponent: Component | null = null;
        let fromPort: Port | null = null;
        let toPort: Port | null = null;
        let gateForPositioning: Component | null = null;

        if (wire.from.terminal === "external") {
          gateForPositioning = this.componentMap.get(wire.to.id) || null;
          if (!this.componentMap.has(wire.from.id)) {
            if (!gateForPositioning) {
              console.error(
                `Cannot place external input ${wire.from.id}: Target gate ${wire.to.id} not found.`
              );
              continue;
            }

            const gateId = wire.to.id;

            if (!gateToggleOffsets.has(gateId)) {
              gateToggleOffsets.set(gateId, 0);
            }

            const verticalOffset = gateToggleOffsets.get(gateId) || 0;

            gateToggleOffsets.set(gateId, verticalOffset + 40);

            const targetPosition: Point = {
              x: gateForPositioning.position.x - externalOffset,
              y: gateForPositioning.position.y + verticalOffset - 20,
            };

            const inputComponent = this.circuitBoard.createComponentByType(
              "toggle",
              targetPosition
            );
            if (inputComponent) {
              this.componentMap.set(wire.from.id, inputComponent);
              this.circuitBoard.addComponent(inputComponent);
            } else {
              console.error(`Failed to create external input ${wire.from.id}. Skipping wire.`);
              continue;
            }
          }
          fromComponent = this.componentMap.get(wire.from.id) || null;
          if (fromComponent && fromComponent.outputs.length > 0) {
            fromPort = fromComponent.outputs[0];
          } else {
            console.warn(
              `'From' component ${wire.from.id} (external) not found or has no output port. Skipping wire.`
            );
            continue;
          }
        } else {
          fromComponent = this.componentMap.get(wire.from.id) || null;
          if (fromComponent && fromComponent.outputs.length > 0) {
            fromPort = fromComponent.outputs[0];
          } else {
            console.warn(
              `'From' component ${wire.from.id} (gate) not found or has no output port. Skipping wire.`
            );
            continue;
          }
        }

        if (wire.to.terminal === "external") {
          gateForPositioning = this.componentMap.get(wire.from.id) || null;
          if (!this.componentMap.has(wire.to.id)) {
            if (!gateForPositioning) {
              console.error(
                `Cannot place external output ${wire.to.id}: Source gate ${wire.from.id} not found.`
              );
              continue;
            }
            const targetPosition: Point = {
              x: gateForPositioning.position.x + gateForPositioning.size.width + externalOffset,
              y: gateForPositioning.position.y,
            };
            const outputComponent = this.circuitBoard.createComponentByType(
              "light-bulb",
              targetPosition
            );
            if (outputComponent) {
              this.componentMap.set(wire.to.id, outputComponent);
              this.circuitBoard.addComponent(outputComponent);
            } else {
              console.error(`Failed to create external output ${wire.to.id}. Skipping wire.`);
              continue;
            }
          }
          toComponent = this.componentMap.get(wire.to.id) || null;
          if (toComponent && toComponent.inputs.length > 0) {
            toPort = toComponent.inputs[0];
            const portKey = `${toComponent.id}-${0}`;
            if (usedInputPorts.has(portKey)) {
              console.warn(
                `External output ${wire.to.id} input port already connected. Skipping wire.`
              );
              continue;
            }
            usedInputPorts.add(portKey);
          } else {
            console.warn(
              `'To' component ${wire.to.id} (external) not found or has no input port. Skipping wire.`
            );
            continue;
          }
        } else {
          toComponent = this.componentMap.get(wire.to.id) || null;
          if (!toComponent) {
            console.warn(`'To' component ${wire.to.id} (gate) not found. Skipping wire.`);
            continue;
          }
          let foundPortIndex = -1;
          for (let i = 0; i < toComponent.inputs.length; i++) {
            const portKey = `${toComponent.id}-${i}`;
            if (!usedInputPorts.has(portKey)) {
              foundPortIndex = i;
              usedInputPorts.add(portKey);
              break;
            }
          }

          if (foundPortIndex !== -1) {
            toPort = toComponent.inputs[foundPortIndex];
          } else {
            console.warn(
              `Component ${toComponent.id} (Python ID: ${wire.to.id}) has no available input ports for wire from ${wire.from.id}. Skipping wire.`
            );
            continue;
          }
        }

        if (fromPort && toPort) {
          const newWire = new Wire(fromPort, true);
          const success = newWire.connect(toPort);
          if (success) {
            this.circuitBoard.addWire(newWire);
            fromPort.isConnected = true;
            toPort.isConnected = true;
          } else {
            console.error("Wire connection failed unexpectedly.");
          }
        } else {
          console.warn(
            `Could not create wire: From: ${wire.from.id}, To: ${wire.to.id}. Missing component or port object.`
          );
        }
      }

      this.repairMissingConnections();
      this.removeUnnecessaryToggles();

      this.circuitBoard.simulate();
      this.circuitBoard.draw();
    } catch (error) {
      console.error("Error processing Python analysis results:", error);
      alert(
        `Error processing analysis: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      this.circuitBoard.clearCircuit();
      this.circuitBoard.draw();
    }
  }

  private removeUnnecessaryToggles(): void {
    const components = this.circuitBoard.components;
    const toggles = components.filter(comp => comp.type === 'toggle');
    
    let togglesRemoved = 0;
    
    for (const toggle of toggles) {
      
      const connectedWire = this.circuitBoard.wires.find(w => 
        w.from?.component.id === toggle.id && w.from?.component.type === 'toggle');
      
      if (!connectedWire) {
        continue;
      }
      
      const connectedInput = connectedWire.to;
      if (!connectedInput) {
        continue;
      }
      
      for (const component of components) {
        
        if (component.id === toggle.id || component.type === 'toggle') continue;
        
        
        if (component.outputs && component.outputs.length > 0) {
          for (const outputPort of component.outputs) {
            
            if (outputPort.isConnected) continue;
            
            const distance = this.calculatePortDistance(outputPort, connectedInput);
            const thresholdToUse = 250;
            
            if (distance <= thresholdToUse) {
              const wireIndex = this.circuitBoard.wires.findIndex(w => w === connectedWire);
              if (wireIndex !== -1) {
                this.circuitBoard.wires.splice(wireIndex, 1);
              }
              
              
              const toggleIndex = this.circuitBoard.components.findIndex(c => c.id === toggle.id);
              if (toggleIndex !== -1) {
                this.circuitBoard.components.splice(toggleIndex, 1);
              }
              
              
              const newWire = new Wire(outputPort, true);
              const success = newWire.connect(connectedInput);
              
              if (success) {
                this.circuitBoard.addWire(newWire);
                togglesRemoved++;
                break;
              }
            }
          }
        }
      }
    }
  }

  private repairMissingConnections(): void {
    const components = this.circuitBoard.components;

    const unconnectedOutputs: Port[] = [];
    const unconnectedInputs: Port[] = [];

    components.forEach(component => {
      component.outputs.forEach(output => {
        if (!output.isConnected) unconnectedOutputs.push(output);
      });

      component.inputs.forEach(input => {
        if (!input.isConnected) unconnectedInputs.push(input);
      });
    });

    let directConnectionsAdded = 0;

    const directConnections = [];

    for (const output of unconnectedOutputs) {
      for (const input of unconnectedInputs) {
        if (output.component.id === input.component.id) continue;

        const distance = this.calculatePortDistance(output, input);

        if (distance <= this.DIRECT_CONNECTION_THRESHOLD) {
          directConnections.push({
            output,
            input,
            distance,
          });
        }
      }
    }

    directConnections.sort((a, b) => a.distance - b.distance);

    for (const conn of directConnections) {
      if (conn.output.isConnected || conn.input.isConnected) continue;

      const wire = new Wire(conn.output, true);
      const success = wire.connect(conn.input);

      if (success) {
        this.circuitBoard.addWire(wire);
        conn.output.isConnected = true;
        conn.input.isConnected = true;
        directConnectionsAdded++;
      }
    }

    const remainingOutputs = unconnectedOutputs.filter(o => !o.isConnected);

    let toggleConnectionsAdded = 0;

    for (const output of remainingOutputs) {
      if (output.isConnected) continue;

      const toggledInputs = components
        .filter(c => c.type === "toggle")
        .map(toggle => {
          const wire = this.circuitBoard.wires.find(
            w => w.from?.component.id === toggle.id && w.from?.component.type === "toggle"
          );
          return wire?.to;
        })
        .filter(Boolean) as Port[];

      if (toggledInputs.length === 0) continue;

      let closestDistance = Infinity;
      let closestInput: Port | null = null;
      let closestToggle: Component | null = null;

      for (const input of toggledInputs) {
        const distance = this.calculatePortDistance(output, input);

        if (distance <= this.TOGGLE_CONNECTION_THRESHOLD && distance < closestDistance) {
          closestDistance = distance;
          closestInput = input;

          const wire = this.circuitBoard.wires.find(w => w.to === input);
          closestToggle = wire?.from?.component || null;
        }
      }

      if (closestInput && closestToggle) {
        const toggleWire = this.circuitBoard.wires.find(w => w.to === closestInput);

        if (toggleWire) {
          const wireIndex = this.circuitBoard.wires.findIndex(w => w === toggleWire);
          if (wireIndex !== -1) {
            this.circuitBoard.wires.splice(wireIndex, 1);
          }

          const toggleIndex = this.circuitBoard.components.findIndex(c => c === closestToggle);
          if (toggleIndex !== -1) {
            this.circuitBoard.components.splice(toggleIndex, 1);
          }

          const wire = new Wire(output, true);
          const success = wire.connect(closestInput);

          if (success) {
            this.circuitBoard.addWire(wire);
            output.isConnected = true;
            toggleConnectionsAdded++;
          }
        }
      }
    }
  }

  private calculatePortDistance(port1: Port, port2: Port): number {
    const comp1 = port1.component;
    const comp2 = port2.component;

    const port1Pos = {
      x: comp1.position.x + port1.position.x,
      y: comp1.position.y + port1.position.y,
    };
    const port2Pos = {
      x: comp2.position.x + port2.position.x,
      y: comp2.position.y + port2.position.y,
    };

    const distance = Math.sqrt(
      Math.pow(port2Pos.x - port1Pos.x, 2) + Math.pow(port2Pos.y - port1Pos.y, 2)
    );

    return distance;
  }

  private mapComponentType(pythonType: string): string | null {
    const mappedType = this.componentTypeMap[pythonType.toUpperCase()];
    if (!mappedType) {
      console.warn(`No mapping found for Python component type: ${pythonType}`);
      return null;
    }
    return mappedType;
  }

  private calculateScaledPosition(
    originalPos: [number, number],
    dimensions: ImageDimensions
  ): Point {
    const canvasWidth = this.circuitBoard.getCanvasWidth();
    const canvasHeight = this.circuitBoard.getCanvasHeight();
    const safeWidth = dimensions.originalWidth || canvasWidth || 1;
    const safeHeight = dimensions.originalHeight || canvasHeight || 1;
    const x = (originalPos[0] / safeWidth) * canvasWidth;
    const y = (originalPos[1] / safeHeight) * canvasHeight;
    const padding = 30;
    const clampedX = Math.max(padding, Math.min(canvasWidth - padding * 2, x));
    const clampedY = Math.max(padding, Math.min(canvasHeight - padding * 2, y));
    return { x: clampedX, y: clampedY };
  }
}
