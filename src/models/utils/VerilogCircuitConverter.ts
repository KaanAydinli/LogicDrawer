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
import { Text } from "../other/Text";
import { BufferGate } from "../gates/BufferGate";
import { Clock } from "../components/Clock";

export class VerilogCircuitConverter {
  private parser: VerilogParser;
  private circuitBoard: CircuitBoard;
  private componentPositions: Map<string, Point> = new Map();
  private components: { [name: string]: Component } = {};
  private outputPorts: { [name: string]: any } = {};
  private feedbackWires: { source: string; target: string }[] = [];


  constructor(circuitBoard: CircuitBoard) {
    this.parser = new VerilogParser();
    this.circuitBoard = circuitBoard;
  }

  importVerilogCode(code: string): boolean {
    try {
      const module = this.parser.parseVerilog(code);
      console.log("Parsed module:", module);

      this.circuitBoard.clearCircuit();
      this.components = {};
      this.outputPorts = {};
      this.componentPositions.clear();
      this.feedbackWires = [];

      const { hasCombinationalLoop, feedbackEdges } = this.detectFeedbackLoops(module);
      

      if (hasCombinationalLoop) {
        console.log("Sequential logic or feedback loops detected. Will handle specially.");
        this.feedbackWires = feedbackEdges;
      }

      const { signalLayers, signalDependencies } = this.analyzeCircuitStructure(module);

      this.organizeAndPositionComponents(module, signalLayers, signalDependencies);
      this.buildCircuit(module);

      this.circuitBoard.simulate();
      this.circuitBoard.draw();
      return true;
    } catch (error) {
      console.error("Error importing Verilog code:", error);
      return false;
    }
  }

