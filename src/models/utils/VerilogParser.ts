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
  conditions?: {value: string, result: string}[]; 
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

    
    
    
    
    const portListItemRegex = /(input|output|inout)?\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*(\w+)/g;

    
    const portListItems = portList.split(',').map(item => item.trim()).filter(Boolean);

    let currentDirection = 'inout'; 
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
                currentBitWidth = (currentMsb !== undefined && currentLsb !== undefined)
                                    ? Math.abs(currentMsb - currentLsb) + 1 : undefined;
            } else {
                 
                 if (msbStr) { 
                    currentMsb = parseInt(msbStr, 10);
                    currentLsb = lsbStr ? parseInt(lsbStr, 10) : undefined; 
                    currentBitWidth = (currentMsb !== undefined && currentLsb !== undefined)
                                        ? Math.abs(currentMsb - currentLsb) + 1 : undefined;
                 }
                 
            }


            const port: VerilogPort = {
                name: name,
                bitWidth: currentBitWidth,
                msb: currentMsb,
                lsb: currentLsb,
            };

            if (currentDirection === 'input') {
                inputs.push(port);
            } else if (currentDirection === 'output') {
                outputs.push(port);
            }
            
             console.log(`Parsed PortList Item: Name=${name}, Dir=${currentDirection}, Width=${currentBitWidth}`); 
        } else {
            console.warn(`Could not parse item from port list: "${item}"`);
        }
    }


    
    
    const bodyInputRegex = /input\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?);/g;
    const bodyOutputRegex = /output\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?);/g;
    const wireRegex = /wire\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|$)/g;

    
    
    const bodyInputs = this.collectPortsWithBitWidths(body, bodyInputRegex);
    const bodyOutputs = this.collectPortsWithBitWidths(body, bodyOutputRegex);
    const wires = this.collectPortsWithBitWidths(body, wireRegex);

    
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
      // Port ve isminin geçerli olduğundan emin ol
      if (port && port.name) {
          if (portNames.has(port.name)) {
              // Yinelenen isim bulunduğunda hata fırlat
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
      const defaultBitWidth = (defaultMsb !== undefined && defaultLsb !== undefined)
                                ? Math.abs(defaultMsb - defaultLsb) + 1 : undefined;

      
      var parts = identifiers.split(",").map(s => s.trim()).filter(Boolean);
      for (var part of parts) {
          
          part
          const nameMatch = part.match(/(?:\[\s*(\d+)\s*:\s*(\d+)\s*\]\s*)?(\w+)/);
          if (nameMatch) {
              const [, partMsbStr, partLsbStr, name] = nameMatch;
              const partMsb = partMsbStr ? parseInt(partMsbStr, 10) : defaultMsb;
              const partLsb = partLsbStr ? parseInt(partLsbStr, 10) : defaultLsb;
              const partBitWidth = (partMsb !== undefined && partLsb !== undefined)
                                    ? Math.abs(partMsb - partLsb) + 1 : defaultBitWidth;

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
  
    // always bloklarını bul
    const alwaysRegex = /always\s*@\s*\(([^)]*?)\)\s*begin([\s\S]*?)end(?=\s*(?:always|assign|endmodule|$))/g;
    let alwaysMatch;
    alwaysRegex.lastIndex = 0;
  
    while ((alwaysMatch = alwaysRegex.exec(body)) !== null) {
      const sensitivity = alwaysMatch[1].trim();
      const alwaysBody = alwaysMatch[2].trim();
  
      console.log("Found always block with sensitivity:", sensitivity);
      console.log("Always body:", alwaysBody);
  
      // Sequential logic kontrolü - posedge/negedge algılama
      const isSequential = /(pos|neg)edge\s+(\w+)/.test(sensitivity);
      const clockMatch = sensitivity.match(/(pos|neg)edge\s+(\w+)/);
      const clockSignal = clockMatch ? clockMatch[2] : null;
      
      if (isSequential) {
        console.log(`Sequential logic detected with clock signal: ${clockSignal}`);
        // Sequential logic için ayrı işleme
        const sequentialGates = this.extractSequentialLogic(alwaysBody, clockSignal, gateCounter);
        gates.push(...sequentialGates);
      } else {
        // Kombinasyonel logic için mevcut işleme
        const currentBlockGates: VerilogGate[] = [];
        this.extractIfStatementsManually(alwaysBody, currentBlockGates, gateCounter);
        this.extractCaseStatements(alwaysBody, currentBlockGates, gateCounter + 100);
        gates.push(...currentBlockGates);
      }
      
      gateCounter += 200;
    }
  
    console.log("Extracted gates from control structures:", gates);
    return gates;
  }
  private extractSequentialLogic(alwaysBody: string, clockSignal: string | null, gateCounter: number): VerilogGate[] {
    const gates: VerilogGate[] = [];
    
    if (!clockSignal) {
      console.error("Clock signal not properly identified for sequential logic");
      return gates;
    }
    
    // Eğer if-else yapısı varsa önce onu işle
    if (alwaysBody.includes("if") && alwaysBody.includes("else")) {
      return this.extractSequentialIfElse(alwaysBody, clockSignal, gateCounter);
    }
    
    // Non-blocking atama (<= operator) ifadelerini bul
    const assignmentRegex = /(\w+(?:\[\d+\])?)\s*<=\s*([^;]+);/g;
    let assignmentMatch;
    
    while ((assignmentMatch = assignmentRegex.exec(alwaysBody)) !== null) {
      const [fullMatch, target, expression] = assignmentMatch;
      const cleanTarget = this.cleanSignalName(target);
      const cleanExpression = expression.trim();
      
      console.log(`Found sequential assignment: ${cleanTarget} <= ${cleanExpression}`);
      
      // D flip-flop kapısı oluştur
      const dffGate: VerilogGate = {
        type: 'dflipflop',
        name: `dff_${cleanTarget}_${gateCounter++}`,
        output: cleanTarget,
        inputs: [cleanExpression, clockSignal], // [D, CLK]
      };
      
      gates.push(dffGate);
    }
    
    return gates;
  }
  
  // Yeni fonksiyon - sequential if-else yapıları için
  private extractSequentialIfElse(alwaysBody: string, clockSignal: string | null, gateCounter: number): VerilogGate[] {
    const gates: VerilogGate[] = [];
    
    // if-else yapısını bul
    const ifRegex = /if\s*\(([^)]+)\)\s*([^;]+?)\s*<=\s*([^;]+);\s*else\s*([^;]+?)\s*<=\s*([^;]+);/;
    const match = alwaysBody.match(ifRegex);
    
    if (match) {
      const [, condition, targetIf, valueIf, targetElse, valueElse] = match;
      
      // Hedeflerin aynı olduğunu doğrula (genelde böyle olur)
      if (this.cleanSignalName(targetIf) === this.cleanSignalName(targetElse)) {
        const target = this.cleanSignalName(targetIf);
        
        // Önce bir MUX2 oluştur
        const muxGate: VerilogGate = {
          type: 'mux2',
          name: `mux_${target}_${gateCounter}`,
          output: `_mux_${target}_${gateCounter}`,
          inputs: [valueElse, valueIf], // [0, 1] girişleri 
          controlSignal: condition // Select sinyali
        };
        
        // Sonra DFF'i MUX çıkışına bağla
        const dffGate: VerilogGate = {
          type: 'dflipflop',
          name: `dff_${target}_${gateCounter + 1}`,
          output: target,
          inputs: [muxGate.output, clockSignal!], // [D, CLK] (non-null assertion since we checked at beginning)
        };
        
        gates.push(muxGate);
        gates.push(dffGate);
        
        return gates;
      }
    }
    
    // Genel yapıya uymayan düzensiz if-else için normal işleme dön
    return this.extractSequentialLogic(alwaysBody, clockSignal, gateCounter);
  }
  
  private extractIfStatementsManually(alwaysBody: string, gates: VerilogGate[], gateCounter: number): void {
    console.log("Manually extracting if statements from alwaysBody:", alwaysBody);

    // Find the first 'if' that is not inside another structure (simplistic approach)
    const ifRegex = /\bif\s*\(([\s\S]+?)\)/; // Non-greedy condition match
    const ifMatch = alwaysBody.match(ifRegex);

    if (!ifMatch || ifMatch.index === undefined) {
      // No more top-level if statements in this block
      return;
    }

    const condition = ifMatch[1].trim();
    const afterIfConditionIndex = ifMatch.index + ifMatch[0].length;
    let remainingBody = alwaysBody.substring(afterIfConditionIndex).trim(); // Start processing right after if(...)

    // --- Extract 'then' block/statement ---
    const thenResult = this.extractStatementOrBlock(remainingBody);
    if (!thenResult) {
        console.error(`Could not parse 'then' block/statement for condition: ${condition}`);
        return; // Stop processing this if statement
    }
    const thenContent = thenResult.content;
    remainingBody = thenResult.remaining; // Update remaining body

    // --- Extract 'else' block/statement (if exists) ---
    let elseContent: string | null = null;
    if (remainingBody.startsWith('else')) {
        remainingBody = remainingBody.substring('else'.length).trim(); // Consume 'else' keyword
        const elseResult = this.extractStatementOrBlock(remainingBody);
        if (!elseResult) {
            console.error(`Could not parse 'else' block/statement for condition: ${condition}`);
            // Decide whether to continue without else or stop
        } else {
            elseContent = elseResult.content;
            remainingBody = elseResult.remaining; // Update remaining body after else
        }
    }

    console.log(`Found if: Condition='${condition}'`);
    console.log(`  Then: '${thenContent}'`);
    if (elseContent !== null) {
        console.log(`  Else: '${elseContent}'`);
    }

    // --- Process the blocks/statements to generate gates ---
    const assignmentRegex = /(\w+)\s*=\s*([^;]+);/; // Simple assignment regex

    const thenAssignMatch = thenContent.match(assignmentRegex);
    const elseAssignMatch = elseContent ? elseContent.match(assignmentRegex) : null;

    if (thenAssignMatch && elseAssignMatch && thenAssignMatch[1] === elseAssignMatch[1]) {
      // Both branches assign to the same variable -> MUX
      const target = thenAssignMatch[1];
      const trueSignal = this.cleanSignalName(thenAssignMatch[2]);
      const falseSignal = this.cleanSignalName(elseAssignMatch[2]);
      const controlSignal = this.cleanSignalName(condition); // Assuming condition is simple

      // Check if signals are simple identifiers before creating MUX directly
      if (this.isSimpleIdentifier(controlSignal) && this.isSimpleIdentifier(trueSignal) && this.isSimpleIdentifier(falseSignal)) {
          const muxGate: VerilogGate = {
            type: 'mux2',
            name: `if_mux2_${target}_${gateCounter}`, // Use gateCounter for uniqueness
            output: target,
            inputs: [falseSignal, trueSignal], // [sel=0, sel=1]
            controlSignal: controlSignal,
          };
          console.log("Generated MUX2 for if/else:", JSON.stringify(muxGate));
          gates.push(muxGate);
          gateCounter++; // Increment counter for next potential gate
      } else {
          // Handle complex expressions (requires temporary wires)
          console.warn(`Complex expressions inside if/else branches not fully implemented for MUX generation yet: ${condition}`);
          // Placeholder logic...
      }

    } else if (thenAssignMatch && elseContent === null) {
        // Handle 'if' without 'else'
        console.warn(`Handling 'if' without 'else' for target '${thenAssignMatch[1]}' is not fully implemented (potential latch).`);
        // Placeholder logic...
    } else {
        // Handle assignments to different targets or no assignments
        console.warn(`Assignments in 'if'/'else' branches do not match or are missing for condition: ${condition}`);
    }
  }

  private extractCaseStatements(body: string, gates: VerilogGate[], gateCounter: number): void {
    console.log("Extracting case statements from:", body);

    
    const caseRegex = /case\s*\(\s*([^)]+?)\s*\)([\s\S]*?)endcase/g;
    
    const caseItemRegex = /(?:(\d+'[bB][01xXzZ]+|\d+'[hH][0-9a-fA-FxXzZ]+|\d+'[dD][0-9xXzZ]+|\d+'[oO][0-7xXzZ]+|\d+|default)\s*:)\s*([^;]+);/g;

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
        
        const portOrWire = this.currentModule?.inputs.find(p => p.name === selector) ||
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
          console.error(`Case statement assigns to multiple targets ('${targetOutput}' and '${currentTarget}'). This is not supported.`);
          return; 
        }

        conditions.push({ value: caseValue, result: expression });

        if (caseValue === "default") {
          defaultAssignment = expression;
        } else {
          
          let index: number | null = null;
          try {
            if (caseValue.includes("'b")) {
              index = parseInt(caseValue.split("'b")[1].replace(/[xXzZ_]/g, '0'), 2);
            } else if (caseValue.includes("'h")) {
              index = parseInt(caseValue.split("'h")[1].replace(/[xXzZ_]/g, '0'), 16);
            } else if (caseValue.includes("'d")) {
              index = parseInt(caseValue.split("'d")[1].replace(/[xXzZ_]/g, '0'), 10);
            } else if (caseValue.includes("'o")) {
              index = parseInt(caseValue.split("'o")[1].replace(/[xXzZ_]/g, '0'), 8);
            } else {
              index = parseInt(caseValue, 10);
            }
          } catch (e) {
             console.error(`Could not parse case value '${caseValue}' to integer index.`, e);
          }


          if (index !== null && index >= 0 && index < muxSize) {
            if (muxInputs[index] !== null) {
               console.warn(`Duplicate case index ${index} ('${caseValue}'). Overwriting previous assignment.`);
            }
            muxInputs[index] = expression;
          } else {
             console.warn(`Case value '${caseValue}' (index ${index}) is out of bounds for MUX size ${muxSize}.`);
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
            console.warn(`MUX input at index ${i} is unspecified and no default case found. Assigning '0'.`);
            muxInputs[i] = "'b0"; 
          }
        }
      }


      
      let muxType: string;
      if (muxSize <= 2) muxType = 'mux2';
      else if (muxSize <= 4) muxType = 'mux4';
      
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
        conditions: conditions 
      };

      console.log(`Creating ${muxType} gate:`, muxGate);
      gates.push(muxGate);
      gateCounter += 100; 
    }
  }
  private extractAndProcessAssignments(body: string): VerilogGate[] {
    const assignRegex =
      /assign\s+(\w+(?:\[\d+:\d+\]|\[\d+\])?)\s*=\s*([\w\s&|~^()\[\]<>!?:+\-*\/]+);/g;
    const gates: VerilogGate[] = [];
    let match;
    let gateCounter = 0;

    while ((match = assignRegex.exec(body)) !== null) {
      const [, outputRaw, expression] = match;

      
      const output = outputRaw.replace(/\[.*\]/, "");
      const trimmedExpr = expression.trim();

      
      if (this.isSimpleExpression(trimmedExpr)) {
        this.processSimpleExpression(trimmedExpr, output, gates);
        continue;
      }

      
      if (trimmedExpr.includes("(")) {
        this.processParenthesisExpression(trimmedExpr, output, gates, gateCounter);
        gateCounter += this.countOperators(trimmedExpr);
        continue;
      }

      
      if (trimmedExpr.includes("?") && trimmedExpr.includes(":")) {
        this.processTernaryExpression(trimmedExpr, output, gates, gateCounter);
        gateCounter += 1;
        continue;
      }

      
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
    }
    
    else if (expr.includes("|") && !expr.includes("&") && !expr.includes("^")) {
      const inputs = expr.split("|").map(s => this.cleanSignalName(s));
      gates.push({
        type: "or",
        name: `assign_${output}`,
        output,
        inputs,
      });
    }
    
    else if (expr.includes("^") && !expr.includes("&") && !expr.includes("|")) {
      const inputs = expr.split("^").map(s => this.cleanSignalName(s));
      gates.push({
        type: "xor",
        name: `assign_${output}`,
        output,
        inputs,
      });
    }
    
    else if (
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

      
      if (this.isSimpleExpression(innerExpr)) {
        this.processSimpleExpression(innerExpr, tempOutput, gates);
      } else {
        
        this.processComplexExpression(innerExpr, tempOutput, gates, gateCounter + index + 10);
      }

      
      processedExpr = processedExpr.replace(parenthesis, tempOutput);
    });

    
    if (this.isSimpleExpression(processedExpr)) {
      this.processSimpleExpression(processedExpr, output, gates);
    } else {
      this.processComplexExpression(processedExpr, output, gates, gateCounter + parentheses.length);
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
      return; // Hatalı ifadeyi işlemeyi durdur
  }

  const [condition, trueExpr, falseExpr] = parts;

  const cleanCondition = this.cleanSignalName(condition);
  const cleanTrueExpr = this.cleanSignalName(trueExpr);
  const cleanFalseExpr = this.cleanSignalName(falseExpr);

  // --- BASİT DURUM DÜZELTMESİ ---
  if (this.isSimpleIdentifier(condition) && this.isSimpleIdentifier(trueExpr) && this.isSimpleIdentifier(falseExpr)) {
    // MUX kapısını oluştur
    const muxGate: VerilogGate = { // Tip tanımını ekle
      type: "mux2",
      name: `assign_mux2_${output}_${gateCounter}`, // Daha belirgin isim
      output: output,
      // MUX2 girişleri: [select=0, select=1]
      inputs: [cleanTrueExpr, cleanFalseExpr], // Doğru sıra: false, true
      // Kontrol sinyalini ayrı özelliğe ata
      controlSignal: cleanCondition,
    };
    console.log("Created MUX2 directly (simple):", JSON.stringify(muxGate)); // Log ekle
    gates.push(muxGate);
    return; // Basit durum işlendi, fonksiyondan çık
  }
  // --- BASİT DURUM DÜZELTMESİ SONU ---

  // --- Karmaşık İfadeler Durumu (Önceki düzeltme burada geçerli olmalı) ---
  let finalConditionSignal = cleanCondition;
  let finalTrueSignal = cleanTrueExpr;
  let finalFalseSignal = cleanFalseExpr;
  let tempGateCounter = gateCounter + 1; // Geçici kapılar için sayaç

  // Koşul ifadesini işle (karmaşıksa)
  if (!this.isSimpleIdentifier(condition)) {
      finalConditionSignal = `_temp_cond_${gateCounter}`;
      console.log(`Processing complex condition: ${condition} -> ${finalConditionSignal}`);
      // processComplexExpression veya processParenthesisExpression çağrılabilir
      if (condition.includes('(')) {
          this.processParenthesisExpression(condition, finalConditionSignal, gates, tempGateCounter);
      } else {
          this.processComplexExpression(condition, finalConditionSignal, gates, tempGateCounter);
      }
      tempGateCounter += this.countOperators(condition) + 1; // Sayaç artırımı
  }

  // True ifadesini işle (karmaşıksa)
  if (!this.isSimpleIdentifier(trueExpr)) {
      finalTrueSignal = `_temp_true_${gateCounter}`;
      console.log(`Processing complex true expression: ${trueExpr} -> ${finalTrueSignal}`);
      if (trueExpr.includes('(')) {
          this.processParenthesisExpression(trueExpr, finalTrueSignal, gates, tempGateCounter);
      } else {
          this.processComplexExpression(trueExpr, finalTrueSignal, gates, tempGateCounter);
      }
      tempGateCounter += this.countOperators(trueExpr) + 1;
  }

  // False ifadesini işle (karmaşıksa)
  if (!this.isSimpleIdentifier(falseExpr)) {
      finalFalseSignal = `_temp_false_${gateCounter}`;
       console.log(`Processing complex false expression: ${falseExpr} -> ${finalFalseSignal}`);
      if (falseExpr.includes('(')) {
          this.processParenthesisExpression(falseExpr, finalFalseSignal, gates, tempGateCounter);
      } else {
          this.processComplexExpression(falseExpr, finalFalseSignal, gates, tempGateCounter);
      }
      // tempGateCounter += this.countOperators(falseExpr) + 1; // Sonraki adım yoksa artırmaya gerek yok
  }

  // Son MUX kapısını oluştur (geçici veya orijinal sinyallerle)
  const finalMuxGate: VerilogGate = { // Tip tanımını ekle
    type: "mux2",
    name: `assign_mux2_${output}_${gateCounter}`, // Ana kapı ismi
    output: output,
    // MUX2 girişleri: [select=0, select=1]
    inputs: [finalTrueSignal, finalFalseSignal], // Doğru sıra
    // Kontrol sinyalini ayrı özelliğe ata
    controlSignal: finalConditionSignal,
  };
  console.log(`Created final MUX2 for ternary (complex):`, JSON.stringify(finalMuxGate)); // Log ekle
  gates.push(finalMuxGate);
  // --- Karmaşık Durum Sonu ---
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
    const beginKeyword = 'begin';
    const endKeyword = 'end';
    let inBegin = false; // Track if we are inside the initial 'begin'

    // Find the start of the block content
    while(currentIndex < text.length && /\s/.test(text[currentIndex])) {
        currentIndex++;
    }
    if (text.substring(currentIndex, currentIndex + beginKeyword.length) === beginKeyword) {
        currentIndex += beginKeyword.length;
        balance = 1; // Start balance at 1 since we are inside the 'begin'
        inBegin = true;
    } else {
        // If not starting with begin, we can't find a matching end for it
        return -1;
    }


    while (currentIndex < text.length) {
      // Check for nested 'begin'
      if (text.substring(currentIndex, currentIndex + beginKeyword.length) === beginKeyword) {
        balance++;
        currentIndex += beginKeyword.length;
      // Check for 'end'
      } else if (text.substring(currentIndex, currentIndex + endKeyword.length) === endKeyword) {
        balance--;
        if (balance === 0 && inBegin) { // Found the matching end for the initial 'begin'
          return currentIndex + endKeyword.length; // Return position *after* 'end'
        }
        if (balance < 0) return -1; // Mismatched 'end'
        currentIndex += endKeyword.length;
      } else {
        currentIndex++;
      }
    }
    return -1; // Matching end not found
  }

  // Helper function to extract a block (either begin..end or single statement)
  private extractStatementOrBlock(text: string): { content: string; remaining: string } | null {
      text = text.trim();
      if (!text) return null;

      if (text.startsWith('begin')) {
          const endBlockIndex = this.findMatchingEnd(text, 0); // Start search from beginning
          if (endBlockIndex !== -1) {
              // Extract content between 'begin' and its matching 'end'
              const beginContentStart = text.indexOf('begin') + 'begin'.length;
              const endContentEnd = endBlockIndex - 'end'.length; // Position before 'end' keyword
              const content = text.substring(beginContentStart, endContentEnd).trim();
              const remaining = text.substring(endBlockIndex).trim();
              return { content, remaining };
          } else {
              console.error("Syntax error: Missing 'end' for 'begin' block starting near:", text.substring(0, 50) + "...");
              return null; // Error: missing end
          }
      } else {
          // Assume single statement ending with semicolon
          // Need to handle potential nested structures like case inside single statement? (Keep simple for now)
          let semicolonIndex = -1;
          let parenDepth = 0;
          for(let i = 0; i < text.length; i++) {
              if (text[i] === '(') parenDepth++;
              else if (text[i] === ')') parenDepth--;
              else if (text[i] === ';' && parenDepth === 0) {
                  semicolonIndex = i;
                  break;
              }
          }

          if (semicolonIndex !== -1) {
              const content = text.substring(0, semicolonIndex + 1).trim(); // Include semicolon
              const remaining = text.substring(semicolonIndex + 1).trim();
              return { content, remaining };
          } else {
              console.error("Syntax error: Expected single statement ending with ';' near:", text.substring(0, 50) + "...");
              return null; // Error: missing semicolon or invalid single statement
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
    let currentExpr = expr.trim();
    let tempCounter = 0; 

    
    const generateTempName = (op: string): string => `_temp_${op}_${gateCounter}_${tempCounter++}`;

    
    
    
    const notRegex = /~\s*([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)/g; 
    let tempExpr = currentExpr;
    do {
        currentExpr = tempExpr;
        tempExpr = currentExpr.replace(notRegex, (match, signal) => {
            const tempNotOut = generateTempName('not');
            const cleanSignal = this.cleanSignalName(signal); 
            gates.push({
                type: 'not',
                name: `not_${tempNotOut}`,
                output: tempNotOut,
                inputs: [cleanSignal],
            });
            return tempNotOut; 
        });
    } while (tempExpr !== currentExpr); 

    
    
    
    const andRegex = /([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)\s*&\s*([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)/;
    let andMatch;
    while ((andMatch = currentExpr.match(andRegex)) !== null) {
        const tempAndOut = generateTempName('and');
        
        
        const input1 = this.cleanSignalName(andMatch[1]);
        const input2 = this.cleanSignalName(andMatch[2]);
        gates.push({
            type: 'and',
            name: `and_${tempAndOut}`,
            output: tempAndOut,
            inputs: [input1, input2],
        });
        
        currentExpr = currentExpr.replace(andMatch[0], tempAndOut);
    }

    
    const xorRegex = /([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)\s*\^\s*([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)/;
    let xorMatch;
    while ((xorMatch = currentExpr.match(xorRegex)) !== null) {
        const tempXorOut = generateTempName('xor');
        const input1 = this.cleanSignalName(xorMatch[1]);
        const input2 = this.cleanSignalName(xorMatch[2]);
        gates.push({
            type: 'xor',
            name: `xor_${tempXorOut}`,
            output: tempXorOut,
            inputs: [input1, input2],
        });
        currentExpr = currentExpr.replace(xorMatch[0], tempXorOut);
    }

    
    const orRegex = /([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)\s*\|\s*([a-zA-Z_]\w*(?:\[\d+:\d+\]|\[\d+\])?|_\w+)/;
    let orMatch;
    while ((orMatch = currentExpr.match(orRegex)) !== null) {
        const tempOrOut = generateTempName('or');
        const input1 = this.cleanSignalName(orMatch[1]);
        const input2 = this.cleanSignalName(orMatch[2]);
        gates.push({
            type: 'or',
            name: `or_${tempOrOut}`,
            output: tempOrOut,
            inputs: [input1, input2],
        });
        currentExpr = currentExpr.replace(orMatch[0], tempOrOut);
    }

    
    
    const finalSource = this.cleanSignalName(currentExpr);

    
    if (finalSource !== output) {
        
        
        
        
        
        gates.push({
            type: 'buf', 
            name: `buf_assign_${output}`, 
            output: output,
            inputs: [finalSource],
        });
        console.log(`Assigning final result '${finalSource}' to output '${output}' via buffer.`);
    } else {
        
        console.log(`Expression simplified directly to the output name: ${output}. No final gate needed.`);
    }
  }


  /**
   * Sinyal adındaki boşluk ve bit aralıklarını temizler
   */
  private cleanSignalName(name: string): string {
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
