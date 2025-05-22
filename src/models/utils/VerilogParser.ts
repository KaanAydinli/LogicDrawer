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
  name?: string;
  output: string;
  inputs: string[];
  controlSignal?: string;
  conditions?: { value: string; result: string }[];
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
        /module\s+(\w+)\s*\(([\s\S]*?)\);\s*([\s\S]*?)endmodule/
      );
      if (!moduleMatch) {
        throw new Error(
          "Invalid Verilog module syntax. Check module declaration and make sure it ends with 'endmodule'."
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

        const safeInputs = inputs || [];
        const safeOutputs = outputs || [];
        const safeWires = wires || [];

        this.currentModule = {
          name: moduleName,
          inputs: safeInputs,
          outputs: safeOutputs,
          wires: safeWires,
          gates: [],
        };

        const gates = this.extractGates(body);

        this.currentModule.gates = gates || [];

        return this.currentModule;
      } catch (error) {
        throw new Error(
          `Error in module body: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  getModule(): VerilogModule | null {
    return this.currentModule;
  }

  private extractPortsAndWires(portList: string, body: string) {
    console.log("Extracting ports and wires from Verilog code...");
    console.log("Raw Port List:", portList);

    const inputs: VerilogPort[] = [];
    const outputs: VerilogPort[] = [];

    const portListItemRegex =
      /(input|output|inout)?\s*(?:reg\s+)?(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*(\w+)/g;

    const portListItems = portList
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    let currentDirection = "inout";
    let currentMsb: number | undefined = undefined;
    let currentLsb: number | undefined = undefined;
    let currentBitWidth: number | undefined = undefined;

    for (const item of portListItems) {
      portListItemRegex.lastIndex = 0;
      const match = portListItemRegex.exec(item);

      if (match) {
        const [, direction, msbStr, lsbStr, name] = match;

        if (direction) {
          currentDirection = direction;

          currentMsb = msbStr ? parseInt(msbStr, 10) : undefined;
          currentLsb = lsbStr ? parseInt(lsbStr, 10) : undefined;
          currentBitWidth =
            currentMsb !== undefined && currentLsb !== undefined
              ? Math.abs(currentMsb - currentLsb) + 1
              : undefined;
        } else {
          if (msbStr) {
            currentMsb = parseInt(msbStr, 10);
            currentLsb = lsbStr ? parseInt(lsbStr, 10) : undefined;
            currentBitWidth =
              currentMsb !== undefined && currentLsb !== undefined
                ? Math.abs(currentMsb - currentLsb) + 1
                : undefined;
          }
        }

        const port: VerilogPort = {
          name: name,
          bitWidth: currentBitWidth,
          msb: currentMsb,
          lsb: currentLsb,
        };

        if (currentDirection === "input") {
          inputs.push(port);
        } else if (currentDirection === "output") {
          outputs.push(port);
        }

        console.log(
          `Parsed PortList Item: Name=${name}, Dir=${currentDirection}, Width=${currentBitWidth}`
        );
      } else {
        console.warn(`Could not parse item from port list: "${item}"`);
      }
    }

    const bodyInputRegex =
      /input\s+(?:reg\s+)?(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?);/g;
    const bodyOutputRegex =
      /output\s+(?:reg\s+)?(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?);/g;
    const wireRegex = /wire\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|$)/g;
    const regRegex = /reg\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|$)/g;

    const bodyInputs = this.collectPortsWithBitWidths(body, bodyInputRegex);
    const bodyOutputs = this.collectPortsWithBitWidths(body, bodyOutputRegex);
    const wires = this.collectPortsWithBitWidths(body, wireRegex);
    const regs = this.collectPortsWithBitWidths(body, regRegex);

    wires.push(...regs);

    inputs.push(...bodyInputs);
    outputs.push(...bodyOutputs);

    var temp = [];

    temp.push(...inputs);
    temp.push(...outputs);
    temp.push(...wires);

    temp = this.removeDuplicatePorts(temp);

    if (inputs.length === 0) {
      console.warn("No input ports defined or detected in the module.");
      throw new Error("No input ports defined in the module");
    }
    if (outputs.length === 0) {
      throw new Error("No output ports defined in the module");
    }

    return { inputs: inputs, outputs: outputs, wires: wires };
  }

  private removeDuplicatePorts(ports: VerilogPort[]): VerilogPort[] {
    const uniquePorts: VerilogPort[] = [];
    const portNames = new Set<string>();

    for (const port of ports) {
      
      if (port && port.name) {
        if (portNames.has(port.name)) {
          
          throw new Error(`Duplicate port name found: ${port.name}`);
        }
        portNames.add(port.name);
        uniquePorts.push(port);
      } else {
        console.warn("Encountered an invalid port/wire object during deduplication:", port);
      }
    }
    return uniquePorts;
  }

  private collectPortsWithBitWidths(source: string, regex: RegExp): VerilogPort[] {
    const results: VerilogPort[] = [];
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(source)) !== null) {
      const [, bitRange, msbStr, lsbStr, identifiers] = match;
      if (!identifiers || identifiers.trim() === "") continue;

      const defaultMsb = msbStr ? parseInt(msbStr, 10) : undefined;
      const defaultLsb = lsbStr ? parseInt(lsbStr, 10) : undefined;
      const defaultBitWidth =
        defaultMsb !== undefined && defaultLsb !== undefined
          ? Math.abs(defaultMsb - defaultLsb) + 1
          : undefined;

      var parts = identifiers
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      for (var part of parts) {
        part;
        const nameMatch = part.match(/(?:\[\s*(\d+)\s*:\s*(\d+)\s*\]\s*)?(\w+)/);
        if (nameMatch) {
          const [, partMsbStr, partLsbStr, name] = nameMatch;
          const partMsb = partMsbStr ? parseInt(partMsbStr, 10) : defaultMsb;
          const partLsb = partLsbStr ? parseInt(partLsbStr, 10) : defaultLsb;
          const partBitWidth =
            partMsb !== undefined && partLsb !== undefined
              ? Math.abs(partMsb - partLsb) + 1
              : defaultBitWidth;

          results.push({
            name: name,
            bitWidth: partBitWidth,
            msb: partMsb,
            lsb: partLsb,
          });
        } else {
          console.warn(`Could not parse port/wire identifier part: ${part}`);
        }
      }
    }
    console.log(`Collected ports/wires with regex ${regex}:`, results);
    return results;
  }

  private extractGates(body: string): VerilogGate[] {
    const basicGates = this.extractBasicGates(body);

    const assignGates = this.extractAndProcessAssignments(body);

    const controlStructureGates = this.extractControlStructures(body);

    return [...basicGates, ...assignGates, ...controlStructureGates];
  }
  private extractControlStructures(body: string): VerilogGate[] {
    console.log("Control structures extraction from body:", body);
    const gates: VerilogGate[] = [];
    let gateCounter = 0;

    
    const alwaysRegex =
      /always\s*@\s*\(([^)]*?)\)\s*begin([\s\S]*?)end(?=\s*(?:always|assign|endmodule|$))/g;
    let alwaysMatch;
    alwaysRegex.lastIndex = 0;

    while ((alwaysMatch = alwaysRegex.exec(body)) !== null) {
      const sensitivity = alwaysMatch[1].trim();
      const alwaysBody = alwaysMatch[2].trim();

      console.log("Found always block with sensitivity:", sensitivity);
      console.log("Always body:", alwaysBody);

      
      const isSequential = /(pos|neg)edge\s+(\w+)/.test(sensitivity);
      const clockMatch = sensitivity.match(/(pos|neg)edge\s+(\w+)/);
      const clockSignal = clockMatch ? clockMatch[2] : null;

      if (isSequential) {
        console.log(`Sequential logic detected with clock signal: ${clockSignal}`);
        
        const sequentialGates = this.extractSequentialLogic(alwaysBody, clockSignal, gateCounter);
        gates.push(...sequentialGates);
      } else {
        
        const currentBlockGates: VerilogGate[] = [];

        
        this.processNestedIfStatements(alwaysBody, currentBlockGates, gateCounter);

        
        this.extractCaseStatements(alwaysBody, currentBlockGates, gateCounter + 100);

        gates.push(...currentBlockGates);
      }

      gateCounter += 200;
    }

    console.log("Extracted gates from control structures:", gates);
    return gates;
  }

  private extractSequentialLogic(
    alwaysBody: string,
    clockSignal: string | null,
    gateCounter: number
  ): VerilogGate[] {
    const gates: VerilogGate[] = [];

    if (!clockSignal) {
      console.error("Clock signal not properly identified for sequential logic");
      return gates;
    }

    
    if (alwaysBody.includes("if") && alwaysBody.includes("else")) {
      return this.extractSequentialIfElse(alwaysBody, clockSignal, gateCounter);
    }

    
    const assignmentRegex = /(\w+(?:\[\d+\])?)\s*<=\s*([^;]+);/g;
    let assignmentMatch;

    while ((assignmentMatch = assignmentRegex.exec(alwaysBody)) !== null) {
      const [fullMatch, target, expression] = assignmentMatch;
      const cleanTarget = this.cleanSignalName(target);
      const cleanExpression = expression.trim();

      console.log(`Found sequential assignment: ${cleanTarget} <= ${cleanExpression}`);

      
      const dffGate: VerilogGate = {
        type: "dflipflop",
        name: `dff_${cleanTarget}_${gateCounter++}`,
        output: cleanTarget,
        inputs: [cleanExpression, clockSignal], 
      };

      gates.push(dffGate);
    }

    return gates;
  }

  
  private extractSequentialIfElse(
    alwaysBody: string,
    clockSignal: string | null,
    gateCounter: number
  ): VerilogGate[] {
    const gates: VerilogGate[] = [];

    
    const ifRegex = /if\s*\(([^)]+)\)\s*([^;]+?)\s*<=\s*([^;]+);\s*else\s*([^;]+?)\s*<=\s*([^;]+);/;
    const match = alwaysBody.match(ifRegex);

    if (match) {
      const [, condition, targetIf, valueIf, targetElse, valueElse] = match;

      
      if (this.cleanSignalName(targetIf) === this.cleanSignalName(targetElse)) {
        const target = this.cleanSignalName(targetIf);

        
        const muxGate: VerilogGate = {
          type: "mux2",
          name: `mux_${target}_${gateCounter}`,
          output: `_mux_${target}_${gateCounter}`,
          inputs: [valueElse, valueIf], 
          controlSignal: condition, 
        };

        
        const dffGate: VerilogGate = {
          type: "dflipflop",
          name: `dff_${target}_${gateCounter + 1}`,
          output: target,
          inputs: [muxGate.output, clockSignal!], 
        };

        gates.push(muxGate);
        gates.push(dffGate);

        return gates;
      }
    }

    
    return this.extractSequentialLogic(alwaysBody, clockSignal, gateCounter);
  }

  private processNestedIfStatements(
    alwaysBody: string,
    gates: VerilogGate[],
    gateCounter: number
  ): string | null {
    
    const ifRegex = /\bif\s*\(([\s\S]+?)\)/;
    const ifMatch = alwaysBody.match(ifRegex);

    if (!ifMatch || ifMatch.index === undefined) {
      return null;
    }

    const condition = ifMatch[1].trim();
    const afterIfIndex = ifMatch.index + ifMatch[0].length;
    let remainingText = alwaysBody.substring(afterIfIndex).trim();

    
    const thenResult = this.extractStatementOrBlock(remainingText);
    if (!thenResult) {
      return null;
    }

    const thenBlock = thenResult.content;
    remainingText = thenResult.remaining.trim();

    
    let elseBlock = null;
    if (remainingText.startsWith("else")) {
      remainingText = remainingText.substring(4).trim();
      const elseResult = this.extractStatementOrBlock(remainingText);
      if (elseResult) {
        elseBlock = elseResult.content;
        remainingText = elseResult.remaining.trim();
      }
    }

    
    let finalOutputTarget: string | null = null;

    const thenAssign = thenBlock.match(/(\w+)\s*=\s*([^;]+);/);
    if (thenAssign) {
      finalOutputTarget = this.cleanSignalName(thenAssign[1]);
    } else if (elseBlock) {
      const elseAssign = elseBlock.match(/(\w+)\s*=\s*([^;]+);/);
      if (elseAssign) {
        finalOutputTarget = this.cleanSignalName(elseAssign[1]);
      }
    }

    if (!finalOutputTarget) {
      return null;
    }

    
    
    
    const isOuterMostIf = gateCounter === 0;
    const outputName = isOuterMostIf ? finalOutputTarget : `temp_if_${gateCounter}`;

    
    let thenValue: string;
    const hasThenNestedIf = thenBlock.includes("if (") || thenBlock.includes("if(");

    if (hasThenNestedIf) {
      
      const nestedOutput = this.processNestedIfStatements(thenBlock, gates, gateCounter + 1);
      thenValue = nestedOutput || "1'b0";
      console.log(`Nested if (THEN branch) output: ${thenValue}`);
    } else {
      
      const assignMatch = thenBlock.match(/(\w+)\s*=\s*([^;]+);/);
      if (assignMatch) {
        thenValue = this.cleanSignalName(assignMatch[2]);
      } else {
        thenValue = "'b0";
      }
    }

    
    let elseValue: string;
    const hasElseNestedIf = elseBlock && (elseBlock.includes("if (") || elseBlock.includes("if("));

    if (hasElseNestedIf && elseBlock) {
      
      const nestedOutput = this.processNestedIfStatements(elseBlock, gates, gateCounter + 100);
      elseValue = nestedOutput || "1'b0";
      console.log(`Nested if (ELSE branch) output: ${elseValue}`);
    } else if (elseBlock) {
      
      const assignMatch = elseBlock.match(/(\w+)\s*=\s*([^;]+);/);
      if (assignMatch) {
        elseValue = this.cleanSignalName(assignMatch[2]);
      } else {
        elseValue = "1'b0";
      }
    } else {
      elseValue = "1'b0";
    }

    
    const muxGate: VerilogGate = {
      type: "mux2",
      name: `if_mux_${gateCounter}`,
      
      output: outputName,
      inputs: [elseValue, thenValue], 
      controlSignal: condition,
    };

    console.log(
      `Creating MUX: if_mux_${gateCounter}, output=${outputName}, inputs=[${elseValue},${thenValue}], control=${condition}`
    );
    gates.push(muxGate);

    
    if (remainingText.includes("if (") || remainingText.includes("if(")) {
      this.processNestedIfStatements(remainingText, gates, gateCounter + 200);
    }

    
    return outputName;
  }

  private extractCaseStatements(body: string, gates: VerilogGate[], gateCounter: number): void {
    console.log("Extracting case statements from:", body);

    const caseRegex = /case\s*\(\s*([^)]+?)\s*\)([\s\S]*?)endcase/g;

    const caseItemRegex =
      /(?:(\d+'[bB][01xXzZ]+|\d+'[hH][0-9a-fA-FxXzZ]+|\d+'[dD][0-9xXzZ]+|\d+'[oO][0-7xXzZ]+|\d+|default)\s*:)\s*([^;]+);/g;

    let caseMatch;
    while ((caseMatch = caseRegex.exec(body)) !== null) {
      const selector = caseMatch[1].trim();
      const caseBody = caseMatch[2];
      console.log("Found case statement with selector:", selector);
      console.log("Case body:", caseBody);

      let selectorBitWidth = 1;
      const selectorWidthMatch = selector.match(/\[(\d+):(\d+)\]/);
      if (selectorWidthMatch) {
        const msb = parseInt(selectorWidthMatch[1]);
        const lsb = parseInt(selectorWidthMatch[2]);
        selectorBitWidth = Math.abs(msb - lsb) + 1;
      } else {
        const portOrWire =
          this.currentModule?.inputs.find(p => p.name === selector) ||
          this.currentModule?.wires.find(w => w.name === selector);
        if (portOrWire?.bitWidth) {
          selectorBitWidth = portOrWire.bitWidth;
        } else {
          console.warn(`Selector '${selector}' bit width could not be determined, assuming 1.`);
        }
      }

      const muxSize = 2 ** selectorBitWidth;
      const muxInputs: (string | null)[] = new Array(muxSize).fill(null);
      let defaultAssignment: string | null = null;
      const conditions: { value: string; result: string }[] = [];
      let targetOutput: string | null = null;

      let caseItemMatch;
      while ((caseItemMatch = caseItemRegex.exec(caseBody)) !== null) {
        const caseValue = caseItemMatch[1].trim();
        const assignment = caseItemMatch[2].trim();
        console.log(`Found case item: ${caseValue} -> ${assignment}`);

        const assignmentMatch = assignment.match(/(\w+)\s*=\s*(.+)/);
        if (!assignmentMatch) {
          console.warn(`Could not parse assignment: ${assignment}`);
          continue;
        }
        const currentTarget = assignmentMatch[1].trim();
        const expression = assignmentMatch[2].trim();

        if (targetOutput === null) {
          targetOutput = currentTarget;
        } else if (targetOutput !== currentTarget) {
          console.error(
            `Case statement assigns to multiple targets ('${targetOutput}' and '${currentTarget}'). This is not supported.`
          );
          return;
        }

        conditions.push({ value: caseValue, result: expression });

        if (caseValue === "default") {
          defaultAssignment = expression;
        } else {
          let index: number | null = null;
          try {
            if (caseValue.includes("'b")) {
              index = parseInt(caseValue.split("'b")[1].replace(/[xXzZ_]/g, "0"), 2);
            } else if (caseValue.includes("'h")) {
              index = parseInt(caseValue.split("'h")[1].replace(/[xXzZ_]/g, "0"), 16);
            } else if (caseValue.includes("'d")) {
              index = parseInt(caseValue.split("'d")[1].replace(/[xXzZ_]/g, "0"), 10);
            } else if (caseValue.includes("'o")) {
              index = parseInt(caseValue.split("'o")[1].replace(/[xXzZ_]/g, "0"), 8);
            } else {
              index = parseInt(caseValue, 10);
            }
          } catch (e) {
            console.error(`Could not parse case value '${caseValue}' to integer index.`, e);
          }

          if (index !== null && index >= 0 && index < muxSize) {
            if (muxInputs[index] !== null) {
              console.warn(
                `Duplicate case index ${index} ('${caseValue}'). Overwriting previous assignment.`
              );
            }
            muxInputs[index] = expression;
          } else {
            console.warn(
              `Case value '${caseValue}' (index ${index}) is out of bounds for MUX size ${muxSize}.`
            );
          }
        }
      }

      if (targetOutput === null) {
        console.warn("No valid assignments found in case statement.");
        continue;
      }

      if (defaultAssignment !== null) {
        for (let i = 0; i < muxSize; i++) {
          if (muxInputs[i] === null) {
            muxInputs[i] = defaultAssignment;
          }
        }
      } else {
        for (let i = 0; i < muxSize; i++) {
          if (muxInputs[i] === null) {
            console.warn(
              `MUX input at index ${i} is unspecified and no default case found. Assigning '0'.`
            );
            muxInputs[i] = "'b0";
          }
        }
      }

      let muxType: string;
      if (muxSize <= 2) muxType = "mux2";
      else if (muxSize <= 4) muxType = "mux4";
      else {
        console.error(`MUX size ${muxSize} is too large or unsupported.`);
        continue;
      }

      console.log(`Creating MUX for target ${targetOutput} with ${muxSize} inputs.`);

      const muxGate: VerilogGate = {
        type: muxType,
        name: `case_${muxType}_${gateCounter}`,
        output: targetOutput,

        inputs: muxInputs.filter(input => input !== null) as string[],
        controlSignal: selector,
        conditions: conditions,
      };

      console.log(`Creating ${muxType} gate:`, muxGate);
      gates.push(muxGate);
      gateCounter += 100;
    }
  }
  private extractAndProcessAssignments(body: string): VerilogGate[] {
    const assignRegex = /assign\s+(\w+(?:\[\d+:\d+\]|\[\d+\])?)\s*=\s*([\w\s&|~^()\[\]<>!?:+\-*\/'"]+);?/g;
    const gates: VerilogGate[] = [];
    let match;
    let gateCounter = 0;
  
    while ((match = assignRegex.exec(body)) !== null) {
      const [, outputRaw, expression] = match;
      const output = outputRaw.replace(/\[.*\]/, "");
      const trimmedExpr = expression.trim();
  
      // Check for Verilog literals: 1'b0, 1'b1, 8'h2A, etc.
      const literalPattern = /^\d+'[bB][01xXzZ_]+$|^\d+'[hH][0-9a-fA-FxXzZ_]+$|^\d+'[dD][0-9_]+$|^\d+'[oO][0-7xXzZ_]+$|^1'b[01xXzZ]$/;
      
      if (literalPattern.test(trimmedExpr)) {
        // Direct constant assignment
        const constantGate: VerilogGate = {
          type: 'buf',
          name: `constant_${output}_${gateCounter++}`,
          output: output,
          inputs: [trimmedExpr]
        };
        
        console.log(`Created constant assignment: ${output} = ${trimmedExpr}`);
        gates.push(constantGate);
        continue;
      }

      // Process complex expression
      this.processComplexExpression(trimmedExpr, output, gates, gateCounter);
      gateCounter += this.countOperators(trimmedExpr);
    }

    return gates;
  }

  /**
   * Basit bir ifade mi kontrol eder (tek operatör içeren)
   */
  private isSimpleExpression(expr: string): boolean {
    return (
      (expr.includes("&") && !expr.includes("|") && !expr.includes("^") && !expr.includes("~")) ||
      (expr.includes("|") && !expr.includes("&") && !expr.includes("^") && !expr.includes("~")) ||
      (expr.includes("^") && !expr.includes("&") && !expr.includes("|") && !expr.includes("~")) ||
      (expr.startsWith("~") && !expr.includes("&") && !expr.includes("|") && !expr.includes("^"))
    );
  }

  /**
   * Basit ifadeleri işler (AND, OR, XOR, NOT)
   */
  private processSimpleExpression(expr: string, output: string, gates: VerilogGate[]): void {
    if (expr.includes("&") && !expr.includes("|") && !expr.includes("^")) {
      const inputs = expr.split("&").map(s => this.cleanSignalName(s));
      gates.push({
        type: "and",
        name: `assign_${output}`,
        output,
        inputs,
      });
    } else if (expr.includes("|") && !expr.includes("&") && !expr.includes("^")) {
      const inputs = expr.split("|").map(s => this.cleanSignalName(s));
      gates.push({
        type: "or",
        name: `assign_${output}`,
        output,
        inputs,
      });
    } else if (expr.includes("^") && !expr.includes("&") && !expr.includes("|")) {
      const inputs = expr.split("^").map(s => this.cleanSignalName(s));
      gates.push({
        type: "xor",
        name: `assign_${output}`,
        output,
        inputs,
      });
    } else if (
      expr.startsWith("~") &&
      !expr.includes("&") &&
      !expr.includes("|") &&
      !expr.includes("^")
    ) {
      const input = this.cleanSignalName(expr.substring(1));
      gates.push({
        type: "not",
        name: `assign_${output}`,
        output,
        inputs: [input],
      });
    }
  }
  private processParenthesisExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    
    const parentheses = this.extractParenthesisGroups(expr);
    let processedExpr = expr;
    const tempWires: string[] = [];

    
    parentheses.forEach((parenthesis, index) => {
      const tempOutput = `_temp_wire_${gateCounter + index}`;
      tempWires.push(tempOutput);

      
      const innerExpr = parenthesis.substring(1, parenthesis.length - 1);

      
      this.processNestedExpression(innerExpr, tempOutput, gates, gateCounter + index + 100);

      
      processedExpr = processedExpr.replace(parenthesis, tempOutput);
    });

    
    if (processedExpr !== output) {
      if (this.isSimpleExpression(processedExpr)) {
        this.processSimpleExpression(processedExpr, output, gates);
      } else {
        this.processComplexExpression(
          processedExpr,
          output,
          gates,
          gateCounter + parentheses.length * 100
        );
      }
    }
  }

  private extractParenthesisGroups(expr: string): string[] {
    const groups: string[] = [];
    let depth = 0;
    let start = -1;

    
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (expr[i] === ")") {
        depth--;
        if (depth === 0 && start !== -1) {
          groups.push(expr.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return groups;
  }
  private processNestedExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    
    if (expr.startsWith("(") && expr.endsWith(")")) {
      const innerExpr = expr.substring(1, expr.length - 1);
      if (this.isBalancedParentheses(innerExpr)) {
        expr = innerExpr;
      }
    }

    
    const parenthesisGroups = this.extractParenthesisGroups(expr);

    if (parenthesisGroups.length > 0) {
      
      this.processParenthesisExpression(expr, output, gates, gateCounter);
    } else if (this.isSimpleExpression(expr)) {
      
      this.processSimpleExpression(expr, output, gates);
    } else {
      
      this.processComplexExpression(expr, output, gates, gateCounter);
    }
  }

  
  private isBalancedParentheses(expr: string): boolean {
    let depth = 0;

    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") {
        depth++;
      } else if (expr[i] === ")") {
        depth--;
        if (depth < 0) return false; 
      }
    }

    return depth === 0; 
  }

  /**
   * Ternary ifadeleri işler (? :)
   */
  /**
   * Ternary ifadeleri işler (? :)
   */

  private processTernaryExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    const parts = this.splitTernary(expr);
    if (parts.length !== 3) {
      console.error(`Could not properly split ternary expression: ${expr}`);
      return; 
    }

    const [condition, trueExpr, falseExpr] = parts;

    const cleanCondition = this.cleanSignalName(condition);
    const cleanTrueExpr = this.cleanSignalName(trueExpr);
    const cleanFalseExpr = this.cleanSignalName(falseExpr);

    
    if (
      this.isSimpleIdentifier(condition) &&
      this.isSimpleIdentifier(trueExpr) &&
      this.isSimpleIdentifier(falseExpr)
    ) {
      
      const muxGate: VerilogGate = {
        
        type: "mux2",
        name: `assign_mux2_${output}_${gateCounter}`, 
        output: output,
        
        inputs: [cleanTrueExpr, cleanFalseExpr], 
        
        controlSignal: cleanCondition,
      };
      console.log("Created MUX2 directly (simple):", JSON.stringify(muxGate)); 
      gates.push(muxGate);
      return; 
    }
    

    
    let finalConditionSignal = cleanCondition;
    let finalTrueSignal = cleanTrueExpr;
    let finalFalseSignal = cleanFalseExpr;
    let tempGateCounter = gateCounter + 1; 

    
    if (!this.isSimpleIdentifier(condition)) {
      finalConditionSignal = `_temp_cond_${gateCounter}`;
      console.log(`Processing complex condition: ${condition} -> ${finalConditionSignal}`);
      
      if (condition.includes("(")) {
        this.processParenthesisExpression(condition, finalConditionSignal, gates, tempGateCounter);
      } else {
        this.processComplexExpression(condition, finalConditionSignal, gates, tempGateCounter);
      }
      tempGateCounter += this.countOperators(condition) + 1; 
    }

    
    if (!this.isSimpleIdentifier(trueExpr)) {
      finalTrueSignal = `_temp_true_${gateCounter}`;
      console.log(`Processing complex true expression: ${trueExpr} -> ${finalTrueSignal}`);
      if (trueExpr.includes("(")) {
        this.processParenthesisExpression(trueExpr, finalTrueSignal, gates, tempGateCounter);
      } else {
        this.processComplexExpression(trueExpr, finalTrueSignal, gates, tempGateCounter);
      }
      tempGateCounter += this.countOperators(trueExpr) + 1;
    }

    
    if (!this.isSimpleIdentifier(falseExpr)) {
      finalFalseSignal = `_temp_false_${gateCounter}`;
      console.log(`Processing complex false expression: ${falseExpr} -> ${finalFalseSignal}`);
      if (falseExpr.includes("(")) {
        this.processParenthesisExpression(falseExpr, finalFalseSignal, gates, tempGateCounter);
      } else {
        this.processComplexExpression(falseExpr, finalFalseSignal, gates, tempGateCounter);
      }
      
    }

    
    const finalMuxGate: VerilogGate = {
      
      type: "mux2",
      name: `assign_mux2_${output}_${gateCounter}`, 
      output: output,
      
      inputs: [finalTrueSignal, finalFalseSignal], 
      
      controlSignal: finalConditionSignal,
    };
    console.log(`Created final MUX2 for ternary (complex):`, JSON.stringify(finalMuxGate)); 
    gates.push(finalMuxGate);
    
  }

  /**
   * Basit bir tanımlayıcı mı? (sadece değişken adı)
   */
  private isSimpleIdentifier(expr: string): boolean {
    return /^\s*[a-zA-Z_]\w*\s*$/.test(expr) && !expr.includes("[") && !expr.includes("(");
  }

  /**
   * Ternary operatörü parçalar
   */
  private splitTernary(expr: string): string[] {
    let depth = 0;
    let questionIdx = -1;
    let colonIdx = -1;

    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") depth++;
      else if (expr[i] === ")") depth--;
      else if (expr[i] === "?" && depth === 0) questionIdx = i;
      else if (expr[i] === ":" && depth === 0) colonIdx = i;
    }

    if (questionIdx !== -1 && colonIdx !== -1) {
      const condition = expr.substring(0, questionIdx).trim();
      const trueExpr = expr.substring(questionIdx + 1, colonIdx).trim();
      const falseExpr = expr.substring(colonIdx + 1).trim();
      return [condition, trueExpr, falseExpr];
    }

    return [];
  }
  private findMatchingEnd(text: string, startIndex: number = 0): number {
    let balance = 0;
    let currentIndex = startIndex;
    const beginKeyword = "begin";
    const endKeyword = "end";
    let inBegin = false; 

    
    while (currentIndex < text.length && /\s/.test(text[currentIndex])) {
      currentIndex++;
    }
    if (text.substring(currentIndex, currentIndex + beginKeyword.length) === beginKeyword) {
      currentIndex += beginKeyword.length;
      balance = 1; 
      inBegin = true;
    } else {
      
      return -1;
    }

    while (currentIndex < text.length) {
      
      if (text.substring(currentIndex, currentIndex + beginKeyword.length) === beginKeyword) {
        balance++;
        currentIndex += beginKeyword.length;
        
      } else if (text.substring(currentIndex, currentIndex + endKeyword.length) === endKeyword) {
        balance--;
        if (balance === 0 && inBegin) {
          
          return currentIndex + endKeyword.length; 
        }
        if (balance < 0) return -1; 
        currentIndex += endKeyword.length;
      } else {
        currentIndex++;
      }
    }
    return -1; 
  }

  
  private extractStatementOrBlock(text: string): { content: string; remaining: string } | null {
    text = text.trim();
    if (!text) return null;

    if (text.startsWith("begin")) {
      const endBlockIndex = this.findMatchingEnd(text, 0); 
      if (endBlockIndex !== -1) {
        
        const beginContentStart = text.indexOf("begin") + "begin".length;
        const endContentEnd = endBlockIndex - "end".length; 
        const content = text.substring(beginContentStart, endContentEnd).trim();
        const remaining = text.substring(endBlockIndex).trim();
        return { content, remaining };
      } else {
        console.error(
          "Syntax error: Missing 'end' for 'begin' block starting near:",
          text.substring(0, 50) + "..."
        );
        return null; 
      }
    } else {
      
      
      let semicolonIndex = -1;
      let parenDepth = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "(") parenDepth++;
        else if (text[i] === ")") parenDepth--;
        else if (text[i] === ";" && parenDepth === 0) {
          semicolonIndex = i;
          break;
        }
      }

      if (semicolonIndex !== -1) {
        const content = text.substring(0, semicolonIndex + 1).trim(); 
        const remaining = text.substring(semicolonIndex + 1).trim();
        return { content, remaining };
      } else {
        console.error(
          "Syntax error: Expected single statement ending with ';' near:",
          text.substring(0, 50) + "..."
        );
        return null; 
      }
    }
  }

  /**
   * Karmaşık ifadeleri işler (operatör önceliğine göre)
   */
  private processComplexExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    // First, tokenize the expression
    const tokens = this.tokenizeExpression(expr);
    
    // Convert to postfix notation (Reverse Polish Notation)
    const postfix = this.infixToPostfix(tokens);
    
    // Process the postfix expression to create gates
    this.processPostfixExpression(postfix, output, gates, gateCounter);
  }

  private tokenizeExpression(expr: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inIdentifier = false;
    let inNumber = false;
    let inBitSelect = false;
    let parenDepth = 0;

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      if (char === '(') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
        parenDepth++;
        continue;
      }
      
      if (char === ')') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
        parenDepth--;
        continue;
      }
      
      if (char === '&' || char === '|' || char === '^' || char === '~') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
        continue;
      }
      
      if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }

  private getOperatorPrecedence(op: string): number {
    switch (op) {
      case '~': return 3;
      case '&': return 2;
      case '^': return 1;
      case '|': return 0;
      default: return -1;
    }
  }

  private infixToPostfix(tokens: string[]): string[] {
    const output: string[] = [];
    const operators: string[] = [];
    
    for (const token of tokens) {
      if (token === '(') {
        operators.push(token);
      } else if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          output.push(operators.pop()!);
        }
        if (operators.length > 0 && operators[operators.length - 1] === '(') {
          operators.pop();
        }
      } else if (this.isOperator(token)) {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          this.getOperatorPrecedence(operators[operators.length - 1]) >= this.getOperatorPrecedence(token)
        ) {
          output.push(operators.pop()!);
        }
        operators.push(token);
      } else {
        output.push(token);
      }
    }
    
    while (operators.length > 0) {
      output.push(operators.pop()!);
    }
    
    return output;
  }

  private isOperator(token: string): boolean {
    return ['~', '&', '|', '^'].includes(token);
  }

  private processPostfixExpression(
    postfix: string[],
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    const stack: string[] = [];
    let tempCounter = 0;
    
    const generateTempName = (op: string): string => `_temp_${op}_${gateCounter}_${tempCounter++}`;
    
    for (const token of postfix) {
      if (this.isOperator(token)) {
        if (token === '~') {
          // Unary operator
          const operand = stack.pop()!;
          const tempOut = generateTempName('not');
          
          gates.push({
            type: 'not',
            name: `not_${tempOut}`,
            output: tempOut,
            inputs: [this.cleanSignalName(operand)]
          });
          
          stack.push(tempOut);
        } else {
          // Binary operator
          const right = stack.pop()!;
          const left = stack.pop()!;
          const tempOut = generateTempName(token);
          
          gates.push({
            type: token === '&' ? 'and' : token === '|' ? 'or' : 'xor',
            name: `${token}_${tempOut}`,
            output: tempOut,
            inputs: [
              this.cleanSignalName(left),
              this.cleanSignalName(right)
            ]
          });
          
          stack.push(tempOut);
        }
      } else {
        stack.push(token);
      }
    }
    
    // Connect final result to output
    const finalResult = stack.pop()!;
    if (finalResult !== output) {
      gates.push({
        type: 'buf',
        name: `buf_${output}`,
        output: output,
        inputs: [this.cleanSignalName(finalResult)]
      });
    }
  }

  /**
   * Sinyal adındaki boşluk ve bit aralıklarını temizler
   */
  private cleanSignalName(name: string): string {
    // If it's a Verilog constant (e.g., 1'b0, 4'hF, etc.), return it as is
    if (/^\d+'[bdh][0-9a-fA-F_xzXZ]*$/.test(name.trim())) {
      return name.trim();
    }
    // Otherwise clean up arrays/vector notation as before
    return name.trim().replace(/\[.*\]/, "");
  }

  private extractBasicGates(body: string): VerilogGate[] {
    const gateRegex =
      /\b(xor|and|or|nand|buf|nor|xnor|not|mux2|mux4)\s+(\w+)\s*\(\s*([\w\s,\[\]]+)\s*\)\s*;?/gi;
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

  /**
   * İfadedeki operatör sayısını sayar
   */
  private countOperators(expr: string): number {
    let count = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "&" || expr[i] === "|" || expr[i] === "^" || expr[i] === "~") {
        count++;
      }
    }
    return Math.max(1, count);
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
    let inQuotes = false;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (char === '"' && argsString[i - 1] !== "\\") {
        inQuotes = !inQuotes;
        currentArg += char;
      } else if (char === "[") {
        bracketDepth++;
        currentArg += char;
      } else if (char === "]") {
        bracketDepth--;
        currentArg += char;
      } else if (char === "," && bracketDepth === 0 && !inQuotes) {
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