  private detectFeedbackLoops(module: VerilogModule): {
    hasCombinationalLoop: boolean;
    feedbackEdges: { source: string; target: string }[];
  } {
    const dependencies = new Map<string, string[]>();
    const reverseDependencies = new Map<string, string[]>();

    module.gates.forEach((gate) => {
      dependencies.set(gate.output, [...gate.inputs]);

      gate.inputs.forEach((input) => {
        if (!reverseDependencies.has(input)) {
          reverseDependencies.set(input, []);
        }
        reverseDependencies.get(input)!.push(gate.output);
      });
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycleNodes = new Set<string>();
    const feedbackEdges: { source: string; target: string }[] = [];

    const dfs = (signal: string, path: string[] = []): boolean => {
      if (recursionStack.has(signal)) {
        const cycleStartIndex = path.indexOf(signal);
        if (cycleStartIndex !== -1) {
          const cycle = [...path.slice(cycleStartIndex), signal];

          cycle.forEach((node) => cycleNodes.add(node));

          feedbackEdges.push({
            source: cycle[cycle.length - 2],
            target: cycle[cycle.length - 1],
          });
        }
        return true;
      }

      if (visited.has(signal)) return false;

      visited.add(signal);
      recursionStack.add(signal);
      path.push(signal);

      let hasCycle = false;
      for (const nextSignal of dependencies.get(signal) || []) {
        if (dfs(nextSignal, [...path])) {
          hasCycle = true;
        }
      }

      recursionStack.delete(signal);
      return hasCycle;
    };

    const hasCombinationalLoop = Array.from(dependencies.keys()).some((signal) => dfs(signal));

    if (hasCombinationalLoop) {
      // Feedback döngülerini temizle ve yeniden oluştur
      feedbackEdges.length = 0;

      // Tüm kapıları tarayarak çapraz bağlantıları tespit et
      for (let i = 0; i < module.gates.length; i++) {
        const gate1 = module.gates[i];

        for (let j = i + 1; j < module.gates.length; j++) {
          const gate2 = module.gates[j];

          // İki kapı birbirlerine bağlı mı kontrol et
          const gate1UsesGate2Output = gate1.inputs.includes(gate2.output);
          const gate2UsesGate1Output = gate2.inputs.includes(gate1.output);

          if (gate1UsesGate2Output && gate2UsesGate1Output) {
            console.log(`Çapraz bağlantılı kapılar bulundu: ${gate1.output} <-> ${gate2.output}`);

            // Her iki yönde de bağlantı ekle
            feedbackEdges.push({
              source: gate1.output,
              target: gate2.output,
            });

            feedbackEdges.push({
              source: gate2.output,
              target: gate1.output,
            });
          }
        }
      }

      console.log(
        `SR latch veya benzer yapılar için ${feedbackEdges.length} geri besleme bağlantısı tespit edildi`,
      );
    }

    return { hasCombinationalLoop, feedbackEdges };
  }
  private analyzeCircuitStructure(module: VerilogModule): {
    signalLayers: Map<string, number>;
    signalDependencies: Map<string, string[]>;
  } {
    const signalLayers = new Map<string, number>();
    const signalDependencies = new Map<string, string[]>();

    module.inputs.forEach((input) => {
      signalLayers.set(input.name, 0);
      signalDependencies.set(input.name, []);
    });

    const processedFeedbackWires = new Set<string>();

    module.gates.forEach((gate) => {
      const nonFeedbackInputs = gate.inputs.filter((input) => {
        const isPartOfFeedback = this.feedbackWires.some(
          (fw) => fw.source === gate.output && fw.target === input,
        );

        if (isPartOfFeedback) {
          processedFeedbackWires.add(`${gate.output}:${input}`);
        }

        return !isPartOfFeedback;
      });

      signalDependencies.set(gate.output, [...gate.inputs]);
    });

    let changed = true;
    const MAX_ITERATIONS = 100;
    let iterations = 0;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      for (const gate of module.gates) {
        const normalInputs = gate.inputs.filter((input) => {
          return !this.feedbackWires.some((fw) => fw.source === gate.output && fw.target === input);
        });

        const inputLayers = normalInputs
          .map((input) => signalLayers.get(input) || 0)
          .filter((layer) => layer !== undefined);

        if (inputLayers.length === 0) continue;

        const gateLayer = Math.max(...inputLayers) + 1;

        if (!signalLayers.has(gate.output) || signalLayers.get(gate.output)! < gateLayer) {
          signalLayers.set(gate.output, gateLayer);
          changed = true;
        }
      }
    }

    for (const gate of module.gates) {
      if (!signalLayers.has(gate.output)) {
        console.warn(`Forcing layer assignment for ${gate.output} due to feedback loop`);

        const inputLayers = gate.inputs
          .map((input) => signalLayers.get(input) || 0)
          .filter((layer) => layer !== undefined);

        const gateLayer = inputLayers.length > 0 ? Math.max(...inputLayers) + 1 : 1;
        signalLayers.set(gate.output, gateLayer);
      }
    }

    return { signalLayers, signalDependencies };
  }

  private organizeAndPositionComponents(
    module: VerilogModule,
    signalLayers: Map<string, number>,
    signalDependencies: Map<string, string[]>,
  ): void {
    const inputGroups = this.groupRelatedSignals(module.inputs);

    const maxLayer = Math.max(...Array.from(signalLayers.values()));
    const xBase = 100;
    const yBase = 0;
    const xLayerSpacing = 180;
    const yComponentSpacing = 200;

    let yPos = yBase;
    const usedPositions = new Set<number>();

    inputGroups.forEach((group) => {
      const isControlGroup = group.some(
        (input) =>
          input.name.includes("mode") ||
          input.name.includes("sel") ||
          input.name === "s" ||
          input.name === "clk" ||
          input.name === "reset" ||
          input.name === "en" ||
          input.name === "enable",
      );

      if (isControlGroup) {
        group.forEach((input, index) => {
          const y = yBase + index * yComponentSpacing - 100;
          usedPositions.add(y);
          this.componentPositions.set(input.name, {
            x: xBase + 100,
            y: y,
          });
        });

        yPos = yBase + group.length * yComponentSpacing;
      } else {
        if (usedPositions.has(yPos)) {
          while (usedPositions.has(yPos)) {
            yPos += 100;
          }
        }

        group.forEach((input, index) => {
          const y = yPos + index * yComponentSpacing;
          usedPositions.add(y);
          this.componentPositions.set(input.name, {
            x: xBase,
            y: y,
          });
        });

        yPos += group.length * yComponentSpacing + 100;
      }
    });

    const gatesByLayer = new Map<number, VerilogGate[]>();

    module.gates.forEach((gate) => {
      const layer = signalLayers.get(gate.output) || 1;
      if (!gatesByLayer.has(layer)) {
        gatesByLayer.set(layer, []);
      }
      gatesByLayer.get(layer)!.push(gate);
    });

    for (let layer = 1; layer <= maxLayer; layer++) {
      const gates = gatesByLayer.get(layer) || [];
      const xPos = xBase + layer * xLayerSpacing;

      gates.forEach((gate, index) => {
        const inputPositions = gate.inputs
          .map((input) => this.componentPositions.get(input))
          .filter((pos) => pos !== undefined) as Point[];

        let gateYPos = yBase + index * yComponentSpacing;

        if (inputPositions.length > 0) {
          const avgY = inputPositions.reduce((sum, pos) => sum + pos.y, 0) / inputPositions.length;
          gateYPos = avgY;

          const minSpacing = 70;
          const overlappingGate = gates.slice(0, index).find((g) => {
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
          y: gateYPos,
        });
      });
    }
    let effectiveMaxLayer = Math.min(maxLayer, 4);
    const outputXPos = xBase + (effectiveMaxLayer + 1) * xLayerSpacing + 50;

    yPos = yBase + 100;
    const yOutputSpacing = yComponentSpacing * 0.75;

    module.outputs.forEach((output, index) => {
      this.componentPositions.set(output.name, {
        x: outputXPos,
        y: yPos + index * yOutputSpacing,
      });
    });
  }

  private groupRelatedSignals(signals: VerilogPort[]): VerilogPort[][] {
    const groups: { [key: string]: VerilogPort[] } = {};

    signals.forEach((signal) => {
      const match = signal.name.match(/^([a-zA-Z_]+)(\d+)$/);

      if (match) {
        const baseName = match[1];
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(signal);
      } else {
        if (
          signal.name === "mode" ||
          signal.name === "cin" ||
          signal.name === "reset" ||
          signal.name === "clk" ||
          signal.name.includes("sel")
        ) {
          if (!groups["control"]) groups["control"] = [];
          groups["control"].push(signal);
        } else {
          if (!groups[signal.name]) groups[signal.name] = [];
          groups[signal.name].push(signal);
        }
      }
    });

    Object.values(groups).forEach((group) => {
      group.sort((a, b) => {
        const numA = parseInt(a.name.replace(/^\D+/g, "") || "0");
        const numB = parseInt(b.name.replace(/^\D+/g, "") || "0");
        return numB - numA;
      });
    });

    return Object.values(groups);
  }

  private buildCircuit(module: VerilogModule): boolean {
    try {
      this.detectAndHandleUndeclaredSignals(module);

      module.inputs.forEach((input) => {
        const position = this.componentPositions.get(input.name) || { x: 100, y: 100 };

        if (input.name === "clk") {
          const clock = new Clock(position, this.circuitBoard);
          this.components[input.name] = clock;
          this.outputPorts[input.name] = clock.outputs[0];
          this.circuitBoard.addComponent(clock);
        } else {
          const toggle = new ToggleSwitch(position);
          this.components[input.name] = toggle;
          this.outputPorts[input.name] = toggle.outputs[0];
          this.circuitBoard.addComponent(toggle);
        }

        const labelPosition = {
          x: position.x - 80,
          y: position.y + 20,
        };

        const label = new Text(labelPosition, input.name, 20);
        this.circuitBoard.addComponent(label);
      });

      const sortedGates = [...module.gates].sort((a, b) => {
        const layerA = this.getGateLayer(a.output);
        const layerB = this.getGateLayer(b.output);
        return layerA - layerB;
      });

      for (const gate of sortedGates) {
        const position = this.componentPositions.get(gate.output) || { x: 200, y: 200 };
        let component: Component | null = null;

        switch (gate.type.toLowerCase()) {
          case "and":
            component = new AndGate(position);
            break;
          case "or":
            component = new OrGate(position);
            break;
          case "not":
            component = new NotGate(position);
            break;
          case "xor":
            component = new XorGate(position);
            break;
          case "nand":
            component = new NandGate(position);
            break;
          case "nor":
            component = new NorGate(position);
            break;
          case "xnor":
            component = new XnorGate(position);
            break;
          case "buf":
            component = new BufferGate(position);
            break;
          case "mux2":
            component = new Mux2(position);
            break;
          case "mux4":
            component = new Mux4(position);
            break;
          default:
            console.error(`Unsupported gate type: ${gate.type}`);
        }

        if (component) {
          this.components[gate.output] = component;
          this.outputPorts[gate.output] = component.outputs[0];
          this.circuitBoard.addComponent(component);

          this.connectGateInputs(gate, component);
        }
      }

      module.outputs.forEach((output) => {
        const position = this.componentPositions.get(output.name) || { x: 500, y: 200 };

        const bulbPosition = {
          x: position.x + 200,
          y: position.y,
        };

        const bulb = new LightBulb(bulbPosition);
        this.components[output.name + "_bulb"] = bulb;
        this.circuitBoard.addComponent(bulb);

        const labelPosition = {
          x: position.x + 280,
          y: position.y + 20,
        };

        const label = new Text(labelPosition, output.name, 20);
        this.circuitBoard.addComponent(label);

        this.connectOutput(output.name, bulb);
      });

      this.connectFeedbackWires();

      return true;
    } catch (error) {
      console.error("Error building circuit:", error);
      return false;
    }
  }

  private getGateLayer(output: string): number {
    const layer = Array.from(this.componentPositions.entries()).find(
      ([name]) => name === output,
    )?.[1]?.x;
    return layer || 0;
  }

  private connectGateInputs(gate: VerilogGate, component: Component): void {
    for (let j = 0; j < gate.inputs.length; j++) {
      if (j >= component.inputs.length) {
        console.error(
          `Gate ${gate.type} has more inputs than supported: ${j + 1} > ${component.inputs.length}`,
        );
        continue;
      }

      const inputName = gate.inputs[j];

      if (this.feedbackWires.some((fw) => fw.source === gate.output && fw.target === inputName)) {
        console.log(`Skipping feedback wire from ${gate.output} to ${inputName}`);
        continue;
      }

      let sourcePort = this.outputPorts[inputName];

      if (!sourcePort) {
        const bitSelectionMatch = inputName.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
        if (bitSelectionMatch) {
          const [, baseName, msb, lsb] = bitSelectionMatch;

          if (!lsb) {
            sourcePort = this.outputPorts[`${baseName}[${msb}]`];
          }
        }
      }

      if (sourcePort) {
        const wire = new Wire(sourcePort);
        wire.connect(component.inputs[j]);
        this.circuitBoard.addWire(wire);
      } else {
        const position = this.findUnusedPosition();
        const toggle = new ToggleSwitch(position);
        this.components[`auto_${inputName}`] = toggle;
        this.outputPorts[inputName] = toggle.outputs[0];
        this.circuitBoard.addComponent(toggle);


        const wire = new Wire(toggle.outputs[0]);
        wire.connect(component.inputs[j]);
        this.circuitBoard.addWire(wire);

        const labelPosition = {
          x: position.x - 80,
          y: position.y + 20,
        };
        const label = new Text(labelPosition, inputName, 20);
        this.circuitBoard.addComponent(label);
        console.error(`Source port for ${inputName} not found, needed for ${gate.output}`);
      }
    }
  }
  private findUnusedPosition(): Point {
    
    let x = 50;
    let y = 50;

   
    while (this.isPositionUsed(x, y)) {
      y += 100; 
    }

    return { x, y };
  }

  private isPositionUsed(x: number, y: number): boolean {
    
    for (const position of this.componentPositions.values()) {
      if (Math.abs(position.x - x) < 50 && Math.abs(position.y - y) < 50) {
        return true;
      }
    }
    return false;
  }

  
  private connectFeedbackWires(): void {
    console.log("Connecting feedback wires:", this.feedbackWires);

    
    const feedbackPairs = new Map<string, string[]>();

    for (const { source, target } of this.feedbackWires) {
      if (!feedbackPairs.has(source)) {
        feedbackPairs.set(source, []);
      }
      feedbackPairs.get(source)!.push(target);
    }

   
    const module = this.parser.getModule();
    if (!module) return;

    for (const [source, targets] of feedbackPairs.entries()) {
      
      const sourcePort = this.outputPorts[source];
      if (!sourcePort) {
        console.error(`Source port for ${source} not found`);
        continue;
      }

     
      for (const target of targets) {
     
        const targetGates = module.gates.filter(
          (gate) =>
            gate.inputs.includes(target) &&
          
            gate.output !== source,
        );

        for (const gate of targetGates) {
      
          const inputIndex = gate.inputs.indexOf(target);
          if (inputIndex === -1) continue;

     
          const targetComponent = this.components[gate.output];
          if (!targetComponent || inputIndex >= targetComponent.inputs.length) {
            console.error(`Target component for ${gate.output} not found or input index invalid`);
            continue;
          }


          if (targetComponent.inputs[inputIndex].isConnected) {
            console.log(`Input ${inputIndex} of ${gate.output} is already connected, skipping`);
            continue;
          }

          console.log(
            `Connecting cross-feedback: ${source} -> input ${inputIndex} of ${gate.output} (${target})`,
          );
          const wire = new Wire(sourcePort);
          wire.connect(targetComponent.inputs[inputIndex]);
          this.circuitBoard.addWire(wire);
        }

        const targetSourceGates = module.gates.filter((gate) => gate.output === target);

        for (const gate of targetSourceGates) {

          const inputIndex = gate.inputs.indexOf(source);
          if (inputIndex === -1) continue;

          const targetComponent = this.components[gate.output];
          if (!targetComponent || inputIndex >= targetComponent.inputs.length) continue;


          if (targetComponent.inputs[inputIndex].isConnected) continue;


          console.log(
            `Connecting SR latch feedback: ${source} -> input ${inputIndex} of ${target}`,
          );
          const wire = new Wire(sourcePort);
          wire.connect(targetComponent.inputs[inputIndex]);
          this.circuitBoard.addWire(wire);
        }
      }
    }
  }

  private connectOutput(outputName: string, bulb: Component): void {
    const sourceGate = this.findSourceForOutput(outputName);
    let sourcePort;

    if (sourceGate) {
      sourcePort = this.outputPorts[sourceGate.output];
    } else {
      sourcePort = this.outputPorts[outputName];

      if (!sourcePort) {
        for (const [name, port] of Object.entries(this.outputPorts)) {
          const gate = this.parser.getModule()?.gates.find((g) => g.output === name);
          if (gate?.output === outputName) {
            sourcePort = port;
            break;
          }
        }
      }
    }

    if (sourcePort) {
      const wire = new Wire(sourcePort);
      wire.connect(bulb.inputs[0]);
      this.circuitBoard.addWire(wire);
    } else {
      console.error(`Source port for output ${outputName} not found`);

      const position = this.findUnusedPosition();
      const toggle = new ToggleSwitch(position);
      this.components[`auto_${outputName}`] = toggle;
      this.outputPorts[outputName] = toggle.outputs[0];
      this.circuitBoard.addComponent(toggle);

      const wire = new Wire(toggle.outputs[0]);
      wire.connect(bulb.inputs[0]);
      this.circuitBoard.addWire(wire);


      const labelPosition = {
        x: position.x - 80,
        y: position.y + 20,
      };
      const label = new Text(labelPosition, outputName, 20);
      this.circuitBoard.addComponent(label);
    }
  }
  private detectAndHandleUndeclaredSignals(module: VerilogModule): void {

    const definedSignals = new Set<string>();

    module.inputs.forEach((input) => definedSignals.add(input.name));
    module.outputs.forEach((output) => definedSignals.add(output.name));
    if (module.wires) {
      module.wires.forEach((wire) => definedSignals.add(wire.name));
    } else {
      module.wires = []; 
    }

    const usedSignals = new Set<string>();

    module.gates.forEach((gate) => {

      usedSignals.add(gate.output);


      gate.inputs.forEach((input) => usedSignals.add(input));
    });


    const undeclaredSignals: string[] = [];

    for (const signal of usedSignals) {
      if (!definedSignals.has(signal)) {
        undeclaredSignals.push(signal);
      }
    }


    if (undeclaredSignals.length > 0) {
      console.warn(
        `Bildirilmemiş sinyaller bulundu: ${undeclaredSignals.join(", ")}. Bunlar wire olarak ekleniyor.`,
      );

 
      undeclaredSignals.forEach((signal) => {
        module.wires.push({ name: signal });
      });
    }
  }

  private findSourceForOutput(outputName: string): VerilogGate | undefined {
    const module = this.parser.getModule();
    if (!module) return undefined;

    const directGate = module.gates.find((g) => g.output === outputName);
    if (directGate) return directGate;

    for (const gate of module.gates) {
      if (gate.output === outputName) {
        return gate;
      }
    }

    const bufferGate = module.gates.find(
      (g) => (g.type.toLowerCase() === "buf" || g.type.toLowerCase() === "buffer") && g.output === outputName
    );
    if (bufferGate) return bufferGate;
    

    const bitSelectionMatch = outputName.match(/^(\w+)\[(\d+)\]$/);
    if (bitSelectionMatch) {
      const [, baseName, bitIndex] = bitSelectionMatch;

      return module.gates.find(
        (g) => g.output === `${baseName}[${bitIndex}]` || g.output === `${baseName}_${bitIndex}`,
      );
    }

    if (/^d\d+$/.test(outputName)) {
      const gates = module.gates.filter((g) => {
        return g.type === "and" && g.output === outputName;
      });

      if (gates.length > 0) {
        return gates[0];
      }
    }

    return undefined;
  }
}
