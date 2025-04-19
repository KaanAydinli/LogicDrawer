import { Point, Port } from '../models/Component';
import { CircuitBoard } from '../models/CircuitBoard';
import { Component } from '../models/Component'; // Import Component base class
import { Wire } from '../models/Wire';

// export interface DetectionResult {
//   class: string;
//   confidence: number;
//   x: number;
//   y: number;
//   width: number;
//   height: number;
//   class_id?: number;
//   detection_id?: string;
//   parent_id?: string;
// }


// export interface RoboflowResponse {
//   outputs?: Array<{
//     model_predictions?: {  
//       image: {
//         width: number;
//         height: number;
//       };
//       predictions: DetectionResult[];
//     };
//     predictions?: {  
//       image: {
//         width: number;
//         height: number;
//       };
//       predictions: DetectionResult[];
//     };
//   }>;
//   predictions?: DetectionResult[];
//   image?: {
//     width: number;
//     height: number;
//   };
// }

export interface ImageDimensions {
  originalWidth: number;
  originalHeight: number;
}
interface PythonGate {
  id: string; // e.g., "g1", "g2"
  type: string; // e.g., "AND", "NOT"
  position: [number, number]; // [x, y] center coordinates from Python (relative to original image)
}

interface PythonTerminal {
  id: string; // e.g., "g1", "input1", "output1"
  terminal: 'input' | 'output' | 'external';
}

interface PythonWire {
  from: PythonTerminal;
  to: PythonTerminal;
}

export interface PythonAnalysisResult {
  gates: PythonGate[];
  wires: PythonWire[];
}
// --- END NEW ---




export class CircuitRecognizer {
  // ... existing properties (circuitBoard, componentTypeMap) ...
  private circuitBoard: CircuitBoard;
  private componentMap: Map<string, Component>; // Map Python ID to CircuitBoard Component

  // Component type mapping (ensure it covers types from your Python script)
  private componentTypeMap: Record<string, string> = {
    'AND': 'and', 'OR': 'or', 'NOT': 'not', 'NAND': 'nand',
    'NOR': 'nor', 'XOR': 'xor', 'XNOR': 'xnor',
    // Add lowercase versions if Python might output lowercase
    'and': 'and', 'or': 'or', 'not': 'not', 'nand': 'nand',
    'nor': 'nor', 'xor': 'xor', 'xnor': 'xnor',
    // Map potential external types if needed, though handled separately
    // 'input': 'toggle',
    // 'output': 'light-bulb',
  };

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
      this.circuitBoard.clearCircuit(); // Start fresh
      this.componentMap.clear();

      if (!analysisResult || !analysisResult.gates || !analysisResult.wires) {
        console.error('Invalid analysis result structure received:', analysisResult);
        alert('Error: Invalid data received from analysis.');
        return;
      }

      const { gates, wires } = analysisResult;

      // --- 1. Create Gate Components ---
      console.log(`Creating ${gates.length} gate components...`);
      for (const gate of gates) {
        const componentType = this.mapComponentType(gate.type);
        if (!componentType) {
          console.warn(`Unknown component type from Python: ${gate.type} (ID: ${gate.id}). Skipping.`);
          continue;
        }
        const position = this.calculateScaledPosition(gate.position, dimensions);
        const component = this.circuitBoard.createComponentByType(componentType, position); // Use create, not add yet

        if (component) {
          this.componentMap.set(gate.id, component); // Map Python ID to Component object
          console.log(`Mapped Python ID ${gate.id} to internal Component ID ${component.id} (${component.type})`);
        } else {
          console.error(`Failed to create component object for type ${componentType} (Python ID: ${gate.id})`);
        }
      }
      // Add all created gate components to the board *after* mapping
      this.componentMap.forEach(component => {
          if (!component.type.startsWith('toggle') && !component.type.startsWith('light-bulb')) { // Avoid adding externals yet
             this.circuitBoard.addComponent(component);
          }
      });

      console.log(`Processing ${wires.length} wires...`);
      const usedInputPorts = new Set<string>();
      // REMOVE or COMMENT OUT fixed offset variables
      // let inputYOffset = 50;
      // let outputYOffset = 50;
      // const xInputOffset = 50;
      // const xOutputOffset = this.circuitBoard.getCanvasWidth() - 50;
      const externalOffset = 120; // Distance from gate for external components

