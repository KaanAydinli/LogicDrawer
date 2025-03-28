/**
 * A more advanced SystemVerilog parser for your logic circuit designer.
 * Supports module definitions, ports, connecting wires, and basic gate primitives.
 * Now with support for bit vector notation ([n:m]).
 */
export interface VerilogPort {
  name: string;
  bitWidth?: number;  // Optional bit width for vectors
  msb?: number;       // Optional most significant bit
  lsb?: number;       // Optional least significant bit
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

  /**
   * Parse Verilog code and return the module definition
   */
  parseVerilog(code: string): VerilogModule {
    // Remove comments
    const noComments = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");

    // Simple match for module
    const moduleMatch = noComments.match(/module\s+(\w+)\s*\(([\s\S]*?)\);\s*([\s\S]*?)endmodule/);
    if (!moduleMatch) {
      throw new Error("Invalid Verilog module syntax.");
    }

    const [ , moduleName, portList, body ] = moduleMatch;
    const { inputs, outputs, wires } = this.extractPortsAndWires(portList, body);
    const gates = this.extractGates(body);

    this.currentModule = {
      name: moduleName,
      inputs,
      outputs,
      wires,
      gates
    };

    return this.currentModule;
  }

  /**
   * Get the currently parsed module
   */
  getModule(): VerilogModule | null {
    return this.currentModule;
  }

  private extractPortsAndWires(portList: string, body: string) {
    // Find input and output declarations in the module header and body
    // Now also capture bit vector specifications like [7:0]
    const inputRegex = /input\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s]+);?/g;
    const outputRegex = /output\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s]+);?/g;
    const wireRegex = /wire\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w,\s,]+);?/g;

    const inputs = this.collectPortsWithBitWidths(portList, inputRegex);
    const outputs = this.collectPortsWithBitWidths(portList, outputRegex);

    // Also check body for separate declarations
    const bodyInputs = this.collectPortsWithBitWidths(body, inputRegex);
    const bodyOutputs = this.collectPortsWithBitWidths(body, outputRegex);

    inputs.push(...bodyInputs);
    outputs.push(...bodyOutputs);

    // Check for wire declarations in body
    const wires = this.collectPortsWithBitWidths(body, wireRegex);

    return { inputs, outputs, wires };
  }

  private collectPortsWithBitWidths(source: string, regex: RegExp): VerilogPort[] {
    const results: VerilogPort[] = [];
    let match;
    
    while ((match = regex.exec(source)) !== null) {
      const [, fullBitRange, msbStr, lsbStr, identifiers] = match;
      
      // Parse bit range if present
      const msb = msbStr ? parseInt(msbStr, 10) : undefined;
      const lsb = lsbStr ? parseInt(lsbStr, 10) : undefined;
      
      // Calculate bit width if msb and lsb are defined
      const bitWidth = (msb !== undefined && lsb !== undefined) 
        ? Math.abs(msb - lsb) + 1 
        : undefined;
      
      // Split identifiers and create ports
      const portNames = identifiers
        .split(/[,]/)
        .map(s => s.trim())
        .filter(Boolean);
      
      for (const name of portNames) {
        results.push({
          name,
          bitWidth,
          msb,
          lsb
        });
      }
    }
    
    return results;
  }

  private extractGates(body: string): VerilogGate[] {
    // Match gate instances like: xor x1(out, in1, in2);
    // or: and g1(a, b, c);
    // or: and a2(out2, w2, a0);
    const gateRegex = /\b(xor|and|or|nand|nor|xnor|not|mux2|mux4)\s+(\w+)\s*\(\s*([\w\s,\[\]]+)\s*\)\s*;?/gi;
    const gates: VerilogGate[] = [];
    let match;
    
    while ((match = gateRegex.exec(body)) !== null) {
      const [, gateType, gateName, args] = match;
      
      // Parse arguments, preserving any bit-select or bit-range notation
      const argList = this.parseGateArgs(args);
      
      // Usually first is output, rest are inputs
      const output = argList.shift() || "";
      
      gates.push({
        type: gateType.toLowerCase(),
        name: gateName,
        output,
        inputs: argList
      });
    }
    
    return gates;
  }
  
  private parseGateArgs(argsString: string): string[] {
    // Split by commas, but handle bit select/range notation properly
    const args: string[] = [];
    let currentArg = '';
    let bracketDepth = 0;
    
    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if (char === '[') {
        bracketDepth++;
        currentArg += char;
      } else if (char === ']') {
        bracketDepth--;
        currentArg += char;
      } else if (char === ',' && bracketDepth === 0) {
        // Only split on commas that aren't inside brackets
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
    }
    
    // Add the last argument
    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }
    
    return args;
  }

  /**
   * Clear the current module
   */
  clear(): void {
    this.currentModule = null;
  }
}