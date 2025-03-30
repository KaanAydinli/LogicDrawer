import { Component, Point } from "../Component";
import { CircuitBoard } from "../CircuitBoard";
import { VerilogParser, VerilogModule, VerilogGate, VerilogPort } from "./VerilogParser";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { LightBulb } from "../components/LightBulb";
import { AndGate } from "../gates/AndGate";
import { OrGate } from "../gates/OrGate";
import { NotGate } from "../gates/NotGate";
import { XorGate } from "../gates/XorGate";
import { NandGate } from "../gates/NandGate";
import { NorGate } from "../gates/NorGate";
import { XnorGate } from "../gates/XnorGate";
import { Mux2 } from "../gates/Mux2";
import { Mux4 } from "../gates/Mux4";
import { Wire } from "../Wire";

export class VerilogCircuitConverter {
  private parser: VerilogParser;
  private circuitBoard: CircuitBoard;
  private componentPositions: Map<string, Point> = new Map();
  private components: { [name: string]: Component } = {};
  private outputPorts: { [name: string]: any } = {};
  
  constructor(circuitBoard: CircuitBoard) {
    this.parser = new VerilogParser();
    this.circuitBoard = circuitBoard;
  }

  importVerilogCode(code: string): boolean {
    try {
      // Parse Verilog code
      const module = this.parser.parseVerilog(code);
      console.log("Parsed module:", module);
      
      // Clear existing circuit
      this.circuitBoard.clearCircuit();
      this.components = {};
      this.outputPorts = {};
      this.componentPositions.clear();
      
      // Analyze circuit structure
      const { signalLayers, signalDependencies } = this.analyzeCircuitStructure(module);
      
      // Organize and position components
      this.organizeAndPositionComponents(module, signalLayers, signalDependencies);
      
      // Create circuit components
      this.buildCircuit(module);
      
      // Update circuit
      this.circuitBoard.simulate();
      this.circuitBoard.draw();
      
      return true;
    } catch (error) {
      console.error("Error importing Verilog code:", error);
      return false;
    }
  }
  
  // private detectSpecialCircuit(module: VerilogModule): string | null {
  //   const gateTypes = module.gates.map(g => g.type);
  //   const inputCount = module.inputs.length;
  //   const outputCount = module.outputs.length;
    
  //   // Check for adder/subtractor circuit
  //   if (gateTypes.includes('xor') && 
  //       (gateTypes.includes('and') || gateTypes.includes('or')) &&
  //       inputCount >= 3 && outputCount >= 2) {
        
  //     // Look for mode/cin input pattern
  //     const hasMode = module.inputs.some(i => 
  //       i.name === 'mode' || i.name === 'cin' || i.name === 'subtract'
  //     );
      
  //     if (hasMode) {
  //       return 'addsub';
  //     }
  //   }
    
  //   // Check for multiplexer circuit
  //   if (gateTypes.includes('and') && gateTypes.includes('or') && 
  //       module.inputs.some(i => 
  //         i.name.includes('sel') || i.name === 'select' || i.name === 'mode'
  //       )) {
  //     return 'multiplexer';
  //   }
    
  //   return null;
  // }
  
  // private createSpecialCircuit(module: VerilogModule, circuitType: string): boolean {
  //   switch (circuitType) {
  //     case 'addsub':
  //       return this.createAdderSubtractorCircuit(module);
  //     case 'multiplexer':
  //       return this.createMultiplexerCircuit(module);
  //     default:
  //       console.warn(`Unknown special circuit type: ${circuitType}`);
  //       return false;
  //   }
  // }
  
  // private createAdderSubtractorCircuit(module: VerilogModule): boolean {
  //   // Group inputs by data buses (a, b) and control (mode)
  //   const inputGroups = this.groupRelatedSignals(module.inputs);
  //   const controlSignals = module.inputs.filter(i => 
  //     i.name === 'mode' || i.name === 'cin' || i.name === 'subtract'
  //   );
    
  //   // Position components
  //   const xSpacing = 150;
  //   const ySpacing = 80;
  //   let xPos = 100;
  //   let yPos = 100;
    
