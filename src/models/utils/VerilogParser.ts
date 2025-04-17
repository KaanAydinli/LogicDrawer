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
  controlSignal?: string; // Mux için seçim sinyali
  conditions?: {value: string, result: string}[]; // Case koşulları
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

        const gates = this.extractGates(body);

        const safeInputs = inputs || [];
        const safeOutputs = outputs || [];
        const safeWires = wires || [];

        const allSignalNames = [
          ...safeInputs.map(p => p.name),
          ...safeOutputs.map(p => p.name),
          ...safeWires.map(p => p.name),
        ];

        this.currentModule = {
          name: moduleName,
          inputs: safeInputs,
          outputs: safeOutputs,
          wires: safeWires,
          gates: gates || [],
        };

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

  private validateWireConnections(gates: VerilogGate[], allSignals: string[]): void {
    const wireOutputMap: Record<string, string> = {};

    for (const gate of gates) {
      const outputNet = gate.output;

      if (!outputNet) {
        throw new Error(`Gate ${gate.name} has no output defined`);
      }

      if (outputNet in wireOutputMap) {
        throw new Error(
          `Signal '${outputNet}' is driven by multiple gates (${wireOutputMap[outputNet]} and ${gate.type}). Each wire can only have one driver.`
        );
      }

      wireOutputMap[outputNet] = gate.type;
    }
  }

  private validateGateConnections(gates: VerilogGate[], allSignals: string[]): void {
    for (const gate of gates) {
      if (!gate.output || !allSignals.includes(gate.output)) {
        throw new Error(`Gate ${gate.name} output '${gate.output}' is not a declared signal`);
      }

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
    console.log("Extracting ports and wires from Verilog code...");
    const inputRegex =
      /input\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|\s+(?:output|inout|wire|reg|endmodule)\b|$)/g;
    const outputRegex =
      /output\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|\s+(?:input|inout|wire|reg|endmodule)\b|$)/g;
    const wireRegex = /wire\s+(?:(\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+)?([\w\s,\[\]:]+?)(?=\s*;|$)/g;

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
      const [, initialBitRange, initialMsbStr, initialLsbStr, identifiers] = match;

      if (!identifiers || identifiers.trim() === "") {
        continue;
      }

      const defaultMsb = initialMsbStr ? parseInt(initialMsbStr, 10) : undefined;
      const defaultLsb = initialLsbStr ? parseInt(initialLsbStr, 10) : undefined;
      const defaultBitWidth =
        defaultMsb !== undefined && defaultLsb !== undefined
          ? Math.abs(defaultMsb - defaultLsb) + 1
          : undefined;

      const parts = identifiers
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      let applyDefaultBitWidth = true;

      for (const part of parts) {
        const bitRangeMatch = part.match(/^\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])\s+(\w+)$/);

        if (bitRangeMatch) {
          const [, msbStr, lsbStr, name] = bitRangeMatch;
          const msb = parseInt(msbStr, 10);
          const lsb = parseInt(lsbStr, 10);
          const bitWidth = Math.abs(msb - lsb) + 1;

          results.push({
            name,
            bitWidth,
            msb,
            lsb,
          });
        } else if (part.match(/^\s*\w+\s*$/)) {
          if (parts.indexOf(part) > 0 && initialBitRange && !initialBitRange.includes(part)) {
            results.push({
              name: part,
              bitWidth: undefined,
              msb: undefined,
              lsb: undefined,
            });
          } else {
            results.push({
              name: part,
              bitWidth: defaultBitWidth,
              msb: defaultMsb,
              lsb: defaultLsb,
            });
          }
        } else {
          const individualBitRangeMatch = part.match(/^\s*\[\s*(\d+)\s*:\s*(\d+)\s*\](\w+)$/);
          if (individualBitRangeMatch) {
            const [, msbStr, lsbStr, name] = individualBitRangeMatch;
            const msb = parseInt(msbStr, 10);
            const lsb = parseInt(lsbStr, 10);
            const bitWidth = Math.abs(msb - lsb) + 1;

            results.push({
              name,
              bitWidth,
              msb,
              lsb,
            });
          }
        }
      }
    }

    return results;
  }

  private extractGates(body: string): VerilogGate[] {
    
    const basicGates = this.extractBasicGates(body);
    
    
    const assignGates = this.extractAndProcessAssignments(body);

    const controlStructureGates = this.extractControlStructures(body);
    
    // Tüm kapıları birleştir
    return [...basicGates, ...assignGates, ...controlStructureGates];
  }
  
  private extractControlStructures(body: string): VerilogGate[] {
    console.log("Control structures extraction from body:", body);
    const gates: VerilogGate[] = [];
    let gateCounter = 0;
  
    // Düzeltilmiş alwaysRegex - İçeriği greedy olarak yakala (*)
    const alwaysRegex = /always\s*@\s*\(\s*([^)]*?)\s*\)\s*begin([\s\S]*)end\b/g; // [\s\S]*? yerine [\s\S]*
    let alwaysMatch;
  
    while ((alwaysMatch = alwaysRegex.exec(body)) !== null) {
      const sensitivity = alwaysMatch[1].trim();
      // alwaysBody: begin ve end arasındaki içerik
      const alwaysBody = alwaysMatch[2].trim();
  
      console.log("Found always block with sensitivity:", sensitivity);
      console.log("Always body:", alwaysBody); // Bu çıktının artık tam olması lazım
      console.log("Full always match:", alwaysMatch[0]); // Tam eşleşmeyi kontrol et
  
      // extractIfStatementsManually metoduna doğru alwaysBody'yi geçirelim
      this.extractIfStatementsManually(alwaysBody, gates, gateCounter);
      gateCounter += 100;
  
      // Case kontrolü normal devam edebilir
      this.extractCaseStatements(alwaysBody, gates, gateCounter);
      gateCounter += 100;
    }
  
    console.log("Extracted gates from control structures:", gates);
    return gates;
  }

  private extractIfStatementsManually(alwaysBody: string, gates: VerilogGate[], gateCounter: number): void {
    console.log("Manually extracting if statements from alwaysBody:", alwaysBody);
  
    // Regex'leri alwaysBody üzerinde çalışacak şekilde ayarla
    // if (koşul)
    const ifConditionMatch = alwaysBody.match(/if\s*\(\s*([^)]+?)\s*\)/);
    if (!ifConditionMatch) {
      console.log("No if condition found in alwaysBody");
      return;
    }
    const condition = ifConditionMatch[1].trim();
    console.log("Found if condition:", condition);
  
    // Then bloğu: if(...) begin ... end
    // [\s\S]*? kullanarak tembel eşleşme yapalım
    const thenMatch = alwaysBody.match(/if\s*\([^)]+?\)\s*begin\s*([\s\S]*?)\s*end/);
    if (!thenMatch) {
      console.log("No then block found (begin...end)");
      // Belki begin/end olmadan tek satırlık if? (Şimdilik kapsam dışı)
      return;
    }
    const thenBody = thenMatch[1].trim();
    console.log("Found then body:", thenBody);
  
    // Else bloğu: end else begin ... end
    const elseMatch = alwaysBody.match(/end\s*else\s*begin\s*([\s\S]*?)\s*end/);
    const elseBody = elseMatch ? elseMatch[1].trim() : ''; // Else bloğu opsiyonel
    console.log("Found else body:", elseBody);
  
    // Then ve else bloğundaki atamaları bul
    const thenAssignments = thenBody.match(/(\w+)\s*=\s*([^;]+);/g) || [];
    const elseAssignments = elseBody.match(/(\w+)\s*=\s*([^;]+);/g) || [];
  
    console.log("Then assignments:", thenAssignments);
    console.log("Else assignments:", elseAssignments);
  
    let ifCounter = 0;
  
    // Then bloğundaki atamaları işle
    for (const thenAssign of thenAssignments) {
      const thenAssignMatch = thenAssign.match(/(\w+)\s*=\s*([^;]+)/);
      if (!thenAssignMatch) continue;
  
      const target = thenAssignMatch[1].trim();
      const thenExpression = thenAssignMatch[2].trim();
  
      // Else bloğunda aynı hedef var mı bul
      let elseExpression = '';
      for (const elseAssign of elseAssignments) {
        // Dinamik regex oluştururken özel karakterlere dikkat et
        const elseAssignMatch = elseAssign.match(new RegExp(`^\\s*${target}\\s*=\\s*([^;]+)`));
        if (elseAssignMatch) {
          elseExpression = elseAssignMatch[1].trim();
          console.log(`Found matching else assignment for ${target}: ${elseExpression}`);
          break;
        }
      }
  
      // MUX2 kapısı oluştur
      const muxGate: VerilogGate = {
        type: 'mux2',
        name: `if_mux_${gateCounter + ifCounter}`,
        output: target,
        // MUX2 giriş sırası: [false_değeri, true_değeri]
        inputs: elseExpression ?
          [elseExpression, thenExpression] :
          ['0', thenExpression], // Else yoksa varsayılan olarak 0 kullan
        controlSignal: condition
      };
  
      console.log("Creating MUX2 gate:", muxGate);
      gates.push(muxGate);
  
      ifCounter++;
    }
  }
  private extractCaseStatements(body: string, gates: VerilogGate[], gateCounter: number): void {
    console.log("Extracting case statements from:", body);

    // case (selector) ... endcase
    const caseRegex = /case\s*\(\s*([^)]+?)\s*\)([\s\S]*?)endcase/g;
    // case_item: assignment; (default dahil)
    const caseItemRegex = /(?:(\d+'[bB][01xXzZ]+|\d+'[hH][0-9a-fA-FxXzZ]+|\d+'[dD][0-9xXzZ]+|\d+'[oO][0-7xXzZ]+|\d+|default)\s*:)\s*([^;]+);/g;

    let caseMatch;
    while ((caseMatch = caseRegex.exec(body)) !== null) {
      const selector = caseMatch[1].trim();
      const caseBody = caseMatch[2];
      console.log("Found case statement with selector:", selector);
      console.log("Case body:", caseBody);

      // Seçici sinyalin bit genişliğini tahmin etmeye çalış (varsayılan 1 bit)
      // TODO: Daha sağlam bit genişliği tespiti için port/wire bilgilerini kullan
      let selectorBitWidth = 1;
      const selectorWidthMatch = selector.match(/\[(\d+):(\d+)\]/);
      if (selectorWidthMatch) {
        const msb = parseInt(selectorWidthMatch[1]);
        const lsb = parseInt(selectorWidthMatch[2]);
        selectorBitWidth = Math.abs(msb - lsb) + 1;
      } else {
        // Port/wire listesinden bulmayı dene (this.currentModule kullanarak)
        const portOrWire = this.currentModule?.inputs.find(p => p.name === selector) ||
                           this.currentModule?.wires.find(w => w.name === selector);
        if (portOrWire?.bitWidth) {
          selectorBitWidth = portOrWire.bitWidth;
        } else {
           console.warn(`Selector '${selector}' bit width could not be determined, assuming 1.`);
        }
      }


      const muxSize = 2 ** selectorBitWidth;
      const muxInputs: (string | null)[] = new Array(muxSize).fill(null); // Başlangıçta null ile doldur
      let defaultAssignment: string | null = null;
      const conditions: { value: string; result: string }[] = [];
      let targetOutput: string | null = null;

      let caseItemMatch;
      while ((caseItemMatch = caseItemRegex.exec(caseBody)) !== null) {
        const caseValue = caseItemMatch[1].trim();
        const assignment = caseItemMatch[2].trim();
        console.log(`Found case item: ${caseValue} -> ${assignment}`);

        // Atamayı ayrıştır (örn: out = a)
        const assignmentMatch = assignment.match(/(\w+)\s*=\s*(.+)/);
        if (!assignmentMatch) {
          console.warn(`Could not parse assignment: ${assignment}`);
          continue;
        }
        const currentTarget = assignmentMatch[1].trim();
        const expression = assignmentMatch[2].trim();

        // Tüm case kollarının aynı hedefi atadığından emin ol (basitleştirme)
        if (targetOutput === null) {
          targetOutput = currentTarget;
        } else if (targetOutput !== currentTarget) {
          console.error(`Case statement assigns to multiple targets ('${targetOutput}' and '${currentTarget}'). This is not supported.`);
          return; // Desteklenmeyen durum
        }

        conditions.push({ value: caseValue, result: expression });

        if (caseValue === "default") {
          defaultAssignment = expression;
        } else {
          // Case değerini integer'a çevir
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

      // Default değeri atanmamış girişlere uygula
      if (defaultAssignment !== null) {
        for (let i = 0; i < muxSize; i++) {
          if (muxInputs[i] === null) {
            muxInputs[i] = defaultAssignment;
          }
        }
      } else {
         // Default yoksa ve boşluklar varsa, varsayılan olarak '0' ata
         for (let i = 0; i < muxSize; i++) {
          if (muxInputs[i] === null) {
            console.warn(`MUX input at index ${i} is unspecified and no default case found. Assigning '0'.`);
            muxInputs[i] = "'b0"; // Veya 1'b0
          }
        }
      }


      // MUX kapısı oluştur
      let muxType: string;
      if (muxSize <= 2) muxType = 'mux2';
      else if (muxSize <= 4) muxType = 'mux4';
      // else if (muxSize <= 8) muxType = 'mux8'; // Gerekirse eklenebilir
      else {
        console.error(`MUX size ${muxSize} is too large or unsupported.`);
        continue;
      }

      console.log(`Creating MUX for target ${targetOutput} with ${muxSize} inputs.`);

      const muxGate: VerilogGate = {
        type: muxType,
        name: `case_${muxType}_${gateCounter}`,
        output: targetOutput,
        // DİKKAT: MUX giriş sırası önemli! [input0, input1, input2, input3]
        inputs: muxInputs.filter(input => input !== null) as string[], // Null olmayanları al
        controlSignal: selector,
        conditions: conditions // Koşulları da ekleyelim (Converter'da yardımcı olabilir)
      };

      console.log(`Creating ${muxType} gate:`, muxGate);
      gates.push(muxGate);
      gateCounter += 100; // Sonraki kapı için sayacı artır
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
  if (parts.length !== 3) return;

  const [condition, trueExpr, falseExpr] = parts;

  
  const cleanCondition = this.cleanSignalName(condition);
  const cleanTrueExpr = this.cleanSignalName(trueExpr);
  const cleanFalseExpr = this.cleanSignalName(falseExpr);
  
  
  if (this.isSimpleIdentifier(condition) && this.isSimpleIdentifier(trueExpr) && this.isSimpleIdentifier(falseExpr)) {
    
    gates.push({
      type: "mux2",
      name: `assign_ternary_${output}`,
      output,
      inputs: [cleanTrueExpr, cleanFalseExpr, cleanCondition], 
    });
    return;
  }

  
  const tempCondition = `_temp_cond_${gateCounter}`;
  const tempTrue = `_temp_true_${gateCounter}`;
  const tempFalse = `_temp_false_${gateCounter}`;

  
  if (this.isSimpleExpression(condition)) {
    this.processSimpleExpression(condition, tempCondition, gates);
  } else {
    this.processComplexExpression(condition, tempCondition, gates, gateCounter + 100);
  }

  
  if (this.isSimpleExpression(trueExpr)) {
    this.processSimpleExpression(trueExpr, tempTrue, gates);
  } else {
    this.processComplexExpression(trueExpr, tempTrue, gates, gateCounter + 200);
  }

  
  if (this.isSimpleExpression(falseExpr)) {
    this.processSimpleExpression(falseExpr, tempFalse, gates);
  } else {
    this.processComplexExpression(falseExpr, tempFalse, gates, gateCounter + 300);
  }

  
  gates.push({
    type: "mux2",
    name: `assign_ternary_${output}`,
    output,
    inputs: [tempTrue, tempFalse, tempCondition], 
  });
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

  /**
   * Karmaşık ifadeleri işler (operatör önceliğine göre)
   */
  private processComplexExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    
    let processedExpr = expr;

    
    const notMatch = processedExpr.match(/~(\w+)/g);
    if (notMatch) {
      notMatch.forEach((match, index) => {
        const input = this.cleanSignalName(match.substring(1));
        const tempOutput = `_temp_not_${gateCounter + index}`;

        gates.push({
          type: "not",
          name: `assign_not_${gateCounter + index}`,
          output: tempOutput,
          inputs: [input],
        });

        processedExpr = processedExpr.replace(match, tempOutput);
      });
    }

    
    if (processedExpr.includes("&")) {
      const tempOutput = `_temp_and_${gateCounter}`;
      const andParts = processedExpr.split("&").map(s => this.cleanSignalName(s));

      gates.push({
        type: "and",
        name: `assign_and_${gateCounter}`,
        output: tempOutput,
        inputs: andParts,
      });

      processedExpr = tempOutput;
    }

    
    if (processedExpr.includes("^")) {
      const tempOutput = `_temp_xor_${gateCounter}`;
      const xorParts = processedExpr.split("^").map(s => this.cleanSignalName(s));

      gates.push({
        type: "xor",
        name: `assign_xor_${gateCounter}`,
        output: tempOutput,
        inputs: xorParts,
      });

      processedExpr = tempOutput;
    }

    
    if (processedExpr.includes("|")) {
      const orParts = processedExpr.split("|").map(s => this.cleanSignalName(s));

      gates.push({
        type: "or",
        name: `assign_or_${gateCounter}`,
        output,
        inputs: orParts,
      });
    } else {
      
      
      if (processedExpr !== expr && processedExpr !== output) {
        gates.push({
          type: "buf",
          name: `assign_buf_${gateCounter}`,
          output,
          inputs: [processedExpr],
        });
      }
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
