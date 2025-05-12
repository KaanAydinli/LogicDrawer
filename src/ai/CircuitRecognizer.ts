import { Point, Port } from "../models/Component";
import { CircuitBoard } from "../models/CircuitBoard";
import { Component } from "../models/Component"; // Import Component base class
import { Wire } from "../models/Wire";

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
  private componentMap: Map<string, Component>; // Map Python ID to CircuitBoard Component

  // Component type mapping (ensure it covers types from your Python script)
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


  private readonly DIRECT_CONNECTION_THRESHOLD = 250; // Direkt bağlantı için yakınlık eşiği
  private readonly TOGGLE_CONNECTION_THRESHOLD = 80;  // Toggle eklemek için yakınlık eşiği

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
        console.error("Invalid analysis result structure received:", analysisResult);
        alert("Error: Invalid data received from analysis.");
        return;
      }

      const { gates, wires } = analysisResult;

      console.log(`Creating ${gates.length} gate components...`);
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
          console.log(
            `Mapped Python ID ${gate.id} to internal Component ID ${component.id} (${component.type})`
          );
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

      console.log(`Processing ${wires.length} wires...`);
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
              console.log(
                `Created external input ${wire.from.id} (Toggle) near ${wire.to.id} with offset ${verticalOffset}`
              );
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
          console.log(
            `Adding wire from ${fromPort.component.id}[${fromPort.component.outputs.indexOf(fromPort)}] (Py: ${wire.from.id}) to ${toPort.component.id}[${toPort.component.inputs.indexOf(toPort)}] (Py: ${wire.to.id})`
          );
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

      console.log("Finished processing. Simulating and drawing.");
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

  private repairMissingConnections(): void {
    console.log("Starting circuit repair with intelligent connection strategy...");
    
    const components = this.circuitBoard.components;
    
    // Bağlanmamış portları topla
    const unconnectedOutputs: Port[] = [];
    const unconnectedInputs: Port[] = [];
    
    components.forEach(component => {
      component.outputs.forEach(output => {
        if (!output.isConnected) unconnectedOutputs.push(output);
      });
      
      component.inputs.forEach(input => {
        if (!input.isConnected) unconnectedInputs.push(input);
        if(input.component.type === 'toggle') unconnectedInputs.push(input); 
      });
    });
    
    console.log(`Found ${unconnectedOutputs.length} unconnected outputs and ${unconnectedInputs.length} unconnected inputs`);
    
    // ADIM 1: Öncelikli olarak yakın output-input çiftlerini bağla
    console.log("Step 1: Connecting close output-input pairs...");
    let directConnectionsAdded = 0;
    
    // Potansiyel bağlantıları topla ve mesafeye göre sırala
    const directConnections = [];
    
    for (const output of unconnectedOutputs) {
      for (const input of unconnectedInputs) {
        if (output.component.id === input.component.id) continue; // Kendine bağlantıyı engelle
        
        const distance = this.calculatePortDistance(output, input);
        console.log(`Direct connection check: ${output.component.id} (${output.component.type}) -> ${input.component.id} (${input.component.type}), distance: ${Math.round(distance)}`);
        
        if (distance <= this.DIRECT_CONNECTION_THRESHOLD) {
          directConnections.push({
            output,
            input,
            distance
          });
        }
      }
    }
    
    // Yakın olandan uzağa doğru sırala
    directConnections.sort((a, b) => a.distance - b.distance);
    
    // Yakın çiftleri bağla
    for (const conn of directConnections) {
      // Portlar halihazırda bağlı mı kontrol et
      if (conn.output.isConnected || conn.input.isConnected) continue;
      
      // Doğrudan bağlantı kur
      const wire = new Wire(conn.output, true);
      const success = wire.connect(conn.input);
      
      if (success) {
        this.circuitBoard.addWire(wire);
        conn.output.isConnected = true;
        conn.input.isConnected = true;
        directConnectionsAdded++;
        
        console.log(`Direct connection added: ${conn.output.component.id} (${conn.output.component.type}) -> ${conn.input.component.id} (${conn.input.component.type}), distance: ${Math.round(conn.distance)}`);
      }
    }
    
    console.log(`Added ${directConnectionsAdded} direct connections`);
    
    // Bağlı olmayan portları yeniden belirle
    const remainingOutputs = unconnectedOutputs.filter(o => !o.isConnected);
    const remainingInputs = unconnectedInputs.filter(i => !i.isConnected);
    
    // ADIM 2: Hala boşta olan output portlar için toggle'ı olan inputlar ara
    console.log("Step 2: Looking for toggle inputs for remaining outputs...");
    let toggleConnectionsAdded = 0;
    
    for (const output of remainingOutputs) {
      if (output.isConnected) continue;
      
      // Toggle'ı olan inputlar
      const toggledInputs = components
        .filter(c => c.type === 'toggle')
        .map(toggle => {
          const wire = this.circuitBoard.wires.find(w => 
            w.from?.component.id === toggle.id &&
            w.from?.component.type === 'toggle'
          );
          return wire?.to;
        })
        .filter(Boolean) as Port[];
      
      if (toggledInputs.length === 0) continue;
      
      // En yakın toggle'lı inputu bul
      let closestDistance = Infinity;
      let closestInput: Port | null = null;
      let closestToggle: Component | null = null;
      
      for (const input of toggledInputs) {
        const distance = this.calculatePortDistance(output, input);
        
        if (distance <= this.TOGGLE_CONNECTION_THRESHOLD && distance < closestDistance) {
          closestDistance = distance;
          closestInput = input;
          
          // Bu inputa bağlı toggle'ı bul
          const wire = this.circuitBoard.wires.find(w => w.to === input);
          closestToggle = wire?.from?.component || null;
        }
      }
      
      if (closestInput && closestToggle) {
        console.log(`Found toggle-connected input near output ${output.component.id} at distance ${Math.round(closestDistance)}`);
        
        // Toggle'ı kaldır ve direkt bağlantı kur
        const toggleWire = this.circuitBoard.wires.find(w => w.to === closestInput);
        
        if (toggleWire) {
          // Toggle'ı ve wire'ı kaldır
          const wireIndex = this.circuitBoard.wires.findIndex(w => w === toggleWire);
          if (wireIndex !== -1) {
            this.circuitBoard.wires.splice(wireIndex, 1);
          }
          
          const toggleIndex = this.circuitBoard.components.findIndex(c => c === closestToggle);
          if (toggleIndex !== -1) {
            this.circuitBoard.components.splice(toggleIndex, 1);
          }
          
          // Yeni bağlantı oluştur
          const wire = new Wire(output, true);
          const success = wire.connect(closestInput);
          
          if (success) {
            this.circuitBoard.addWire(wire);
            output.isConnected = true;
            toggleConnectionsAdded++;
            
            console.log(`Replaced toggle with direct connection from ${output.component.id} to ${closestInput.component.id}`);
          }
        }
      }
    }
     const finalUnconnectedOutputs = unconnectedOutputs.filter(o => !o.isConnected);  
    const finalUnconnectedInputs = unconnectedInputs.filter(i => !i.isConnected);
    console.log(`Replaced ${toggleConnectionsAdded} toggles with direct connections`);
    

    for (const input of finalUnconnectedInputs) {
    // Bu input zaten bağlı mı kontrol et (güvenlik için)
    if (input.isConnected) continue;
    
    // Yakın çıkış var mı kontrol et
    let hasNearbyOutput = false;
    
    for (const output of finalUnconnectedOutputs) {
      const distance = this.calculatePortDistance(output, input);
      if (distance <= this.DIRECT_CONNECTION_THRESHOLD) {
        hasNearbyOutput = true;
        break; // Yakında bir output varsa, toggle gerekmez
      }
    }
    
    // Yakında uygun bir çıkış yoksa toggle ekle
    if (!hasNearbyOutput) {
      const inputComponent = input.component;
      
      // Yeni toggle için pozisyon belirle
      const togglePosition: Point = {
        x: inputComponent.position.x - 2 * inputComponent.size.width, 
        y: inputComponent.position.y 
      };
      
      // Toggle oluştur
      const toggle = this.circuitBoard.createComponentByType('toggle', togglePosition);
      
      if (toggle) {
        this.circuitBoard.addComponent(toggle);
        
        // Toggle'dan input'a bağlantı oluştur
        const wire = new Wire(toggle.outputs[0], true);
        const success = wire.connect(input);
        
        if (success) {
          this.circuitBoard.addWire(wire);
          
          input.isConnected = true;
          
          console.log(`Added toggle switch at (${Math.round(togglePosition.x)},${Math.round(togglePosition.y)}) for isolated input on ${inputComponent.id} (${inputComponent.type})`);
        }
      }
    }
  }
    
    console.log("Intelligent connection repair complete.");
  }

  private removeUnnecessaryToggles(): void {
    console.log("Looking for unnecessary toggles to remove...");
    
    const components = this.circuitBoard.components;
    const toggles = components.filter(comp => comp.type === 'toggle');
    
    let togglesRemoved = 0;
    
    for (const toggle of toggles) {
      // Toggle'ın bağlı olduğu wire'ı bul
      const connectedWire = this.circuitBoard.wires.find(w => 
        w.from?.component.id === toggle.id && w.from?.component.type === 'toggle');
      
      if (!connectedWire) {
        console.log(`Toggle ${toggle.id} has no output connection, skipping`);
        continue;
      }
      
      const connectedInput = connectedWire.to;
      if (!connectedInput) {
        console.log(`Toggle ${toggle.id} has no connection to an input, skipping`);
        continue;
      }
      
      const inputComponent = connectedInput.component;
      
      // Yakındaki çıkışları bul
      for (const component of components) {
        // Kendimiz ya da toggle olmayan komponentleri kontrol et
        if (component.id === toggle.id || component.type === 'toggle') continue;
        
        // Komponentin çıkışları varsa
        if (component.outputs && component.outputs.length > 0) {
          for (const outputPort of component.outputs) {
            // Bu çıkış zaten bağlı mı kontrol et
            if (outputPort.isConnected) continue;
            
            const distance = this.calculatePortDistance(outputPort, connectedInput);
            console.log(`Distance from ${component.id} output to ${inputComponent.id} input: ${distance}`);
            
            // Eşik değerinden küçükse, toggle'ı kaldır ve doğrudan bağla
            if (distance <= this.DIRECT_CONNECTION_THRESHOLD && component.id !== inputComponent.id) {
              console.log(`Found unnecessary toggle: ${toggle.id} - Can connect ${component.id} to ${inputComponent.id} directly`);
              
              // Önce mevcut bağlantıyı kaldır
              const wireIndex = this.circuitBoard.wires.findIndex(w => w === connectedWire);
              if (wireIndex !== -1) {
                this.circuitBoard.wires.splice(wireIndex, 1);
              }
              
              // Toggle'ı kaldır
              const toggleIndex = this.circuitBoard.components.findIndex(c => c.id === toggle.id);
              if (toggleIndex !== -1) {
                this.circuitBoard.components.splice(toggleIndex, 1);
              }
              
              // Yeni bağlantı oluştur
              const newWire = new Wire(outputPort, true);
              const success = newWire.connect(connectedInput);
              
              if (success) {
                this.circuitBoard.addWire(newWire);
                togglesRemoved++;
                console.log(`Successfully removed toggle ${toggle.id} and connected ${component.id} directly to ${inputComponent.id}`);
                break;
              }
            }
          }
        }
      }
    }
    
    console.log(`Total toggles removed and replaced with direct connections: ${togglesRemoved}`);
  }

  private calculatePortDistance(port1: Port, port2: Port): number {
    const comp1 = port1.component;
    const comp2 = port2.component;
    
    // Portların dünya koordinatlarındaki pozisyonlarını hesapla
    const port1Pos = {
      x: comp1.position.x + port1.position.x,
      y: comp1.position.y + port1.position.y
    };
    
    const port2Pos = {
      x: comp2.position.x + port2.position.x,
      y: comp2.position.y + port2.position.y
    };
    
    // Öklidyen mesafeyi hesapla
    const distance = Math.sqrt(
      Math.pow(port2Pos.x - port1Pos.x, 2) + 
      Math.pow(port2Pos.y - port1Pos.y, 2)
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