      for (const wire of wires) {
        let fromComponent: Component | null = null;
        let toComponent: Component | null = null;
        let fromPort: Port | null = null;
        let toPort: Port | null = null;
        let gateForPositioning: Component | null = null; // Gate to position relative to

        // --- Handle FROM side ---
        if (wire.from.terminal === 'external') {
          gateForPositioning = this.componentMap.get(wire.to.id) || null; // Position relative to the 'to' gate
          if (!this.componentMap.has(wire.from.id)) {
            if (!gateForPositioning) {
                console.error(`Cannot place external input ${wire.from.id}: Target gate ${wire.to.id} not found.`);
                continue;
            }
            // Calculate position to the left of the gate
            const targetPosition: Point = {
                x: gateForPositioning.position.x - externalOffset,
                y: gateForPositioning.position.y // Adjust Y slightly if needed based on port
            };
            // TODO: Add overlap check/adjustment if necessary
            const inputComponent = this.circuitBoard.createComponentByType('toggle', targetPosition);
            if (inputComponent) {
              this.componentMap.set(wire.from.id, inputComponent);
              this.circuitBoard.addComponent(inputComponent);
              console.log(`Created external input ${wire.from.id} (Toggle) near ${wire.to.id}`);
            } else {
               console.error(`Failed to create external input ${wire.from.id}. Skipping wire.`);
               continue;
            }
          }
          fromComponent = this.componentMap.get(wire.from.id) || null;
          if (fromComponent && fromComponent.outputs.length > 0) {
             fromPort = fromComponent.outputs[0];
          } else {
             console.warn(`'From' component ${wire.from.id} (external) not found or has no output port. Skipping wire.`);
             continue;
          }
        } else { // From a gate output
          fromComponent = this.componentMap.get(wire.from.id) || null;
          if (fromComponent && fromComponent.outputs.length > 0) {
             fromPort = fromComponent.outputs[0];
          } else {
             console.warn(`'From' component ${wire.from.id} (gate) not found or has no output port. Skipping wire.`);
             continue;
          }
        }

        // --- Handle TO side ---
        if (wire.to.terminal === 'external') {
           gateForPositioning = this.componentMap.get(wire.from.id) || null; // Position relative to the 'from' gate
           if (!this.componentMap.has(wire.to.id)) {
             if (!gateForPositioning) {
                console.error(`Cannot place external output ${wire.to.id}: Source gate ${wire.from.id} not found.`);
                continue;
             }
             // Calculate position to the right of the gate
             const targetPosition: Point = {
                x: gateForPositioning.position.x + gateForPositioning.size.width + externalOffset, // Place right of the gate
                y: gateForPositioning.position.y // Adjust Y slightly if needed
             };
             // TODO: Add overlap check/adjustment if necessary
             const outputComponent = this.circuitBoard.createComponentByType('light-bulb', targetPosition);
             if (outputComponent) {
                this.componentMap.set(wire.to.id, outputComponent);
                this.circuitBoard.addComponent(outputComponent);
                console.log(`Created external output ${wire.to.id} (LightBulb) near ${wire.from.id}`);
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
                 console.warn(`External output ${wire.to.id} input port already connected. Skipping wire.`);
                 continue;
             }
             usedInputPorts.add(portKey);
          } else {
             console.warn(`'To' component ${wire.to.id} (external) not found or has no input port. Skipping wire.`);
             continue;
          }
        } else { // To a gate input
          toComponent = this.componentMap.get(wire.to.id) || null;
          if (!toComponent) {
             console.warn(`'To' component ${wire.to.id} (gate) not found. Skipping wire.`);
             continue;
          }
          // Find the next available input port index (Same as before)
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
              console.warn(`Component ${toComponent.id} (Python ID: ${wire.to.id}) has no available input ports for wire from ${wire.from.id}. Skipping wire.`);
              continue;
          }
        }

        // --- Create the Wire (Same as before) ---
        if (fromPort && toPort) {
          console.log(`Adding wire from ${fromPort.component.id}[${fromPort.component.outputs.indexOf(fromPort)}] (Py: ${wire.from.id}) to ${toPort.component.id}[${toPort.component.inputs.indexOf(toPort)}] (Py: ${wire.to.id})`);
          const newWire = new Wire(fromPort, true); // Create wire with fromPort
          const success = newWire.connect(toPort); // Connect the 'to' port
          if (success) {
              this.circuitBoard.addWire(newWire); // Add wire only if connection is successful
              fromPort.isConnected = true;
              toPort.isConnected = true;
          } else {
              console.error("Wire connection failed unexpectedly.");
              // Don't add the wire if connection failed
          }
        } else {
          console.warn(`Could not create wire: From: ${wire.from.id}, To: ${wire.to.id}. Missing component or port object.`);
        }
      }

      // --- 3. Finalize (Same as before) ---
      console.log("Finished processing. Simulating and drawing.");
      this.circuitBoard.simulate();
      this.circuitBoard.draw();

    } catch (error) {
      console.error('Error processing Python analysis results:', error);
      alert(`Error processing analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.circuitBoard.clearCircuit();
      this.circuitBoard.draw();
    }
  }

  // ... (mapComponentType and calculateScaledPosition remain the same) ...
  private mapComponentType(pythonType: string): string | null {
    const mappedType = this.componentTypeMap[pythonType.toUpperCase()];
    if (!mappedType) {
       console.warn(`No mapping found for Python component type: ${pythonType}`);
       return null;
    }
    return mappedType;
  }

  private calculateScaledPosition(originalPos: [number, number], dimensions: ImageDimensions): Point {
    const canvasWidth = this.circuitBoard.getCanvasWidth();
    const canvasHeight = this.circuitBoard.getCanvasHeight();
    const safeWidth = dimensions.originalWidth || canvasWidth || 1;
    const safeHeight = dimensions.originalHeight || canvasHeight || 1;
    const x = (originalPos[0] / safeWidth) * canvasWidth;
    const y = (originalPos[1] / safeHeight) * canvasHeight;
    const padding = 30; // Increased padding slightly
    const clampedX = Math.max(padding, Math.min(canvasWidth - padding * 2, x)); // Ensure space on right too
    const clampedY = Math.max(padding, Math.min(canvasHeight - padding * 2, y));
    return { x: clampedX, y: clampedY };
  }

}