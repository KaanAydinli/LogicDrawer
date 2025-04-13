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
    // Mevcut gate extraction kodunu koru
    const basicGates = this.extractBasicGates(body);
    
    // Assign ifadelerini parse et
    const assignGates = this.extractAndProcessAssignments(body);
    
    // Tüm kapıları birleştir
    return [...basicGates, ...assignGates];
  }
  private extractAndProcessAssignments(body: string): VerilogGate[] {
    const assignRegex =
      /assign\s+(\w+(?:\[\d+:\d+\]|\[\d+\])?)\s*=\s*([\w\s&|~^()\[\]<>!?:+\-*\/]+);/g;
    const gates: VerilogGate[] = [];
    let match;
    let gateCounter = 0;

    while ((match = assignRegex.exec(body)) !== null) {
      const [, outputRaw, expression] = match;

      // Çıkış sinyali adını temizle ([x:y] gibi bit aralıklarını kaldır)
      const output = outputRaw.replace(/\[.*\]/, "");
      const trimmedExpr = expression.trim();

      // 1. Basit tek operatörlü ifadeler
      if (this.isSimpleExpression(trimmedExpr)) {
        this.processSimpleExpression(trimmedExpr, output, gates);
        continue;
      }

      // 2. Parantezli ifadeler
      if (trimmedExpr.includes("(")) {
        this.processParenthesisExpression(trimmedExpr, output, gates, gateCounter);
        gateCounter += this.countOperators(trimmedExpr);
        continue;
      }

      // 3. Ternary operatör
      if (trimmedExpr.includes("?") && trimmedExpr.includes(":")) {
        this.processTernaryExpression(trimmedExpr, output, gates, gateCounter);
        gateCounter += 1;
        continue;
      }

      // 4. Karışık operatörler için öncelik sırasında işle
      this.processComplexExpression(trimmedExpr, output, gates, gateCounter);
      gateCounter += this.countOperators(trimmedExpr);
    }

    return gates;
  }

  /**
   * Basit bir ifade mi kontrol eder (tek operatör içeren)
   */
  private isSimpleExpression(expr: string): boolean {
    // Tek bir operatör içeren ifadeler
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
    // AND işlemi
    if (expr.includes("&") && !expr.includes("|") && !expr.includes("^")) {
      const inputs = expr.split("&").map(s => this.cleanSignalName(s));
      gates.push({
        type: "and",
        name: `assign_${output}`,
        output,
        inputs,
      });
    }
    // OR işlemi
    else if (expr.includes("|") && !expr.includes("&") && !expr.includes("^")) {
      const inputs = expr.split("|").map(s => this.cleanSignalName(s));
      gates.push({
        type: "or",
        name: `assign_${output}`,
        output,
        inputs,
      });
    }
    // XOR işlemi
    else if (expr.includes("^") && !expr.includes("&") && !expr.includes("|")) {
      const inputs = expr.split("^").map(s => this.cleanSignalName(s));
      gates.push({
        type: "xor",
        name: `assign_${output}`,
        output,
        inputs,
      });
    }
    // NOT işlemi
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

  /**
   * Parantez içi ifadeleri işler
   */
  private processParenthesisExpression(
    expr: string,
    output: string,
    gates: VerilogGate[],
    gateCounter: number
  ): void {
    // Parantez içi ifadeleri parçala ve işle
    const parentheses = this.extractParenthesisGroups(expr);
    let processedExpr = expr;
    const tempWires: string[] = [];

    // Her parantez grubunu ayrı bir ara kapı olarak işle
    parentheses.forEach((parenthesis, index) => {
      const tempOutput = `_temp_wire_${gateCounter + index}`;
      tempWires.push(tempOutput);

      // Parantez içini temizle
      const innerExpr = parenthesis.substring(1, parenthesis.length - 1);

      // Parantez içi ifadeyi işle
      if (this.isSimpleExpression(innerExpr)) {
        this.processSimpleExpression(innerExpr, tempOutput, gates);
      } else {
        // Daha karmaşık parantez içi ifadeler için
        this.processComplexExpression(innerExpr, tempOutput, gates, gateCounter + index + 10);
      }

      // Ana ifadede parantezi temp wire ile değiştir
      processedExpr = processedExpr.replace(parenthesis, tempOutput);
    });

    // Parantezler çözüldükten sonraki ifadeyi işle
    if (this.isSimpleExpression(processedExpr)) {
      this.processSimpleExpression(processedExpr, output, gates);
    } else {
      this.processComplexExpression(processedExpr, output, gates, gateCounter + parentheses.length);
    }
  }

  /**
   * Parantez gruplarını çıkarır
   */
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

  // Temiz sinyal adları - bit genişliğini kaldır
  const cleanCondition = this.cleanSignalName(condition);
  const cleanTrueExpr = this.cleanSignalName(trueExpr);
  const cleanFalseExpr = this.cleanSignalName(falseExpr);
  
  // Basit durumlar için doğrudan bağlantı - ara sinyalleri azalt
  if (this.isSimpleIdentifier(condition) && this.isSimpleIdentifier(trueExpr) && this.isSimpleIdentifier(falseExpr)) {
    // Eğer hepsi basit değişkenlerse, doğrudan bağlantı yap
    gates.push({
      type: "mux2",
      name: `assign_ternary_${output}`,
      output,
      inputs: [cleanTrueExpr, cleanFalseExpr, cleanCondition], // [a, b, sel] sırası önemli
    });
    return;
  }

  // Karmaşık ifadeler için ara sinyaller oluştur
  const tempCondition = `_temp_cond_${gateCounter}`;
  const tempTrue = `_temp_true_${gateCounter}`;
  const tempFalse = `_temp_false_${gateCounter}`;

  // Koşulu işle
  if (this.isSimpleExpression(condition)) {
    this.processSimpleExpression(condition, tempCondition, gates);
  } else {
    this.processComplexExpression(condition, tempCondition, gates, gateCounter + 100);
  }

  // True ifadesini işle
  if (this.isSimpleExpression(trueExpr)) {
    this.processSimpleExpression(trueExpr, tempTrue, gates);
  } else {
    this.processComplexExpression(trueExpr, tempTrue, gates, gateCounter + 200);
  }

  // False ifadesini işle
  if (this.isSimpleExpression(falseExpr)) {
    this.processSimpleExpression(falseExpr, tempFalse, gates);
  } else {
    this.processComplexExpression(falseExpr, tempFalse, gates, gateCounter + 300);
  }

  // MUX2 kapısı oluştur - doğru sırada girişleri bağla
  gates.push({
    type: "mux2",
    name: `assign_ternary_${output}`,
    output,
    inputs: [tempTrue, tempFalse, tempCondition], // [a, b, sel] sırası önemli
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

    // ? ve : operatörlerinin konumunu bul (parantez derinliğini dikkate alarak)
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
    // Operatör önceliği: ~ -> & -> ^ -> |
    let processedExpr = expr;

    // 1. NOT operatörünü işle
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

    // 2. AND operatörünü işle
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

    // 3. XOR operatörünü işle
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

    // 4. OR operatörünü işle
    if (processedExpr.includes("|")) {
      const orParts = processedExpr.split("|").map(s => this.cleanSignalName(s));

      gates.push({
        type: "or",
        name: `assign_or_${gateCounter}`,
        output,
        inputs: orParts,
      });
    } else {
      // Son işlenmiş ifade sonucunu çıkışa bağla
      // Bu kısım, AND veya XOR işlemlerinin sonucu olabilir
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