  //   // Position input groups (a0-an, b0-bn) vertically aligned
  //   let maxBits = 0;
  //   const dataBuses = inputGroups.filter(group => group.length > 1);
    
  //   dataBuses.forEach((bus, busIndex) => {
  //     maxBits = Math.max(maxBits, bus.length);
  //     bus.forEach((signal, bitIndex) => {
  //       this.componentPositions.set(signal.name, {
  //         x: xPos + busIndex * 100,  // Offset each bus horizontally
  //         y: yPos + bitIndex * ySpacing
  //       });
  //     });
  //   });
    
  //   // Position control signals
  //   controlSignals.forEach((signal, index) => {
  //     this.componentPositions.set(signal.name, {
  //       x: xPos,
  //       y: yPos + maxBits * ySpacing + (index + 1) * ySpacing
  //     });
  //   });
    
  //   // Calculate gate positions based on bit slices
  //   const fullAdderWidth = 150; // Width of a full adder slice
  //   xPos += 200; // Start gates after inputs
    
  //   // Group gates by bit position they operate on
  //   const gatesByBit = this.groupGatesByBitPosition(module);
    
  //   // Position gates for each bit
  //   Object.entries(gatesByBit).forEach(([bitIndex, gates]) => {
  //     const bitPos = parseInt(bitIndex);
      
  //     // Calculate layer for each gate in this bit slice
  //     const gateLayers = this.layerGatesWithinBitSlice(gates);
      
  //     // Position each gate
  //     gates.forEach(gate => {
  //       const layer = gateLayers.get(gate.output) || 0;
  //       this.componentPositions.set(gate.output, {
  //         x: xPos + layer * fullAdderWidth,
  //         y: yPos + bitPos * ySpacing * 2 // More space between bit slices
  //       });
  //     });
  //   });
    
  //   // Position outputs
  //   xPos = Math.max(...Array.from(this.componentPositions.values()).map(p => p.x)) + 200;
    
  //   module.outputs.forEach((output, index) => {
  //     // Try to determine bit position from output name
  //     const bitMatch = output.name.match(/(\d+)$/);
  //     let bitPos = index;
      
  //     if (bitMatch) {
  //       bitPos = parseInt(bitMatch[1]);
  //     }
      
  //     this.componentPositions.set(output.name, {
  //       x: xPos,
  //       y: yPos + bitPos * ySpacing
  //     });
  //   });
    
  //   // Create components and connections
  //   return this.buildCircuit(module);
  // }
  
  // private createMultiplexerCircuit(module: VerilogModule): boolean {
  //   // Identify select signals
  //   const selectSignals = module.inputs.filter(i => 
  //     i.name.includes('sel') || i.name === 'select' || i.name === 'mode'
  //   );
    
  //   // Group data inputs
  //   const dataInputs = module.inputs.filter(i => !selectSignals.includes(i));
  //   const inputGroups = this.groupRelatedSignals(dataInputs);
    
  //   // Position components
  //   const xPos = 100;
  //   let yPos = 100;
  //   const ySpacing = 80;
    
  //   // Position select signals at top
  //   selectSignals.forEach((signal, index) => {
  //     this.componentPositions.set(signal.name, {
  //       x: xPos,
  //       y: yPos + index * ySpacing
  //     });
  //   });
    
  //   // Position data input groups
  //   yPos += selectSignals.length * ySpacing + 40; // Extra spacing after select signals
    
  //   inputGroups.forEach(group => {
  //     group.forEach((signal, index) => {
  //       this.componentPositions.set(signal.name, {
  //         x: xPos,
  //         y: yPos + index * ySpacing
  //       });
  //     });
      
  //     yPos += group.length * ySpacing + 20; // Extra spacing between groups
  //   });
    
  //   // Position gates in layers
  //   const { signalLayers } = this.analyzeCircuitStructure(module);
  //   const maxLayer = Math.max(...Array.from(signalLayers.values()));
    
  //   // Group gates by layer
  //   const gatesByLayer = new Map<number, VerilogGate[]>();
    
