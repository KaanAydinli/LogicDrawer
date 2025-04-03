export interface VerilogPort {
  name: string;
  bitWidth?: number;
  msb?: number;
  lsb?: number;
}

export interface VerilogModule {
  name: string;
  inputs: VerilogPort[];
  outputs: VerilogPort[];
  wires: VerilogPort[];
  gates: VerilogGate[];
}

export interface VerilogGate {
  type: string;
  inputs: string[];
  output: string;
  name: string;
}

export class VerilogParser {
  private currentModule: VerilogModule | null = null;

  parseVerilog(code: string): VerilogModule {
    try {
      if (!code) {
        throw new Error("No Verilog code provided");
      }

      const noComments = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|`[\s\S]*?`/g, "");

      const moduleMatch = noComments.match(
        /module\s+(\w+)\s*\(([\s\S]*?)\);\s*([\s\S]*?)endmodule/,
      );
      if (!moduleMatch) {
        throw new Error(
          "Invalid Verilog module syntax. Check module declaration and make sure it ends with 'endmodule'.",
        );
      }

      const [, moduleName, portList, body] = moduleMatch;

      if (!portList.trim()) {
        throw new Error("Module port list is empty.");
      }

      if ((portList.match(/;/g) || []).length > 1) {
        throw new Error("Invalid semicolon in module port declaration.");
      }

      try {
        const { inputs, outputs, wires } = this.extractPortsAndWires(portList, body);
        const gates = this.extractGates(body);

        const allSignalNames = [
          ...inputs.map((p) => p.name),
          ...outputs.map((p) => p.name),
          ...wires.map((p) => p.name),
        ];

        //Removing these as we now does not need wire declarations in the body
        // this.validateWireConnections(gates, allSignalNames);
        // this.validateGateConnections(gates, allSignalNames);

        this.currentModule = {
          name: moduleName,
          inputs,
          outputs,
          wires,
          gates,
        };

        return this.currentModule;
      } catch (error) {
        throw new Error(
          `Error in module body: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  private validateWireConnections(gates: VerilogGate[], allSignals: string[]): void {
    const wireOutputMap: Record<string, string> = {};

    for (const gate of gates) {
      const outputNet = gate.output;

      if (!outputNet) {
        throw new Error(`Gate ${gate.name} has no output defined`);
      }

      if (outputNet in wireOutputMap) {
        throw new Error(
          `Signal '${outputNet}' is driven by multiple gates (${wireOutputMap[outputNet]} and ${gate.type}). Each wire can only have one driver.`,
        );
      }

      wireOutputMap[outputNet] = gate.type;
    }
  }

  private validateGateConnections(gates: VerilogGate[], allSignals: string[]): void {
    for (const gate of gates) {
      // Check output connection
      if (!gate.output || !allSignals.includes(gate.output)) {
        throw new Error(`Gate ${gate.name} output '${gate.output}' is not a declared signal`);
      }

      // Check input connections
      for (const input of gate.inputs) {
        if (!input || !allSignals.includes(input)) {
          throw new Error(`Gate ${gate.name} input '${input}' is not a declared signal`);
        }
      }
    }
  }

  getModule(): VerilogModule | null {
    return this.currentModule;
  }

  private extractPortsAndWires(portList: string, body: string) {
    const inputRegex =
      /input\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s]+?)(?=\s*;|\s+(?:output|inout|wire|reg|endmodule)\b|$)/g;
    const outputRegex = /output\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s]+)?/g;
    const wireRegex = /wire\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s,]+)?/g;

    const inputs = this.collectPortsWithBitWidths(portList, inputRegex);
    const outputs = this.collectPortsWithBitWidths(portList, outputRegex);

    const bodyInputs = this.collectPortsWithBitWidths(body, inputRegex);
    const bodyOutputs = this.collectPortsWithBitWidths(body, outputRegex);

    inputs.push(...bodyInputs);
    outputs.push(...bodyOutputs);

    
    const wires = this.collectPortsWithBitWidths(body, wireRegex);

    
    if (inputs.length === 0) {
      throw new Error("No input ports defined in the module");
    }
    if (outputs.length === 0) {
      throw new Error("No output ports defined in the module");
    }

    return { inputs, outputs, wires };
  }


  private collectPortsWithBitWidths(source: string, regex: RegExp): VerilogPort[] {

    const results: VerilogPort[] = [];
    let match;

    while ((match = regex.exec(source)) !== null) {
      const [, fullBitRange, msbStr, lsbStr, identifiers] = match;

      if (!identifiers || identifiers.trim() === "") {
        continue; 
      }


      const msb = msbStr ? parseInt(msbStr, 10) : undefined;
      const lsb = lsbStr ? parseInt(lsbStr, 10) : undefined;

   
      const bitWidth = msb !== undefined && lsb !== undefined ? Math.abs(msb - lsb) + 1 : undefined;

     
      const portNames = identifiers
        .split(/[,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const name of portNames) {
        results.push({
          name,
          bitWidth,
          msb,
          lsb,
        });
      }
    }

    return results;
  }

  private extractGates(body: string): VerilogGate[] {
    const gateRegex =
      /\b(xor|and|or|nand|buffer|nor|xnor|not|mux2|mux4)\s+(\w+)\s*\(\s*([\w\s,\[\]]+)\s*\)\s*;?/gi;
    const gates: VerilogGate[] = [];
    let match;

    while ((match = gateRegex.exec(body)) !== null) {
      const [, gateType, gateName, args] = match;

      const argList = this.parseGateArgs(args);

      if (argList.length === 0) {
        throw new Error(`Gate ${gateName} has no connections defined`);
      }

      const output = argList.shift() || "";

      this.validateGateInputCount(gateType, gateName, argList.length);

      gates.push({
        type: gateType.toLowerCase(),
        name: gateName,
        output,
        inputs: argList,
      });
    }

    return gates;
  }

  private validateGateInputCount(gateType: string, gateName: string, inputCount: number): void {
    const lowerType = gateType.toLowerCase();

    if (lowerType === "not" && inputCount !== 1) {
      throw new Error(`NOT gate '${gateName}' must have exactly 1 input`);
    } else if (["and", "or", "nand", "nor", "xor", "xnor"].includes(lowerType) && inputCount < 1) {
      throw new Error(`${gateType.toUpperCase()} gate '${gateName}' must have at least 1 input`);
    } else if (lowerType === "mux2" && inputCount !== 3) {
      throw new Error(`MUX2 gate '${gateName}' must have exactly 3 inputs (2 data, 1 select)`);
    } else if (lowerType === "mux4" && inputCount !== 6) {
      throw new Error(`MUX4 gate '${gateName}' must have exactly 6 inputs (4 data, 2 select)`);
    }
  }

  private parseGateArgs(argsString: string): string[] {
    const args: string[] = [];
    let currentArg = "";
    let bracketDepth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (char === "[") {
        bracketDepth++;
        currentArg += char;
      } else if (char === "]") {
        bracketDepth--;
        currentArg += char;
      } else if (char === "," && bracketDepth === 0) {
        args.push(currentArg.trim());
        currentArg = "";
      } else {
        currentArg += char;
      }
    }

    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }

    return args;
  }

  clear(): void {
    this.currentModule = null;
  }
}
