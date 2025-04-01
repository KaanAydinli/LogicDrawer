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
import { Text } from "../components/Text";

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
      const module = this.parser.parseVerilog(code);
      console.log("Parsed module:", module);

      this.circuitBoard.clearCircuit();
      this.components = {};
      this.outputPorts = {};
      this.componentPositions.clear();

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

    module.gates.forEach((gate) => {
      signalDependencies.set(gate.output, [...gate.inputs]);
    });

    let changed = true;
    while (changed) {
      changed = false;

      for (const gate of module.gates) {
        const inputLayers = gate.inputs
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

    const outputXPos = xBase + (maxLayer + 1) * xLayerSpacing + 50;

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
      module.inputs.forEach((input) => {
        const position = this.componentPositions.get(input.name) || { x: 100, y: 100 };

        const toggle = new ToggleSwitch(position);
        this.components[input.name] = toggle;
        this.outputPorts[input.name] = toggle.outputs[0];
        this.circuitBoard.addComponent(toggle);

        const labelPosition = {
          x: position.x - 80,
          y: position.y + 20,
        };

        const label = new Text(labelPosition, input.name, 20);
        this.circuitBoard.addComponent(label);
      });

      const sortedGates = [...module.gates].sort((a, b) => {
        const posA = this.componentPositions.get(a.output) || { x: 0, y: 0 };
        const posB = this.componentPositions.get(b.output) || { x: 0, y: 0 };
        return posA.x - posB.x;
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

      return true;
    } catch (error) {
      console.error("Error building circuit:", error);
      return false;
    }
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
        console.error(`Source port for ${inputName} not found, needed for ${gate.output}`);
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

      console.warn(`Attempting to find any available source for ${outputName}`);
      const fallbackSource = Object.values(this.outputPorts)[0];
      if (fallbackSource) {
        console.warn(`Created fallback connection for ${outputName}`);
        const debugWire = new Wire(fallbackSource);
        debugWire.connect(bulb.inputs[0]);
        this.circuitBoard.addWire(debugWire);
      }
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