  //   module.gates.forEach(gate => {
  //     const layer = signalLayers.get(gate.output) || 1;
  //     if (!gatesByLayer.has(layer)) {
  //       gatesByLayer.set(layer, []);
  //     }
  //     gatesByLayer.get(layer)!.push(gate);
  //   });
    
  //   // Position gates in each layer
  //   for (let layer = 1; layer <= maxLayer; layer++) {
  //     const gates = gatesByLayer.get(layer) || [];
  //     const layerXPos = xPos + layer * 150;
      
  //     gates.forEach((gate, index) => {
  //       // Try to center gates vertically based on their inputs
  //       const inputPositions = gate.inputs
  //         .map(input => this.componentPositions.get(input))
  //         .filter(pos => pos !== undefined) as Point[];
        
  //       let gateYPos = yPos + index * ySpacing;
        
  //       // If we have input positions, center the gate
  //       if (inputPositions.length > 0) {
  //         const avgY = inputPositions.reduce((sum, pos) => sum + pos.y, 0) / inputPositions.length;
  //         gateYPos = avgY;
  //       }
        
  //       this.componentPositions.set(gate.output, {
  //         x: layerXPos,
  //         y: gateYPos
  //       });
  //     });
  //   }
    
  //   // Position outputs
  //   const outputXPos = xPos + (maxLayer + 1) * 150;
    
  //   module.outputs.forEach((output, index) => {
  //     // Try to align with its source
  //     let outputYPos = 100 + index * ySpacing;
      
  //     // Find the gate that produces this output
  //     const sourceGate = module.gates.find(g => g.output === output.name);
  //     if (sourceGate) {
  //       const sourcePos = this.componentPositions.get(sourceGate.output);
  //       if (sourcePos) {
  //         outputYPos = sourcePos.y;
  //       }
  //     }
      
  //     this.componentPositions.set(output.name, {
  //       x: outputXPos,
  //       y: outputYPos
  //     });
  //   });
    
  //   return this.buildCircuit(module);
  // }
  
