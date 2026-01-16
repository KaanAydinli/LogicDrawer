import { Tool, ToolContext } from "./Tool";
import { apiBaseUrl } from "../../services/apiConfig";
import { CircuitBoard } from "../../models/CircuitBoard";
import { KarnaughMap } from "../../models/utils/KarnaughMap";
import { VerilogCircuitConverter } from "../../models/utils/VerilogCircuitConverter";
import { Logger } from "../../utils/logger";

// Tool for extracting Truth Tables from images
export class TruthTableImageTool implements Tool {
  async execute(context: ToolContext): Promise<string> {
    try {
      if (!context.image) {
        return "I need an image of a truth table to analyze. Please upload an image.";
      }

      Logger.log("Processing Truth Table from image...");

      // Use Gemini Vision API to extract the truth table
      const response = await fetch(`${apiBaseUrl}/api/generate/gemini-vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            "Extract the truth table from this image. Return only a JSON object with format: {headers: [column names], rows: [[values in row 1], [values in row 2], ...]}. Only include the actual table data, no explanations.",
          imageData: context.image,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      let extractedTableData;

      try {
        // Try to parse the JSON response
        const jsonMatch =
          data.text.match(/```json\s*([\s\S]*?)\s*```/) || data.text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          extractedTableData = JSON.parse(jsonMatch[0].replace(/```json|```/g, "").trim());
        } else {
          // Fallback to manual parsing if JSON extraction fails
          extractedTableData = this.parseTableText(data.text);
        }
      } catch (e) {
        Logger.error("Failed to parse JSON response:", e);
        extractedTableData = this.parseTableText(data.text);
      }

      if (!extractedTableData || !extractedTableData.headers || !extractedTableData.rows) {
        return "I couldn't properly extract a truth table from the image. Please make sure the image shows a clear truth table.";
      }

      // Use improved heuristic and multi-output support
      const { truthTable, inputLabels, outputLabels, outputIndices } =
        this.convertToTruthTableFormat(extractedTableData);
      const { success, createdOutputs } = await this.createCircuitFromTruthTable(
        truthTable,
        inputLabels,
        outputLabels,
        context.circuitBoard,

        outputIndices
      );
      if (success && createdOutputs.length > 0) {
        return `I've successfully created circuits for outputs: ${createdOutputs.join(", ")}. You can see them on the canvas now.`;
      } else {
        return "I recognized a truth table in your image, but couldn't create a circuit from it. The table might be complex or have an unusual format.";
      }
    } catch (error) {
      Logger.error("Error in TruthTableImageTool:", error);
      return "I encountered an error while processing your truth table image. Please try with a clearer image.";
    }
  }

  // Parse text table when JSON parsing fails
  private parseTableText(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split("\n").filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("Not enough data to form a table");
    }

    // Try to detect if the table is space-separated or comma-separated
    const delimiter = lines[0].includes(",") ? "," : /\s{2,}|\t/;

    // Extract headers from the first line
    const headers = lines[0]
      .split(delimiter)
      .map(h => h.trim())
      .filter(h => h);

