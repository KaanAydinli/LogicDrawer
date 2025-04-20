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
import { Constant0 } from "../components/Constant0";
import { Constant1 } from "../components/Constant1";
import { DFlipFlop } from "../Sequential/DFlipFlop";

export class VerilogCircuitConverter {
  private parser: VerilogParser;
  public circuitBoard: CircuitBoard;
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

    module.gates.forEach(gate => {
      dependencies.set(gate.output, [...gate.inputs]);

      gate.inputs.forEach(input => {
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

          cycle.forEach(node => cycleNodes.add(node));

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

    const hasCombinationalLoop = Array.from(dependencies.keys()).some(signal => dfs(signal));

    if (hasCombinationalLoop) {
      feedbackEdges.length = 0;

      for (let i = 0; i < module.gates.length; i++) {
        const gate1 = module.gates[i];

        for (let j = i + 1; j < module.gates.length; j++) {
          const gate2 = module.gates[j];

          const gate1UsesGate2Output = gate1.inputs.includes(gate2.output);
          const gate2UsesGate1Output = gate2.inputs.includes(gate1.output);

          if (gate1UsesGate2Output && gate2UsesGate1Output) {
            console.log(`Çapraz bağlantılı kapılar bulundu: ${gate1.output} <-> ${gate2.output}`);

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
        `SR latch veya benzer yapılar için ${feedbackEdges.length} geri besleme bağlantısı tespit edildi`
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

    module.inputs.forEach(input => {
      signalLayers.set(input.name, 0);
      signalDependencies.set(input.name, []);
    });

    const processedFeedbackWires = new Set<string>();

    module.gates.forEach(gate => {
      const nonFeedbackInputs = gate.inputs.filter(input => {
        const isPartOfFeedback = this.feedbackWires.some(
          fw => fw.source === gate.output && fw.target === input
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
        const normalInputs = gate.inputs.filter(input => {
          return !this.feedbackWires.some(fw => fw.source === gate.output && fw.target === input);
        });

        const inputLayers = normalInputs
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

    for (const gate of module.gates) {
      if (!signalLayers.has(gate.output)) {
        console.warn(`Forcing layer assignment for ${gate.output} due to feedback loop`);

        const inputLayers = gate.inputs
          .map(input => signalLayers.get(input) || 0)
          .filter(layer => layer !== undefined);

        const gateLayer = inputLayers.length > 0 ? Math.max(...inputLayers) + 1 : 1;
        signalLayers.set(gate.output, gateLayer);
      }
    }

    return { signalLayers, signalDependencies };
  }

  private organizeAndPositionComponents(
    module: VerilogModule,
    signalLayers: Map<string, number>,
    signalDependencies: Map<string, string[]>
  ): void {
    const inputGroups = this.groupRelatedSignals(module.inputs);

    const maxLayer = Math.max(...Array.from(signalLayers.values()));
    const xBase = 100;
    const yBase = 0;
    const xLayerSpacing = 180;
    const yComponentSpacing = 200;

    let yPos = yBase;
    const usedPositions = new Set<number>();

    inputGroups.forEach(group => {
      const isControlGroup = group.some(
        input =>
          input.name.includes("mode") ||
          input.name.includes("sel") ||
          input.name === "s" ||
          input.name === "clk" ||
          input.name === "reset" ||
          input.name === "en" ||
          input.name === "enable"
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

    module.gates.forEach(gate => {
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
          .map(input => this.componentPositions.get(input))
          .filter(pos => pos !== undefined) as Point[];

        let gateYPos = yBase + index * yComponentSpacing;

        if (inputPositions.length > 0) {
          const avgY = inputPositions.reduce((sum, pos) => sum + pos.y, 0) / inputPositions.length;
          gateYPos = avgY;

          const minSpacing = 70;
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

    signals.forEach(signal => {
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

    Object.values(groups).forEach(group => {
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

      this.setupMultiBitSignals(module);

      module.inputs.forEach(input => {
        if (!input.bitWidth || input.bitWidth === 1) {
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
        }
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

            // Component'i ekle
            this.components[gate.output] = component;
            this.outputPorts[gate.output] = component.outputs[0];
            this.circuitBoard.addComponent(component);

            // Veri girişlerini bağla (0 ve 1 girişleri)
            for (let i = 0; i < Math.min(gate.inputs.length, 2); i++) {
              const inputName = gate.inputs[i];
              this.connectGateInputToComponent(inputName, component, i);
            }

            // Seçim (select) sinyalini bağla (2. giriş)
            if (gate.controlSignal) {
              this.connectControlSignal(gate.controlSignal, component, 2);
            }

            // Diğer kapılarda olduğu gibi devam etmemesi için erkenden dön
            continue;
          case "mux4":
            component = new Mux4(position);

            // Component'i ekle
            this.components[gate.output] = component;
            this.outputPorts[gate.output] = component.outputs[0];
            this.circuitBoard.addComponent(component);

            // Veri girişlerini bağla (0, 1, 2, 3 girişleri)
            for (let i = 0; i < Math.min(gate.inputs.length, 4); i++) {
              const inputName = gate.inputs[i];
              this.connectGateInputToComponent(inputName, component, i);
            }

            // Seçim sinyalini bağla
            if (gate.controlSignal) {
              // MUX4 2-bit kontrol girişi gerektirir - select0 ve select1
              this.connectControlSignalForMux4(gate.controlSignal, component, gate.conditions);
            }

            continue;
          case "dflipflop":
            component = new DFlipFlop(position);

            // Component'i ekle
            this.components[gate.output] = component;
            // DFF'nin Q çıkışını (index 0) outputPorts'a ekle
            this.outputPorts[gate.output] = component.outputs[0];
            this.circuitBoard.addComponent(component);

            // Girişleri bağla:
            // gate.inputs[0] -> D girişi (component.inputs[0])
            // gate.inputs[1] -> CLK girişi (component.inputs[1])
            if (gate.inputs.length >= 2) {
              this.connectGateInputToComponent(gate.inputs[0], component, 0); // D girişi
              this.connectGateInputToComponent(gate.inputs[1], component, 1); // CLK girişi
            } else {
              console.error(
                `DFlipFlop gate '${gate.name || gate.output}' has insufficient inputs.`
              );
            }
            // DFF için özel bağlantı mantığı burada bitti, genel bağlantıya geçme
            continue;
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

      module.outputs.forEach(output => {
        if (output.bitWidth && output.bitWidth > 1) {
          const basePosition = this.componentPositions.get(output.name) || { x: 500, y: 200 };

          for (let i = 0; i < output.bitWidth; i++) {
            const bitName = `${output.name}[${i}]`;

            const bitPosition = {
              x: basePosition.x + 200,
              y: basePosition.y + i * 200,
            };

            const bulb = new LightBulb(bitPosition);
            this.components[bitName + "_bulb"] = bulb;
            this.circuitBoard.addComponent(bulb);

            const labelPosition = {
              x: bitPosition.x + 80,
              y: bitPosition.y + 20,
            };
            const label = new Text(labelPosition, bitName, 16);
            this.circuitBoard.addComponent(label);

            this.connectOutput(bitName, bulb);
          }
        } else {
          const position = this.componentPositions.get(output.name) || { x: 500, y: 200 };
          const bulbPosition = { x: position.x + 200, y: position.y };
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
        }
      });

      this.connectFeedbackWires();

      return true;
    } catch (error) {
      console.error("Error building circuit:", error);
      return false;
    }
  }
  private connectGateInputToComponent(
    inputName: string,
    component: Component,
    inputIndex: number
  ): void {
    // Sayısal sabit değer mi kontrol et (0, 1, 2'b00, vb.)
    if (this.isConstant(inputName)) {
      this.connectConstantValue(inputName, component, inputIndex);
      return;
    }

    // Normal sinyal bağlantısı
    let sourcePort = this.outputPorts[inputName];

    // Eğer sinyal adı "sel[0]" gibi ise ve outputPorts'ta yoksa,
    // otomatik toggle oluşturulacaktır. Bu genellikle istenmeyen durumdur
    // eğer "sel" çok-bitli bir giriş olarak tanımlandıysa.
    // setupMultiBitSignals'ın bu bitleri outputPorts'a eklediğinden emin olun.

    if (sourcePort) {
      const wire = new Wire(sourcePort);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);
    } else {
      console.error(
        `Source port for ${inputName} not found, needed for component ${component.id} input ${inputIndex}. Creating auto-toggle.`
      );

      // Otomatik oluşturulan toggle switch ile bağla
      const position = this.findUnusedPosition();
      const toggle = new ToggleSwitch(position);

      // Otomatik oluşturulan toggle'ları ayırt etmek için isim verelim
      const autoCompName = `auto_${inputName.replace(/[\[\]:]/g, "_")}`; // Geçersiz karakterleri değiştir
      this.components[autoCompName] = toggle;
      this.outputPorts[inputName] = toggle.outputs[0]; // Orijinal sinyal adıyla kaydet
      this.circuitBoard.addComponent(toggle);

      const wire = new Wire(toggle.outputs[0]);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);

      const labelPosition = {
        x: position.x - 80,
        y: position.y + 20,
      };
      const label = new Text(labelPosition, inputName, 20);
      this.circuitBoard.addComponent(label);
    }
  }

  // MUX için kontrol sinyalini bağlar
  private connectControlSignal(
    controlSignal: string,
    component: Component,
    inputIndex: number
  ): void {
    // Kontrol ifadesi karmaşık bir ifade olabilir (örn: a & b, ~c, vb.)
    if (this.isComplexExpression(controlSignal)) {
      this.connectComplexControlExpression(controlSignal, component, inputIndex);
      return;
    }

    // Basit değişken adı
    const sourcePort = this.outputPorts[controlSignal];

    if (sourcePort) {
      const wire = new Wire(sourcePort);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);
    } else {
      console.error(`Control signal source port for ${controlSignal} not found`);

      // Otomatik oluşturulan switch
      const position = this.findUnusedPosition();
      const toggle = new ToggleSwitch(position);

      const toggleName = `auto_${controlSignal}`;
      this.components[toggleName] = toggle;
      this.outputPorts[controlSignal] = toggle.outputs[0];
      this.circuitBoard.addComponent(toggle);

      const wire = new Wire(toggle.outputs[0]);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);

      const labelPosition = {
        x: position.x - 80,
        y: position.y + 20,
      };
      const label = new Text(labelPosition, controlSignal, 20);
      this.circuitBoard.addComponent(label);
    }
  }

  // MUX4 için 2-bit kontrol sinyalini bağlar
  private connectControlSignalForMux4(
    controlSignal: string,
    component: Component, // MUX4 component
    conditions?: { value: string; result: string }[]
  ): void {
    console.log(
      `Connecting control signals for MUX4 ${component.id} using signal: ${controlSignal}`
    );

    // 1. Kontrol sinyali çok-bitli bir giriş portu mu? (örn: "sel")
    //    Bu kontrol, setupMultiBitSignals'ın bitleri outputPorts'a eklediğini varsayar.
    const bit0SignalName = `${controlSignal}[0]`;
    const bit1SignalName = `${controlSignal}[1]`;

    const sourcePortBit0 = this.outputPorts[bit0SignalName];
    const sourcePortBit1 = this.outputPorts[bit1SignalName];

    if (sourcePortBit0 && sourcePortBit1) {
      console.log(`Found existing multi-bit signals: ${bit0SignalName} and ${bit1SignalName}`);
      // Doğrudan bitleri bağla
      const wire0 = new Wire(sourcePortBit0);
      wire0.connect(component.inputs[4]); // select0
      this.circuitBoard.addWire(wire0);
      console.log(`Connected ${bit0SignalName} to MUX4 select0`);

      const wire1 = new Wire(sourcePortBit1);
      wire1.connect(component.inputs[5]); // select1
      this.circuitBoard.addWire(wire1);
      console.log(`Connected ${bit1SignalName} to MUX4 select1`);
      return; // Başarıyla bağlandı, başka işleme gerek yok
    }

    // 2. Kontrol sinyali bit aralığı mı? (örn: sel[1:0])
    //    Bu durum genellikle parser tarafından zaten bitlere ayrılmalı,
    //    ama yine de kontrol edelim.
    const bitRangeMatch = controlSignal.match(/^(\w+)\[(\d+):(\d+)\]$/);
    if (bitRangeMatch) {
      const [, baseName, msbStr, lsbStr] = bitRangeMatch;
      const msb = parseInt(msbStr);
      const lsb = parseInt(lsbStr);

      if (Math.abs(msb - lsb) === 1) {
        // İki bit bağla (connectGateInputToComponent bunları bulamazsa toggle oluşturur)
        const bit0Index = Math.min(msb, lsb);
        const bit1Index = Math.max(msb, lsb);
        const derivedBit0Name = `${baseName}[${bit0Index}]`;
        const derivedBit1Name = `${baseName}[${bit1Index}]`;

        console.log(
          `Control signal is a bit range. Connecting derived bits: ${derivedBit0Name} and ${derivedBit1Name}`
        );
        this.connectGateInputToComponent(derivedBit0Name, component, 4); // select0
        this.connectGateInputToComponent(derivedBit1Name, component, 5); // select1
        return;
      } else {
        console.warn(`Control signal ${controlSignal} has an unexpected bit range for MUX4.`);
      }
    }

    // 3. Case ifadesinden mi geliyor? (conditions listesi var)
    if (conditions && conditions.length > 0) {
      console.log(
        `Control signal likely from a case statement. Creating toggles based on conditions.`
      );
      // Case değerlerini ikili sayılara dönüştür ve MUX4 seçim girişlerine bağla
      // Bu metot kendi içinde toggle'ları oluşturur.
      this.connectMux4SelectionsBasedOnCaseValues(conditions, component);
      return;
    }

    // 4. Varsayılan Durum: Tek bit kontrol sinyali veya bilinmeyen durum
    //    Tek sinyali select0'a bağla, select1'i 0 yap.
    console.warn(
      `Could not directly map control signal ${controlSignal} to 2 bits. Connecting ${controlSignal} to select0 and grounding select1.`
    );
    this.connectGateInputToComponent(controlSignal, component, 4); // select0

    // select1'i 0'a bağla
    this.connectConstantValue("0", component, 5); // select1
  }

  // MUX4 seçim girişlerini case değerlerine göre bağlar
  private connectMux4SelectionsBasedOnCaseValues(
    conditions: { value: string; result: string }[],
    mux: Component
  ): void {
    // Tüm case değerlerini incele ve 2-bit kodlama oluştur
    const bitMapping = new Map<string, [boolean, boolean]>();

    // Kodlamayı belirle
    conditions.forEach((condition, index) => {
      if (index < 4) {
        // MUX4 maksimum 4 giriş destekler
        // Değer ikili sayı mı? (örn: 2'b01, 2'h2, vb.)
        const binaryMatch = condition.value.match(/(\d+)'b([01]+)/);
        const hexMatch = condition.value.match(/(\d+)'h([0-9A-Fa-f]+)/);
        const decimalMatch = condition.value.match(/^(\d+)$/);

        let binaryValue: string = "";

        if (binaryMatch) {
          binaryValue = binaryMatch[2].padStart(parseInt(binaryMatch[1]), "0");
        } else if (hexMatch) {
          const hexValue = hexMatch[2];
          const decimal = parseInt(hexValue, 16);
          binaryValue = decimal.toString(2).padStart(parseInt(hexMatch[1]), "0");
        } else if (decimalMatch) {
          const decimal = parseInt(decimalMatch[1]);
          binaryValue = decimal.toString(2).padStart(2, "0");
        } else {
          // Özel durum: default veya isimlendirilen durum
          binaryValue = index.toString(2).padStart(2, "0");
        }

        // Son 2 biti al
        const lastTwoBits = binaryValue.slice(-2).padStart(2, "0");
        bitMapping.set(condition.value, [
          lastTwoBits[1] === "1", // Bit 0
          lastTwoBits[0] === "1", // Bit 1
        ]);
      }
    });

    // Bit 0 ve Bit 1 için toggle switch oluştur (select0 ve select1)
    const pos0 = this.findUnusedPosition();
    const toggle0 = new ToggleSwitch(pos0);
    this.components[`select0_${mux.id}`] = toggle0;
    this.circuitBoard.addComponent(toggle0);

    const pos1 = { x: pos0.x, y: pos0.y + 60 };
    const toggle1 = new ToggleSwitch(pos1);
    this.components[`select1_${mux.id}`] = toggle1;
    this.circuitBoard.addComponent(toggle1);

    // Etiketler ekle
    const label0 = new Text({ x: pos0.x - 80, y: pos0.y + 20 }, "select0", 16);
    this.circuitBoard.addComponent(label0);

    const label1 = new Text({ x: pos1.x - 80, y: pos1.y + 20 }, "select1", 16);
    this.circuitBoard.addComponent(label1);

    // Bağlantıları yap
    const wire0 = new Wire(toggle0.outputs[0]);
    wire0.connect(mux.inputs[4]); // select0
    this.circuitBoard.addWire(wire0);

    const wire1 = new Wire(toggle1.outputs[0]);
    wire1.connect(mux.inputs[5]); // select1
    this.circuitBoard.addWire(wire1);

    // Case değerlerini gösteren bir bilgi etiketi ekle
    if (conditions.length > 0) {
      let caseInfoText = "Case Değerleri:\n";
      conditions.forEach((condition, index) => {
        if (index < 4) {
          const [bit0, bit1] = bitMapping.get(condition.value) || [false, false];
          caseInfoText += `${condition.value}: [${bit1 ? 1 : 0}, ${bit0 ? 1 : 0}] -> ${index}\n`;
        }
      });

      const infoPos = { x: mux.position.x, y: mux.position.y - 80 };
      const infoLabel = new Text(infoPos, caseInfoText, 14);
      this.circuitBoard.addComponent(infoLabel);
    }
  }

  // Karmaşık kontrol ifadesini bağlar (a & b, ~c, vb.)
  private connectComplexControlExpression(
    expression: string,
    component: Component,
    inputIndex: number
  ): void {
    // AND işlemi
    if (expression.includes("&")) {
      const andPosition = {
        x: component.position.x - 120,
        y: component.position.y - 50,
      };
      const andGate = new AndGate(andPosition);
      this.components[`and_ctrl_${component.id}`] = andGate;
      this.circuitBoard.addComponent(andGate);

      const parts = expression.split("&").map(p => p.trim());
      this.connectGateInputToComponent(parts[0], andGate, 0);
      this.connectGateInputToComponent(parts[1], andGate, 1);

      const wire = new Wire(andGate.outputs[0]);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);
      return;
    }

    // OR işlemi
    if (expression.includes("|")) {
      const orPosition = {
        x: component.position.x - 120,
        y: component.position.y - 50,
      };
      const orGate = new OrGate(orPosition);
      this.components[`or_ctrl_${component.id}`] = orGate;
      this.circuitBoard.addComponent(orGate);

      const parts = expression.split("|").map(p => p.trim());
      this.connectGateInputToComponent(parts[0], orGate, 0);
      this.connectGateInputToComponent(parts[1], orGate, 1);

      const wire = new Wire(orGate.outputs[0]);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);
      return;
    }

    // NOT işlemi
    if (expression.startsWith("~")) {
      const notPosition = {
        x: component.position.x - 120,
        y: component.position.y - 50,
      };
      const notGate = new NotGate(notPosition);
      this.components[`not_ctrl_${component.id}`] = notGate;
      this.circuitBoard.addComponent(notGate);

      const input = expression.substring(1).trim();
      this.connectGateInputToComponent(input, notGate, 0);

      const wire = new Wire(notGate.outputs[0]);
      wire.connect(component.inputs[inputIndex]);
      this.circuitBoard.addWire(wire);
      return;
    }

    // Basit kontrol sinyali olarak bağla
    this.connectControlSignal(expression, component, inputIndex);
  }

  private connectConstantValue(value: string, component: Component, inputIndex: number): void {
    const constPosition = this.findUnusedPosition(); // Sabit için pozisyon bul

    // Değeri belirle
    let boolValue = false; // Varsayılan olarak false (0)

    if (value === "1" || value === "true") {
      boolValue = true;
    } else if (value === "0" || value === "false") {
      boolValue = false;
    } else {
      // Verilog formatlarını işle (sadece son biti dikkate alalım)
      const binaryMatch = value.match(/(\d+)'[bB]([01xXzZ]+)$/);
      const hexMatch = value.match(/(\d+)'[hH]([0-9a-fA-FxXzZ]+)$/);
      const decimalMatch = value.match(/(\d+)'[dD]([0-9xXzZ]+)$/);
      const octalMatch = value.match(/(\d+)'[oO]([0-7xXzZ]+)$/);

      let numericValue = 0;

      try {
        if (binaryMatch) {
          const binaryString = binaryMatch[2].replace(/[xXzZ]/g, "0"); // X/Z'yi 0 kabul et
          numericValue = parseInt(binaryString, 2);
        } else if (hexMatch) {
          const hexString = hexMatch[2].replace(/[xXzZ]/g, "0");
          numericValue = parseInt(hexString, 16);
        } else if (decimalMatch) {
          const decimalString = decimalMatch[2].replace(/[xXzZ]/g, "0");
          numericValue = parseInt(decimalString, 10);
        } else if (octalMatch) {
          const octalString = octalMatch[2].replace(/[xXzZ]/g, "0");
          numericValue = parseInt(octalString, 8);
        }
      } catch (e) {
        console.error(`Sabit değer ayrıştırılamadı: ${value}`, e);
      }

      // En düşük anlamlı bit (LSB) 1 ise true kabul et
      boolValue = (numericValue & 1) === 1;
    }

    // DÜZELTME: ToggleSwitch yerine Constant0 veya Constant1 kullan
    let constantComponent: Component;
    if (boolValue) {
      constantComponent = new Constant1(constPosition);
    } else {
      constantComponent = new Constant0(constPosition);
    }

    // Component'i ekle
    const constCompName = `const_${component.id}_${inputIndex}_${value.replace(/[^a-zA-Z0-9]/g, "_")}`;
    this.components[constCompName] = constantComponent;
    this.circuitBoard.addComponent(constantComponent);

    // Bağlantıyı yap
    // Constant0/1'in tek bir çıkışı var (index 0)
    const wire = new Wire(constantComponent.outputs[0]);
    wire.connect(component.inputs[inputIndex]);
    this.circuitBoard.addWire(wire);

    console.log(
      `Connected constant value ${value} (interpreted as ${boolValue}) to ${component.id} input ${inputIndex} using ${constantComponent.type}`
    );
  }

  // Bir değerin sabit olup olmadığını kontrol eder
  private isConstant(value: string): boolean {
    // Basit 0 veya 1
    if (value === "0" || value === "1") return true;
    // Verilog formatları: 1'b0, 4'hF, 8'd12 vb.
    // 'b, 'h, 'd, 'o harflerinden sonra sayısal değerler
    if (/^\d+'[bB][01xXzZ]+$/.test(value)) return true; // Binary
    if (/^\d+'[hH][0-9a-fA-FxXzZ]+$/.test(value)) return true; // Hex
    if (/^\d+'[dD][0-9xXzZ]+$/.test(value)) return true; // Decimal
    if (/^\d+'[oO][0-7xXzZ]+$/.test(value)) return true; // Octal
    // true/false
    if (value === "true" || value === "false") return true;

    return false;
  }

  // Karmaşık bir ifade olup olmadığını kontrol eder
  private isComplexExpression(expr: string): boolean {
    return (
      expr.includes("&") ||
      expr.includes("|") ||
      expr.includes("~") ||
      expr.includes("^") ||
      expr.includes("(") ||
      expr.includes(")")
    );
  }
  private getGateLayer(output: string): number {
    const layer = Array.from(this.componentPositions.entries()).find(
      ([name]) => name === output
    )?.[1]?.x;
    return layer || 0;
  }

  private connectGateInputs(gate: VerilogGate, component: Component): void {
    if (gate.type === 'dflipflop') {
      // DFF has D input and CLK input, handled specially
      if (gate.inputs.length >= 2) {
        // D input (gate.inputs[0])
        const dInputName = gate.inputs[0];
        let dSourcePort = this.outputPorts[dInputName];
        
        if (dSourcePort) {
          const dWire = new Wire(dSourcePort);
          dWire.connect(component.inputs[0]); // D input (input[0])
          this.circuitBoard.addWire(dWire);
        } else {
          console.warn(`Source for D input '${dInputName}' not found, creating auto-toggle`);
          const position = this.findUnusedPosition();
          const toggle = new ToggleSwitch(position);
          this.components[`auto_${dInputName}`] = toggle;
          this.outputPorts[dInputName] = toggle.outputs[0];
          this.circuitBoard.addComponent(toggle);
          
          const wire = new Wire(toggle.outputs[0]);
          wire.connect(component.inputs[0]); // D input
          this.circuitBoard.addWire(wire);
          
          const labelPosition = { x: position.x - 80, y: position.y + 20 };
          const label = new Text(labelPosition, dInputName, 20);
          this.circuitBoard.addComponent(label);
        }
        
        // CLK input (gate.inputs[1])
        const clkInputName = gate.inputs[1];
        let clkSourcePort = this.outputPorts[clkInputName];
        
        if (clkSourcePort) {
          const clkWire = new Wire(clkSourcePort);
          clkWire.connect(component.inputs[1]); // CLK input (input[1])
          this.circuitBoard.addWire(clkWire);
        } else {
          console.warn(`Clock signal '${clkInputName}' not found, creating clock component`);
          const position = this.findUnusedPosition();
          const clock = new Clock(position, this.circuitBoard);
          this.components[`auto_${clkInputName}`] = clock;
          this.outputPorts[clkInputName] = clock.outputs[0];
          this.circuitBoard.addComponent(clock);
          
          const wire = new Wire(clock.outputs[0]);
          wire.connect(component.inputs[1]); // CLK input
          this.circuitBoard.addWire(wire);
          
          const labelPosition = { x: position.x - 80, y: position.y + 20 };
          const label = new Text(labelPosition, clkInputName, 20);
          this.circuitBoard.addComponent(label);
        }
      } else {
        console.error(`DFlipFlop gate '${gate.name || gate.output}' has insufficient inputs.`);
      }
      
      return; // Özel işleme tamamlandı, normal işleme geçme
    }
    
    for (let j = 0; j < gate.inputs.length; j++) {
      if (j >= component.inputs.length) {
        console.error(
          `Gate ${gate.type} has more inputs than supported: ${j + 1} > ${component.inputs.length}`
        );
        continue;
      }

      const inputName = gate.inputs[j];

      if (this.feedbackWires.some(fw => fw.source === gate.output && fw.target === inputName)) {
        console.log(`Skipping feedback wire from ${gate.output} to ${inputName}`);
        continue;
      }

      let sourcePort = this.outputPorts[inputName];

      if (!sourcePort) {
        const bitSelectionMatch = inputName.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
        if (bitSelectionMatch) {
          const [, baseName, msb, lsb] = bitSelectionMatch;

          sourcePort = this.outputPorts[inputName];

          if (!sourcePort && !lsb && parseInt(msb) === 0) {
            sourcePort = this.outputPorts[baseName];
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

        const toggleName = `auto_${inputName}`;
        this.components[toggleName] = toggle;
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

  private setupMultiBitSignals(module: VerilogModule): void {
    const multiBitInputs = module.inputs.filter(input => input.bitWidth && input.bitWidth > 1);
    const multiBitWires = module.wires.filter(wire => wire.bitWidth && wire.bitWidth > 1);
    const multiBitOutputs = module.outputs.filter(output => output.bitWidth && output.bitWidth > 1);

    const maxBitWidth = Math.max(
      ...multiBitInputs.map(s => s.bitWidth || 0),
      ...multiBitWires.map(s => s.bitWidth || 0),
      ...multiBitOutputs.map(s => s.bitWidth || 0)
    );

    var horizontalSpacing = 100;

    var verticalSpacing = 200;

    var inputBaseX = 50;
    var inputBaseY = 100;

    multiBitInputs.forEach((input, signalIndex) => {
      if (!input.bitWidth) return;

      console.log(`Setting up multi-bit input: ${input.name} (${input.bitWidth} bits)`);

      const baseX = inputBaseX + signalIndex * horizontalSpacing;
      this.componentPositions.set(input.name, { x: baseX, y: inputBaseY }); // Ana sinyal için pozisyon

      for (let i = 0; i < input.bitWidth; i++) {
        // Bit sırasını doğru belirle (msb/lsb'ye göre)
        const bitActualIndex =
          input.msb !== undefined && input.lsb !== undefined && input.msb < input.lsb
            ? input.lsb - i // Örn: [0:7] -> i=0 -> bit 7
            : input.lsb !== undefined
              ? input.lsb + i
              : i; // Örn: [7:0] -> i=0 -> bit 0

        const bitName = `${input.name}[${bitActualIndex}]`;
        const position = {
          x: baseX,
          y: inputBaseY + i * verticalSpacing,
        };

        const toggle = new ToggleSwitch(position);
        // DİKKAT: Hem bit adıyla hem de ana adıyla kaydetmek yerine sadece bit adıyla kaydedelim
        this.components[bitName] = toggle; // Bileşeni bit adıyla kaydet
        this.outputPorts[bitName] = toggle.outputs[0]; // Çıkış portunu bit adıyla kaydet
        this.circuitBoard.addComponent(toggle);

        const labelPosition = {
          x: position.x - 30,
          y: position.y + 30,
        };
        const label = new Text(labelPosition, bitName, 16);
        this.circuitBoard.addComponent(label);
      }
      inputBaseY += 50; // Sonraki çok-bitli sinyal için Y pozisyonunu ayarla
    });

    const outputBaseX = 500;
    const outputBaseY = 100;

    multiBitOutputs.forEach((output, signalIndex) => {
      if (!output.bitWidth) return;

      console.log(`Setting up multi-bit output: ${output.name} (${output.bitWidth} bits)`);

      const baseX = outputBaseX + signalIndex * horizontalSpacing;
      const baseY = outputBaseY;
      this.componentPositions.set(output.name, { x: baseX, y: baseY });

      for (let i = 0; i < output.bitWidth; i++) {
        const bitName = `${output.name}[${i}]`;
      }
    });

    module.wires.forEach(wire => {
      if (wire.bitWidth && wire.bitWidth > 1) {
        console.log(`Registered multi-bit wire: ${wire.name} (${wire.bitWidth} bits)`);

        for (let i = 0; i < wire.bitWidth; i++) {
          const bitName = `${wire.name}[${i}]`;
        }
      }
    });
  }

  private findBitPosition(baseName: string, bitIndex: number, totalBits: number): Point {
    const basePosition = this.componentPositions.get(baseName) || { x: 50, y: 100 };

    return {
      x: basePosition.x + bitIndex * 120,
      y: basePosition.y + 100,
    };
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
          gate => gate.inputs.includes(target) && gate.output !== source
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
            `Connecting cross-feedback: ${source} -> input ${inputIndex} of ${gate.output} (${target})`
          );
          const wire = new Wire(sourcePort);
          wire.connect(targetComponent.inputs[inputIndex]);
          this.circuitBoard.addWire(wire);
        }

        const targetSourceGates = module.gates.filter(gate => gate.output === target);

        for (const gate of targetSourceGates) {
          const inputIndex = gate.inputs.indexOf(source);
          if (inputIndex === -1) continue;

          const targetComponent = this.components[gate.output];
          if (!targetComponent || inputIndex >= targetComponent.inputs.length) continue;

          if (targetComponent.inputs[inputIndex].isConnected) continue;

          console.log(
            `Connecting SR latch feedback: ${source} -> input ${inputIndex} of ${target}`
          );
          const wire = new Wire(sourcePort);
          wire.connect(targetComponent.inputs[inputIndex]);
          this.circuitBoard.addWire(wire);
        }
      }
    }
  }

  private connectOutput(outputName: string, bulb: Component): void {
    const bitSelectionMatch = outputName.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
    const actualOutputName = bitSelectionMatch ? outputName : outputName;

    const sourceGate = this.findSourceForOutput(actualOutputName);
    let sourcePort;

    if (sourceGate) {
      sourcePort = this.outputPorts[sourceGate.output];
    } else {
      sourcePort = this.outputPorts[actualOutputName];

      if (!sourcePort && bitSelectionMatch) {
        const [, baseName, bitIndex] = bitSelectionMatch;

        const module = this.parser.getModule();
        if (module) {
          for (const gate of module.gates) {
            if (gate.output === actualOutputName) {
              sourcePort = this.outputPorts[gate.output];
              break;
            }
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
      this.components[`auto_${actualOutputName}`] = toggle;
      this.outputPorts[actualOutputName] = toggle.outputs[0];
      this.circuitBoard.addComponent(toggle);

      const wire = new Wire(toggle.outputs[0]);
      wire.connect(bulb.inputs[0]);
      this.circuitBoard.addWire(wire);

      const labelPosition = {
        x: position.x - 80,
        y: position.y + 20,
      };
      const label = new Text(labelPosition, actualOutputName, 20);
      this.circuitBoard.addComponent(label);
    }
  }

  private findSourceForOutput(outputName: string): VerilogGate | undefined {
    const module = this.parser.getModule();
    if (!module) return undefined;

    const directGate = module.gates.find(g => g.output === outputName);
    if (directGate) return directGate;

    for (const gate of module.gates) {
      if (gate.output === outputName) {
        return gate;
      }
    }

    const bufferGate = module.gates.find(
      g =>
        (g.type.toLowerCase() === "buf" || g.type.toLowerCase() === "buffer") &&
        g.output === outputName
    );
    if (bufferGate) return bufferGate;

    const bitSelectionMatch = outputName.match(/^(\w+)\[(\d+)\]$/);
    if (bitSelectionMatch) {
      const [, baseName, bitIndex] = bitSelectionMatch;

      return module.gates.find(
        g => g.output === `${baseName}[${bitIndex}]` || g.output === `${baseName}_${bitIndex}`
      );
    }

    if (/^d\d+$/.test(outputName)) {
      const gates = module.gates.filter(g => {
        return g.type === "and" && g.output === outputName;
      });

      if (gates.length > 0) {
        return gates[0];
      }
    }

    return undefined;
  }
  private getBaseSignalName(signal: string): string {
    const match = signal.match(/^(\w+)(?:\[.+\])?$/);
    return match ? match[1] : signal;
  }
  private detectAndHandleUndeclaredSignals(module: VerilogModule): void {
    const definedSignals = new Set<string>();
    const definedMultiBitSignals = new Map<string, VerilogPort>();

    module.inputs.forEach(input => {
      definedSignals.add(input.name);
      if (input.bitWidth !== undefined && input.bitWidth > 1) {
        definedMultiBitSignals.set(input.name, input);
      }
    });

    module.outputs.forEach(output => {
      definedSignals.add(output.name);
      if (output.bitWidth !== undefined && output.bitWidth > 1) {
        definedMultiBitSignals.set(output.name, output);
      }
    });

    if (!module.wires) {
      module.wires = [];
    }

    module.wires.forEach(wire => {
      definedSignals.add(wire.name);
      if (wire.bitWidth !== undefined && wire.bitWidth > 1) {
        definedMultiBitSignals.set(wire.name, wire);
      }
    });

    const usedSignals = new Set<string>();
    const bitSelections = new Set<string>();

    module.gates.forEach(gate => {
      usedSignals.add(gate.output);

      const outputBitMatch = gate.output.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
      if (outputBitMatch) {
        const baseName = outputBitMatch[1];
        bitSelections.add(gate.output);
        usedSignals.add(baseName);
      }

      gate.inputs.forEach(input => {
        usedSignals.add(input);

        const inputBitMatch = input.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
        if (inputBitMatch) {
          const baseName = inputBitMatch[1];
          bitSelections.add(input);
          usedSignals.add(baseName);
        }
      });
    });

    const undeclaredSignals: string[] = [];

    for (const signal of usedSignals) {
      if (definedSignals.has(signal)) {
        continue;
      }

      const bitMatch = signal.match(/^(\w+)\[(\d+)(?::(\d+))?\]$/);
      if (bitMatch) {
        const baseName = bitMatch[1];

        if (definedMultiBitSignals.has(baseName)) {
          continue;
        }
      }

      undeclaredSignals.push(signal);
    }

    if (undeclaredSignals.length > 0) {
      console.warn(
        `Undeclared signals found: ${undeclaredSignals.join(", ")}. Adding them as wires.`
      );

      undeclaredSignals.forEach(signal => {
        module.wires.push({ name: signal });
      });
    }
  }
}