  private analyzeCircuitStructure(module: VerilogModule): { 
    signalLayers: Map<string, number>,
    signalDependencies: Map<string, string[]>
  } {
    const signalLayers = new Map<string, number>();
    const signalDependencies = new Map<string, string[]>();
    
    // Initialize all inputs to layer 0
    module.inputs.forEach(input => {
      signalLayers.set(input.name, 0);
      signalDependencies.set(input.name, []);
    });
    
    // Build dependency graph
    module.gates.forEach(gate => {
      signalDependencies.set(gate.output, [...gate.inputs]);
    });
    
    // Assign layers through topological sort
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const gate of module.gates) {
        const inputLayers = gate.inputs
          .map(input => signalLayers.get(input) || 0)
          .filter(layer => layer !== undefined);
        
        if (inputLayers.length === 0) continue;
        
        const gateLayer = Math.max(...inputLayers) + 1;
        
        if (!signalLayers.has(gate.output) || signalLayers.get(gate.output)! < gateLayer) {
          signalLayers.set(gate.output, gateLayer);
          changed = true;
        }
      }
    }
    
    return { signalLayers, signalDependencies };
  }
  
  private organizeAndPositionComponents(
    module: VerilogModule, 
    signalLayers: Map<string, number>,
    signalDependencies: Map<string, string[]>
  ): void {
    // 1. Group related inputs
    const inputGroups = this.groupRelatedSignals(module.inputs);
  
    // 2. Determine circuit depth and width
    const maxLayer = Math.max(...Array.from(signalLayers.values()));
    const xBase = 100;
    const yBase = 0;
    const xLayerSpacing = 180;
    const yComponentSpacing = 200; // Increase this to 200 from whatever it was
    
    // 3. Position inputs with better spacing
    let yPos = yBase;
    const usedPositions = new Set<number>(); // Track used Y positions
    
    inputGroups.forEach(group => {
      const isControlGroup = group.some(input => 
        input.name.includes('mode') || input.name.includes('sel') || input.name === 's' ||
        input.name === 'clk' || input.name === 'reset'
      );
      
      if (isControlGroup) {
        group.forEach((input, index) => {
          const y = yBase + (index ) * yComponentSpacing;
          usedPositions.add(y);
          this.componentPositions.set(input.name, {
            x: xBase + 100,
            y: y 
          });
        });
        
        yPos = yBase + group.length * yComponentSpacing + 100; // Extra spacing after controls
      } else {
        // Make sure we don't overlap with any existing positions
        if (usedPositions.has(yPos)) {
          // Find next available position
          while (usedPositions.has(yPos)) {
            yPos += 100;
          }
        }
        
        group.forEach((input, index) => {
          const y = yPos + index * yComponentSpacing;
          usedPositions.add(y);
          this.componentPositions.set(input.name, {
            x: xBase,
            y: y
          });
        });
        
        yPos += group.length * yComponentSpacing + 100; // Increased spacing
      }
    });
    
    // 4. Group gates by layer
    const gatesByLayer = new Map<number, VerilogGate[]>();
    
    module.gates.forEach(gate => {
      const layer = signalLayers.get(gate.output) || 1;
      if (!gatesByLayer.has(layer)) {
        gatesByLayer.set(layer, []);
      }
      gatesByLayer.get(layer)!.push(gate);
    });
    
    // 5. Position gates by layer
    for (let layer = 1; layer <= maxLayer; layer++) {
      const gates = gatesByLayer.get(layer) || [];
      const xPos = xBase + layer * xLayerSpacing;
      
      gates.forEach((gate, index) => {
        // Try to position gates near their inputs
        const inputPositions = gate.inputs
          .map(input => this.componentPositions.get(input))
          .filter(pos => pos !== undefined) as Point[];
        
        let gateYPos = yBase + index * yComponentSpacing;
        
        if (inputPositions.length > 0) {
          // Find the average Y position of inputs
          const avgY = inputPositions.reduce((sum, pos) => sum + pos.y, 0) / inputPositions.length;
          gateYPos = avgY;
          
          // Make sure gates in the same layer don't overlap
          const minSpacing = 100;
          const overlappingGate = gates.slice(0, index).find(g => {
            const pos = this.componentPositions.get(g.output);
            return pos && Math.abs(pos.y - gateYPos) < minSpacing;
          });
          
          if (overlappingGate) {
            const overlapPos = this.componentPositions.get(overlappingGate.output)!;
            gateYPos = overlapPos.y + minSpacing;
          }
        }
        
        this.componentPositions.set(gate.output, {
          x: xPos,
          y: gateYPos
        });
      });
    }
    
    // 6. Position outputs
    const outputXPos = xBase + (maxLayer + 1) * xLayerSpacing + 50; // Add extra spacing
    
    // Try to group related outputs
    const outputGroups = this.groupRelatedSignals(module.outputs);
    
    // First pass: collect all outputs with their preferred Y positions
    const outputPositions: {output: VerilogPort, y: number}[] = [];
    
    yPos = yBase;
    outputGroups.forEach(group => {
      group.forEach((output, index) => {
        // Try to align with source if possible
        let outputYPos = yPos + index * yComponentSpacing;
        
        // Find source gate for this output
        const sourceGate = module.gates.find(g => g.output === output.name);
        if (sourceGate) {
          const sourcePos = this.componentPositions.get(sourceGate.output);
          if (sourcePos) {
            outputYPos = sourcePos.y;
          }
        }
        
        outputPositions.push({output, y: outputYPos});
      });
      
      // Calculate next position
      const lastPos = group.map(out => 
        outputPositions.find(p => p.output.name === out.name)?.y || 0
      );
      if (lastPos.length > 0) {
        yPos = Math.max(...lastPos) + yComponentSpacing;
      } else {
        yPos += group.length * yComponentSpacing + 20;
      }
    });
    
    // Second pass: fix overlapping outputs by ensuring minimum spacing
    outputPositions.sort((a, b) => a.y - b.y);
    for (let i = 1; i < outputPositions.length; i++) {
      const minSpacing = 100; // Minimum spacing between bulbs
      const prev = outputPositions[i-1];
      const current = outputPositions[i];
      
      if (current.y - prev.y < minSpacing) {
        current.y = prev.y + minSpacing;
      }
    }
    
    // Apply final positions
    outputPositions.forEach(({output, y}) => {
      this.componentPositions.set(output.name, {
        x: outputXPos,
        y: y
      });
    });
  }
  
  private groupRelatedSignals(signals: VerilogPort[]): VerilogPort[][] {
    const groups: { [key: string]: VerilogPort[] } = {};
    
    // First, group by naming patterns
    signals.forEach(signal => {
      const match = signal.name.match(/^([a-zA-Z_]+)(\d+)$/);
      
      if (match) {
        // Signal with numeric suffix (a0, a1, etc.)
        const baseName = match[1];
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(signal);
      } else {
        // Special signals like mode, cin, etc.
        // Special groups for control-like signals
        if (signal.name === 'mode' || signal.name === 'cin' || signal.name === 'reset' || 
            signal.name === 'clk' || signal.name.includes('sel')) {
          if (!groups['control']) groups['control'] = [];
          groups['control'].push(signal);
        } else {
          // No pattern match, treat as unique
          if (!groups[signal.name]) groups[signal.name] = [];
          groups[signal.name].push(signal);
        }
      }
    });
    
    // Sort each group - numeric suffixes in descending order (MSB first)
    Object.values(groups).forEach(group => {
      group.sort((a, b) => {
        const numA = parseInt(a.name.replace(/^\D+/g, "") || "0");
        const numB = parseInt(b.name.replace(/^\D+/g, "") || "0");
        return numB - numA; // Descending order (MSB first)
      });
    });
    
    // Convert to array of groups
    return Object.values(groups);
  }
  
  private groupGatesByBitPosition(module: VerilogModule): { [key: number]: VerilogGate[] } {
    const result: { [key: number]: VerilogGate[] } = {};
    
    // Try to determine which bit each gate operates on
    module.gates.forEach(gate => {
      // Try to extract bit index from inputs
      const bitIndices = gate.inputs
        .map(input => {
          const match = input.match(/(\d+)$/);
          return match ? parseInt(match[1]) : -1;
        })
        .filter(idx => idx >= 0);
      
      // If we found bit indices, use the first one
      if (bitIndices.length > 0) {
        const bitIndex = bitIndices[0];
        if (!result[bitIndex]) result[bitIndex] = [];
        result[bitIndex].push(gate);
      } else {
        // If we can't determine bit index from inputs, try from output
        const outputMatch = gate.output.match(/(\d+)$/);
        if (outputMatch) {
          const bitIndex = parseInt(outputMatch[1]);
          if (!result[bitIndex]) result[bitIndex] = [];
          result[bitIndex].push(gate);
        } else {
          // Can't determine bit position, put in group -1
          if (!result[-1]) result[-1] = [];
          result[-1].push(gate);
        }
      }
    });
    
    return result;
  }
  
  private layerGatesWithinBitSlice(gates: VerilogGate[]): Map<string, number> {
    const layers = new Map<string, number>();
    const dependencies = new Map<string, string[]>();
    
    // Build dependency graph
    gates.forEach(gate => {
      dependencies.set(gate.output, [...gate.inputs]);
    });
    
    // Assign layers through topological sort
    let changed = true;
    let iteration = 0;
    
    while (changed && iteration < 10) {
      changed = false;
      iteration++;
      
      for (const gate of gates) {
        // Find inputs that are outputs of other gates in this slice
        const sliceInputs = gate.inputs.filter(input => 
          gates.some(g => g.output === input)
        );
        
        // Calculate max layer of dependencies
        const inputLayers = sliceInputs
          .map(input => layers.get(input) || 0)
          .filter(layer => layer !== undefined);
        
        // If this gate depends on other gates in the slice, its layer is max + 1
        let gateLayer = 0;
        if (inputLayers.length > 0) {
          gateLayer = Math.max(...inputLayers) + 1;
        }
        
        // Update layer if needed
        if (!layers.has(gate.output) || layers.get(gate.output)! < gateLayer) {
          layers.set(gate.output, gateLayer);
          changed = true;
        }
      }
    }
    
    return layers;
  }
  
  private buildCircuit(module: VerilogModule): boolean {
    try {
      // Create input components
      module.inputs.forEach(input => {
        const position = this.componentPositions.get(input.name) || { x: 100, y: 100 };
        
        // Handle bit vectors by creating multiple toggles for each bit
        if (input.bitWidth && input.bitWidth > 1) {
          // Add label above component to indicate bit vector name
          console.log(`Creating bit vector input: ${input.name}[${input.msb}:${input.lsb}]`);
          
          // Create individual toggles for each bit
          this.createBitVectorInput(input, position);
        } else {
          // Single bit input
          const toggle = new ToggleSwitch(position);
          this.components[input.name] = toggle;
          this.outputPorts[input.name] = toggle.outputs[0];
          this.circuitBoard.addComponent(toggle);
        }
      });
      
      // Create gates in order of dependencies
      // Sort gates by their position's x-coordinate to ensure dependencies are met
      const sortedGates = [...module.gates].sort((a, b) => {
        const posA = this.componentPositions.get(a.output) || { x: 0, y: 0 };
        const posB = this.componentPositions.get(b.output) || { x: 0, y: 0 };
        return posA.x - posB.x;
      });
      
      for (const gate of sortedGates) {
        const position = this.componentPositions.get(gate.output) || { x: 200, y: 200 };
        let component: Component | null = null;
        
        // Create gate component based on type
        switch (gate.type.toLowerCase()) {
          case 'and':
            component = new AndGate(position);
            break;
          case 'or':
            component = new OrGate(position);
            break;
          case 'not':
            component = new NotGate(position);
            break;
          case 'xor':
            component = new XorGate(position);
            break;
          case 'nand':
            component = new NandGate(position);
            break;
          case 'nor':
            component = new NorGate(position);
            break;
          case 'xnor':
            component = new XnorGate(position);
            break;
          case 'mux2':
            component = new Mux2(position);
            break;
          case 'mux4':
            component = new Mux4(position);
            break;
          default:
            console.error(`Unsupported gate type: ${gate.type}`);
        }
        
        if (component) {
          // Add component to circuit
          this.components[gate.output] = component;
          this.outputPorts[gate.output] = component.outputs[0];
          this.circuitBoard.addComponent(component);
          
          // Handle bit selections in the inputs (e.g., "a[0]", "b[1:0]")
          this.connectGateInputs(gate, component);
        }
      }
      
      // Create output components
      module.outputs.forEach((output) => {
        const position = this.componentPositions.get(output.name) || { x: 500, y: 200 };
        
        // Handle bit vectors for outputs
        if (output.bitWidth && output.bitWidth > 1) {
          console.log(`Creating bit vector output: ${output.name}[${output.msb}:${output.lsb}]`);
          this.createBitVectorOutput(output, position);
        } else {
          // Single bit output
          const bulbPosition = { 
            x: position.x + 200, 
            y: position.y 
          };
          
          const bulb = new LightBulb(bulbPosition);
          this.components[output.name + "_bulb"] = bulb;
          this.circuitBoard.addComponent(bulb);
          
          // Connect output to source
          this.connectOutput(output.name, bulb);
        }
      });
      
      return true;
    } catch (error) {
      console.error("Error building circuit:", error);
      return false;
    }
  }
  
  // Helper method to create bit vector inputs
  private createBitVectorInput(input: VerilogPort, basePosition: Point): void {
    if (!input.bitWidth || !input.msb || !input.lsb) return;
    
    const ySpacing = 60;
    
    // Determine direction (msb > lsb or lsb > msb)
    const ascending = input.msb < input.lsb;
    const startBit = ascending ? input.msb : input.lsb;
    const endBit = ascending ? input.lsb : input.msb;
    
    for (let bit = startBit; bit <= endBit; bit++) {
      const bitIndex = ascending ? bit - startBit : endBit - bit;
      const position = {
        x: basePosition.x,
        y: basePosition.y + bitIndex * ySpacing
      };
      
      const bitName = `${input.name}[${bit}]`;
      const toggle = new ToggleSwitch(position);
      
      this.components[bitName] = toggle;
      this.outputPorts[bitName] = toggle.outputs[0];
      this.circuitBoard.addComponent(toggle);
    }
  }
  
  // Helper method to create bit vector outputs
  private createBitVectorOutput(output: VerilogPort, basePosition: Point): void {
    if (!output.bitWidth || !output.msb || !output.lsb) return;
    
    const ySpacing = 60;
    
    // Determine direction (msb > lsb or lsb > msb)
    const ascending = output.msb < output.lsb;
    const startBit = ascending ? output.msb : output.lsb;
    const endBit = ascending ? output.lsb : output.msb;
    
    for (let bit = startBit; bit <= endBit; bit++) {
      const bitIndex = ascending ? bit - startBit : endBit - bit;
      const position = {
        x: basePosition.x + 20,
        y: basePosition.y + bitIndex * ySpacing
      };
      
      const bitName = `${output.name}[${bit}]`;
      const bulb = new LightBulb(position);
      
      this.components[bitName + "_bulb"] = bulb;
      this.circuitBoard.addComponent(bulb);
      
      // Connect output bit to source
      this.connectOutput(bitName, bulb);
    }
  }
  
  // Helper method to connect gate inputs considering bit selections
  private connectGateInputs(gate: VerilogGate, component: Component): void {
    for (let j = 0; j < gate.inputs.length; j++) {
      if (j >= component.inputs.length) {
        console.error(`Gate ${gate.type} has more inputs than supported: ${j+1} > ${component.inputs.length}`);
        continue;
      }
      
      const inputName = gate.inputs[j];
      
      // Check for bit selection in the input (e.g., "a[0]", "b[1:0]")
      let sourcePort = this.outputPorts[inputName];
      
      // If not found directly, try to parse bit selection
      if (!sourcePort) {
        const bitSelectionMatch = inputName.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
        if (bitSelectionMatch) {
          const [, baseName, msb, lsb] = bitSelectionMatch;
          
          // Single bit selection (e.g., "a[0]")
          if (!lsb) {
            sourcePort = this.outputPorts[`${baseName}[${msb}]`];
          }
          // Multi-bit selection not directly supported, would need to build logic
        }
      }
      
      // Connect if source port found
      if (sourcePort) {
        const wire = new Wire(sourcePort);
        wire.connect(component.inputs[j]);
        this.circuitBoard.addWire(wire);
      } else {
        console.error(`Source port for ${inputName} not found, needed for ${gate.output}`);
      }
    }
  }
  
  // Helper method to connect outputs
  private connectOutput(outputName: string, bulb: Component): void {
    // Connect output to source
    const sourceGate = this.findSourceForOutput(outputName);
    let sourcePort;
    
    if (sourceGate) {
      sourcePort = this.outputPorts[sourceGate.output];
    } else {
      // Output might be directly connected to an input
      sourcePort = this.outputPorts[outputName];
    }
    
    if (sourcePort) {
      const wire = new Wire(sourcePort);
      wire.connect(bulb.inputs[0]);
      this.circuitBoard.addWire(wire);
    } else {
      console.error(`Source port for output ${outputName} not found`);
    }
  }
  
  // Helper to find the gate that produces a given output
  private findSourceForOutput(outputName: string): VerilogGate | undefined {
    // First check if any gate directly outputs this signal
    const directGate = this.parser.getModule()?.gates.find(g => g.output === outputName);
    if (directGate) return directGate;
    
    // Check for bit selections
    const bitSelectionMatch = outputName.match(/^(\w+)\[(\d+)\]$/);
    if (bitSelectionMatch) {
      const [, baseName, bitIndex] = bitSelectionMatch;
      // Try to find a gate that outputs to this specific bit
      return this.parser.getModule()?.gates.find(g => 
        g.output === `${baseName}[${bitIndex}]` || 
        g.output === `${baseName}_${bitIndex}`
      );
    }
    
    return undefined;
  }
}