    // Extract rows
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]
        .split(delimiter)
        .map(cell => cell.trim())
        .filter(cell => cell);
      if (row.length > 0) {
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  // Convert parsed data to the format expected by our TruthTableManager
  private convertToTruthTableFormat(data: { headers: string[]; rows: string[][] }): {
    truthTable: { inputs: boolean[]; outputs: boolean[] }[];
    inputLabels: string[];
    outputLabels: string[];
    inputIndices: number[];
    outputIndices: number[];
  } {
    const headers = data.headers;
    const rows = data.rows;
    // Heuristic for output detection
    const outputKeywords = ["out", "output", "f", "y", "z", "q", "s"];
    const outputIndices: number[] = [];
    // 1. Keyword-based detection
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (
        outputKeywords.some(k => lower.includes(k)) ||
        /^f\\d*$/i.test(h) // F, F1, F2, F3...
      ) {
        outputIndices.push(i);
      }
    });
    // 2. If no outputs found, try to find columns with only 0/1 values (likely outputs)
    if (outputIndices.length === 0) {
      for (let i = 0; i < headers.length; i++) {
        if (rows.every(row => row[i] === "0" || row[i] === "1")) {
          outputIndices.push(i);
        }
      }
    }
    // 3. If still ambiguous, fallback to last column as output
    if (outputIndices.length === 0 && headers.length > 1) {
      outputIndices.push(headers.length - 1);
    }
    // Inputs are all columns not in outputs
    const inputIndices = headers.map((_, i) => i).filter(i => !outputIndices.includes(i));
    const inputLabels = inputIndices.map(i => headers[i]);
    const outputLabels = outputIndices.map(i => headers[i]);
    // Convert rows to boolean arrays
    const truthTable: { inputs: boolean[]; outputs: boolean[] }[] = [];
    for (const row of rows) {
      if (row.length >= headers.length) {
        const inputs = inputIndices.map(i => this.parseBooleanValue(row[i]));
        const outputs = outputIndices.map(i => this.parseBooleanValue(row[i]));
        truthTable.push({ inputs, outputs });
      }
    }
    return { truthTable, inputLabels, outputLabels, inputIndices, outputIndices };
  }

  // Parse various representations of boolean values
  private parseBooleanValue(value: string): boolean {
    const val = value.trim().toLowerCase();
    return val === "1" || val === "true" || val === "t" || val === "yes" || val === "y";
  }

  // Create a circuit from the extracted truth table data
  private async createCircuitFromTruthTable(
    truthTable: { inputs: boolean[]; outputs: boolean[] }[],
    inputLabels: string[],
    outputLabels: string[],
    circuitBoard: CircuitBoard,

    outputIndices: number[]
  ): Promise<{ success: boolean; createdOutputs: string[] }> {
    const createdOutputs: string[] = [];
    let anySuccess = false;
    const expressions: string[] = [];
    circuitBoard.clearCircuit();
    // For each output, generate minimal boolean expression
    for (let outIdx = 0; outIdx < outputIndices.length; outIdx++) {
      const perOutputTruthTable = truthTable.map(row => ({
        inputs: row.inputs,
        outputs: [row.outputs[outIdx]],
      }));
      try {
        const kmap = new KarnaughMap(perOutputTruthTable, inputLabels, [outputLabels[outIdx]]);
        kmap.findMinimalGroups();
        // Get boolean expression in Verilog format
        let expr = "";
        if (typeof (kmap as any).generateBooleanExpression === "function") {
          expr = (kmap as any).generateBooleanExpression();
        } else {
          expr = "0";
        }
        // Replace logical symbols with Verilog equivalents
        expr = expr.replace(/∧/g, "&").replace(/∨/g, "|").replace(/¬/g, "~");
        expressions.push(`assign ${outputLabels[outIdx]} = ${expr};`);
        createdOutputs.push(outputLabels[outIdx]);
        anySuccess = true;
      } catch (err) {
        Logger.error(`Failed to create circuit for output ${outputLabels[outIdx]}:`, err);
      }
    }
    if (anySuccess && expressions.length > 0) {
      // Create a single Verilog module for all outputs, with explicit input/output declarations
      const inputDecls = inputLabels.length > 0 ? `input ${inputLabels.join(", ")};` : "";
      const outputDecls = outputLabels.length > 0 ? `output ${outputLabels.join(", ")};` : "";
      const portList = [...inputLabels, ...outputLabels].join(", ");
      const verilogModule = `module boolean_circuit(${portList});\n${inputDecls}\n${outputDecls}\n${expressions.join("\n")}\nendmodule`;
      // Import this module once
      const converter = new VerilogCircuitConverter(circuitBoard);
      converter.importVerilogCode(verilogModule);
    }
    return { success: anySuccess, createdOutputs };
  }
}
